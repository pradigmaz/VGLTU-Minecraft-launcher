from fastapi import APIRouter, HTTPException, Depends, Path, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models import Instance, File as FileModel, instance_files
from app.schemas import InstanceManifest, FileManifest
from app.utils import get_db, validate_instance_id
from typing import List, Optional
from pydantic import BaseModel
import os

router = APIRouter(prefix="/api/client", tags=["Client"])

# Берем URL хранилища из env или дефолтный (для генерации ссылок)
STORAGE_URL = os.getenv("STORAGE_BASE_URL", "http://localhost:9000/pixellauncher-storage")

class InstanceSummary(BaseModel):
    id: str
    title: str
    mc_version: str
    loader_type: str

class PaginatedInstances(BaseModel):
    items: List[InstanceSummary]
    total: int
    page: int
    page_size: int
    pages: int

@router.get("/instances", response_model=PaginatedInstances)
async def get_instances(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    db: AsyncSession = Depends(get_db)
):
    """Возвращает список доступных сборок для меню лаунчера с пагинацией"""
    # Count total
    count_result = await db.execute(select(func.count(Instance.id)))
    total = count_result.scalar() or 0
    
    # Get page
    offset = (page - 1) * page_size
    result = await db.execute(
        select(Instance).offset(offset).limit(page_size)
    )
    instances = result.scalars().all()
    
    return PaginatedInstances(
        items=[
            InstanceSummary(
                id=i.id,
                title=i.title,
                mc_version=i.mc_version,
                loader_type=i.loader_type
            ) for i in instances
        ],
        total=total,
        page=page,
        page_size=page_size,
        pages=(total + page_size - 1) // page_size if total > 0 else 1
    )

@router.get("/instances/{instance_id}/manifest", response_model=InstanceManifest)
async def get_instance_manifest(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    db: AsyncSession = Depends(get_db)
):
    # 1. Проверяем, существует ли сборка
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalars().first()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    # 2. Делаем JOIN запрос, чтобы получить файлы И их пути установки
    # SELECT files.*, instance_files.path 
    # FROM files 
    # JOIN instance_files ON files.sha256 = instance_files.file_hash 
    # WHERE instance_files.instance_id = :id
    
    stmt = (
        select(FileModel, instance_files.c.path)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
    )
    
    files_result = await db.execute(stmt)
    
    manifest_files = []
    for file_obj, install_path in files_result:
        # Формируем прямую ссылку на скачивание
        # file_obj.s3_path выглядит как "objects/ab/abcdef..."
        download_url = f"{STORAGE_URL}/{file_obj.s3_path}"
        
        manifest_files.append(FileManifest(
            filename=file_obj.filename,
            hash=file_obj.sha256,
            size=file_obj.size,
            path=install_path, # Самое важное: "mods/jei.jar"
            url=download_url
        ))

    return InstanceManifest(
        instance_id=instance_id,
        mc_version=instance.mc_version,
        loader_type=instance.loader_type,
        files=manifest_files
    )
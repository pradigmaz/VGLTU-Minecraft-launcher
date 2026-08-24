import logging

from fastapi import APIRouter, HTTPException, Depends, Path, Query, Request
from fastapi.responses import StreamingResponse
from minio.error import S3Error
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from starlette.background import BackgroundTask
from starlette.concurrency import run_in_threadpool

from app.database import BUCKET_NAME, minio_client
from app.models import Instance, File as FileModel, instance_files, SideType
from app.schemas import InstanceManifest, FileManifest
from app.utils import get_db
from typing import List
from pydantic import BaseModel

router = APIRouter(prefix="/api/client", tags=["Client"])

logger = logging.getLogger(__name__)

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
    count_result = await db.execute(select(func.count(Instance.id)))
    total = count_result.scalar() or 0
    
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
    request: Request,
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Instance).where(Instance.id == instance_id))
    instance = result.scalars().first()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    # === ФИЛЬТРАЦИЯ СТОРОН ===
    stmt = (
        select(FileModel, instance_files.c.path)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
        # ⚠️ КРИТИЧНО: Исключаем файлы, которые только для сервера
        .where(instance_files.c.side.in_([SideType.CLIENT, SideType.BOTH])) 
    )
    
    files_result = await db.execute(stmt)
    
    manifest_files = []
    for file_obj, install_path in files_result:
        download_url = (
            f"{str(request.base_url).rstrip('/')}"
            f"{router.prefix}/instances/{instance_id}/files/{file_obj.sha256}"
        )
        
        manifest_files.append(FileManifest(
            filename=file_obj.filename,
            hash=file_obj.sha256,
            size=file_obj.size,
            path=install_path, 
            url=download_url
        ))

    return InstanceManifest(
        instance_id=instance_id,
        mc_version=instance.mc_version,
        loader_type=instance.loader_type,
        files=manifest_files
    )


def _close_minio_response(response) -> None:
    response.close()
    response.release_conn()


@router.get("/instances/{instance_id}/files/{file_hash}")
async def download_instance_file(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    file_hash: str = Path(..., pattern=r"^[a-f0-9]{64}$", min_length=64, max_length=64),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(FileModel)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
        .where(FileModel.sha256 == file_hash)
        .where(instance_files.c.side.in_([SideType.CLIENT, SideType.BOTH]))
    )
    file_obj = (await db.execute(stmt)).scalars().first()
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")

    try:
        response = await run_in_threadpool(minio_client.get_object, BUCKET_NAME, file_obj.s3_path)
    except S3Error as error:
        logger.warning("Client file %s is absent from object storage: %s", file_hash, error.code)
        raise HTTPException(status_code=404, detail="File not found") from error
    except Exception:
        logger.exception("Unable to retrieve client file %s", file_hash)
        raise HTTPException(status_code=503, detail="Download temporarily unavailable")

    return StreamingResponse(
        response.stream(amt=64 * 1024),
        media_type="application/octet-stream",
        headers={"Content-Length": str(file_obj.size)},
        background=BackgroundTask(_close_minio_response, response),
    )

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Body, Path, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, func, update
from starlette.concurrency import run_in_threadpool
from app.database import async_session_factory, minio_client
from app.models import Instance, File as FileModel, instance_files, User, SideType
from app.utils import calculate_sha256, validate_uploaded_archive, get_current_admin, generate_instance_id, get_db, validate_instance_id, validate_file_path
import rarfile
from app.schemas import AdminInstanceView, FileNode, ConfigUpdateRequest, FileUpdateSide
from app.services.sftp_sync import SFTPSyncService
from typing import List
from pydantic import BaseModel
import zipfile
import io
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])
BUCKET_NAME = os.getenv("MINIO_BUCKET", "launcher-files")

def decode_archive_filename(filename: str, archive_type: str) -> str:
    try:
        if archive_type == 'zip':
            return filename.encode('cp437').decode('cp866')
        else:
            return filename
    except:
        return filename

@router.get("/instances", response_model=List[AdminInstanceView])
async def get_admin_instances(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin) 
):
    stmt = (
        select(Instance, func.count(instance_files.c.file_hash).label("files_count"))
        .outerjoin(instance_files, Instance.id == instance_files.c.instance_id)
        .group_by(Instance.id)
    )
    result = await db.execute(stmt)
    
    return [
        AdminInstanceView(
            id=i.id,
            title=i.title,
            mc_version=i.mc_version,
            files_count=count
        ) for i, count in result
    ]

@router.delete("/instances/{instance_id}")
async def delete_instance(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    cleanup_remote: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    stmt = select(Instance).where(Instance.id == instance_id)
    instance = (await db.execute(stmt)).scalars().first()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    if cleanup_remote:
        try:
            sync_service = SFTPSyncService(db)
            await sync_service.cleanup_instance(instance_id)
        except Exception as e:
            logger.error(f"Remote cleanup failed: {e}")

    await db.execute(
        instance_files.delete().where(instance_files.c.instance_id == instance_id)
    )
    await db.delete(instance)
    
    orphan_stmt = select(FileModel).outerjoin(
        instance_files, FileModel.sha256 == instance_files.c.file_hash
    ).where(instance_files.c.instance_id == None)
    
    orphans = (await db.execute(orphan_stmt)).scalars().all()
    deleted_files_count = 0
    deleted_size_bytes = 0

    for file_obj in orphans:
        try:
            await run_in_threadpool(minio_client.remove_object, BUCKET_NAME, file_obj.s3_path)
        except: pass
        await db.delete(file_obj)
        deleted_files_count += 1
        deleted_size_bytes += file_obj.size

    await db.commit()
    return {"status": "deleted", "gc_stats": {"files": deleted_files_count, "mb": round(deleted_size_bytes/1024/1024, 2)}}
@router.post("/upload-zip")
async def upload_instance_zip(
    file: UploadFile = File(...),
    title: str = Form(...),
    mc_version: str = Form(...),
    loader_type: str = Form("forge"),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    instance_id = generate_instance_id(title, mc_version)
    archive_buffer, archive_type = await validate_uploaded_archive(file)
    
    stmt = select(Instance).where(Instance.id == instance_id)
    if not (await db.execute(stmt)).scalars().first():
        db.add(Instance(id=instance_id, title=title, mc_version=mc_version, loader_type=loader_type))
    else:
        await db.execute(instance_files.delete().where(instance_files.c.instance_id == instance_id))
    
    await db.flush()

    processed = 0
    skipped = 0
    uploaded_paths = []

    try:
        archive_obj = zipfile.ZipFile(archive_buffer) if archive_type == 'zip' else rarfile.RarFile(archive_buffer)
        with archive_obj:
            for file_info in archive_obj.infolist():
                is_dir = file_info.is_dir() if archive_type == 'zip' else file_info.isdir()
                if is_dir: continue
                fixed_filename = decode_archive_filename(file_info.filename, archive_type)
                if not validate_file_path(fixed_filename): continue
                if "__MACOSX" in fixed_filename or ".DS_Store" in fixed_filename: continue

                # === SIDE LOGIC ===
                side = SideType.BOTH
                final_path = fixed_filename
                if fixed_filename.startswith("client-mods/"):
                    side = SideType.CLIENT
                    final_path = fixed_filename.replace("client-mods/", "mods/", 1)
                elif fixed_filename.startswith("server-mods/"):
                    side = SideType.SERVER
                    final_path = fixed_filename.replace("server-mods/", "mods/", 1)
                elif fixed_filename.startswith("shaderpacks/"):
                    side = SideType.CLIENT
                elif fixed_filename.startswith("resourcepacks/"):
                    side = SideType.CLIENT
                
                if "tlskincape" in fixed_filename.lower() or "optifine" in fixed_filename.lower():
                    side = SideType.CLIENT

                file_data = archive_obj.read(file_info)
                file_hash = calculate_sha256(file_data)
                s3_path = f"objects/{file_hash[:2]}/{file_hash}"
                
                existing = (await db.execute(select(FileModel).where(FileModel.sha256 == file_hash))).scalars().first()
                if not existing:
                    db.add(FileModel(sha256=file_hash, filename=os.path.basename(final_path), size=file_info.file_size, s3_path=s3_path))
                    await db.flush()
                    try: 
                        if not await run_in_threadpool(minio_client.bucket_exists, BUCKET_NAME):
                            await run_in_threadpool(minio_client.make_bucket, BUCKET_NAME)
                    except: pass
                    await run_in_threadpool(minio_client.put_object, BUCKET_NAME, s3_path, io.BytesIO(file_data), length=len(file_data))
                    uploaded_paths.append(s3_path)
                    processed += 1
                else:
                    skipped += 1

                await db.execute(instance_files.insert().values(
                    instance_id=instance_id,
                    file_hash=file_hash,
                    path=final_path,
                    side=side
        ))
        await db.commit() 
    except Exception as e:
        await db.rollback()
        for p in uploaded_paths:
            try:
                minio_client.remove_object(BUCKET_NAME, p)
            except:
                pass
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    return {"status": "success", "stats": {"new_files_uploaded": processed, "files_deduplicated": skipped}}

@router.get("/instances/{instance_id}/files", response_model=List[FileNode])
async def get_instance_files(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not (await db.execute(select(Instance).where(Instance.id == instance_id))).scalars().first():
        raise HTTPException(status_code=404, detail="Instance not found")

    stmt = (
        select(FileModel, instance_files.c.path, instance_files.c.side)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
    )
    results = await db.execute(stmt)
    
    files = []
    for f, path, side in results:
        is_config = path.endswith((".cfg", ".txt", ".json", ".toml", ".ini", ".properties", ".md"))
        files.append(FileNode(
            path=path, filename=f.filename, size=f.size, hash=f.sha256, is_config=is_config, side=side
        ))
    return files

@router.patch("/instances/{instance_id}/files/side")
async def update_file_side(
    instance_id: str,
    body: FileUpdateSide,
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    stmt = (
        instance_files.update()
        .where(instance_files.c.instance_id == instance_id)
        .where(instance_files.c.path == body.path)
        .values(side=body.side)
    )
    result = await db.execute(stmt)
    await db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="File not found")
    return {"status": "updated"}

@router.delete("/instances/{instance_id}/files")
async def delete_file(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    path: str = Query(..., min_length=1, max_length=500),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not validate_file_path(path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    result = await db.execute(
        instance_files.delete()
        .where(instance_files.c.instance_id == instance_id)
        .where(instance_files.c.path == path)
    )
    
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="File not found in instance")
    
    orphan_stmt = select(FileModel).outerjoin(
        instance_files, FileModel.sha256 == instance_files.c.file_hash
    ).where(instance_files.c.instance_id == None)
    
    orphans = (await db.execute(orphan_stmt)).scalars().all()
    for file_obj in orphans:
        try:
            await run_in_threadpool(minio_client.remove_object, BUCKET_NAME, file_obj.s3_path)
        except: pass
        await db.delete(file_obj)
    
    await db.commit()
    return {"status": "deleted", "path": path}

@router.post("/instances/{instance_id}/files")
async def upload_single_file(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    path: str = Form(..., min_length=1, max_length=500),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not validate_file_path(path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    content = await file.read()
    file_hash = calculate_sha256(content)
    file_size = len(content)
    s3_path = f"objects/{file_hash[:2]}/{file_hash}"
    
    stmt = select(FileModel).where(FileModel.sha256 == file_hash)
    existing = (await db.execute(stmt)).scalars().first()
    
    if not existing:
        new_file = FileModel(
            sha256=file_hash, filename=file.filename, size=file_size, s3_path=s3_path
        )
        db.add(new_file)
        await db.flush()
        
        try:
            if not await run_in_threadpool(minio_client.bucket_exists, BUCKET_NAME):
                await run_in_threadpool(minio_client.make_bucket, BUCKET_NAME)
        except Exception:
            pass
            
        await run_in_threadpool(
            minio_client.put_object, BUCKET_NAME, s3_path, io.BytesIO(content), length=file_size
        )
    
    await db.execute(
        instance_files.delete()
        .where(instance_files.c.instance_id == instance_id)
        .where(instance_files.c.path == path)
    )
    
    await db.execute(instance_files.insert().values(
        instance_id=instance_id,
        file_hash=file_hash,
        path=path
    ))
    
    await db.commit()
    return {"status": "uploaded", "path": path}

@router.get("/instances/{instance_id}/config", response_class=PlainTextResponse)
async def get_config_content(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    path: str = Query(..., min_length=1, max_length=500),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not validate_file_path(path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    stmt = (
        select(FileModel)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
        .where(instance_files.c.path == path)
    )
    file_obj = (await db.execute(stmt)).scalars().first()
    
    if not file_obj:
        raise HTTPException(status_code=404, detail="File not found")
        
    try:
        response = await run_in_threadpool(minio_client.get_object, BUCKET_NAME, file_obj.s3_path)
        content = response.read()
        response.close()
        response.release_conn()
        try:
            return content.decode('utf-8')
        except:
            return content.decode('cp1251')
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Read error: {e}")

@router.put("/instances/{instance_id}/config")
async def update_config_content(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    path: str = Query(..., min_length=1, max_length=500),
    body: ConfigUpdateRequest = Body(...),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    if not validate_file_path(path):
        raise HTTPException(status_code=400, detail="Invalid file path")
    content_bytes = body.content.encode('utf-8')
    file_hash = calculate_sha256(content_bytes)
    file_size = len(content_bytes)
    s3_path = f"objects/{file_hash[:2]}/{file_hash}"
    
    stmt = select(FileModel).where(FileModel.sha256 == file_hash)
    existing = (await db.execute(stmt)).scalars().first()
    
    if not existing:
        filename = os.path.basename(path)
        new_file = FileModel(
            sha256=file_hash, filename=filename, size=file_size, s3_path=s3_path
        )
        db.add(new_file)
        await db.flush()
        await run_in_threadpool(
            minio_client.put_object, BUCKET_NAME, s3_path, io.BytesIO(content_bytes), length=file_size
        )
    
    await db.execute(
        instance_files.delete()
        .where(instance_files.c.instance_id == instance_id)
        .where(instance_files.c.path == path)
    )
    
    await db.execute(instance_files.insert().values(
        instance_id=instance_id,
        file_hash=file_hash,
        path=path
    ))
    
    orphan_stmt = select(FileModel).outerjoin(
        instance_files, FileModel.sha256 == instance_files.c.file_hash
    ).where(instance_files.c.instance_id == None)
    
    orphans = (await db.execute(orphan_stmt)).scalars().all()
    for file_obj in orphans:
        try:
            await run_in_threadpool(minio_client.remove_object, BUCKET_NAME, file_obj.s3_path)
        except: pass
        await db.delete(file_obj)

    await db.commit()
    return {"status": "updated", "path": path}

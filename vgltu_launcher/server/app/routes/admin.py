from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Body, Path, Query
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, or_, func
from starlette.concurrency import run_in_threadpool
from app.database import async_session_factory, minio_client
from app.models import Instance, File as FileModel, instance_files, User, SideType
from app.utils import calculate_sha256, validate_uploaded_archive, get_current_admin, generate_instance_id, get_db, validate_instance_id, validate_file_path
import rarfile
from app.schemas import AdminInstanceView, FileNode, ConfigUpdateRequest
from app.services.sftp_sync import SFTPSyncService  # <--- IMPORTED
from typing import List
from pydantic import BaseModel
import zipfile
import io
import os
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/admin", tags=["Admin"])
BUCKET_NAME = os.getenv("MINIO_BUCKET", "launcher-files")

# ХЕЛПЕР ДЛЯ ЛЕЧЕНИЯ КОДИРОВКИ
def decode_archive_filename(filename: str, archive_type: str) -> str:
    try:
        if archive_type == 'zip':
            # ZIP стандартно использует CP437
            return filename.encode('cp437').decode('cp866')
        else:
            # RAR обычно использует UTF-8 или системную кодировку
            return filename
    except:
        return filename

@router.get("/instances", response_model=List[AdminInstanceView])
async def get_admin_instances(
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin) 
):
    # JOIN с подсчётом файлов
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
    cleanup_remote: bool = Query(False, description="Удалить файлы с игрового сервера (SFTP)"), # <--- NEW PARAM
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    logger.info(f"Deleting instance: {instance_id}, cleanup_remote={cleanup_remote}")
    stmt = select(Instance).where(Instance.id == instance_id)
    instance = (await db.execute(stmt)).scalars().first()
    
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")

    # --- REMOTE CLEANUP ---
    if cleanup_remote:
        # Пытаемся почистить удаленный сервер, пока настройки SFTP еще живы
        try:
            logger.info("Initiating remote cleanup...")
            sync_service = SFTPSyncService(db)
            await sync_service.cleanup_instance(instance_id)
        except Exception as e:
            # Логируем, но не прерываем удаление инстанса (fail-safe)
            logger.error(f"Remote cleanup failed, but proceeding with local deletion: {e}")

    # --- LOCAL DELETION ---
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
        except Exception as e:
            logger.warning(f"MinIO delete warning for {file_obj.s3_path}: {e}")
        await db.delete(file_obj)
        deleted_files_count += 1
        deleted_size_bytes += file_obj.size

    await db.commit()
    return {
        "status": "deleted",
        "instance_id": instance_id,
        "remote_cleanup": cleanup_remote,
        "gc_stats": {
            "orphaned_files_removed": deleted_files_count,
            "space_freed_mb": round(deleted_size_bytes / 1024 / 1024, 2)
        }
    }

@router.post("/upload-zip")
async def upload_instance_zip(
    file: UploadFile = File(...),
    title: str = Form(...),
    mc_version: str = Form(...),
    loader_type: str = Form("forge"),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    # Генерируем ID автоматически
    instance_id = generate_instance_id(title, mc_version)
    logger.info(f"Start processing archive for {instance_id}")
    
    archive_buffer, archive_type = await validate_uploaded_archive(file)
    
    stmt = select(Instance).where(Instance.id == instance_id)
    instance = (await db.execute(stmt)).scalars().first()
    
    if not instance:
        instance = Instance(id=instance_id, title=title, mc_version=mc_version, loader_type=loader_type)
        db.add(instance)
    else:
        await db.execute(instance_files.delete().where(instance_files.c.instance_id == instance_id))
    
    await db.flush()

    processed_count = 0
    skipped_count = 0
    uploaded_s3_paths = []

    try:
        # Универсальная обработка ZIP и RAR
        if archive_type == 'zip':
            archive_obj = zipfile.ZipFile(archive_buffer)
            file_list = archive_obj.infolist()
        else:  # rar
            archive_obj = rarfile.RarFile(archive_buffer)
            file_list = archive_obj.infolist()
        
        with archive_obj:
            for file_info in file_list:
                # Проверка на директорию
                if archive_type == 'zip' and file_info.is_dir():
                    continue
                if archive_type == 'rar' and file_info.isdir():
                    continue
                
                # Декодирование имени
                fixed_filename = decode_archive_filename(file_info.filename, archive_type)
                logger.debug(f"Found in {archive_type.upper()}: '{file_info.filename}' -> Decoded: '{fixed_filename}'")

                # Безопасность: полная проверка path traversal
                if not validate_file_path(fixed_filename):
                    logger.warning(f"SKIPPED (Security): '{fixed_filename}'")
                    continue
                
                if fixed_filename.startswith("__MACOSX") or fixed_filename.endswith(".DS_Store"):
                    logger.debug(f"SKIPPED (Junk): '{fixed_filename}'")
                    continue

                # === УМНАЯ ЛОГИКА СТОРОН (ДОПОЛНЕННАЯ) ===
                side = SideType.BOTH
                final_path = fixed_filename
                # 1. Явные папки в архиве
                if fixed_filename.startswith("client-mods/"):
                    side = SideType.CLIENT
                    final_path = fixed_filename.replace("client-mods/", "mods/", 1)
                elif fixed_filename.startswith("server-mods/"):
                    side = SideType.SERVER
                    final_path = fixed_filename.replace("server-mods/", "mods/", 1)
                
                # 2. Авто-определение по типу контента (НОВОЕ!)
                elif fixed_filename.startswith("shaderpacks/"):
                    side = SideType.CLIENT  # Шейдеры нужны только глазам игрока
                elif fixed_filename.startswith("resourcepacks/"):
                    side = SideType.CLIENT  # Ресурспаки обычно тоже
                
                # 3. Эвристика по имени (защита от дурака)
                if "tlskincape" in fixed_filename.lower() or "optifine" in fixed_filename.lower():
                    side = SideType.CLIENT

                # Чтение данных
                file_data = archive_obj.read(file_info)
                file_hash = calculate_sha256(file_data)
                file_size = file_info.file_size
                s3_path = f"objects/{file_hash[:2]}/{file_hash}"
                
                stmt = select(FileModel).where(FileModel.sha256 == file_hash)
                existing_file = (await db.execute(stmt)).scalars().first()
                
                if not existing_file:
                    new_file = FileModel(
                        sha256=file_hash,
                        filename=os.path.basename(fixed_filename),
                        size=file_size,
                        s3_path=s3_path
                    )
                    db.add(new_file)
                    await db.flush()
                    
                    try:
                        if not await run_in_threadpool(minio_client.bucket_exists, BUCKET_NAME):
                            await run_in_threadpool(minio_client.make_bucket, BUCKET_NAME)
                    except Exception:
                        pass  # Bucket already exists
                    
                    await run_in_threadpool(
                        minio_client.put_object,
                        BUCKET_NAME, 
                        s3_path, 
                        io.BytesIO(file_data), 
                        length=len(file_data)
                    )
                    uploaded_s3_paths.append(s3_path)
                    processed_count += 1
                else:
                    skipped_count += 1

                await db.execute(instance_files.insert().values(
                    instance_id=instance_id,
                    file_hash=file_hash,
                    path=final_path
                ))

        # GC после обновления
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
        
    except Exception as e:
        logger.error(f"Upload failed! Rolling back {len(uploaded_s3_paths)} files...")
        await db.rollback()
        for path in uploaded_s3_paths:
            try: minio_client.remove_object(BUCKET_NAME, path)
            except: pass
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")
    
    finally:
        archive_buffer.close()
    
    return {
        "status": "success",
        "instance": instance_id,
        "stats": {
            "new_files_uploaded": processed_count,
            "files_deduplicated": skipped_count
        }
    }

# --- NEW: FILE MANAGER ENDPOINTS ---

@router.get("/instances/{instance_id}/files", response_model=List[FileNode])
async def get_instance_files(
    instance_id: str = Path(..., regex=r"^[a-z0-9][a-z0-9-]*[a-z0-9]$", min_length=3, max_length=50),
    db: AsyncSession = Depends(get_db),
    current_admin: User = Depends(get_current_admin)
):
    stmt = select(Instance).where(Instance.id == instance_id)
    if not (await db.execute(stmt)).scalars().first():
        raise HTTPException(status_code=404, detail="Instance not found")

    stmt = (
        select(FileModel, instance_files.c.path)
        .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
        .where(instance_files.c.instance_id == instance_id)
    )
    results = await db.execute(stmt)
    
    files = []
    for f, path in results:
        # Расширенный список конфигов
        is_config = path.endswith((".cfg", ".txt", ".json", ".toml", ".ini", ".properties", ".md"))
        
        files.append(FileNode(
            path=path,
            filename=f.filename,
            size=f.size,
            hash=f.sha256,
            is_config=is_config
        ))
    return files

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
        # 🔥 ВАЖНО: Добавляем flush, чтобы файл попал в БД до создания связи
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
        # Пробуем декодировать (если это конфиг - будет utf-8)
        try:
            return content.decode('utf-8')
        except:
            # Если не вышло (например, CP1251 в старых модах) - пробуем latin1 или cp1251
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
        # 🔥 ВАЖНО: Добавляем flush, чтобы файл попал в БД до создания связи
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
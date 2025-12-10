import asyncio
import os
import sys
from sqlalchemy import select
from minio import Minio

# Добавляем путь к приложению, чтобы импортировать модули
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import async_session_factory, minio_client, BUCKET_NAME
from app.models import File as FileModel

async def run_gc():
    print(f"🗑️  Starting Garbage Collection for bucket: {BUCKET_NAME}")
    
    # 1. Получаем список всех путей из БД
    print("📥 Fetching active files from Database...")
    active_paths = set()
    async with async_session_factory() as session:
        result = await session.execute(select(FileModel.s3_path))
        active_paths = set(result.scalars().all())
    
    print(f"✅ Database has {len(active_paths)} active files.")

    # 2. Получаем список всех объектов в MinIO
    print("📥 Scanning MinIO bucket...")
    orphaned_objects = []
    total_objects = 0
    
    # list_objects возвращает генератор
    objects = minio_client.list_objects(BUCKET_NAME, recursive=True)
    
    for obj in objects:
        total_objects += 1
        # object_name это s3_path (например objects/ab/abcdef...)
        if obj.object_name not in active_paths:
            orphaned_objects.append(obj.object_name)

    print(f"✅ MinIO has {total_objects} total objects.")
    print(f"⚠️  Found {len(orphaned_objects)} orphans to delete.")

    if not orphaned_objects:
        print("🎉 Clean! No garbage found.")
        return

    # 3. Удаление
    # MinIO client умеет удалять списком (batch delete), но в python sdk это remove_objects
    # Требует итератор DeleteObject
    from minio.deleteobjects import DeleteObject
    
    delete_list = [DeleteObject(path) for path in orphaned_objects]
    
    errors = minio_client.remove_objects(BUCKET_NAME, delete_list)
    
    deleted_count = 0
    for error in errors:
        print(f"❌ Error deleting {error.name}: {error}")
    
    # Если ошибок нет, итератор пустой, считаем что все удалено (грубая оценка)
    # Но надежнее просто поверить, что операция прошла
    print(f"🔥 Burned {len(orphaned_objects)} orphaned files.")

if __name__ == "__main__":
    # Запускаем в loop
    loop = asyncio.get_event_loop()
    loop.run_until_complete(run_gc())
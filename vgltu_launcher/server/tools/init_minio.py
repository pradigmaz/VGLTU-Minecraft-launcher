import os
import sys
import logging

# Добавляем путь к приложению
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import minio_client, BUCKET_NAME
from minio.error import S3Error

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MinIO-Init")

def init_minio():
    logger.info(f"🔧 Configuring MinIO bucket: {BUCKET_NAME}")
    
    try:
        # 1. Создаем бакет
        if not minio_client.bucket_exists(BUCKET_NAME):
            logger.info(f"   Creating bucket '{BUCKET_NAME}'...")
            minio_client.make_bucket(BUCKET_NAME)
        else:
            logger.info(f"   Bucket '{BUCKET_NAME}' already exists.")

        # Launcher downloads are served by the backend after side filtering.
        try:
            minio_client.delete_bucket_policy(BUCKET_NAME)
            logger.info("   Removed bucket policy; object storage is private.")
        except S3Error as error:
            if error.code != "NoSuchBucketPolicy":
                raise
            logger.info("   Bucket has no public policy.")

        logger.info("✅ Success! Bucket is private.")
        
    except Exception as e:
        logger.error(f"❌ Failed to configure MinIO: {e}")
        # Не роняем сервер, если MinIO временно недоступен, но пишем ошибку
        sys.exit(1)

if __name__ == "__main__":
    init_minio()

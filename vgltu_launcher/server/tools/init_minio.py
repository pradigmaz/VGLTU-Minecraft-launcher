import os
import sys
import json
import logging

# Добавляем путь к приложению
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import minio_client, BUCKET_NAME

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

        # 2. Настраиваем Public Policy (Read Only)
        # Это позволяет лаунчеру скачивать файлы без авторизации
        policy = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{BUCKET_NAME}/*"]
                }
            ]
        }
        
        logger.info("   Applying public read policy...")
        minio_client.set_bucket_policy(BUCKET_NAME, json.dumps(policy))
        logger.info("✅ Success! Bucket is fully configured.")
        
    except Exception as e:
        logger.error(f"❌ Failed to configure MinIO: {e}")
        # Не роняем сервер, если MinIO временно недоступен, но пишем ошибку
        sys.exit(1)

if __name__ == "__main__":
    init_minio()
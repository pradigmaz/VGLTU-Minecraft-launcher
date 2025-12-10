import os
import sys
import json

# Добавляем путь к приложению
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import minio_client, BUCKET_NAME

def init_minio():
    print(f"🔧 Configuring MinIO bucket: {BUCKET_NAME}")
    
    # 1. Создаем бакет, если нет
    if not minio_client.bucket_exists(BUCKET_NAME):
        print(f"   Creating bucket '{BUCKET_NAME}'...")
        minio_client.make_bucket(BUCKET_NAME)
    else:
        print(f"   Bucket '{BUCKET_NAME}' already exists.")

    # 2. Настраиваем Public Access Policy (Read Only)
    # Это аналог кнопки "Access Policy: Public"
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
    
    print("   Applying public read policy...")
    try:
        minio_client.set_bucket_policy(BUCKET_NAME, json.dumps(policy))
        print("✅ Success! Bucket is now PUBLIC.")
    except Exception as e:
        print(f"❌ Error setting policy: {e}")

if __name__ == "__main__":
    init_minio()
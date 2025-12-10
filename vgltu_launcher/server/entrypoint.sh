#!/bin/bash

# Останавливаем скрипт при любой критической ошибке
set -e

# 1. Ожидание базы данных
echo "⏳ Waiting for PostgreSQL..."
for i in {1..30}; do
  if pg_isready -h postgres -U launcher > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  echo "Attempt $i/30: PostgreSQL not ready yet, waiting..."
  sleep 2
done

# 2. Миграции БД
echo "🔄 Running database migrations..."
alembic upgrade head

# 3. Авто-настройка MinIO (Создание бакета и прав)
echo "🔧 Configuring MinIO Storage..."
python tools/init_minio.py

# 4. Запуск сборщика мусора в фоновом режиме (&)
# Он будет работать параллельно с сервером
echo "🧹 Starting Background Garbage Collector..."
python tools/gc_loop.py &

# 5. Запуск основного сервера
echo "🚀 Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
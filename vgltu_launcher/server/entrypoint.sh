#!/bin/bash

# Останавливаем скрипт при любой критической ошибке
set -e

# Читаем пароль Redis из переменных окружения для CLI
REDIS_PASSWORD=${REDIS_PASSWORD}

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

# 2. ОЖИДАНИЕ REDIS (КРИТИЧНОЕ ДОБАВЛЕНИЕ)
echo "⏳ Waiting for Redis..."
for i in {1..10}; do
  # Проверяем готовность Redis, используя его DNS-имя (redis) и пароль
  # redis-cli -h redis -a "$REDIS_PASSWORD" ping
  if command -v redis-cli &> /dev/null; then
    # Если redis-cli доступен, используем его
    if redis-cli -h redis -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then
      echo "✅ Redis is ready!"
      break
    fi
  else
    # Если redis-cli нет, ждем еще 2 секунды (менее надежный путь)
    echo "Warning: redis-cli not found, waiting passively..."
  fi
  
  if [ $i -eq 10 ]; then
    echo "❌ Error: Redis not available after 10 attempts. Continuing may cause errors."
    break
  fi
  sleep 2
done

# 3. Миграции БД
echo "🔄 Running database migrations..."
alembic upgrade head

# 4. Авто-настройка MinIO (Создание бакета и прав)
echo "🔧 Configuring MinIO Storage..."
python tools/init_minio.py

# 5. Запуск сборщика мусора в фоновом режиме (&)
echo "🧹 Starting Background Garbage Collector..."
python tools/gc_loop.py &

# 6. Запуск основного сервера
echo "🚀 Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
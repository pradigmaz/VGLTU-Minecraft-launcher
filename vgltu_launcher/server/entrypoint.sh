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

# 2. ОЖИДАНИЕ REDIS (Устранение проблемы с экранированием)
echo "⏳ Waiting for Redis..."
REDIS_HOST="redis" # Имя сервиса
REDIS_PORT="6379"

# Отладочная информация
if [ -n "$REDIS_PASSWORD" ]; then
  echo "🔐 Redis password is set, using authentication"
else
  echo "🔓 Redis password is not set, connecting without auth"
fi

for i in {1..15}; do 
  
  # Используем переменную окружения REDIS_PASSWORD для аутентификации
  # Проверяем подключение с паролем через флаг -a
  if [ -n "$REDIS_PASSWORD" ]; then
    # Если пароль задан, используем его для аутентификации
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" -a "$REDIS_PASSWORD" ping > /dev/null 2>&1; then 
      echo "✅ Redis is ready and authenticated!"
      break
    else
      echo "🔍 Debug: Redis auth failed, trying to connect..."
    fi
  else
    # Если пароль не задан, подключаемся без аутентификации
    if redis-cli -h "$REDIS_HOST" -p "$REDIS_PORT" ping > /dev/null 2>&1; then 
      echo "✅ Redis is ready!"
      break
    else
      echo "🔍 Debug: Redis connection failed without auth..."
    fi
  fi

  echo "Attempt $i/15: Redis not ready yet, waiting..."
  if [ $i -eq 15 ]; then
    echo "❌ CRITICAL FAILURE: Redis not available after all attempts. Exiting Docker entrypoint."
    exit 1 # Выход с ошибкой.
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
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

#!/bin/bash

# Останавливаем скрипт при любой ошибке
set -e

# Ждем готовности PostgreSQL
echo "⏳ Waiting for PostgreSQL..."
for i in {1..30}; do
  if pg_isready -h postgres -U launcher > /dev/null 2>&1; then
    echo "✅ PostgreSQL is ready!"
    break
  fi
  echo "Attempt $i/30: PostgreSQL not ready yet, waiting..."
  sleep 2
done

# Применяем миграции базы данных (создаем таблицы)
echo "🔄 Running database migrations..."
alembic upgrade head

# Запускаем сервер FastAPI
echo "🚀 Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
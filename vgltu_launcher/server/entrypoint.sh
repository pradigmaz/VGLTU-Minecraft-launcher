#!/bin/bash
set -e

echo "🔄 Running database migrations..."
# Stamp current state if tables exist but no alembic version
alembic upgrade head || alembic stamp head

echo "🚀 Starting server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000

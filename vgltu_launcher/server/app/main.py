from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
import os

from .database import engine, Base, redis_client
import sqlalchemy as sa
from app.routes import yggdrasil, admin, client, auth, players, sftp

from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

# Redis URL для rate limiter storage
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

# --- LIFESPAN ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 [STARTUP] Initializing system...")
    
    # 1. DB Check (миграции через Alembic в entrypoint.sh)
    try:
        async with engine.begin() as conn:
            await conn.execute(sa.text("SELECT 1"))
        print("✅ Database: Connected")
    except Exception as e:
        print(f"❌ Database Error: {e}")

    # 2. Redis Check
    try:
        await redis_client.set("startup_test", "ok", ex=10)
        print("✅ Redis: Connected")
    except Exception as e:
        print(f"❌ Redis Error: {e}")
        
    yield
    
    print("🛑 [SHUTDOWN] Closing connections...")
    await engine.dispose()
    await redis_client.aclose()

app = FastAPI(lifespan=lifespan)
# --- НАСТРОЙКА CORS ---
# Читаем разрешённые origins из env (через запятую)
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)


# Подключаем роутеры
app.include_router(yggdrasil.router)
app.include_router(admin.router)
app.include_router(client.router)
app.include_router(auth.router)
app.include_router(players.router)
app.include_router(sftp.router)

# --- RATE LIMITING ---
# Global limiter с Redis storage и default limits
limiter = Limiter(
    key_func=get_remote_address,
    storage_uri=REDIS_URL,
    default_limits=["100/minute"],  # Default для всех endpoints
    application_limits=["1000/hour"]  # Общий лимит на приложение
)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


@app.get("/")
async def root():
    return {"status": "online", "service": "Pixel Launcher API"}

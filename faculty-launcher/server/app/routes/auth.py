# app/routes/auth.py
from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import redis_client
from app.models import User
from app.utils import create_access_token, get_db
from slowapi import Limiter
from slowapi.util import get_remote_address
import uuid
import os

router = APIRouter(prefix="/api/auth", tags=["Auth"])

limiter = Limiter(key_func=get_remote_address)

ADMIN_IDS = [int(id) for id in os.getenv("ADMIN_IDS", "").split(",") if id]
BOT_USERNAME = os.getenv("BOT_USERNAME", "vgltuminecraftbot")

class BotCallback(BaseModel):
    code: str
    telegram_id: int
    username: str

@router.get("/code")
@limiter.limit("5/minute")
async def get_login_code(request: Request):
    code = str(uuid.uuid4())
    await redis_client.set(f"auth_code:{code}", "pending", ex=300)
    # Генерируем ссылку динамически
    return {"code": code, "bot_link": f"https://t.me/{BOT_USERNAME}?start={code}"}

@router.post("/callback")
async def bot_callback(data: BotCallback, db: AsyncSession = Depends(get_db)):
    status = await redis_client.get(f"auth_code:{data.code}")
    if not status:
        raise HTTPException(status_code=404, detail="Code expired or invalid")

    if data.telegram_id in ADMIN_IDS:
        stmt = select(User).where(User.telegram_id == data.telegram_id)
        user = (await db.execute(stmt)).scalars().first()
        
        if not user:
            mc_uuid = uuid.uuid5(uuid.NAMESPACE_OID, str(data.telegram_id))
            user = User(
                telegram_id=data.telegram_id,
                username=data.username,
                role="admin",
                mc_uuid=mc_uuid
            )
            db.add(user)
            await db.commit()
        
        access_token = create_access_token(
            data={"sub": str(user.telegram_id), "role": "admin"}
        )
        
        await redis_client.set(f"auth_code:{data.code}", access_token, ex=300)
        return {"status": "ok", "role": "admin"}

    raise HTTPException(status_code=403, detail="User not authorized")

@router.get("/check/{code}")
async def check_auth_status(code: str):
    token = await redis_client.get(f"auth_code:{code}")
    if not token:
        raise HTTPException(status_code=404, detail="Code expired")
    
    if token == "pending":
        return {"status": "pending"}
    
    await redis_client.delete(f"auth_code:{code}")
    return {"status": "success", "access_token": token}
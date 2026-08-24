from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User
from app.schemas import AuthenticateRequest, AuthenticateResponse, JoinRequest
from app.database import redis_client
from app.security import verify_password
from app.utils import get_db
from slowapi.util import get_remote_address
import uuid
import json

router = APIRouter()

# --- Метаданные для authlib-injector ---
@router.get("/authserver")
async def authserver_metadata():
    """Возвращает метаданные сервера авторизации для authlib-injector"""
    return {
        "meta": {
            "serverName": "Pixel Launcher",
            "implementationName": "pixellauncher-yggdrasil",
            "implementationVersion": "1.0.0",
            "feature.no_mojang_namespace": True,
            "feature.legacy_skin_api": True,
            "feature.enable_profile_key": False
        },
        "skinDomains": ["localhost"]
        # signaturePublickey не указываем — скины без подписи
    }

# Хелпер: UUID в формат без дефисов (Mojang style)
def to_hex(u: uuid.UUID) -> str:
    return u.hex

# Хелпер: из hex в UUID
def from_hex(h: str) -> uuid.UUID:
    return uuid.UUID(h)

# --- Rate Limiter ---
from slowapi import Limiter
from slowapi.util import get_remote_address
limiter = Limiter(key_func=get_remote_address)

# --- 1. AUTHSERVER: Вход (Вызывает Лаунчер) ---
@router.post("/authserver/authenticate", response_model=AuthenticateResponse)
@limiter.limit("10/minute")
async def authenticate(
    request: Request,
    payload: AuthenticateRequest, 
    db: AsyncSession = Depends(get_db)
):
    # 1. Ищем player и проверяем его пароль.
    result = await db.execute(select(User).where(User.username == payload.username))
    user = result.scalars().first()

    if not user or user.is_banned or not user.password_hash:
        raise HTTPException(status_code=403, detail="Invalid credentials")

    if not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=403, detail="Invalid credentials")

    # 2. Генерируем Access Token (сессионный ключ для игры)
    access_token = uuid.uuid4().hex
    client_token = payload.clientToken or uuid.uuid4().hex

    # 3. Сохраняем сессию в Redis (живет 24 часа)
    # Ключ: "token:<access_token>" -> Значение: JSON с данными
    session_data = {
        "user_id": str(user.id),
        "username": user.username,
        "mc_uuid": to_hex(user.mc_uuid),
        "ip": request.client.host if request.client else None,
    }
    await redis_client.set(f"session:{access_token}", json.dumps(session_data), ex=86400)

    # 4. Ответ в формате Yggdrasil
    profile = {"id": to_hex(user.mc_uuid), "name": user.username}
    
    return {
        "accessToken": access_token,
        "clientToken": client_token,
        "selectedProfile": profile,
        "availableProfiles": [profile],
        "user": {"id": to_hex(user.mc_uuid), "properties": []}
    }

# --- 2. SESSIONSERVER: Join (Вызывает Клиент Игры) ---
@router.post("/sessionserver/session/minecraft/join")
@limiter.limit("30/minute")
async def join_server(request: Request, payload: JoinRequest):
    # Клиент говорит: "Я (accessToken) хочу зайти на сервер (serverId)"
    
    # 1. Проверяем токен в Redis
    data_raw = await redis_client.get(f"session:{payload.accessToken}")
    if not data_raw:
        raise HTTPException(status_code=403, detail="Invalid session")
    
    session_data = json.loads(data_raw)
    
    # 2. Связываем ServerID с Юзером (Это проверит сервер Minecraft)
    # Ключ: "join:<serverId>" -> Значение: username
    # Важно: ServerID генерируется клиентом и сервером на основе хешей, он уникален для сессии входа
    await redis_client.set(f"join:{payload.serverId}", session_data["username"], ex=60) # Живет 60 сек

    return status.HTTP_204_NO_CONTENT

# --- 3. SESSIONSERVER: HasJoined (Вызывает Сервер Minecraft) ---
@router.get("/sessionserver/session/minecraft/hasJoined")
async def has_joined(username: str, serverId: str, ip: str = None, db: AsyncSession = Depends(get_db)):
    # Сервер спрашивает: "Чувак с ником X и id Y реально залогинился?"
    
    # 1. Проверяем запись в Redis
    real_username = await redis_client.get(f"join:{serverId}")
    
    if not real_username or real_username != username:
        # Либо сессия истекла, либо ник не совпадает (хакер)
        raise HTTPException(status_code=204) # 204 значит "Неа, не знаю такого"

    # 2. Достаем профиль из БД
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    
    if not user:
         raise HTTPException(status_code=204)
     
    # 🔥🔥🔥 ВОТ СЮДА ВСТАВЛЯЕМ ПРОВЕРКУ 🔥🔥🔥
    if user.is_banned:
        # Если юзер забанен, мы говорим серверу Майнкрафта, 
        # что такого игрока "как бы нет" или сессия невалидна.
        # Сервер Майнкрафта сам кикнет игрока с ошибкой "Authentication failed".
        raise HTTPException(status_code=204) 
    # 🔥🔥🔥 КОНЕЦ ВСТАВКИ 🔥🔥🔥

    # 3. Отдаем профиль (Тут в будущем будут Скины!)
    # Формат ответа критически важен
    return {
        "id": to_hex(user.mc_uuid),
        "name": user.username,
        "properties": [
            # Сюда потом вставим textures (base64)
        ]
    }

# --- 4. SESSIONSERVER: Profile (Вызывает Клиент для получения профиля по UUID) ---
# Два пути: authlib-injector может запрашивать с префиксом /authserver или без
@router.get("/sessionserver/session/minecraft/profile/{player_uuid}")
@router.get("/authserver/sessionserver/session/minecraft/profile/{player_uuid}")
async def get_profile(player_uuid: str, unsigned: bool = True, db: AsyncSession = Depends(get_db)):
    """
    Возвращает профиль игрока по UUID.
    Вызывается клиентом при создании мира, входе на сервер и т.д.
    """
    try:
        # Конвертируем hex UUID в объект
        parsed_uuid = from_hex(player_uuid.replace("-", ""))
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid UUID format")
    
    # Ищем юзера по mc_uuid
    result = await db.execute(select(User).where(User.mc_uuid == parsed_uuid))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=204)  # Профиль не найден
    
    # Возвращаем профиль в формате Yggdrasil
    return {
        "id": to_hex(user.mc_uuid),
        "name": user.username,
        "properties": [
            # Текстуры скинов добавим позже
        ]
    }

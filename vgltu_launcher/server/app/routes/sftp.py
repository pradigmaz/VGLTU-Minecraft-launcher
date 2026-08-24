import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import async_session_factory
from app.models import Instance, SFTPConnection, User
from app.schemas import SFTPConfigCreate
from app.services.sftp_sync import SFTPSyncService
from app.security import encrypt_sftp_secret
from app.utils import get_current_admin

router = APIRouter(prefix="/api/admin/sftp", tags=["SFTP"])
logger = logging.getLogger(__name__)

async def get_db():
    async with async_session_factory() as session:
        yield session


async def _require_instance(instance_id: str, db: AsyncSession) -> None:
    instance = (await db.execute(select(Instance).where(Instance.id == instance_id))).scalars().first()
    if not instance:
        raise HTTPException(status_code=404, detail="Instance not found")


@router.get("/{instance_id}")
async def get_config(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _current_admin: User = Depends(get_current_admin),
):
    await _require_instance(instance_id, db)
    stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
    config = (await db.execute(stmt)).scalars().first()
    
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    
    # === МАСКИРОВКА ПАРОЛЕЙ ===
    # Мы не отдаем пароли на фронт. Мы отдаем плейсхолдеры.
    return {
        "id": config.id,
        "instance_id": config.instance_id,
        "host": config.host,
        "port": config.port,
        "username": config.username,
        "rcon_host": config.rcon_host,
        "rcon_port": config.rcon_port,

        # Отдаем ******** если пароль есть, иначе пустую строку
        "password": "********" if config.password else "",
        "rcon_password": "********" if config.rcon_password else "",
        
        # Остальные поля
        "sync_mods": config.sync_mods,
        "sync_config": config.sync_config,
        # ... добавь остальные поля sync ...
        "last_sync": config.last_sync
    }

@router.post("/{instance_id}")
async def create_or_update_config(
    instance_id: str, 
    config: SFTPConfigCreate, 
    db: AsyncSession = Depends(get_db),
    _current_admin: User = Depends(get_current_admin),
):
    await _require_instance(instance_id, db)
    stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
    existing = (await db.execute(stmt)).scalars().first()
    
    config_dict = config.model_dump(exclude_unset=True)
    
    for field in ("password", "rcon_password"):
        value = config_dict.get(field)
        if value in (None, "", "********"):
            config_dict.pop(field, None)
        else:
            try:
                config_dict[field] = encrypt_sftp_secret(value)
            except RuntimeError as error:
                logger.error("Cannot encrypt SFTP credential: %s", error)
                raise HTTPException(status_code=503, detail="SFTP encryption is not configured") from error

    if not existing and "password" not in config_dict:
        raise HTTPException(status_code=422, detail="SFTP password is required")

    if existing:
        for key, value in config_dict.items():
            setattr(existing, key, value)
    else:
        # При создании, если пароль не передан, будет ошибка (если поле nullable=False)
        new_config = SFTPConnection(instance_id=instance_id, **config_dict)
        db.add(new_config)
    
    await db.commit()
    return {"status": "saved"}

@router.post("/{instance_id}/sync")
async def run_sync(
    instance_id: str,
    db: AsyncSession = Depends(get_db),
    _current_admin: User = Depends(get_current_admin),
):
    await _require_instance(instance_id, db)
    service = SFTPSyncService(db)
    try:
        logs = await service.sync_instance(instance_id)
        return {"status": "success", "logs": logs}
    except Exception:
        logger.exception("SFTP sync failed for instance %s", instance_id)
        raise HTTPException(status_code=502, detail="SFTP sync failed")

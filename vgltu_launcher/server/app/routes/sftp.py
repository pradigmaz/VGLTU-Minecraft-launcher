from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import async_session_factory
from app.models import SFTPConnection
from app.schemas import SFTPConfigCreate, SFTPConfigResponse 
from app.services.sftp_sync import SFTPSyncService
# from app.utils import encrypt_password

router = APIRouter(prefix="/api/admin/sftp", tags=["SFTP"])

async def get_db():
    async with async_session_factory() as session:
        yield session

@router.get("/{instance_id}")
async def get_config(instance_id: str, db: AsyncSession = Depends(get_db)):
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
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
    existing = (await db.execute(stmt)).scalars().first()
    
    config_dict = config.dict(exclude_unset=True)
    
    # === ЛОГИКА СОХРАНЕНИЯ ПАРОЛЕЙ ===
    # Если пароль пришел как "********", значит юзер его не менял -> удаляем из обновления
    if config_dict.get("password") == "********":
        del config_dict["password"]
    elif config_dict.get("password"):
        # TODO: Здесь вставь шифрование!
        # config_dict["password"] = encrypt_password(config_dict["password"])
        pass 

    if config_dict.get("rcon_password") == "********":
        del config_dict["rcon_password"]
    elif config_dict.get("rcon_password"):
        # TODO: Здесь вставь шифрование!
        # config_dict["rcon_password"] = encrypt_password(config_dict["rcon_password"])
        pass

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
async def run_sync(instance_id: str, db: AsyncSession = Depends(get_db)):
    service = SFTPSyncService(db)
    try:
        logs = await service.sync_instance(instance_id)
        return {"status": "success", "logs": logs}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
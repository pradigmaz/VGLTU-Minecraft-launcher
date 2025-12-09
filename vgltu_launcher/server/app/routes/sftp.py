from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import async_session_factory
from app.models import SFTPConnection, Instance
from app.schemas import SFTPConfigCreate, SFTPConfigResponse, SFTPConfigUpdate
from app.services.sftp_sync import SFTPSyncService
from app.utils import get_current_admin

router = APIRouter(prefix="/api/admin/sftp", tags=["SFTP"])

async def get_db():
    async with async_session_factory() as session:
        yield session

@router.get("/{instance_id}", response_model=SFTPConfigResponse)
async def get_config(instance_id: str, db: AsyncSession = Depends(get_db)):
    stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
    config = (await db.execute(stmt)).scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="Config not found")
    return config

@router.post("/{instance_id}")
async def create_or_update_config(
    instance_id: str, 
    config: SFTPConfigCreate, 
    db: AsyncSession = Depends(get_db)
):
    stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
    existing = (await db.execute(stmt)).scalars().first()
    
    if existing:
        for key, value in config.dict().items():
            setattr(existing, key, value)
    else:
        new_config = SFTPConnection(instance_id=instance_id, **config.dict())
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
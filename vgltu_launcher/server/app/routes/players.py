import secrets
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import User
from app.schemas import PlayerCreate
from app.security import hash_password
from app.utils import get_current_admin, get_db


router = APIRouter(prefix="/api/admin/players", tags=["Players"])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_player(
    player_data: PlayerCreate,
    db: AsyncSession = Depends(get_db),
    _current_admin: User = Depends(get_current_admin),
):
    username = player_data.username.strip()
    if len(username) < 3:
        raise HTTPException(status_code=422, detail="Username must contain at least 3 non-space characters")
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalars().first():
        raise HTTPException(status_code=409, detail="Player already exists")

    account_id = secrets.randbelow(2**63 - 1) + 1
    player = User(
        username=username,
        telegram_id=account_id,
        mc_uuid=uuid.uuid5(uuid.NAMESPACE_OID, str(account_id)),
        password_hash=hash_password(player_data.password),
        role="student",
    )
    db.add(player)
    try:
        await db.commit()
    except IntegrityError as error:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Player already exists") from error

    return {"username": player.username, "uuid": player.mc_uuid.hex}

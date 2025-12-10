from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import uuid

# --- Yggdrasil Request/Response Models ---

class Agent(BaseModel):
    name: str = "Minecraft"
    version: int = 1

class AuthenticateRequest(BaseModel):
    agent: Optional[Agent] = None
    username: str 
    password: str 
    clientToken: Optional[str] = None
    requestUser: bool = False

class GameProfile(BaseModel):
    id: str 
    name: str

class AuthenticateResponse(BaseModel):
    accessToken: str 
    clientToken: str
    selectedProfile: GameProfile
    availableProfiles: List[GameProfile] = []
    user: Optional[Dict] = None

class JoinRequest(BaseModel):
    accessToken: str
    selectedProfile: str 
    serverId: str

# --- Internal / Dev Models ---
class UserCreate(BaseModel):
    username: str
    telegram_id: int
    
# --- Manifest Models ---
class FileManifest(BaseModel):
    filename: str
    hash: str
    size: int
    path: str       
    url: str        

class InstanceManifest(BaseModel):
    instance_id: str
    mc_version: str
    loader_type: str
    files: List[FileManifest]

# --- Admin API Models (MISSING PART) ---

class AdminInstanceView(BaseModel):
    id: str
    title: str
    mc_version: str
    files_count: int 

class FileNode(BaseModel):
    path: str       # "mods/jei.jar"
    filename: str   # "jei.jar"
    size: int
    hash: str
    is_config: bool 

class ConfigUpdateRequest(BaseModel):
    content: str
# --- SFTP Schemas ---
class SFTPConfigBase(BaseModel):
    host: str
    port: int = 22
    username: str
    
    # Новые поля
    rcon_host: Optional[str] = None
    rcon_port: int = 25575
    
    # Настройки синхронизации
    sync_mods: bool = True
    sync_config: bool = True
    sync_scripts: bool = False
    sync_shaderpacks: bool = False
    sync_resourcepacks: bool = False
    auto_sync: bool = False
    sync_interval_minutes: int = 60

class SFTPConfigCreate(SFTPConfigBase):
    password: Optional[str] = None      # SFTP пароль
    rcon_password: Optional[str] = None # RCON пароль
class SFTPConfigUpdate(BaseModel):
    # Все поля опциональны для PATCH
    host: Optional[str] = None
    port: Optional[int] = None
    username: Optional[str] = None
    password: Optional[str] = None
    rcon_host: Optional[str] = None
    rcon_port: Optional[int] = None
    rcon_password: Optional[str] = None
    sync_mods: Optional[bool] = None
    sync_config: Optional[bool] = None
    sync_shaderpacks: Optional[bool] = None
    sync_resourcepacks: Optional[bool] = None
    sync_scripts: Optional[bool] = None
    auto_sync: Optional[bool] = None
    sync_interval_minutes: Optional[int] = None

class SFTPConfigResponse(SFTPConfigBase):
    id: int
    instance_id: str
    last_sync: Optional[datetime]
    
    # Поля-флаги: задан ли пароль? (сами пароли не отдаем!)
    has_password: bool
    has_rcon_password: bool
    
    class Config:
        from_attributes = True

class SyncLog(BaseModel):
    status: str # 'success', 'failed'
    details: str
    timestamp: datetime

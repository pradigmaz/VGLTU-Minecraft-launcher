from pydantic import BaseModel, Field
from typing import Optional, List, Dict
from datetime import datetime
import uuid
from enum import Enum  # <--- NEW

# --- Side Enum ---
class SideType(str, Enum):  # <--- NEW
    CLIENT = "CLIENT"
    SERVER = "SERVER"
    BOTH = "BOTH"

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
    
# --- Manifest Models (Client) ---
class FileManifest(BaseModel):
    filename: str
    hash: str
    size: int
    path: str       
    url: str
    # side клиенту знать не обязательно, он получает уже отфильтрованный список

class InstanceManifest(BaseModel):
    instance_id: str
    mc_version: str
    loader_type: str
    files: List[FileManifest]

# --- Admin API Models ---

class AdminInstanceView(BaseModel):
    id: str
    title: str
    mc_version: str
    files_count: int 

class FileNode(BaseModel):
    path: str       
    filename: str   
    size: int
    hash: str
    is_config: bool
    side: SideType  # <--- NEW: Админка должна знать сторону

class ConfigUpdateRequest(BaseModel):
    content: str

# --- NEW: Смена стороны файла ---
class FileUpdateSide(BaseModel):
    path: str
    side: SideType

# --- SFTP Schemas ---
class SFTPConfigBase(BaseModel):
    host: str
    port: int = 22
    username: str
    
    rcon_host: Optional[str] = None
    rcon_port: int = 25575
    
    sync_mods: bool = True
    sync_config: bool = True
    sync_scripts: bool = False
    sync_shaderpacks: bool = False
    sync_resourcepacks: bool = False
    auto_sync: bool = False
    sync_interval_minutes: int = 60

class SFTPConfigCreate(SFTPConfigBase):
    password: Optional[str] = None      
    rcon_password: Optional[str] = None 

class SFTPConfigUpdate(BaseModel):
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
    has_password: bool
    has_rcon_password: bool
    
    class Config:
        from_attributes = True

class SyncLog(BaseModel):
    status: str 
    details: str
    timestamp: datetime
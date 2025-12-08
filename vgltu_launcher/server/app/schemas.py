from pydantic import BaseModel, Field
from typing import Optional, List, Dict
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
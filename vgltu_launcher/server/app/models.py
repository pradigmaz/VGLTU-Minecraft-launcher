import uuid
import enum  # <--- NEW
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, Boolean, ForeignKey, DateTime, Table, Integer, Enum # <--- IMPORT ENUM
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func
from .database import Base

# === НОВЫЙ ENUM ===
class SideType(str, enum.Enum):
    CLIENT = "CLIENT"
    SERVER = "SERVER"
    BOTH = "BOTH"

# --- Таблица связи: Сборка <-> Файл ---
instance_files = Table(
    "instance_files",
    Base.metadata,
    Column("instance_id", String, ForeignKey("instances.id"), primary_key=True),
    Column("file_hash", String, ForeignKey("files.sha256"), primary_key=True),
    Column("path", String, nullable=False), 
    # === НОВОЕ ПОЛЕ ===
    Column("side", Enum(SideType), default=SideType.BOTH, nullable=False)
)

# --- Пользователи ---
class User(Base):
    __tablename__ = "users"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="student") 
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    mc_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# --- Сборки ---
class Instance(Base):
    __tablename__ = "instances"
    id: Mapped[str] = mapped_column(String(50), primary_key=True) 
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    mc_version: Mapped[str] = mapped_column(String(20), nullable=False)
    loader_type: Mapped[str] = mapped_column(String(20), nullable=False) 
    loader_version: Mapped[str] = mapped_column(String(50), nullable=True)
    manifest_url: Mapped[str] = mapped_column(String(255), nullable=True)

    files = relationship("File", secondary=instance_files, back_populates="instances", cascade="all, delete")
    
    # Связь с настройками SFTP
    sftp_connection = relationship("SFTPConnection", uselist=False, back_populates="instance", cascade="all, delete-orphan")

# --- Файлы ---
class File(Base):
    __tablename__ = "files"
    sha256: Mapped[str] = mapped_column(String(64), primary_key=True)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    s3_path: Mapped[str] = mapped_column(String(255), nullable=False)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    instances = relationship("Instance", secondary=instance_files, back_populates="files")

# --- SFTP Connection (Соответствует твоей таблице в БД) ---
class SFTPConnection(Base):
    __tablename__ = "sftp_connections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    instance_id: Mapped[str] = mapped_column(String, ForeignKey("instances.id"), nullable=False, unique=True)
    
    host: Mapped[str] = mapped_column(String, nullable=False)
    port: Mapped[int] = mapped_column(Integer, default=22)
    username: Mapped[str] = mapped_column(String, nullable=False)
    password: Mapped[str] = mapped_column(String, nullable=False)
    
    # === НОВЫЕ ПОЛЯ ===
    # Если rcon_host не задан, используем host от SFTP
    rcon_host: Mapped[str] = mapped_column(String, nullable=True)
    rcon_port: Mapped[int] = mapped_column(Integer, default=25575)
    rcon_password: Mapped[str] = mapped_column(String, nullable=True)
    
    # Настройки синхронизации
    sync_mods: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_config: Mapped[bool] = mapped_column(Boolean, default=True)
    sync_shaderpacks: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_resourcepacks: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_scripts: Mapped[bool] = mapped_column(Boolean, default=False)
    
    auto_sync: Mapped[bool] = mapped_column(Boolean, default=False)
    sync_interval_minutes: Mapped[int] = mapped_column(Integer, default=30)
    last_sync: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=func.now(), nullable=True)
    
    instance = relationship("Instance", back_populates="sftp_connection")
import uuid
from datetime import datetime
from sqlalchemy import Column, String, BigInteger, Boolean, ForeignKey, DateTime, Table
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship, Mapped, mapped_column
from .database import Base

# --- Таблица связи: Сборка <-> Файл (Многие ко Многим) ---
instance_files = Table(
    "instance_files",
    Base.metadata,
    Column("instance_id", String, ForeignKey("instances.id"), primary_key=True),
    Column("file_hash", String, ForeignKey("files.sha256"), primary_key=True),
    Column("path", String, nullable=False), # Путь внутри папки minecraft (mods/jei.jar)
)

# --- Пользователи ---
class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, nullable=False, index=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    role: Mapped[str] = mapped_column(String(20), default="student") # 'student', 'admin'
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)
    
    # UUID для Minecraft (генерируем детерминированно или храним статический)
    mc_uuid: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# --- Сборки (Instances) ---
class Instance(Base):
    __tablename__ = "instances"

    id: Mapped[str] = mapped_column(String(50), primary_key=True) # например "hitech-v1"
    title: Mapped[str] = mapped_column(String(100), nullable=False)
    mc_version: Mapped[str] = mapped_column(String(20), nullable=False) # "1.12.2"
    loader_type: Mapped[str] = mapped_column(String(20), nullable=False) # "forge"
    loader_version: Mapped[str] = mapped_column(String(50), nullable=True)
    
    # Ссылка на JSON манифест (для клиента)
    manifest_url: Mapped[str] = mapped_column(String(255), nullable=True)

    # Связь с файлами
    files = relationship(
        "File", 
        secondary=instance_files, 
        back_populates="instances",
        cascade="all, delete" # При удалении Instance, SQLAlchemy почистит связи
    )

# --- Файлы (Content Addressable Storage) ---
class File(Base):
    __tablename__ = "files"

    sha256: Mapped[str] = mapped_column(String(64), primary_key=True) # Хеш - это ID
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    size: Mapped[int] = mapped_column(BigInteger, nullable=False)
    s3_path: Mapped[str] = mapped_column(String(255), nullable=False) # Путь в MinIO
    
    uploaded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    
    instances = relationship("Instance", secondary=instance_files, back_populates="files")
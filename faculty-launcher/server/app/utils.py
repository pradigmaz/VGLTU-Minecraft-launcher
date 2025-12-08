# app/utils.py
import jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status, UploadFile
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import User
from app.database import async_session_factory
import os
import zipfile
import rarfile
import io
import hashlib
import tempfile
import re

# Секретный ключ — ОБЯЗАТЕЛЕН в проде
SECRET_KEY = os.getenv("SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("SECRET_KEY environment variable is required!")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 # Сутки

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/login")

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_db():
    async with async_session_factory() as session:
        yield session

# --- ГЛАВНАЯ ЗАЩИТА: Dependency для роутов ---
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        telegram_id: str = payload.get("sub")
        role: str = payload.get("role")
        if telegram_id is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    # Достаем юзера из БД
    stmt = select(User).where(User.telegram_id == int(telegram_id))
    user = (await db.execute(stmt)).scalars().first()
    
    if user is None:
        raise credentials_exception
    return user

# --- ЗАЩИТА АДМИНКИ ---
async def get_current_admin(user: User = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(
            status_code=403, 
            detail="You do not have admin privileges"
        )
    return user

# Максимальный размер загрузки (500 МБ)
MAX_UPLOAD_SIZE = 500 * 1024 * 1024 
# Максимальный размер распакованного контента (2 ГБ)
MAX_UNZIPPED_SIZE = 2 * 1024 * 1024 * 1024 
# Максимальный коэффициент сжатия (защита от бомб)
MAX_COMPRESSION_RATIO = 100 

async def validate_uploaded_archive(file: UploadFile) -> tuple[tempfile.SpooledTemporaryFile, str]:
    """
    Проверяет ZIP/RAR файл на безопасность и возвращает (SpooledTemporaryFile, archive_type).
    Экономит RAM: до 50 МБ в памяти, остальное на диск.
    """
    temp_file = tempfile.SpooledTemporaryFile(max_size=50 * 1024 * 1024, mode='w+b')
    
    try:
        # 1. Читаем чанками, проверяя размер
        total_size = 0
        chunk_size = 64 * 1024
        
        while True:
            chunk = await file.read(chunk_size)
            if not chunk:
                break
            total_size += len(chunk)
            if total_size > MAX_UPLOAD_SIZE:
                temp_file.close()
                raise HTTPException(status_code=413, detail="File too large")
            temp_file.write(chunk)
        
        # 2. Определяем тип по Magic Bytes
        temp_file.seek(0)
        header = temp_file.read(8)
        temp_file.seek(0)
        
        archive_type = None
        if header[:4] == b'PK\x03\x04':
            archive_type = 'zip'
        elif header[:7] == b'Rar!\x1a\x07\x00' or header[:7] == b'Rar!\x1a\x07\x01':
            archive_type = 'rar'
        else:
            temp_file.close()
            raise HTTPException(status_code=400, detail="Invalid file format. Only ZIP and RAR supported.")
        
        # 3. Проверка на бомбу
        unzipped_size = 0
        
        if archive_type == 'zip':
            try:
                with zipfile.ZipFile(temp_file) as zf:
                    for info in zf.infolist():
                        unzipped_size += info.file_size
                        if info.file_size > 0 and info.compress_size > 0:
                            ratio = info.file_size / info.compress_size
                            if ratio > MAX_COMPRESSION_RATIO:
                                temp_file.close()
                                raise HTTPException(status_code=400, detail="Archive bomb detected")
            except zipfile.BadZipFile:
                temp_file.close()
                raise HTTPException(status_code=400, detail="Corrupted ZIP file")
        
        elif archive_type == 'rar':
            try:
                with rarfile.RarFile(temp_file) as rf:
                    for info in rf.infolist():
                        unzipped_size += info.file_size
                        if info.file_size > 0 and info.compress_size > 0:
                            ratio = info.file_size / info.compress_size
                            if ratio > MAX_COMPRESSION_RATIO:
                                temp_file.close()
                                raise HTTPException(status_code=400, detail="Archive bomb detected")
            except rarfile.BadRarFile:
                temp_file.close()
                raise HTTPException(status_code=400, detail="Corrupted RAR file")
        
        if unzipped_size > MAX_UNZIPPED_SIZE:
            temp_file.close()
            raise HTTPException(status_code=400, detail="Unzipped size exceeds limit")
        
        temp_file.seek(0)
        return temp_file, archive_type
        
    except HTTPException:
        raise
    except Exception as e:
        temp_file.close()
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")

def calculate_sha256(data: bytes) -> str:
    sha256_hash = hashlib.sha256()
    sha256_hash.update(data)
    return sha256_hash.hexdigest()

def transliterate(text: str) -> str:
    """Транслитерация кириллицы в латиницу для URL-safe ID"""
    translit_map = {
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
        'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
        'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
        'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '',
        'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
    }
    result = []
    for char in text.lower():
        result.append(translit_map.get(char, char))
    return ''.join(result)

def generate_instance_id(title: str, mc_version: str) -> str:
    """Генерирует URL-safe ID из названия и версии"""
    # Транслитерация + очистка
    clean_title = transliterate(title)
    clean_title = re.sub(r'[^a-z0-9]+', '-', clean_title).strip('-')
    clean_version = mc_version.replace('.', '-')
    return f"{clean_title}-{clean_version}"

def validate_instance_id(instance_id: str) -> bool:
    """Проверяет что instance_id безопасен"""
    if not instance_id or len(instance_id) < 3 or len(instance_id) > 50:
        return False
    return bool(re.match(r'^[a-z0-9][a-z0-9-]*[a-z0-9]$', instance_id))

def validate_file_path(path: str) -> bool:
    """Проверяет путь на path traversal атаки"""
    if not path or len(path) > 500:
        return False
    # Нормализуем путь
    normalized = os.path.normpath(path)
    # Проверяем на выход за пределы
    if normalized.startswith('..') or normalized.startswith('/') or normalized.startswith('\\'):
        return False
    if '..' in normalized:
        return False
    # Проверяем на Windows-специфичные атаки
    if ':' in path or '\x00' in path:
        return False
    # Запрещаем абсолютные пути и скрытые файлы в корне
    if path.startswith('.') and not path.startswith('./'):
        return False
    return True
import paramiko
import os
import io
from sqlalchemy.future import select
from app.models import SFTPConnection, Instance, File as FileModel, instance_files
from app.database import minio_client, BUCKET_NAME
from datetime import datetime

class SFTPSyncService:
    def __init__(self, db_session):
        self.db = db_session

    async def sync_instance(self, instance_id: str):
        # 1. Получаем конфиг
        stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
        config = (await self.db.execute(stmt)).scalars().first()
        
        if not config:
            raise Exception("SFTP configuration not found")

        # 2. Получаем файлы инстанса
        stmt_files = (
            select(FileModel, instance_files.c.path)
            .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
            .where(instance_files.c.instance_id == instance_id)
        )
        files = (await self.db.execute(stmt_files)).all()

        # 3. Подключаемся по SFTP
        transport = paramiko.Transport((config.host, config.port))
        try:
            transport.connect(username=config.username, password=config.password)
            sftp = paramiko.SFTPClient.from_transport(transport)
            
            logs = []
            
            # 4. Определяем папки для синхра
            folders_to_sync = []
            if config.sync_mods: folders_to_sync.append("mods")
            if config.sync_config: folders_to_sync.append("config")
            if config.sync_scripts: folders_to_sync.append("scripts")
            if config.sync_shaderpacks: folders_to_sync.append("shaderpacks")
            if config.sync_resourcepacks: folders_to_sync.append("resourcepacks")

            for folder in folders_to_sync:
                logs.append(f"📂 Syncing folder: {folder}...")
                
                # Фильтруем файлы только для этой папки
                folder_files = [
                    (f, path) for f, path in files 
                    if path.startswith(f"{folder}/")
                ]
                
                # Создаем удаленную папку если нет
                try: sftp.mkdir(folder)
                except: pass

                # А. Получаем список файлов на сервере (для удаления лишних)
                remote_files = set()
                try:
                    remote_files = set(sftp.listdir(folder))
                except: pass

                # Б. Заливаем файлы
                expected_filenames = set()
                for file_obj, path_str in folder_files:
                    filename = os.path.basename(path_str)
                    expected_filenames.add(filename)
                    remote_path = f"{folder}/{filename}"
                    
                    # Проверяем размер (простая проверка изменений)
                    need_upload = True
                    try:
                        attrs = sftp.stat(remote_path)
                        if attrs.st_size == file_obj.size:
                            need_upload = False
                    except: pass # Файла нет

                    if need_upload:
                        logs.append(f"⬆️ Uploading: {filename}")
                        # Качаем с MinIO в память
                        data = minio_client.get_object(BUCKET_NAME, file_obj.s3_path)
                        # Лъем на SFTP
                        sftp.putfo(io.BytesIO(data.read()), remote_path)
                        data.close()
                        data.release_conn()

                # В. Удаляем лишнее (то, чего нет в базе, но есть на сервере)
                for r_file in remote_files:
                    if r_file not in expected_filenames:
                        logs.append(f"🗑️ Deleting remote: {r_file}")
                        try: sftp.remove(f"{folder}/{r_file}")
                        except: pass

            config.last_sync = datetime.utcnow()
            await self.db.commit()
            return "\n".join(logs)

        except Exception as e:
            raise Exception(f"SFTP Error: {str(e)}")
        finally:
            transport.close()
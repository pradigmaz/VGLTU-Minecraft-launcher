import paramiko
import os
import io
import logging
from sqlalchemy.future import select
from app.models import SFTPConnection, Instance, File as FileModel, instance_files, SideType
from app.database import minio_client, BUCKET_NAME
from app.security import decrypt_sftp_secret
from datetime import datetime

logger = logging.getLogger(__name__)

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
        # === ВАЖНО: Добавляем поле side в выборку ===
        stmt_files = (
            select(FileModel, instance_files.c.path, instance_files.c.side) # <--- ADD side
            .join(instance_files, FileModel.sha256 == instance_files.c.file_hash)
            .where(instance_files.c.instance_id == instance_id)
            # === ФИЛЬТР: Берем только то, что нужно серверу ===
            .where(instance_files.c.side.in_([SideType.SERVER, SideType.BOTH])) 
        )
        # files теперь список кортежей (FileModel, path, side)
        files_result = (await self.db.execute(stmt_files)).all() 

        # Преобразуем в удобный список, отбрасывая side (он уже отфильтрован)
        files = [(f, path) for f, path, side in files_result]

        # 3. Подключаемся по SFTP
        transport = paramiko.Transport((config.host, config.port))
        try:
            transport.connect(
                username=config.username,
                password=decrypt_sftp_secret(config.password),
            )
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
                
                # Создаем удаленную папку если нет.
                try:
                    sftp.mkdir(folder)
                except IOError:
                    try:
                        sftp.stat(folder)
                    except IOError as error:
                        raise RuntimeError(f"Cannot create SFTP folder {folder}") from error

                # А. Получаем список файлов на сервере (для удаления лишних)
                remote_files = set(sftp.listdir(folder))

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
                    except IOError:
                        pass  # Файла нет

                    if need_upload:
                        logs.append(f"⬆️ Uploading: {filename}")
                        # Качаем с MinIO в память
                        data = minio_client.get_object(BUCKET_NAME, file_obj.s3_path)
                        # Лъем на SFTP
                        try:
                            sftp.putfo(io.BytesIO(data.read()), remote_path)
                        finally:
                            data.close()
                            data.release_conn()

                # В. Удаляем лишнее (то, чего нет в базе, но есть на сервере)
                for r_file in remote_files:
                    if r_file not in expected_filenames:
                        logs.append(f"🗑️ Deleting remote: {r_file}")
                        sftp.remove(f"{folder}/{r_file}")

            config.last_sync = datetime.utcnow()
            await self.db.commit()
            return "\n".join(logs)

        except Exception as error:
            logger.exception("SFTP sync failed for instance %s", instance_id)
            raise RuntimeError("SFTP synchronization failed") from error
        finally:
            transport.close()

    async def cleanup_instance(self, instance_id: str, target_folders: list = None):
        """
        Удаляет указанные папки с удаленного сервера через SFTP.
        Используется при удалении сборки.
        """
        if target_folders is None:
            # Дефолтный набор для зачистки
            target_folders = ["mods", "config", "scripts", "shaderpacks", "resourcepacks"]

        # 1. Получаем конфиг (пока он еще есть в БД)
        stmt = select(SFTPConnection).where(SFTPConnection.instance_id == instance_id)
        config = (await self.db.execute(stmt)).scalars().first()
        
        if not config:
            logger.warning(f"Skipping remote cleanup for {instance_id}: No SFTP config found.")
            return

        logger.info(f"Starting remote cleanup for {instance_id} on {config.host}...")
        
        transport = paramiko.Transport((config.host, config.port))
        try:
            transport.connect(
                username=config.username,
                password=decrypt_sftp_secret(config.password),
            )
            sftp = paramiko.SFTPClient.from_transport(transport)

            for folder in target_folders:
                logger.info(f"Removing remote folder: {folder}")
                self._rmtree(sftp, folder)
                
            logger.info("Remote cleanup completed.")
        except Exception as e:
            logger.error(f"Remote cleanup failed: {e}")
            # Не рейзим ошибку, чтобы не блокировать удаление сборки из БД
        finally:
            transport.close()

    def _rmtree(self, sftp, remote_path):
        """
        Рекурсивное удаление папки через SFTP (аналог rm -rf)
        """
        try:
            files = sftp.listdir(remote_path)
        except IOError:
            # Папки нет или нет доступа
            return

        for f in files:
            filepath = os.path.join(remote_path, f).replace("\\", "/")
            try:
                # Пробуем удалить как файл
                sftp.remove(filepath)
            except IOError:
                # Если ошибка, скорее всего это папка -> рекурсия
                self._rmtree(sftp, filepath)
        
        try:
            sftp.rmdir(remote_path)
        except IOError:
            pass

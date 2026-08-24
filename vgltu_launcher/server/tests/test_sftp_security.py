import inspect
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from cryptography.fernet import Fernet
from fastapi import HTTPException

from app.routes import sftp
from app.schemas import SFTPConfigCreate
from app.security import decrypt_sftp_secret
from app.utils import get_current_admin


class _Result:
    def __init__(self, value):
        self.value = value

    def scalars(self):
        return self

    def first(self):
        return self.value


class _FakeDb:
    def __init__(self, *results):
        self.results = list(results)
        self.added = None

    async def execute(self, _statement):
        return _Result(self.results.pop(0))

    def add(self, value):
        self.added = value

    async def commit(self):
        pass


class SftpCredentialSecurityTests(unittest.IsolatedAsyncioTestCase):
    async def test_new_config_encrypts_sftp_and_rcon_passwords(self):
        key = Fernet.generate_key().decode("ascii")
        db = _FakeDb(SimpleNamespace(id="demo-pack"), None)
        config = SFTPConfigCreate(
            host="sftp.example.test",
            username="deploy",
            password="sftp-secret",
            rcon_password="rcon-secret",
        )

        with patch.dict(os.environ, {"SFTP_ENCRYPTION_KEY": key}):
            await sftp.create_or_update_config("demo-pack", config, db, SimpleNamespace(role="admin"))

            self.assertNotEqual(db.added.password, "sftp-secret")
            self.assertNotEqual(db.added.rcon_password, "rcon-secret")
            self.assertEqual(decrypt_sftp_secret(db.added.password), "sftp-secret")
            self.assertEqual(decrypt_sftp_secret(db.added.rcon_password), "rcon-secret")

    async def test_all_sftp_routes_require_admin(self):
        for route in sftp.router.routes:
            default = inspect.signature(route.endpoint).parameters["_current_admin"].default
            self.assertIs(default.dependency, get_current_admin)

    async def test_sync_hides_internal_sftp_error(self):
        db = _FakeDb(SimpleNamespace(id="demo-pack"))
        service = SimpleNamespace(sync_instance=AsyncMock(side_effect=RuntimeError("private host")))

        with patch.object(sftp, "SFTPSyncService", return_value=service):
            with self.assertLogs("app.routes.sftp", level="ERROR"):
                with self.assertRaises(HTTPException) as raised:
                    await sftp.run_sync("demo-pack", db, SimpleNamespace(role="admin"))

        self.assertEqual(raised.exception.status_code, 502)
        self.assertEqual(raised.exception.detail, "SFTP sync failed")

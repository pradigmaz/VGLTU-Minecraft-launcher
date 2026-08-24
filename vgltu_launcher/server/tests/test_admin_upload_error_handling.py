import io
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from fastapi import HTTPException

from app.routes import admin


class _Result:
    def scalars(self):
        return self

    def first(self):
        return None


class _FakeDb:
    async def execute(self, _statement):
        return _Result()

    def add(self, _value):
        pass

    async def flush(self):
        pass

    async def rollback(self):
        pass


class _ConfigResult:
    def __init__(self, value):
        self.value = value

    def scalars(self):
        return self

    def first(self):
        return self.value


class _ConfigDb:
    async def execute(self, _statement):
        return _ConfigResult(SimpleNamespace(s3_path="objects/config"))


class AdminUploadErrorHandlingTests(unittest.IsolatedAsyncioTestCase):
    async def test_archive_error_is_not_returned_to_client(self):
        with patch.object(
            admin,
            "validate_uploaded_archive",
            AsyncMock(return_value=(io.BytesIO(b"not a zip"), "zip")),
        ):
            with self.assertLogs("app.routes.admin", level="ERROR"):
                with self.assertRaises(HTTPException) as raised:
                    await admin.upload_instance_zip(
                        SimpleNamespace(),
                        "Test pack",
                        "1.12.2",
                        "forge",
                        _FakeDb(),
                        SimpleNamespace(role="admin"),
                    )

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(raised.exception.detail, "Upload failed")

    async def test_config_read_error_is_not_returned_to_client(self):
        def fail_get_object(*_args):
            raise RuntimeError("private endpoint")

        storage = SimpleNamespace(get_object=fail_get_object)
        with patch.object(admin, "minio_client", storage):
            with self.assertLogs("app.routes.admin", level="ERROR"):
                with self.assertRaises(HTTPException) as raised:
                    await admin.get_config_content(
                        "test-pack",
                        "config/server.properties",
                        _ConfigDb(),
                        SimpleNamespace(role="admin"),
                    )

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(raised.exception.detail, "Could not read config")

import unittest

from fastapi import HTTPException

from app.utils import validate_uploaded_archive


class _BrokenUpload:
    async def read(self, _size):
        raise RuntimeError("private storage path")


class ArchiveErrorHandlingTests(unittest.IsolatedAsyncioTestCase):
    async def test_internal_archive_error_is_not_returned_to_client(self):
        with self.assertLogs("app.utils", level="ERROR"):
            with self.assertRaises(HTTPException) as raised:
                await validate_uploaded_archive(_BrokenUpload())

        self.assertEqual(raised.exception.status_code, 500)
        self.assertEqual(raised.exception.detail, "File processing failed")

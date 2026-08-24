import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from app.file_visibility import archive_file_side, default_file_side
from app.models import SideType
from app.routes import client


class FileVisibilityTests(unittest.TestCase):
    def test_server_config_is_private_by_default(self):
        self.assertEqual(default_file_side("config/server.properties"), SideType.SERVER)
        self.assertEqual(default_file_side("ops.json"), SideType.SERVER)

    def test_client_config_requires_explicit_client_prefix(self):
        side, target_path = archive_file_side("client-config/options.toml")
        self.assertEqual(side, SideType.CLIENT)
        self.assertEqual(target_path, "config/options.toml")

    def test_mods_remain_available_to_client_and_server(self):
        self.assertEqual(default_file_side("mods/example.jar"), SideType.BOTH)


class _Result:
    def __init__(self, first=None, rows=()):
        self._first = first
        self._rows = rows

    def scalars(self):
        return self

    def first(self):
        return self._first

    def __iter__(self):
        return iter(self._rows)


class _FakeDb:
    def __init__(self, *results):
        self.results = list(results)

    async def execute(self, _statement):
        return self.results.pop(0)


class _ObjectResponse:
    def __init__(self):
        self.closed = False
        self.released = False

    def stream(self, *, amt):
        self.chunk_size = amt
        yield b"launcher-file"

    def close(self):
        self.closed = True

    def release_conn(self):
        self.released = True


class ClientDownloadTests(unittest.IsolatedAsyncioTestCase):
    file_hash = "a" * 64

    @staticmethod
    def _request():
        return Request(
            {
                "type": "http",
                "method": "GET",
                "path": "/api/client/instances/demo-pack/manifest",
                "headers": [(b"host", b"launcher.test")],
                "server": ("launcher.test", 80),
            }
        )

    async def test_manifest_uses_backend_download_proxy(self):
        instance = SimpleNamespace(id="demo-pack", mc_version="1.20.1", loader_type="forge")
        file_obj = SimpleNamespace(
            sha256=self.file_hash,
            filename="example.jar",
            size=12,
            s3_path="objects/aa/example",
        )
        db = _FakeDb(_Result(first=instance), _Result(rows=[(file_obj, "mods/example.jar")]))

        manifest = await client.get_instance_manifest(self._request(), "demo-pack", db)

        self.assertEqual(
            manifest.files[0].url,
            f"http://launcher.test/api/client/instances/demo-pack/files/{self.file_hash}",
        )

    async def test_server_only_file_is_not_downloadable(self):
        with self.assertRaises(HTTPException) as raised:
            await client.download_instance_file("demo-pack", self.file_hash, _FakeDb(_Result()))

        self.assertEqual(raised.exception.status_code, 404)

    async def test_client_file_streams_from_private_object_storage(self):
        file_obj = SimpleNamespace(size=13, s3_path="objects/aa/example")
        object_response = _ObjectResponse()
        minio = SimpleNamespace(get_object=lambda *_args: object_response)

        with patch.object(client, "minio_client", minio):
            response = await client.download_instance_file(
                "demo-pack", self.file_hash, _FakeDb(_Result(first=file_obj))
            )

        chunks = []
        async for chunk in response.body_iterator:
            chunks.append(chunk)
        await response.background()

        self.assertEqual(response.headers["content-length"], "13")
        self.assertEqual(b"".join(chunks), b"launcher-file")
        self.assertEqual(object_response.chunk_size, 64 * 1024)
        self.assertTrue(object_response.closed)
        self.assertTrue(object_response.released)

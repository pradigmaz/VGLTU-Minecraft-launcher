import unittest
import uuid
from types import SimpleNamespace
from unittest.mock import patch

from fastapi import HTTPException
from starlette.requests import Request

from app.routes import yggdrasil
from app.schemas import AuthenticateRequest
from app.security import hash_password


class _Result:
    def __init__(self, user):
        self.user = user

    def scalars(self):
        return self

    def first(self):
        return self.user


class _FakeDb:
    def __init__(self, user):
        self.user = user

    async def execute(self, _statement):
        return _Result(self.user)


class _FakeRedis:
    def __init__(self):
        self.values = {}

    async def set(self, key, value, **_kwargs):
        self.values[key] = value


class YggdrasilPasswordTests(unittest.IsolatedAsyncioTestCase):
    @staticmethod
    def _request():
        return Request(
            {
                "type": "http",
                "method": "POST",
                "path": "/authserver/authenticate",
                "headers": [],
                "client": ("127.0.0.1", 12345),
            }
        )

    def _player(self, *, is_banned=False):
        return SimpleNamespace(
            id=uuid.uuid4(),
            username="player",
            mc_uuid=uuid.uuid4(),
            password_hash=hash_password("correct horse battery staple"),
            is_banned=is_banned,
        )

    async def test_rejects_wrong_password(self):
        with self.assertRaises(HTTPException) as raised:
            await yggdrasil.authenticate(
                self._request(),
                AuthenticateRequest(username="player", password="wrong password"),
                _FakeDb(self._player()),
            )

        self.assertEqual(raised.exception.status_code, 403)

    async def test_issues_session_for_correct_password(self):
        redis = _FakeRedis()
        with patch.object(yggdrasil, "redis_client", redis):
            response = await yggdrasil.authenticate(
                self._request(),
                AuthenticateRequest(username="player", password="correct horse battery staple"),
                _FakeDb(self._player()),
            )

        self.assertIn("accessToken", response)
        self.assertIn(f"session:{response['accessToken']}", redis.values)

    async def test_rejects_banned_player_before_creating_session(self):
        with self.assertRaises(HTTPException) as raised:
            await yggdrasil.authenticate(
                self._request(),
                AuthenticateRequest(username="player", password="correct horse battery staple"),
                _FakeDb(self._player(is_banned=True)),
            )

        self.assertEqual(raised.exception.status_code, 403)

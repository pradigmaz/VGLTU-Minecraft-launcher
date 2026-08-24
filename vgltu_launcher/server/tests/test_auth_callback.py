import unittest
from unittest.mock import patch

from fastapi import HTTPException

from app.routes import auth


class _EmptyResult:
    def scalars(self):
        return self

    def first(self):
        return None


class _FakeDb:
    async def execute(self, _statement):
        return _EmptyResult()

    def add(self, _item):
        pass

    async def commit(self):
        pass


class _FakeRedis:
    def __init__(self):
        self.values = {"auth_code:local-proof": "pending"}

    async def get(self, key):
        return self.values.get(key)

    async def set(self, key, value, **_kwargs):
        self.values[key] = value


class AuthCallbackSecretTests(unittest.IsolatedAsyncioTestCase):
    async def test_callback_without_secret_is_rejected(self):
        with (
            patch.object(auth, "ADMIN_IDS", [424242]),
            patch.object(auth, "BOT_CALLBACK_SECRET", "expected-secret", create=True),
            patch.object(auth, "redis_client", _FakeRedis()),
        ):
            with self.assertRaises(HTTPException) as raised:
                await auth.bot_callback(
                    auth.BotCallback(
                        code="local-proof",
                        telegram_id=424242,
                        username="forged",
                    ),
                    _FakeDb(),
                )

        self.assertEqual(raised.exception.status_code, 403)

    async def test_callback_with_correct_secret_issues_code(self):
        redis = _FakeRedis()
        with (
            patch.object(auth, "ADMIN_IDS", [424242]),
            patch.object(auth, "BOT_CALLBACK_SECRET", "expected-secret"),
            patch.object(auth, "redis_client", redis),
        ):
            response = await auth.bot_callback(
                auth.BotCallback(
                    code="local-proof",
                    telegram_id=424242,
                    username="admin",
                ),
                _FakeDb(),
                "expected-secret",
            )

        self.assertEqual(response["status"], "ok")
        self.assertNotEqual(redis.values["auth_code:local-proof"], "pending")

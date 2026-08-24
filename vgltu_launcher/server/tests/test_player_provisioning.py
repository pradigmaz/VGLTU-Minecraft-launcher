import inspect
import unittest
from types import SimpleNamespace

from fastapi import HTTPException

from app.routes import players
from app.schemas import PlayerCreate
from app.security import verify_password
from app.utils import get_current_admin


class _Result:
    def scalars(self):
        return self

    def first(self):
        return None


class _FakeDb:
    def __init__(self):
        self.added = None

    async def execute(self, _statement):
        return _Result()

    def add(self, value):
        self.added = value

    async def commit(self):
        pass


class PlayerProvisioningTests(unittest.IsolatedAsyncioTestCase):
    async def test_admin_provisioning_hashes_player_password(self):
        db = _FakeDb()
        response = await players.create_player(
            PlayerCreate(username="  TestPlayer  ", password="correct horse battery staple"),
            db,
            SimpleNamespace(role="admin"),
        )

        self.assertEqual(response["username"], "TestPlayer")
        self.assertEqual(db.added.role, "student")
        self.assertTrue(verify_password("correct horse battery staple", db.added.password_hash))

    async def test_rejects_whitespace_only_username(self):
        with self.assertRaises(HTTPException) as raised:
            await players.create_player(
                PlayerCreate(username="   ", password="correct horse battery staple"),
                _FakeDb(),
                SimpleNamespace(role="admin"),
            )

        self.assertEqual(raised.exception.status_code, 422)

    async def test_player_route_requires_admin(self):
        route = players.router.routes[0]
        default = inspect.signature(route.endpoint).parameters["_current_admin"].default
        self.assertIs(default.dependency, get_current_admin)

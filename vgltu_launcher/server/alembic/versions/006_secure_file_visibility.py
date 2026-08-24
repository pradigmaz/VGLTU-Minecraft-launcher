"""Secure file visibility defaults

Revision ID: 006_file_visibility
Revises: 005_player_password
Create Date: 2026-08-24
"""

from alembic import op


revision = "006_file_visibility"
down_revision = "005_player_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE instance_files
        SET side = 'SERVER'
        WHERE lower(path) LIKE 'config/%'
           OR lower(path) LIKE 'defaultconfigs/%'
           OR lower(path) LIKE 'scripts/%'
           OR lower(path) LIKE 'world/%'
           OR lower(path) LIKE 'logs/%'
           OR lower(path) IN (
               'server.properties', 'eula.txt', 'ops.json', 'whitelist.json',
               'banned-ips.json', 'banned-players.json', 'usercache.json'
           )
        """
    )


def downgrade() -> None:
    pass

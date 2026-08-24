"""Add player password hash

Revision ID: 005_player_password
Revises: 004_side
Create Date: 2026-08-24
"""

from alembic import op
import sqlalchemy as sa


revision = "005_player_password"
down_revision = "004_side"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("password_hash", sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "password_hash")

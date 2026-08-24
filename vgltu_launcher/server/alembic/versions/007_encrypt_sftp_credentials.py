"""Encrypt SFTP credentials at rest.

Revision ID: 007_sftp_credentials
Revises: 006_file_visibility
Create Date: 2026-08-24
"""

import os

from alembic import op
from cryptography.fernet import Fernet
import sqlalchemy as sa


revision = "007_sftp_credentials"
down_revision = "006_file_visibility"
branch_labels = None
depends_on = None


def _fernet() -> Fernet:
    key = os.getenv("SFTP_ENCRYPTION_KEY")
    if not key:
        raise RuntimeError("SFTP_ENCRYPTION_KEY is required to migrate SFTP credentials")
    return Fernet(key.encode("ascii"))


def upgrade() -> None:
    connection = op.get_bind()
    rows = list(
        connection.execute(
            sa.text("SELECT id, password, rcon_password FROM sftp_connections")
        ).mappings()
    )

    if rows:
        fernet = _fernet()
        for row in rows:
            values = {
                "id": row["id"],
                "password": fernet.encrypt(row["password"].encode("utf-8")).decode("ascii"),
                "rcon_password": (
                    fernet.encrypt(row["rcon_password"].encode("utf-8")).decode("ascii")
                    if row["rcon_password"]
                    else None
                ),
            }
            connection.execute(
                sa.text(
                    """
                    UPDATE sftp_connections
                    SET password = :password,
                        rcon_password = COALESCE(:rcon_password, rcon_password)
                    WHERE id = :id
                    """
                ),
                values,
            )

    op.alter_column(
        "sftp_connections",
        "password",
        existing_type=sa.String(),
        type_=sa.Text(),
        existing_nullable=False,
    )
    op.alter_column(
        "sftp_connections",
        "rcon_password",
        existing_type=sa.String(),
        type_=sa.Text(),
        existing_nullable=True,
    )


def downgrade() -> None:
    raise RuntimeError(
        "SFTP credential encryption is irreversible; restore a database backup to downgrade."
    )

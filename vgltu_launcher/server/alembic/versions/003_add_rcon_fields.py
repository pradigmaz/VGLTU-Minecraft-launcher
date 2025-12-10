"""Add RCON fields to SFTPConnection

Revision ID: 003_rcon
Revises: 002_sftp
Create Date: 2025-12-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '003_rcon'
down_revision: Union[str, None] = '002_sftp'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Добавляем поля для RCON
    op.add_column('sftp_connections', sa.Column('rcon_host', sa.String(255), nullable=True)) # Если null, берем sftp host
    op.add_column('sftp_connections', sa.Column('rcon_port', sa.Integer(), server_default='25575', nullable=False))
    op.add_column('sftp_connections', sa.Column('rcon_password', sa.String(255), nullable=True)) # Храним зашифрованным!

def downgrade() -> None:
    op.drop_column('sftp_connections', 'rcon_password')
    op.drop_column('sftp_connections', 'rcon_port')
    op.drop_column('sftp_connections', 'rcon_host')
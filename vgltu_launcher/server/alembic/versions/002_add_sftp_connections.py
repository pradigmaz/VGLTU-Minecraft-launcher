"""Add SFTP connections table

Revision ID: 002_sftp
Revises: 001_initial
Create Date: 2025-12-09

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = '002_sftp'
down_revision: Union[str, None] = '001_initial'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('sftp_connections',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('instance_id', sa.String(50), nullable=False),
        sa.Column('host', sa.String(255), nullable=False),
        sa.Column('port', sa.Integer(), nullable=False),
        sa.Column('username', sa.String(100), nullable=False),
        sa.Column('password', sa.String(255), nullable=False),
        sa.Column('sync_mods', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sync_config', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('sync_shaderpacks', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sync_resourcepacks', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sync_scripts', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('auto_sync', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('sync_interval_minutes', sa.Integer(), nullable=False, server_default='60'),
        sa.Column('last_sync', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['instance_id'], ['instances.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('instance_id')
    )
    op.create_index('ix_sftp_connections_instance_id', 'sftp_connections', ['instance_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_sftp_connections_instance_id', table_name='sftp_connections')
    op.drop_table('sftp_connections')

"""Initial schema

Revision ID: 001_initial
Revises: 
Create Date: 2025-12-07

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table('users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('telegram_id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(50), nullable=False),
        sa.Column('role', sa.String(20), nullable=True),
        sa.Column('is_banned', sa.Boolean(), nullable=True),
        sa.Column('mc_uuid', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('telegram_id'),
        sa.UniqueConstraint('username')
    )
    op.create_index('ix_users_telegram_id', 'users', ['telegram_id'], unique=True)

    # Instances table
    op.create_table('instances',
        sa.Column('id', sa.String(50), nullable=False),
        sa.Column('title', sa.String(100), nullable=False),
        sa.Column('mc_version', sa.String(20), nullable=False),
        sa.Column('loader_type', sa.String(20), nullable=False),
        sa.Column('loader_version', sa.String(50), nullable=True),
        sa.Column('manifest_url', sa.String(255), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )

    # Files table
    op.create_table('files',
        sa.Column('sha256', sa.String(64), nullable=False),
        sa.Column('filename', sa.String(255), nullable=False),
        sa.Column('size', sa.BigInteger(), nullable=False),
        sa.Column('s3_path', sa.String(255), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('sha256')
    )

    # Instance-Files association table
    op.create_table('instance_files',
        sa.Column('instance_id', sa.String(), nullable=False),
        sa.Column('file_hash', sa.String(), nullable=False),
        sa.Column('path', sa.String(), nullable=False),
        sa.ForeignKeyConstraint(['file_hash'], ['files.sha256']),
        sa.ForeignKeyConstraint(['instance_id'], ['instances.id']),
        sa.PrimaryKeyConstraint('instance_id', 'file_hash')
    )


def downgrade() -> None:
    op.drop_table('instance_files')
    op.drop_table('files')
    op.drop_table('instances')
    op.drop_index('ix_users_telegram_id', table_name='users')
    op.drop_table('users')

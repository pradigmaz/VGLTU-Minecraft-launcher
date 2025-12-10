"""Add side column to instance_files

Revision ID: 004_side
Revises: 003_rcon
Create Date: 2025-12-10
"""
from alembic import op
import sqlalchemy as sa

revision = '004_side'
down_revision = '003_rcon'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Создаем ENUM тип если не существует
    sidetype = sa.Enum('CLIENT', 'SERVER', 'BOTH', name='sidetype')
    sidetype.create(op.get_bind(), checkfirst=True)
    
    # Добавляем колонку
    op.add_column('instance_files', sa.Column('side', sidetype, nullable=False, server_default='BOTH'))


def downgrade() -> None:
    op.drop_column('instance_files', 'side')
    # Удаляем ENUM тип
    sa.Enum(name='sidetype').drop(op.get_bind(), checkfirst=True)

"""Аватарки: пол (f/m, выбирает ученик) и id выбранной картинки

Revision ID: 0021
Revises: 0020
"""
from alembic import op
import sqlalchemy as sa


revision = '0021'
down_revision = '0020'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('gender', sa.String(1), nullable=True))
    op.add_column('users', sa.Column('avatar', sa.String(8), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'avatar')
    op.drop_column('users', 'gender')

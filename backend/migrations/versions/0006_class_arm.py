"""classes: pilot arm (treatment / control)

Revision ID: 0006
Revises: 0005
"""
from alembic import op
import sqlalchemy as sa


revision = '0006'
down_revision = '0005'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('classes', sa.Column('arm', sa.String(length=10), server_default='', nullable=False))


def downgrade() -> None:
    op.drop_column('classes', 'arm')

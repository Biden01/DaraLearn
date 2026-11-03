"""monthly goal: day the schedule starts from

Revision ID: 0008
Revises: 0007
"""
from alembic import op
import sqlalchemy as sa


revision = '0008'
down_revision = '0007'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('monthly_goals', sa.Column('starts_on', sa.Date(), nullable=True))


def downgrade() -> None:
    op.drop_column('monthly_goals', 'starts_on')

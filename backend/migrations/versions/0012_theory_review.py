"""lessons: проверка теории учителем (theory_ok, theory_ok_at, theory_ok_by, theory_comment)

Revision ID: 0012
Revises: 0011
"""
from alembic import op
import sqlalchemy as sa


revision = '0012'
down_revision = '0011'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('lessons', sa.Column('theory_ok', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('lessons', sa.Column('theory_ok_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('lessons', sa.Column('theory_ok_by', sa.Integer(), nullable=True))
    op.add_column('lessons', sa.Column('theory_comment', sa.Text(), server_default='', nullable=False))


def downgrade() -> None:
    for c in ('theory_comment', 'theory_ok_by', 'theory_ok_at', 'theory_ok'):
        op.drop_column('lessons', c)

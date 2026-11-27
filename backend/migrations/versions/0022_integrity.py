"""Защита от списывания и доверие: порядок вариантов и сигналы честности у попыток и проверки Tutor, отметки у ответов

Revision ID: 0022
Revises: 0021
"""
from alembic import op
import sqlalchemy as sa


revision = '0022'
down_revision = '0021'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('attempts', sa.Column('option_order', sa.JSON(), nullable=True))
    op.add_column('attempts', sa.Column('integrity', sa.JSON(), nullable=True))
    op.add_column('learning_events', sa.Column('flags', sa.String(60), nullable=True))
    op.add_column('tutor_sessions', sa.Column('check_task_ids', sa.JSON(), nullable=True))
    op.add_column('tutor_sessions', sa.Column('check_order', sa.JSON(), nullable=True))
    op.add_column('tutor_sessions', sa.Column('check_started_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tutor_sessions', 'check_started_at')
    op.drop_column('tutor_sessions', 'check_order')
    op.drop_column('tutor_sessions', 'check_task_ids')
    op.drop_column('learning_events', 'flags')
    op.drop_column('attempts', 'integrity')
    op.drop_column('attempts', 'option_order')

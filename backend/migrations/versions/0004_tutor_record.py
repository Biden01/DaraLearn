"""tutor session structured record

Revision ID: 0004
Revises: 0003
"""
from alembic import op
import sqlalchemy as sa


revision = '0004'
down_revision = '0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('tutor_sessions', sa.Column('first_task_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_tutor_sessions_first_task', 'tutor_sessions', 'tasks', ['first_task_id'], ['id'])
    op.add_column('tutor_sessions', sa.Column('first_attempt_correct', sa.Boolean(), nullable=True))
    op.add_column('tutor_sessions', sa.Column('hints_used', sa.Integer(), server_default='0', nullable=False))
    op.add_column('tutor_sessions', sa.Column('misconception', sa.Text(), server_default='', nullable=False))
    op.add_column('tutor_sessions', sa.Column('tutor_confidence', sa.String(length=10), server_default='high', nullable=False))
    op.add_column('tutor_sessions', sa.Column('style_used', sa.String(length=20), server_default='', nullable=False))
    op.add_column('tutor_sessions', sa.Column('escalated', sa.Boolean(), server_default='false', nullable=False))
    op.add_column('tutor_sessions', sa.Column('prompt_version', sa.String(length=20), server_default='', nullable=False))


def downgrade() -> None:
    for col in ('prompt_version', 'escalated', 'style_used', 'tutor_confidence', 'misconception', 'hints_used',
                'first_attempt_correct'):
        op.drop_column('tutor_sessions', col)
    op.drop_constraint('fk_tutor_sessions_first_task', 'tutor_sessions', type_='foreignkey')
    op.drop_column('tutor_sessions', 'first_task_id')

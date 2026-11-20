"""Показать решение: bookwork_checks (фото тетради к проверочному заданию, PLAN.md §9 #6)

Revision ID: 0017
Revises: 0016
"""
from alembic import op
import sqlalchemy as sa


revision = '0017'
down_revision = '0016'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'bookwork_checks',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('attempt_id', sa.Integer(), sa.ForeignKey('attempts.id', ondelete='CASCADE'), nullable=False),
        sa.Column('task_id', sa.Integer(), sa.ForeignKey('tasks.id'), nullable=False),
        sa.Column('image_path', sa.String(255), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending_ai'),
        sa.Column('ai_verdict', sa.String(20), nullable=False, server_default=''),
        sa.Column('ai_reason', sa.Text(), nullable=False, server_default=''),
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
        sa.Column('teacher_note', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_bookwork_checks_user_id'), 'bookwork_checks', ['user_id'], unique=False)
    op.create_index(op.f('ix_bookwork_checks_attempt_id'), 'bookwork_checks', ['attempt_id'], unique=False)
    op.create_index(op.f('ix_bookwork_checks_status'), 'bookwork_checks', ['status'], unique=False)


def downgrade() -> None:
    op.drop_table('bookwork_checks')

"""Расписание учителя: schedule_lessons (класс, день недели, начало, длительность, кабинет)

Revision ID: 0019
Revises: 0018
"""
from alembic import op
import sqlalchemy as sa


revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'schedule_lessons',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('class_id', sa.Integer(), sa.ForeignKey('classes.id', ondelete='CASCADE'), nullable=False),
        sa.Column('weekday', sa.Integer(), nullable=False),
        sa.Column('start', sa.String(5), nullable=False),
        sa.Column('minutes', sa.Integer(), nullable=False, server_default='45'),
        sa.Column('room', sa.String(30), nullable=False, server_default=''),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(op.f('ix_schedule_lessons_class_id'), 'schedule_lessons', ['class_id'], unique=False)


def downgrade() -> None:
    op.drop_table('schedule_lessons')

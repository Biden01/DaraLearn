"""Заморозка серии: users.streak_freezes/freeze_milestone, streak_freeze_uses (какой день спасён)

Revision ID: 0016
Revises: 0015
"""
from alembic import op
import sqlalchemy as sa


revision = '0016'
down_revision = '0015'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('streak_freezes', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('freeze_milestone', sa.Integer(), server_default='0', nullable=False))
    op.create_table(
        'streak_freeze_uses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'day'),
    )
    op.create_index(op.f('ix_streak_freeze_uses_user_id'), 'streak_freeze_uses', ['user_id'], unique=False)
    op.create_index(op.f('ix_streak_freeze_uses_day'), 'streak_freeze_uses', ['day'], unique=False)


def downgrade() -> None:
    op.drop_table('streak_freeze_uses')
    op.drop_column('users', 'freeze_milestone')
    op.drop_column('users', 'streak_freezes')

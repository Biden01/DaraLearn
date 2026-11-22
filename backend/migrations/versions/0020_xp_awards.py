"""Опыт и ранги: xp_awards (журнал начислений с уникальным ключом на ученика)

Revision ID: 0020
Revises: 0019
"""
from alembic import op
import sqlalchemy as sa


revision = '0020'
down_revision = '0019'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'xp_awards',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('key', sa.String(80), nullable=False),
        sa.Column('kind', sa.String(20), nullable=False),
        sa.Column('xp', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'key'),
    )
    op.create_index(op.f('ix_xp_awards_user_id'), 'xp_awards', ['user_id'], unique=False)


def downgrade() -> None:
    op.drop_table('xp_awards')

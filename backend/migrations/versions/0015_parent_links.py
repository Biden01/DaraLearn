"""parent_links: кабинет родителя — связь родитель ↔ ребёнок по коду ученика

Revision ID: 0015
Revises: 0014
"""
from alembic import op
import sqlalchemy as sa


revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'parent_links',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('code', sa.String(length=12), nullable=True, unique=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('linked_at', sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index(op.f('ix_parent_links_student_id'), 'parent_links', ['student_id'], unique=False)
    op.create_index(op.f('ix_parent_links_parent_id'), 'parent_links', ['parent_id'], unique=False)


def downgrade() -> None:
    op.drop_table('parent_links')

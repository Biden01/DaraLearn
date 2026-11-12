"""Роль «родитель»: users.family_code (код для привязки), parent_links (родитель↔ученик)

Revision ID: 0014
Revises: 0013
"""
from alembic import op
import sqlalchemy as sa


revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('family_code', sa.String(length=8), nullable=True))
    op.create_index(op.f('ix_users_family_code'), 'users', ['family_code'], unique=True)
    op.create_table(
        'parent_links',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('parent_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('student_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('parent_id', 'student_id'),
    )
    op.create_index(op.f('ix_parent_links_parent_id'), 'parent_links', ['parent_id'], unique=False)
    op.create_index(op.f('ix_parent_links_student_id'), 'parent_links', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_table('parent_links')
    op.drop_index(op.f('ix_users_family_code'), table_name='users')
    op.drop_column('users', 'family_code')

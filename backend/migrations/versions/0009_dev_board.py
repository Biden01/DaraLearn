"""dev scrum board: tasks

Revision ID: 0009
Revises: 0008
"""
from alembic import op
import sqlalchemy as sa


revision = '0009'
down_revision = '0008'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('dev_tasks',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('title', sa.String(length=300), nullable=False),
    sa.Column('description', sa.Text(), nullable=False),
    sa.Column('column', sa.String(length=20), nullable=False),
    sa.Column('position', sa.Float(), nullable=False),
    sa.Column('assignee', sa.String(length=20), nullable=False),
    sa.Column('points', sa.Integer(), nullable=False),
    sa.Column('label', sa.String(length=20), nullable=False),
    sa.Column('sprint', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_dev_tasks_column'), 'dev_tasks', ['column'], unique=False)


def downgrade() -> None:
    op.drop_table('dev_tasks')

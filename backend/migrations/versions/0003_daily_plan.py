"""daily plan: class topics, plans, plan items

Revision ID: 0003
Revises: 0002
"""
from alembic import op
import sqlalchemy as sa


revision = '0003'
down_revision = '0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('class_topics',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('class_id', sa.Integer(), nullable=False),
    sa.Column('course_id', sa.Integer(), nullable=False),
    sa.Column('starts_on', sa.Date(), nullable=False),
    sa.Column('set_by', sa.Integer(), nullable=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['class_id'], ['classes.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['course_id'], ['courses.id']),
    sa.ForeignKeyConstraint(['set_by'], ['users.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('class_id', 'starts_on')
    )
    op.create_index(op.f('ix_class_topics_class_id'), 'class_topics', ['class_id'], unique=False)
    op.create_table('daily_plans',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('day', sa.Date(), nullable=False),
    sa.Column('rules_version', sa.String(length=20), nullable=False),
    sa.Column('total_minutes', sa.Integer(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'day')
    )
    op.create_index(op.f('ix_daily_plans_day'), 'daily_plans', ['day'], unique=False)
    op.create_index(op.f('ix_daily_plans_user_id'), 'daily_plans', ['user_id'], unique=False)
    op.create_table('plan_items',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('plan_id', sa.Integer(), nullable=False),
    sa.Column('block', sa.String(length=10), nullable=False),
    sa.Column('lesson_id', sa.Integer(), nullable=False),
    sa.Column('reason', sa.String(length=20), nullable=False),
    sa.Column('minutes', sa.Integer(), nullable=False),
    sa.Column('task_ids', sa.JSON(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('status', sa.String(length=10), nullable=False),
    sa.Column('done_at', sa.DateTime(timezone=True), nullable=True),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id']),
    sa.ForeignKeyConstraint(['plan_id'], ['daily_plans.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_plan_items_plan_id'), 'plan_items', ['plan_id'], unique=False)


def downgrade() -> None:
    op.drop_table('plan_items')
    op.drop_table('daily_plans')
    op.drop_table('class_topics')

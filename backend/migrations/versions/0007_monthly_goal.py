"""monthly goal: goals, goal topics by week

Revision ID: 0007
Revises: 0006
"""
from alembic import op
import sqlalchemy as sa


revision = '0007'
down_revision = '0006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table('monthly_goals',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=False),
    sa.Column('month', sa.Date(), nullable=False),
    sa.Column('rules_version', sa.String(length=20), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id'),
    sa.UniqueConstraint('user_id', 'month')
    )
    op.create_index(op.f('ix_monthly_goals_user_id'), 'monthly_goals', ['user_id'], unique=False)
    op.create_table('goal_topics',
    sa.Column('id', sa.Integer(), nullable=False),
    sa.Column('goal_id', sa.Integer(), nullable=False),
    sa.Column('lesson_id', sa.Integer(), nullable=False),
    sa.Column('week', sa.Integer(), nullable=False),
    sa.Column('order', sa.Integer(), nullable=False),
    sa.Column('start_status', sa.String(length=10), nullable=False),
    sa.Column('start_proof', sa.Float(), nullable=False),
    sa.ForeignKeyConstraint(['goal_id'], ['monthly_goals.id'], ondelete='CASCADE'),
    sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id']),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_goal_topics_goal_id'), 'goal_topics', ['goal_id'], unique=False)


def downgrade() -> None:
    op.drop_table('goal_topics')
    op.drop_table('monthly_goals')

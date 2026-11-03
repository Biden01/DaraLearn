"""teacher_time_logs (замер времени учителя), survey_responses (опрос удобства)

Revision ID: 0013
Revises: 0012
"""
from alembic import op
import sqlalchemy as sa


revision = '0013'
down_revision = '0012'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'teacher_time_logs',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('week', sa.Date(), nullable=False),
        sa.Column('phase', sa.String(length=10), nullable=False),
        sa.Column('check_minutes', sa.Integer(), nullable=False),
        sa.Column('review_minutes', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'week'),
    )
    op.create_index(op.f('ix_teacher_time_logs_user_id'), 'teacher_time_logs', ['user_id'], unique=False)
    op.create_table(
        'survey_responses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('survey', sa.String(length=20), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('answers', sa.JSON(), nullable=False),
        sa.Column('comment', sa.Text(), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('user_id', 'survey'),
    )
    op.create_index(op.f('ix_survey_responses_user_id'), 'survey_responses', ['user_id'], unique=False)
    op.create_index(op.f('ix_survey_responses_survey'), 'survey_responses', ['survey'], unique=False)


def downgrade() -> None:
    op.drop_table('survey_responses')
    op.drop_table('teacher_time_logs')

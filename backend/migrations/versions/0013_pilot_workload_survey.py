"""teacher_time_logs и survey_responses: нагрузка учителя до/после и опрос удобства

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
        sa.Column('teacher_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('day', sa.Date(), nullable=False),
        sa.Column('checking_min', sa.Integer(), nullable=False),
        sa.Column('errors_min', sa.Integer(), nullable=False),
        sa.Column('note', sa.Text(), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('teacher_id', 'day'),
    )
    op.create_index(op.f('ix_teacher_time_logs_teacher_id'), 'teacher_time_logs', ['teacher_id'])
    op.create_index(op.f('ix_teacher_time_logs_day'), 'teacher_time_logs', ['day'])
    op.create_table(
        'survey_responses',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(length=20), nullable=False),
        sa.Column('week', sa.Date(), nullable=False),
        sa.Column('ease', sa.SmallInteger(), nullable=False),
        sa.Column('useful', sa.SmallInteger(), nullable=False),
        sa.Column('recommend', sa.SmallInteger(), nullable=False),
        sa.Column('comment', sa.Text(), server_default='', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.UniqueConstraint('user_id', 'week'),
    )
    op.create_index(op.f('ix_survey_responses_user_id'), 'survey_responses', ['user_id'])
    op.create_index(op.f('ix_survey_responses_week'), 'survey_responses', ['week'])


def downgrade() -> None:
    op.drop_table('survey_responses')
    op.drop_table('teacher_time_logs')

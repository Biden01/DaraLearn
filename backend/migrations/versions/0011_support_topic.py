"""support_messages: topic (тема обращения)

Revision ID: 0011
Revises: 0010
"""
from alembic import op
import sqlalchemy as sa


revision = '0011'
down_revision = '0010'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('support_messages', sa.Column('topic', sa.String(length=20), server_default='other', nullable=False))
    op.create_index(op.f('ix_support_messages_topic'), 'support_messages', ['topic'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_support_messages_topic'), table_name='support_messages')
    op.drop_column('support_messages', 'topic')

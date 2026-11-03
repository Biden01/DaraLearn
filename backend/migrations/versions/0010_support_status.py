"""support_messages: status (new / done), who and when resolved

Revision ID: 0010
Revises: 0009
"""
from alembic import op
import sqlalchemy as sa


revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('support_messages', sa.Column('status', sa.String(length=10), server_default='new', nullable=False))
    op.add_column('support_messages', sa.Column('resolved_by', sa.Integer(), nullable=True))
    op.add_column('support_messages', sa.Column('resolved_at', sa.DateTime(timezone=True), nullable=True))
    op.create_foreign_key('support_messages_resolved_by_fkey', 'support_messages', 'users', ['resolved_by'], ['id'],
                          ondelete='SET NULL')
    op.create_index(op.f('ix_support_messages_status'), 'support_messages', ['status'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_support_messages_status'), table_name='support_messages')
    op.drop_constraint('support_messages_resolved_by_fkey', 'support_messages', type_='foreignkey')
    op.drop_column('support_messages', 'resolved_at')
    op.drop_column('support_messages', 'resolved_by')
    op.drop_column('support_messages', 'status')

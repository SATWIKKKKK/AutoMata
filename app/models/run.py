from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from datetime import datetime
import uuid

class WorkflowRun(Base):
    __tablename__ = "workflow_runs"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default='running', index=True)
    started_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow, index=True)
    ended_at = Column(DateTime(timezone=True))
    total_tokens_used = Column(Integer, default=0)
    total_cost_inr = Column(Numeric(10, 4), default=0.0)
    run_log = Column(JSONB)

class NodeExecution(Base):
    __tablename__ = "node_executions"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True)
    node_id = Column(UUID(as_uuid=True), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False, index=True)
    status = Column(String, nullable=False, default='pending', index=True)
    input = Column(JSONB)
    output = Column(JSONB)
    tokens_used = Column(Integer, default=0)
    cost_inr = Column(Numeric(10, 4), default=0.0)
    duration_ms = Column(Integer)
    evaluator_score = Column(Integer)
    retry_count = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    ended_at = Column(DateTime(timezone=True))

class HumanGateRequest(Base):
    __tablename__ = "human_gate_requests"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_execution_id = Column(UUID(as_uuid=True), ForeignKey("node_executions.id", ondelete="CASCADE"), nullable=False, index=True)
    assigned_to_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"))
    status = Column(String, nullable=False, default='pending')
    context = Column(JSONB)
    decided_at = Column(DateTime(timezone=True))

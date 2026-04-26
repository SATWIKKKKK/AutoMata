from sqlalchemy import Column, String, DateTime, ForeignKey, Numeric
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.core.database import Base
from datetime import datetime
import uuid

class Workflow(Base):
    __tablename__ = "workflows"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workspace_id = Column(UUID(as_uuid=True), ForeignKey("workspaces.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(String)
    natural_language_prompt = Column(String)
    status = Column(String, nullable=False, default='draft', index=True)
    cron_schedule = Column(String(50))
    estimated_cost_per_run_inr = Column(Numeric(10, 4))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class WorkflowNode(Base):
    __tablename__ = "workflow_nodes"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    node_type = Column(String, nullable=False)
    config = Column(JSONB, nullable=False, default={})
    position_x = Column(Numeric)
    position_y = Column(Numeric)
    label = Column(String(255))
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)

class WorkflowEdge(Base):
    __tablename__ = "workflow_edges"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    source_node_id = Column(UUID(as_uuid=True), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    target_node_id = Column(UUID(as_uuid=True), ForeignKey("workflow_nodes.id", ondelete="CASCADE"), nullable=False)
    condition_label = Column(String(255))

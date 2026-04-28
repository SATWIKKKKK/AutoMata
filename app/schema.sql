-- PostgreSQL Schema for Autonomous AI Workflow Builder
-- Enable pgvector for future embedding storage
CREATE EXTENSION IF NOT EXISTS vector;

-- Workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'member');
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_users_workspace_id ON users(workspace_id);

-- Workflows
CREATE TYPE workflow_status AS ENUM ('draft', 'active', 'paused', 'archived');
CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    natural_language_prompt TEXT,
    status workflow_status NOT NULL DEFAULT 'draft',
    cron_schedule VARCHAR(50),
    estimated_cost_per_run_inr NUMERIC(10,4),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workflows_workspace_id ON workflows(workspace_id);
CREATE INDEX idx_workflows_status ON workflows(status);

-- Workflow Nodes
CREATE TYPE node_type AS ENUM ('cron_trigger', 'llm_call', 'tool_call', 'condition', 'human_gate', 'loop', 'evaluator');
CREATE TABLE workflow_nodes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    node_type node_type NOT NULL,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    position_x NUMERIC,
    position_y NUMERIC,
    label VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_workflow_nodes_workflow_id ON workflow_nodes(workflow_id);

-- Workflow Edges
CREATE TABLE workflow_edges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    target_node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    condition_label VARCHAR(255)
);
CREATE INDEX idx_workflow_edges_workflow_id ON workflow_edges(workflow_id);

-- Workflow Runs (TimescaleDB hypertable candidate)
CREATE TYPE run_status AS ENUM ('running', 'completed', 'failed', 'paused');
CREATE TABLE workflow_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    status run_status NOT NULL DEFAULT 'running',
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE,
    total_tokens_used INTEGER DEFAULT 0,
    total_cost_inr NUMERIC(10,4) DEFAULT 0.0000,
    run_log JSONB
);
CREATE INDEX idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
CREATE INDEX idx_workflow_runs_workspace_id ON workflow_runs(workspace_id);
CREATE INDEX idx_workflow_runs_status ON workflow_runs(status);
CREATE INDEX idx_workflow_runs_started_at ON workflow_runs(started_at);
-- Optionally convert to hypertable: SELECT create_hypertable('workflow_runs', 'started_at');

-- Node Executions
CREATE TYPE block_status AS ENUM ('pending', 'running', 'completed', 'failed', 'skipped');
CREATE TABLE node_executions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES workflow_nodes(id) ON DELETE CASCADE,
    status block_status NOT NULL DEFAULT 'pending',
    input JSONB,
    output JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost_inr NUMERIC(10,4) DEFAULT 0.0000,
    duration_ms INTEGER,
    evaluator_score INTEGER,
    retry_count INTEGER DEFAULT 0,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_node_executions_run_id ON node_executions(run_id);
CREATE INDEX idx_node_executions_node_id ON node_executions(node_id);
CREATE INDEX idx_node_executions_status ON node_executions(status);

-- Human Gate Requests
CREATE TYPE human_gate_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TABLE human_gate_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    node_execution_id UUID NOT NULL REFERENCES node_executions(id) ON DELETE CASCADE,
    assigned_to_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status human_gate_status NOT NULL DEFAULT 'pending',
    context JSONB,
    decided_at TIMESTAMP WITH TIME ZONE
);
CREATE INDEX idx_human_gate_requests_node_execution ON human_gate_requests(node_execution_id);

-- Integrations
CREATE TYPE integration_provider AS ENUM ('gmail', 'sheets', 'slack', 'notion', 'salesforce');
CREATE TABLE integrations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider integration_provider NOT NULL,
    oauth_access_token TEXT NOT NULL, -- encrypted
    oauth_refresh_token TEXT, -- encrypted
    connected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(workspace_id, provider)
);
CREATE INDEX idx_integrations_workspace_id ON integrations(workspace_id);

-- Audit Logs
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(255) NOT NULL,
    entity_id UUID NOT NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX idx_audit_logs_workspace_id ON audit_logs(workspace_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

export const DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    budget_limit_inr NUMERIC(12, 2) DEFAULT 10000,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT,
    role TEXT CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'owner',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT,
    dag JSONB,
    status TEXT CHECK (status IN ('draft', 'generating', 'ready', 'active', 'paused', 'archived', 'failed')) DEFAULT 'draft',
    cron_schedule TEXT,
    estimated_cost_per_run_inr NUMERIC(12, 4) DEFAULT 0,
    generation_error TEXT,
    forked_from TEXT,
    share_token TEXT UNIQUE,
    is_public BOOLEAN DEFAULT FALSE,
    fork_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_workflows_user_id ON workflows(user_id);
  CREATE INDEX IF NOT EXISTS idx_workflows_workspace_id ON workflows(workspace_id);
  CREATE INDEX IF NOT EXISTS idx_workflows_status ON workflows(status);

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    status TEXT DEFAULT 'running',
    trigger TEXT DEFAULT 'manual',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    total_tokens INTEGER DEFAULT 0,
    total_cost_inr NUMERIC(12, 4) DEFAULT 0,
    run_log JSONB,
    parent_run_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow_id ON workflow_runs(workflow_id);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON workflow_runs(status);
  CREATE INDEX IF NOT EXISTS idx_workflow_runs_started_at ON workflow_runs(started_at DESC);

  CREATE TABLE IF NOT EXISTS node_executions (
    id TEXT PRIMARY KEY,
    run_id TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
    node_id TEXT NOT NULL,
    node_label TEXT,
    node_type TEXT,
    status TEXT DEFAULT 'running',
    input_data JSONB,
    output_data JSONB,
    tokens_used INTEGER DEFAULT 0,
    cost_inr NUMERIC(12, 4) DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    evaluator_score NUMERIC(10, 2),
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_node_executions_run_id ON node_executions(run_id);

  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at TIMESTAMPTZ,
    account_name TEXT,
    connected_at TIMESTAMPTZ DEFAULT NOW(),
    enabled BOOLEAN DEFAULT TRUE,
    UNIQUE (workspace_id, provider)
  );
  CREATE INDEX IF NOT EXISTS idx_integrations_workspace_provider ON integrations(workspace_id, provider);

  CREATE TABLE IF NOT EXISTS terminal_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT NOT NULL,
    role TEXT CHECK (role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_inr NUMERIC(12, 4) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_terminal_messages_session_id ON terminal_messages(session_id, created_at ASC);

  CREATE TABLE IF NOT EXISTS workflow_metrics (
    id TEXT PRIMARY KEY,
    workflow_id TEXT REFERENCES workflows(id) ON DELETE CASCADE,
    run_id TEXT REFERENCES workflow_runs(id) ON DELETE CASCADE,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    metric_key TEXT NOT NULL,
    metric_value NUMERIC(15, 4),
    metric_label TEXT,
    extracted_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_workflow_metrics_user_key ON workflow_metrics(user_id, metric_key);

  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sidebar_open BOOLEAN DEFAULT FALSE,
    theme TEXT DEFAULT 'system',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
`;

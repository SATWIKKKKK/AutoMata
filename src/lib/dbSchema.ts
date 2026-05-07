export const DATABASE_SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    auth_provider TEXT DEFAULT 'local',
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider TEXT DEFAULT 'local';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;

  CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    provider_account_id TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sidebar_open BOOLEAN DEFAULT FALSE,
    theme TEXT DEFAULT 'light',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    domain TEXT NOT NULL,
    domain_label TEXT NOT NULL,
    topic TEXT NOT NULL,
    type TEXT NOT NULL,
    difficulty INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    options JSONB,
    correct_answer TEXT NOT NULL,
    explanation TEXT NOT NULL,
    code_snippet TEXT,
    tags JSONB NOT NULL DEFAULT '[]'::jsonb,
    time_limit_minutes INTEGER NOT NULL DEFAULT 8,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE questions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  CREATE INDEX IF NOT EXISTS idx_questions_domain_type ON questions(domain, type);
  CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);

  CREATE TABLE IF NOT EXISTS round_attempts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    round_type TEXT NOT NULL,
    question_type TEXT NOT NULL,
    domain TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    duration_minutes INTEGER NOT NULL,
    question_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
    answer_payload JSONB,
    result_payload JSONB,
    total_questions INTEGER NOT NULL DEFAULT 0,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    score INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_round_attempts_user_round ON round_attempts(user_id, round_type, created_at DESC);

  CREATE TABLE IF NOT EXISTS question_assignments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    attempt_id TEXT REFERENCES round_attempts(id) ON DELETE CASCADE,
    round_type TEXT,
    selected_answer TEXT,
    code_answer TEXT,
    notes TEXT,
    is_correct BOOLEAN,
    score INTEGER,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_question_assignments_user_question ON question_assignments(user_id, question_id, assigned_at DESC);

  CREATE TABLE IF NOT EXISTS github_repos (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repo_url TEXT NOT NULL,
    repo_name TEXT NOT NULL,
    detected_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
    scanned_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'pending',
    raw_analysis_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, repo_url)
  );

  CREATE INDEX IF NOT EXISTS idx_github_repos_user_scanned ON github_repos(user_id, scanned_at DESC);

  CREATE TABLE IF NOT EXISTS repo_question_sets (
    id TEXT PRIMARY KEY,
    repo_id TEXT UNIQUE NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    project_summary TEXT NOT NULL,
    total_questions INTEGER NOT NULL DEFAULT 0,
    sections_json JSONB NOT NULL DEFAULT '[]'::jsonb
  );

  CREATE TABLE IF NOT EXISTS repo_scan_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repo_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0
  );

  CREATE INDEX IF NOT EXISTS idx_repo_scan_jobs_user_status ON repo_scan_jobs(user_id, status, created_at DESC);

  CREATE TABLE IF NOT EXISTS user_repo_interactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    repo_id TEXT NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    viewed_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_user_repo_interactions_user_repo ON user_repo_interactions(user_id, repo_id, viewed_at DESC);
`;

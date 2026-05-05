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
`;

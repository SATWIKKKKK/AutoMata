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
    access_token TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (provider, provider_account_id)
  );

  ALTER TABLE oauth_accounts ADD COLUMN IF NOT EXISTS access_token TEXT;

  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sidebar_open BOOLEAN DEFAULT FALSE,
    theme TEXT DEFAULT 'light',
    domain TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT '';
  ALTER TABLE user_preferences ALTER COLUMN domain SET DEFAULT '';

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

  ALTER TABLE round_attempts ADD COLUMN IF NOT EXISTS paused_ms INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE round_attempts ADD COLUMN IF NOT EXISTS last_saved_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE round_attempts ADD COLUMN IF NOT EXISTS session_seed TEXT;

  CREATE TABLE IF NOT EXISTS question_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    round_type TEXT NOT NULL,
    question_hash TEXT NOT NULL,
    question_text TEXT NOT NULL,
    seen_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, domain, round_type, question_hash)
  );

  CREATE INDEX IF NOT EXISTS idx_question_history_user_domain ON question_history(user_id, domain, seen_at DESC);

  CREATE TABLE IF NOT EXISTS question_angle_history (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    module_key TEXT NOT NULL,
    angle TEXT NOT NULL,
    first_used_at TIMESTAMPTZ DEFAULT NOW(),
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, domain, module_key, angle)
  );

  CREATE INDEX IF NOT EXISTS idx_question_angle_history_user_module ON question_angle_history(user_id, domain, module_key, used_at DESC);

  CREATE TABLE IF NOT EXISTS round_drafts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    draft_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, attempt_id, feature)
  );

  CREATE INDEX IF NOT EXISTS idx_round_drafts_user_attempt ON round_drafts(user_id, attempt_id, saved_at DESC);

  CREATE TABLE IF NOT EXISTS round_focus_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    attempt_id TEXT NOT NULL,
    feature TEXT NOT NULL,
    event_type TEXT NOT NULL,
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_round_focus_events_attempt ON round_focus_events(user_id, attempt_id, occurred_at DESC);

  CREATE TABLE IF NOT EXISTS ai_rate_limit_events (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    weight INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_ai_rate_limit_events_user_created ON ai_rate_limit_events(user_id, created_at DESC);

  CREATE TABLE IF NOT EXISTS ai_retry_jobs (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature TEXT NOT NULL,
    attempt_id TEXT NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'pending',
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_ai_retry_jobs_status ON ai_retry_jobs(status, created_at);

  CREATE TABLE IF NOT EXISTS scenarios (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    topic TEXT NOT NULL DEFAULT '',
    level TEXT NOT NULL DEFAULT 'mid',
    scenario_type TEXT NOT NULL,
    company_context TEXT NOT NULL DEFAULT 'scaling company',
    title TEXT NOT NULL,
    context TEXT NOT NULL,
    role TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]'::jsonb,
    seed TEXT DEFAULT '',
    question_hash TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'active',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    refreshed_from_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_scenarios_domain_level ON scenarios(domain, level, generated_at DESC);

  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS topic TEXT NOT NULL DEFAULT '';
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS seed TEXT DEFAULT '';
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS question_hash TEXT DEFAULT '';
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS question TEXT NOT NULL DEFAULT '';
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS question_type TEXT NOT NULL DEFAULT 'technical';
  ALTER TABLE scenarios ADD COLUMN IF NOT EXISTS hint TEXT NOT NULL DEFAULT '';

  CREATE INDEX IF NOT EXISTS idx_scenarios_user_domain_topic ON scenarios(user_id, domain, topic, generated_at DESC);

  CREATE TABLE IF NOT EXISTS scenario_attempts (
    id TEXT PRIMARY KEY,
    scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'started',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    paused_ms INTEGER NOT NULL DEFAULT 0,
    last_saved_at TIMESTAMPTZ DEFAULT NOW(),
    score INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER,
    completed_at TIMESTAMPTZ,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_scenario_attempts_user ON scenario_attempts(user_id, started_at DESC);

  ALTER TABLE scenario_attempts ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 30;
  ALTER TABLE scenario_attempts ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE scenario_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
  ALTER TABLE scenario_attempts ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

  CREATE TABLE IF NOT EXISTS scenario_step_answers (
    id TEXT PRIMARY KEY,
    attempt_id TEXT NOT NULL REFERENCES scenario_attempts(id) ON DELETE CASCADE,
    step_number INTEGER NOT NULL,
    user_answer TEXT NOT NULL,
    feedback_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (attempt_id, step_number)
  );

  CREATE TABLE IF NOT EXISTS coding_problems (
    id TEXT PRIMARY KEY,
    user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium',
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    context TEXT NOT NULL,
    starter_code TEXT NOT NULL,
    language TEXT NOT NULL,
    question_hash TEXT NOT NULL DEFAULT '',
    requirements JSONB NOT NULL DEFAULT '[]'::jsonb,
    examples JSONB NOT NULL DEFAULT '[]'::jsonb,
    constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
    evaluation_criteria JSONB NOT NULL DEFAULT '[]'::jsonb,
    hints JSONB NOT NULL DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'active',
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_coding_problems_domain ON coding_problems(domain, difficulty, generated_at DESC);

  ALTER TABLE coding_problems ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;
  ALTER TABLE coding_problems ADD COLUMN IF NOT EXISTS question_hash TEXT NOT NULL DEFAULT '';
  ALTER TABLE coding_problems ADD COLUMN IF NOT EXISTS requirements JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE coding_problems ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE coding_problems ADD COLUMN IF NOT EXISTS constraints JSONB NOT NULL DEFAULT '[]'::jsonb;

  CREATE TABLE IF NOT EXISTS coding_attempts (
    id TEXT PRIMARY KEY,
    problem_id TEXT NOT NULL REFERENCES coding_problems(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'started',
    code_draft TEXT,
    notes TEXT,
    language TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INTEGER NOT NULL DEFAULT 45,
    paused_ms INTEGER NOT NULL DEFAULT 0,
    last_saved_at TIMESTAMPTZ DEFAULT NOW(),
    score INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER,
    submitted_at TIMESTAMPTZ,
    evaluation_payload JSONB NOT NULL DEFAULT '{}'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_coding_attempts_user ON coding_attempts(user_id, started_at DESC);

  ALTER TABLE coding_attempts ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 45;
  ALTER TABLE coding_attempts ADD COLUMN IF NOT EXISTS score INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE coding_attempts ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
  ALTER TABLE coding_attempts ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;
  ALTER TABLE coding_attempts ADD COLUMN IF NOT EXISTS scratch_notes TEXT NOT NULL DEFAULT '';

  CREATE TABLE IF NOT EXISTS mock_interviews (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    level TEXT NOT NULL,
    persona TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'started',
    interview_type TEXT NOT NULL DEFAULT 'mixed',
    interview_title TEXT NOT NULL DEFAULT 'Mock Interview',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    responses JSONB NOT NULL DEFAULT '[]'::jsonb,
    current_question_index INTEGER NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    paused_ms INTEGER NOT NULL DEFAULT 0,
    last_saved_at TIMESTAMPTZ DEFAULT NOW(),
    duration_minutes INTEGER NOT NULL DEFAULT 15,
    saved_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    report_payload JSONB NOT NULL DEFAULT '{}'::jsonb
  );

  CREATE INDEX IF NOT EXISTS idx_mock_interviews_user ON mock_interviews(user_id, started_at DESC);
  ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS interview_type TEXT NOT NULL DEFAULT 'mixed';
  ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS interview_title TEXT NOT NULL DEFAULT 'Mock Interview';
  ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS duration_minutes INTEGER NOT NULL DEFAULT 15;
  ALTER TABLE mock_interviews ALTER COLUMN duration_minutes SET DEFAULT 15;
  ALTER TABLE mock_interviews ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

  DROP TABLE IF EXISTS track_modules;
  DROP TABLE IF EXISTS practice_tracks;
  DROP TABLE IF EXISTS practice_gap_reports;

  CREATE TABLE IF NOT EXISTS open_practice_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    domain TEXT NOT NULL,
    topic TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'in-progress',
    questions JSONB NOT NULL DEFAULT '[]'::jsonb,
    question_type_breakdown JSONB NOT NULL DEFAULT '{"mcq":10,"fill-blank":10,"code-reading":20}'::jsonb,
    answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    score INTEGER,
    correct_answers INTEGER NOT NULL DEFAULT 0,
    time_spent_seconds INTEGER,
    result_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    saved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS answers JSONB NOT NULL DEFAULT '[]'::jsonb;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS question_type_breakdown JSONB NOT NULL DEFAULT '{"mcq":10,"fill-blank":10,"code-reading":20}'::jsonb;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS score INTEGER;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS correct_answers INTEGER NOT NULL DEFAULT 0;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS time_spent_seconds INTEGER;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS result_payload JSONB NOT NULL DEFAULT '{}'::jsonb;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
  ALTER TABLE open_practice_sessions ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ;

  CREATE INDEX IF NOT EXISTS idx_open_practice_sessions_user_generated ON open_practice_sessions(user_id, generated_at DESC);
  CREATE INDEX IF NOT EXISTS idx_open_practice_sessions_user_domain ON open_practice_sessions(user_id, domain, generated_at DESC);

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

  CREATE TABLE IF NOT EXISTS subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan TEXT NOT NULL DEFAULT 'free',
    status TEXT NOT NULL DEFAULT 'active',
    provider TEXT NOT NULL DEFAULT 'manual',
    razorpay_customer_id TEXT,
    razorpay_subscription_id TEXT,
    razorpay_payment_id TEXT,
    current_period_end TIMESTAMPTZ,
    billing_interval TEXT DEFAULT 'monthly',
    seats INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'manual';
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS razorpay_payment_id TEXT;
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly';
  ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS seats INTEGER NOT NULL DEFAULT 1;
  CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status ON subscriptions(user_id, status);

  CREATE TABLE IF NOT EXISTS billing_orders (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    razorpay_order_id TEXT UNIQUE NOT NULL,
    plan TEXT NOT NULL,
    billing_interval TEXT NOT NULL,
    seats INTEGER NOT NULL DEFAULT 1,
    amount_paise INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'INR',
    status TEXT NOT NULL DEFAULT 'created',
    razorpay_payment_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    verified_at TIMESTAMPTZ
  );

  CREATE INDEX IF NOT EXISTS idx_billing_orders_user_created ON billing_orders(user_id, created_at DESC);
`;

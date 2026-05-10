CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS github_repos (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_url TEXT NOT NULL,
  repo_name TEXT NOT NULL,
  detected_stack JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  raw_analysis_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, repo_url)
);

CREATE INDEX IF NOT EXISTS idx_github_repos_user_scanned
  ON github_repos(user_id, scanned_at DESC);

CREATE TABLE IF NOT EXISTS repo_question_sets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  repo_id TEXT UNIQUE NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  project_summary TEXT NOT NULL,
  total_questions INTEGER NOT NULL DEFAULT 0,
  sections_json JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS repo_scan_jobs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'complete', 'failed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  retry_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_repo_scan_jobs_user_status
  ON repo_scan_jobs(user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS user_repo_interactions (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  repo_id TEXT NOT NULL REFERENCES github_repos(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL,
  viewed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_repo_interactions_user_repo
  ON user_repo_interactions(user_id, repo_id, viewed_at DESC);

import Database from 'better-sqlite3';
import { pool } from '../src/lib/db.js';

const sqlite = new Database('orren.db', { readonly: true });

async function migrateTable<T>(
  rows: T[],
  insertSql: string,
  mapRow: (row: T) => unknown[],
  label: string,
) {
  for (const row of rows) {
    await pool.query(insertSql, mapRow(row));
  }
  console.log(`${label} migrated: ${rows.length}`);
}

async function migrate() {
  try {
    const workspaces = sqlite.prepare('SELECT * FROM workspaces').all() as Array<Record<string, any>>;
    await migrateTable(
      workspaces,
      `
        INSERT INTO workspaces (id, name, budget_limit_inr, created_at)
        VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [row.id, row.name, row.budget_limit_inr ?? 10000, row.created_at ?? null],
      'Workspaces',
    );

    const users = sqlite.prepare('SELECT * FROM users').all() as Array<Record<string, any>>;
    await migrateTable(
      users,
      `
        INSERT INTO users (id, workspace_id, email, name, password_hash, role, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, COALESCE($7::timestamptz, NOW()), COALESCE($8::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [
        row.id,
        row.workspace_id ?? null,
        row.email,
        row.name ?? null,
        row.password_hash ?? null,
        row.role ?? 'owner',
        row.created_at ?? null,
        row.updated_at ?? row.created_at ?? null,
      ],
      'Users',
    );

    const workflows = sqlite.prepare('SELECT * FROM workflows').all() as Array<Record<string, any>>;
    await migrateTable(
      workflows,
      `
        INSERT INTO workflows (
          id, user_id, workspace_id, name, description, prompt, dag, status,
          cron_schedule, estimated_cost_per_run_inr, generation_error, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8,
          $9, $10, $11, COALESCE($12::timestamptz, NOW()), COALESCE($13::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [
        row.id,
        row.user_id ?? null,
        row.workspace_id ?? null,
        row.name,
        row.description ?? null,
        row.prompt ?? null,
        row.dag ?? null,
        row.status ?? 'draft',
        row.cron_schedule ?? null,
        row.estimated_cost_per_run_inr ?? 0,
        row.generation_error ?? null,
        row.created_at ?? null,
        row.updated_at ?? row.created_at ?? null,
      ],
      'Workflows',
    );

    const runs = sqlite.prepare('SELECT * FROM workflow_runs').all() as Array<Record<string, any>>;
    await migrateTable(
      runs,
      `
        INSERT INTO workflow_runs (
          id, workflow_id, user_id, status, trigger, started_at, ended_at,
          total_tokens, total_cost_inr, run_log, parent_run_id
        )
        VALUES (
          $1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()), $7::timestamptz,
          $8, $9, $10::jsonb, $11
        )
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [
        row.id,
        row.workflow_id,
        row.user_id ?? null,
        row.status ?? 'running',
        row.trigger ?? 'manual',
        row.started_at ?? null,
        row.ended_at ?? null,
        row.total_tokens ?? 0,
        row.total_cost_inr ?? 0,
        row.run_log ?? null,
        row.parent_run_id ?? null,
      ],
      'Workflow runs',
    );

    const executions = sqlite.prepare('SELECT * FROM node_executions').all() as Array<Record<string, any>>;
    await migrateTable(
      executions,
      `
        INSERT INTO node_executions (
          id, run_id, node_id, node_label, node_type, status, input_data, output_data,
          tokens_used, cost_inr, duration_ms, evaluator_score, retry_count, created_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb,
          $9, $10, $11, $12, $13, COALESCE($14::timestamptz, NOW())
        )
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [
        row.id,
        row.run_id,
        row.node_id,
        row.node_label ?? null,
        row.node_type ?? null,
        row.status ?? 'running',
        row.input_data ?? null,
        row.output_data ?? null,
        row.tokens_used ?? 0,
        row.cost_inr ?? 0,
        row.duration_ms ?? 0,
        row.evaluator_score ?? null,
        row.retry_count ?? 0,
        row.created_at ?? null,
      ],
      'Node executions',
    );

    const integrations = sqlite.prepare('SELECT * FROM integrations').all() as Array<Record<string, any>>;
    await migrateTable(
      integrations,
      `
        INSERT INTO integrations (
          id, user_id, workspace_id, provider, access_token, refresh_token,
          expires_at, account_name, connected_at, enabled
        )
        VALUES (
          $1, $2, $3, $4, $5, $6,
          $7::timestamptz, $8, COALESCE($9::timestamptz, NOW()), $10
        )
        ON CONFLICT (workspace_id, provider) DO UPDATE SET
          user_id = EXCLUDED.user_id,
          access_token = EXCLUDED.access_token,
          refresh_token = EXCLUDED.refresh_token,
          expires_at = EXCLUDED.expires_at,
          account_name = EXCLUDED.account_name,
          connected_at = EXCLUDED.connected_at,
          enabled = EXCLUDED.enabled
      `,
      (row) => [
        row.id,
        row.user_id ?? row.workspace_id?.replace(/^workspace:/, '') ?? null,
        row.workspace_id ?? null,
        row.provider,
        row.access_token,
        row.refresh_token ?? null,
        row.expires_at ?? null,
        row.account_name ?? null,
        row.connected_at ?? null,
        row.enabled ?? true,
      ],
      'Integrations',
    );

    const preferences = sqlite.prepare('SELECT * FROM user_preferences').all() as Array<Record<string, any>>;
    await migrateTable(
      preferences,
      `
        INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at)
        VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), COALESCE($6::timestamptz, NOW()))
        ON CONFLICT (user_id) DO UPDATE SET
          sidebar_open = EXCLUDED.sidebar_open,
          theme = EXCLUDED.theme,
          updated_at = EXCLUDED.updated_at
      `,
      (row) => [
        row.id,
        row.user_id,
        Boolean(row.sidebar_open),
        row.theme ?? 'system',
        row.created_at ?? null,
        row.updated_at ?? null,
      ],
      'User preferences',
    );

    const terminalMessages = sqlite.prepare('SELECT * FROM terminal_messages').all() as Array<Record<string, any>>;
    await migrateTable(
      terminalMessages,
      `
        INSERT INTO terminal_messages (id, user_id, session_id, role, content, tokens_used, cost_inr, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
        ON CONFLICT (id) DO NOTHING
      `,
      (row) => [
        row.id,
        row.user_id ?? null,
        row.session_id,
        row.role,
        row.content,
        row.tokens_used ?? 0,
        row.cost_inr ?? 0,
        row.created_at ?? null,
      ],
      'Terminal messages',
    );

    console.log('Migration complete.');
  } finally {
    sqlite.close();
    await pool.end();
  }
}

void migrate().catch((error) => {
  console.error('Migration failed:', error);
  process.exitCode = 1;
});

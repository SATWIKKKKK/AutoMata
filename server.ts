import express from "express";
import { createServer as createHttpServer } from "node:http";
import { createServer as createNetServer } from "node:net";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "node:fs";
import crypto from "node:crypto";
import dotenv from "dotenv";

// Load env from AutoMata/.env only.
const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import sqlite3 from "better-sqlite3";
import {
  buildFallbackSummary,
  buildFallbackWorkflowDag,
  WORKFLOW_DAG_SYSTEM_PROMPT,
  estimateWorkflowRunCostInr,
  extractJSONObject,
  normalizeGeneratedWorkflowDag,
  validateGeneratedWorkflowDag,
  type GeneratedWorkflowDag,
} from "./src/lib/serverWorkflowUtils.js";
import runEventBus from "./src/lib/runEvents.js";
import { requestLlmCompletion } from "./src/lib/llmGateway.js";
import { registerTool } from "./src/lib/toolRegistry.js";
import { decryptSecret, encryptSecret } from "./src/lib/tokenCrypto.js";
import { executeWorkflow, type NodeExecutionEvent } from "./src/lib/workflowExecutor.js";

// Full Database Schema Implementation
const db = sqlite3("orren.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS workspaces (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    budget_limit_inr REAL DEFAULT 10000,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    email TEXT UNIQUE,
    role TEXT CHECK(role IN ('owner', 'admin', 'member')),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS workflows (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    workspace_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT,
    dag TEXT,
    status TEXT CHECK(status IN ('draft', 'generating', 'ready', 'active', 'paused', 'archived', 'failed')) DEFAULT 'draft',
    cron_schedule TEXT,
    estimated_cost_per_run_inr REAL DEFAULT 0,
    generation_error TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS workflow_nodes (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    type TEXT NOT NULL,
    label TEXT,
    config TEXT, -- JSON string
    pos_x REAL,
    pos_y REAL,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
  );

  CREATE TABLE IF NOT EXISTS workflow_edges (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    source_node_id TEXT,
    target_node_id TEXT,
    condition_label TEXT,
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
  );

  CREATE TABLE IF NOT EXISTS workflow_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT,
    status TEXT,
    trigger TEXT DEFAULT 'manual',
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ended_at DATETIME,
    total_tokens INTEGER DEFAULT 0,
    total_cost_inr REAL DEFAULT 0,
    run_log TEXT, -- JSON string
    FOREIGN KEY(workflow_id) REFERENCES workflows(id)
  );

  CREATE TABLE IF NOT EXISTS node_executions (
    id TEXT PRIMARY KEY,
    run_id TEXT,
    node_id TEXT,
    status TEXT,
    input_data TEXT,
    output_data TEXT,
    tokens_used INTEGER DEFAULT 0,
    cost_inr REAL DEFAULT 0,
    duration_ms INTEGER DEFAULT 0,
    evaluator_score REAL,
    retry_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
  );

  CREATE TABLE IF NOT EXISTS integrations (
    id TEXT PRIMARY KEY,
    workspace_id TEXT,
    provider TEXT NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    account_name TEXT,
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    enabled BOOLEAN DEFAULT 1,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );

  CREATE TABLE IF NOT EXISTS terminal_messages (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    session_id TEXT NOT NULL,
    role TEXT CHECK(role IN ('user', 'assistant')) NOT NULL,
    content TEXT NOT NULL,
    tokens_used INTEGER DEFAULT 0,
    cost_inr REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT UNIQUE NOT NULL,
    sidebar_open BOOLEAN DEFAULT 0,
    theme TEXT DEFAULT 'system',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

type SessionUser = {
  userId: string;
  email: string;
  workspaceId: string;
  displayName: string;
};

type WorkflowRow = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  name: string;
  description: string | null;
  prompt: string | null;
  dag: string | null;
  status: string;
  cron_schedule: string | null;
  estimated_cost_per_run_inr: number | null;
  generation_error: string | null;
  created_at: string;
  updated_at: string | null;
};

const activeWorkflowGenerations = new Set<string>();
const activeWorkflowRuns = new Set<string>();
const cancelledRuns = new Set<string>();

function columnExists(tableName: string, columnName: string): boolean {
  const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  return columns.some((column) => column.name === columnName);
}

function getTableSql(tableName: string): string {
  const row = db.prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?`).get(tableName) as { sql?: string } | undefined;
  return row?.sql ?? '';
}

function migrateWorkflowsTableIfNeeded() {
  const currentSql = getTableSql('workflows');
  if (
    currentSql.includes('generating') &&
    columnExists('workflows', 'user_id') &&
    columnExists('workflows', 'dag') &&
    columnExists('workflows', 'estimated_cost_per_run_inr') &&
    columnExists('workflows', 'updated_at')
  ) {
    return;
  }

  db.exec('DROP TABLE IF EXISTS workflows_legacy');
  db.exec('ALTER TABLE workflows RENAME TO workflows_legacy');
  db.exec(`
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      workspace_id TEXT,
      name TEXT NOT NULL,
      description TEXT,
      prompt TEXT,
      dag TEXT,
      status TEXT CHECK(status IN ('draft', 'generating', 'ready', 'active', 'paused', 'archived', 'failed')) DEFAULT 'draft',
      cron_schedule TEXT,
      estimated_cost_per_run_inr REAL DEFAULT 0,
      generation_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id),
      FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
    )
  `);

  const legacyColumns = new Set(
    (db.prepare('PRAGMA table_info(workflows_legacy)').all() as Array<{ name: string }>).map((column) => column.name),
  );

  const selectList = [
    'id',
    legacyColumns.has('user_id') ? 'user_id' : 'NULL AS user_id',
    legacyColumns.has('workspace_id') ? 'workspace_id' : "'default' AS workspace_id",
    'name',
    legacyColumns.has('description') ? 'description' : "'' AS description",
    legacyColumns.has('prompt') ? 'prompt' : 'NULL AS prompt',
    legacyColumns.has('dag') ? 'dag' : 'NULL AS dag',
    legacyColumns.has('status')
      ? "CASE WHEN status IN ('draft', 'generating', 'ready', 'active', 'paused', 'archived', 'failed') THEN status ELSE 'draft' END AS status"
      : "'draft' AS status",
    legacyColumns.has('cron_schedule') ? 'cron_schedule' : 'NULL AS cron_schedule',
    legacyColumns.has('estimated_cost_per_run_inr') ? 'estimated_cost_per_run_inr' : '0 AS estimated_cost_per_run_inr',
    legacyColumns.has('generation_error') ? 'generation_error' : 'NULL AS generation_error',
    legacyColumns.has('created_at') ? 'created_at' : 'CURRENT_TIMESTAMP AS created_at',
    legacyColumns.has('updated_at')
      ? 'COALESCE(updated_at, created_at, CURRENT_TIMESTAMP) AS updated_at'
      : 'COALESCE(created_at, CURRENT_TIMESTAMP) AS updated_at',
  ].join(', ');

  db.exec(`
    INSERT INTO workflows (
      id, user_id, workspace_id, name, description, prompt, dag, status, cron_schedule,
      estimated_cost_per_run_inr, generation_error, created_at, updated_at
    )
    SELECT ${selectList}
    FROM workflows_legacy
  `);

  db.exec('DROP TABLE workflows_legacy');
}

function repairWorkflowForeignKeyReferences() {
  const nodesSql = getTableSql('workflow_nodes');
  if (nodesSql.includes('workflows_legacy')) {
    db.exec('ALTER TABLE workflow_nodes RENAME TO workflow_nodes_legacy');
    db.exec(`
      CREATE TABLE workflow_nodes (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        type TEXT NOT NULL,
        label TEXT,
        config TEXT,
        pos_x REAL,
        pos_y REAL,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id)
      )
    `);
    db.exec(`
      INSERT INTO workflow_nodes (id, workflow_id, type, label, config, pos_x, pos_y)
      SELECT id, workflow_id, type, label, config, pos_x, pos_y
      FROM workflow_nodes_legacy
    `);
    db.exec('DROP TABLE workflow_nodes_legacy');
  }

  const edgesSql = getTableSql('workflow_edges');
  if (edgesSql.includes('workflows_legacy')) {
    db.exec('ALTER TABLE workflow_edges RENAME TO workflow_edges_legacy');
    db.exec(`
      CREATE TABLE workflow_edges (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        source_node_id TEXT,
        target_node_id TEXT,
        condition_label TEXT,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id)
      )
    `);
    db.exec(`
      INSERT INTO workflow_edges (id, workflow_id, source_node_id, target_node_id, condition_label)
      SELECT id, workflow_id, source_node_id, target_node_id, condition_label
      FROM workflow_edges_legacy
    `);
    db.exec('DROP TABLE workflow_edges_legacy');
  }

  const runsSql = getTableSql('workflow_runs');
  if (runsSql.includes('workflows_legacy')) {
    db.exec('ALTER TABLE workflow_runs RENAME TO workflow_runs_legacy');

    const legacyColumns = new Set(
      (db.prepare('PRAGMA table_info(workflow_runs_legacy)').all() as Array<{ name: string }>).map((column) => column.name),
    );

    db.exec(`
      CREATE TABLE workflow_runs (
        id TEXT PRIMARY KEY,
        workflow_id TEXT,
        status TEXT,
        trigger TEXT DEFAULT 'manual',
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        total_tokens INTEGER DEFAULT 0,
        total_cost_inr REAL DEFAULT 0,
        run_log TEXT,
        FOREIGN KEY(workflow_id) REFERENCES workflows(id)
      )
    `);

    const triggerExpr = legacyColumns.has('trigger') ? 'trigger' : "'manual' AS trigger";
    const runLogExpr = legacyColumns.has('run_log') ? 'run_log' : 'NULL AS run_log';

    db.exec(`
      INSERT INTO workflow_runs (
        id, workflow_id, status, trigger, started_at, ended_at, total_tokens, total_cost_inr, run_log
      )
      SELECT
        id,
        workflow_id,
        status,
        ${triggerExpr},
        COALESCE(started_at, CURRENT_TIMESTAMP) AS started_at,
        ended_at,
        COALESCE(total_tokens, 0) AS total_tokens,
        COALESCE(total_cost_inr, 0) AS total_cost_inr,
        ${runLogExpr}
      FROM workflow_runs_legacy
    `);

    db.exec('DROP TABLE workflow_runs_legacy');
  }

  const executionsSql = getTableSql('node_executions');
  if (executionsSql.includes('workflow_runs_legacy')) {
    db.exec('ALTER TABLE node_executions RENAME TO node_executions_legacy');
    db.exec(`
      CREATE TABLE node_executions (
        id TEXT PRIMARY KEY,
        run_id TEXT,
        node_id TEXT,
        status TEXT,
        input_data TEXT,
        output_data TEXT,
        tokens_used INTEGER DEFAULT 0,
        cost_inr REAL DEFAULT 0,
        duration_ms INTEGER DEFAULT 0,
        evaluator_score REAL,
        retry_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(run_id) REFERENCES workflow_runs(id)
      )
    `);
    db.exec(`
      INSERT INTO node_executions (
        id, run_id, node_id, status, input_data, output_data,
        tokens_used, cost_inr, duration_ms, evaluator_score, retry_count, created_at
      )
      SELECT
        id,
        run_id,
        node_id,
        status,
        input_data,
        output_data,
        COALESCE(tokens_used, 0) AS tokens_used,
        COALESCE(cost_inr, 0) AS cost_inr,
        COALESCE(duration_ms, 0) AS duration_ms,
        evaluator_score,
        COALESCE(retry_count, 0) AS retry_count,
        COALESCE(created_at, CURRENT_TIMESTAMP) AS created_at
      FROM node_executions_legacy
    `);
    db.exec('DROP TABLE node_executions_legacy');
  }
}

function ensureWorkflowRunColumns() {
  if (!columnExists('workflow_runs', 'trigger')) {
    db.exec(`ALTER TABLE workflow_runs ADD COLUMN trigger TEXT DEFAULT 'manual'`);
  }
}

function ensureWorkflowColumns() {
  if (!columnExists('workflows', 'dag')) {
    db.exec(`ALTER TABLE workflows ADD COLUMN dag TEXT`);
  }
  if (!columnExists('workflows', 'updated_at')) {
    db.exec(`ALTER TABLE workflows ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP`);
  }
  if (!columnExists('workflows', 'estimated_cost_per_run_inr')) {
    db.exec(`ALTER TABLE workflows ADD COLUMN estimated_cost_per_run_inr REAL DEFAULT 0`);
  }
  if (!columnExists('workflows', 'generation_error')) {
    db.exec(`ALTER TABLE workflows ADD COLUMN generation_error TEXT`);
  }
  if (!columnExists('workflows', 'user_id')) {
    db.exec(`ALTER TABLE workflows ADD COLUMN user_id TEXT`);
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  return (cookieHeader ?? '')
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      acc[key] = decodeURIComponent(value);
      return acc;
    }, {});
}

function getSessionUser(req: express.Request): SessionUser | null {
  const cookies = parseCookies(req.headers.cookie);
  const email = String(cookies.automata_session ?? req.headers['x-user-email'] ?? '').trim().toLowerCase();
  if (!email) return null;

  return {
    userId: email,
    email,
    workspaceId: `workspace:${email}`,
    displayName: email.split('@')[0] || 'User',
  };
}

function ensureUserWorkspace(user: SessionUser) {
  db.prepare(`INSERT OR IGNORE INTO workspaces (id, name) VALUES (?, ?)`).run(
    user.workspaceId,
    `${user.displayName}'s Workspace`,
  );
  db.prepare(`INSERT OR IGNORE INTO users (id, workspace_id, email, role) VALUES (?, ?, ?, ?)`)
    .run(user.userId, user.workspaceId, user.email, 'owner');
}

function getOAuthStateSecret(): string {
  return (process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || 'automata-dev-state-secret').trim();
}

function signOAuthState(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signature = crypto
    .createHmac('sha256', getOAuthStateSecret())
    .update(body)
    .digest('base64url');
  return `${body}.${signature}`;
}

function verifyOAuthState(token: string): Record<string, unknown> | null {
  const [body, signature] = String(token ?? '').split('.');
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac('sha256', getOAuthStateSecret())
    .update(body)
    .digest('base64url');

  if (signature.length !== expected.length) {
    return null;
  }

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function normalizeProviderFromRoute(provider: string): 'gmail' | 'google_sheets' | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'gmail' || normalized === 'google_sheets' || normalized === 'google') {
    return normalized === 'google' ? 'gmail' : normalized;
  }
  return null;
}

function encodeEmail(to: string[] | string, subject: string, body: string): string {
  const toHeader = Array.isArray(to) ? to.join(', ') : to;
  const email = [
    `To: ${toHeader}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\n');

  return Buffer.from(email)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function toRecipientList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  const text = String(value ?? '').trim();
  if (!text) return [];
  return text.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function serializeWorkflowRow(row: WorkflowRow | undefined | null) {
  if (!row) return null;

  let dag: GeneratedWorkflowDag | null = null;
  if (row.dag) {
    try {
      dag = JSON.parse(row.dag) as GeneratedWorkflowDag;
    } catch {
      dag = null;
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    workspaceId: row.workspace_id,
    name: row.name,
    description: row.description ?? '',
    prompt: row.prompt ?? '',
    dag,
    status: row.status,
    cronSchedule: row.cron_schedule,
    estimatedCostPerRunInr: row.estimated_cost_per_run_inr ?? 0,
    generationError: row.generation_error,
    createdAt: row.created_at,
    updatedAt: row.updated_at ?? row.created_at,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
  };
}

function writeSSE(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function getWorkflowById(workflowId: string) {
  return db.prepare(`SELECT * FROM workflows WHERE id = ?`).get(workflowId) as WorkflowRow | undefined;
}

function getOwnedWorkflow(workflowId: string, user: SessionUser) {
  return db.prepare(`SELECT * FROM workflows WHERE id = ? AND user_id = ?`).get(workflowId, user.userId) as WorkflowRow | undefined;
}

migrateWorkflowsTableIfNeeded();
repairWorkflowForeignKeyReferences();
ensureWorkflowColumns();
ensureWorkflowRunColumns();

// Non-destructive column migration: add account_name to integrations if missing
try {
  db.exec(`ALTER TABLE integrations ADD COLUMN account_name TEXT`);
} catch { /* column already exists */ }

async function startServer() {
  const app = express();
  const preferredPort = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";
  const server = createHttpServer(app);

  app.use(cors());
  app.use(express.json());

  const requireSession = (req: express.Request, res: express.Response) => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    ensureUserWorkspace(user);
    return user;
  };

  const upsertIntegration = (
    workspaceId: string,
    provider: 'gmail' | 'google_sheets',
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
    accountName: string,
  ) => {
    const existing = db.prepare(`
      SELECT id
      FROM integrations
      WHERE workspace_id = ? AND provider = ?
      LIMIT 1
    `).get(workspaceId, provider) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE integrations
        SET access_token = ?, refresh_token = ?, expires_at = ?, account_name = ?, enabled = 1, connected_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(accessToken, refreshToken, expiresAt, accountName, existing.id);
    } else {
      db.prepare(`
        INSERT INTO integrations (id, workspace_id, provider, access_token, refresh_token, account_name, expires_at, enabled, connected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
      `).run(uuidv4(), workspaceId, provider, accessToken, refreshToken, accountName, expiresAt);
    }
  };

  const loadIntegrationToken = async (workspaceId: string, provider: string) => {
    const row = db.prepare(`
      SELECT access_token, refresh_token, expires_at
      FROM integrations
      WHERE workspace_id = ? AND provider = ? AND enabled = 1
      ORDER BY connected_at DESC
      LIMIT 1
    `).get(workspaceId, provider) as
      | { access_token: string | null; refresh_token: string | null; expires_at: string | null }
      | undefined;

    if (!row?.access_token) return null;

    return {
      accessToken: decryptSecret(row.access_token),
      refreshToken: row.refresh_token ? decryptSecret(row.refresh_token) : null,
      expiresAt: row.expires_at ?? null,
    };
  };

  const refreshGoogleToken = async (
    workspaceId: string,
    provider: 'gmail' | 'google_sheets',
    refreshToken: string,
  ) => {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth is not configured. Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.');
    }

    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Token refresh failed (${response.status}): ${details}`);
    }

    const payload = await response.json() as { access_token: string; expires_in?: number };
    const expiresAt = payload.expires_in
      ? new Date(Date.now() + payload.expires_in * 1000).toISOString()
      : null;

    db.prepare(`
      UPDATE integrations
      SET access_token = ?, expires_at = ?
      WHERE workspace_id = ? AND provider = ?
    `).run(
      encryptSecret(payload.access_token),
      expiresAt,
      workspaceId,
      provider,
    );

    return {
      accessToken: payload.access_token,
      expiresAt,
    };
  };

  const registerAliases = (aliases: string[], provider: 'gmail' | 'google_sheets', execute: (params: Record<string, any>, accessToken: string) => Promise<any>) => {
    for (const alias of aliases) {
      registerTool(alias, { provider, execute });
    }
  };

  registerAliases(['send_email', 'email.send', 'gmail.send'], 'gmail', async (params, accessToken) => {
    const to = toRecipientList(params.to ?? params.recipients ?? params.email);
    if (to.length === 0) {
      throw new Error('send_email requires at least one recipient.');
    }

    const subject = String(params.subject ?? 'Automata Notification');
    const body = String(params.body ?? params.message ?? '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw: encodeEmail(to, subject, body) }),
    });

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Gmail send failed (${response.status}): ${details}`);
    }

    const payload = await response.json() as { id?: string };
    return {
      messageId: payload.id ?? null,
      status: 'sent',
      to,
      subject,
    };
  });

  registerAliases(['read_range', 'read_rows', 'read_google_sheet', 'google_sheets.read', 'google_sheets_read'], 'google_sheets', async (params, accessToken) => {
    const range = String(params.range ?? 'A:Z');
    const lastNRows = Number(params.last_n_rows ?? params.lastNRows ?? 0);
    let spreadsheetId = String(params.spreadsheet_id ?? '').trim();

    if (!spreadsheetId) {
      const spreadsheetName = String(params.spreadsheet_name ?? params.spreadsheet ?? '').trim();
      if (!spreadsheetName) {
        throw new Error('read_range requires spreadsheet_id or spreadsheet_name.');
      }

      const query = `name='${spreadsheetName.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.spreadsheet'`;
      const searchUrl = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)&pageSize=1`;

      const searchRes = await fetch(searchUrl, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!searchRes.ok) {
        const details = await searchRes.text();
        throw new Error(`Drive lookup failed (${searchRes.status}): ${details}`);
      }

      const searchData = await searchRes.json() as { files?: Array<{ id: string }> };
      if (!searchData.files?.length) {
        throw new Error(`Spreadsheet not found: ${spreadsheetName}`);
      }
      spreadsheetId = searchData.files[0].id;
    }

    const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
    const valuesRes = await fetch(valuesUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!valuesRes.ok) {
      const details = await valuesRes.text();
      throw new Error(`Sheets read failed (${valuesRes.status}): ${details}`);
    }

    const valuesData = await valuesRes.json() as { values?: string[][] };
    const allRows = valuesData.values ?? [];
    const headers = allRows[0] ?? [];
    const dataRows = allRows.slice(1);
    const rows = Number.isFinite(lastNRows) && lastNRows > 0
      ? dataRows.slice(-lastNRows)
      : dataRows;

    return {
      headers,
      rows,
      row_count: rows.length,
      spreadsheet_id: spreadsheetId,
      range,
    };
  });

  const emitWorkflowGenerationEvent = (workflowId: string, event: string, data: unknown) => {
    runEventBus.emit(`workflow:${workflowId}`, { event, data });
  };

  const emitRunEvent = (runId: string, event: string, data: unknown) => {
    runEventBus.emit(`run:${runId}`, { event, data });
  };

  const runWorkflowGeneration = async (workflowId: string) => {
    if (activeWorkflowGenerations.has(workflowId)) return;
    activeWorkflowGenerations.add(workflowId);

    try {
      const workflow = getWorkflowById(workflowId);
      if (!workflow) throw new Error('Workflow not found.');
      const prompt = workflow.prompt?.trim();
      if (!prompt) throw new Error('Workflow prompt is missing.');

      const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
      const summaryModel = process.env.WORKFLOW_SUMMARY_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5';
      const dagModel = process.env.WORKFLOW_DAG_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';

      let name = String(workflow.name ?? 'Generated Workflow').trim().slice(0, 80) || 'Generated Workflow';
      let description = String(workflow.description ?? '').trim();

      if (hasAnthropicKey) {
        try {
          const summaryMessage = await requestLlmCompletion({
            model: summaryModel,
            maxTokens: 60,
            temperature: 0,
            system: 'Extract a short workflow name (max 6 words) and one sentence description from this workflow description. Return only JSON: { "name": string, "description": string }',
            user: prompt,
          });

          const summaryText = summaryMessage.text;
          const summary = extractJSONObject(summaryText) as { name?: string; description?: string };
          name = String(summary.name ?? name).trim().slice(0, 80) || 'Generated Workflow';
          description = String(summary.description ?? description).trim();
        } catch {
          const fallbackSummary = buildFallbackSummary(prompt);
          name = String(fallbackSummary.name ?? name).trim().slice(0, 80) || 'Generated Workflow';
          description = String(fallbackSummary.description ?? description).trim();
        }
      } else {
        const fallbackSummary = buildFallbackSummary(prompt);
        name = String(fallbackSummary.name ?? name).trim().slice(0, 80) || 'Generated Workflow';
        description = String(fallbackSummary.description ?? description).trim();
      }

      db.prepare(`
        UPDATE workflows
        SET name = ?, description = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, description, workflowId);

      emitWorkflowGenerationEvent(workflowId, 'phase', {
        phase: 'named',
        name,
        description,
      });

      let dag: GeneratedWorkflowDag;
      let usedFallback = false;

      if (hasAnthropicKey) {
        try {
          const dagResponse = await requestLlmCompletion({
            model: dagModel,
            maxTokens: 2000,
            temperature: 0.2,
            system: WORKFLOW_DAG_SYSTEM_PROMPT,
            user: prompt,
          });

          const rawDag = dagResponse.text;
          for (let index = 0; index < rawDag.length; index += 160) {
            emitWorkflowGenerationEvent(workflowId, 'token', { token: rawDag.slice(index, index + 160) });
          }

          dag = normalizeGeneratedWorkflowDag(extractJSONObject(rawDag));
          dag.workflow_name = name;
          if (!dag.description) dag.description = description;
        } catch (generationError) {
          usedFallback = true;
          const reason = generationError instanceof Error ? generationError.message : 'Generation provider unavailable.';
          emitWorkflowGenerationEvent(workflowId, 'phase', {
            phase: 'fallback',
            reason,
          });
          dag = buildFallbackWorkflowDag(prompt, name, description);
        }
      } else {
        usedFallback = true;
        emitWorkflowGenerationEvent(workflowId, 'phase', {
          phase: 'fallback',
          reason: 'ANTHROPIC_API_KEY is not configured.',
        });
        dag = buildFallbackWorkflowDag(prompt, name, description);
      }

      const configuredExecModel = process.env.WORKFLOW_EXEC_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim();
      if (configuredExecModel) {
        for (const node of dag.nodes) {
          if (node.type === 'llm_call' || node.type === 'evaluator') {
            node.config = {
              ...(node.config ?? {}),
              model: configuredExecModel,
            };
          }
        }
      }

      validateGeneratedWorkflowDag(dag);
      emitWorkflowGenerationEvent(workflowId, 'phase', {
        phase: 'validated',
        nodeCount: dag.nodes.length,
        edgeCount: dag.edges.length,
      });

      const { estimatedCostPerRunInr, breakdown } = estimateWorkflowRunCostInr(dag);
      emitWorkflowGenerationEvent(workflowId, 'phase', {
        phase: 'costed',
        estimatedCostPerRunInr,
      });

      db.prepare(`
        UPDATE workflows
        SET name = ?, description = ?, dag = ?, status = 'ready', estimated_cost_per_run_inr = ?, generation_error = NULL, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(name, dag.description || description, JSON.stringify(dag), estimatedCostPerRunInr, workflowId);

      emitWorkflowGenerationEvent(workflowId, 'complete', {
        workflowId,
        name,
        description: dag.description || description,
        dag,
        estimatedCostPerRunInr,
        costBreakdown: breakdown,
        usedFallback,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Workflow generation failed.';
      db.prepare(`
        UPDATE workflows
        SET status = 'failed', generation_error = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(message, workflowId);
      emitWorkflowGenerationEvent(workflowId, 'error', { message });
    } finally {
      activeWorkflowGenerations.delete(workflowId);
    }
  };

  const runWorkflowExecution = async (workflowId: string, runId: string) => {
    if (activeWorkflowRuns.has(runId)) return;
    activeWorkflowRuns.add(runId);

    const nodeExecutionIds = new Map<string, string>();
    const startedAt = Date.now();

    try {
      const workflow = getWorkflowById(workflowId);
      if (!workflow) throw new Error('Workflow not found.');
      const dag = workflow.dag ? (JSON.parse(workflow.dag) as GeneratedWorkflowDag) : { nodes: [], edges: [] };
      const workspaceId = workflow.workspace_id ?? `workspace:${workflow.user_id ?? 'anonymous'}`;

      const result = await executeWorkflow(dag, runId, {
        shouldStop: () => cancelledRuns.has(runId),
        resolveIntegration: async (provider: string) => {
          return loadIntegrationToken(workspaceId, provider);
        },
        refreshIntegrationToken: async (provider: string, refreshToken: string) => {
          const normalizedProvider = provider === 'google_sheets' ? 'google_sheets' : 'gmail';
          return refreshGoogleToken(workspaceId, normalizedProvider, refreshToken);
        },
        onNodeUpdate: async (event: NodeExecutionEvent) => {
          const executionId = nodeExecutionIds.get(event.nodeId) ?? uuidv4();
          const hasExecutionRow = nodeExecutionIds.has(event.nodeId);
          nodeExecutionIds.set(event.nodeId, executionId);

          if (event.status === 'running' || !hasExecutionRow) {
            db.prepare(`
              INSERT OR REPLACE INTO node_executions (
                id, run_id, node_id, status, input_data, output_data,
                tokens_used, cost_inr, duration_ms, evaluator_score
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              executionId,
              runId,
              event.nodeId,
              event.status,
              null,
              event.output ? JSON.stringify(event.output) : null,
              event.tokensUsed,
              event.costInr,
              event.durationMs,
              event.evaluatorScore ?? null,
            );
          } else {
            db.prepare(`
              UPDATE node_executions
              SET status = ?, output_data = ?, tokens_used = ?, cost_inr = ?, duration_ms = ?, evaluator_score = ?
              WHERE id = ?
            `).run(
              event.status,
              event.output ? JSON.stringify(event.output) : null,
              event.tokensUsed,
              event.costInr,
              event.durationMs,
              event.evaluatorScore ?? null,
              executionId,
            );
          }

          const totals = db.prepare(`
            SELECT COALESCE(SUM(tokens_used), 0) AS totalTokens, COALESCE(SUM(cost_inr), 0) AS totalCostInr
            FROM node_executions
            WHERE run_id = ?
          `).get(runId) as { totalTokens: number; totalCostInr: number };

          db.prepare(`
            UPDATE workflow_runs
            SET total_tokens = ?, total_cost_inr = ?
            WHERE id = ?
          `).run(totals.totalTokens, totals.totalCostInr, runId);

          emitRunEvent(runId, 'node_update', {
            nodeId: event.nodeId,
            nodeLabel: event.nodeLabel,
            nodeType: event.nodeType,
            status: event.status,
            outputPreview: event.outputPreview,
            tokensUsed: event.tokensUsed,
            costInr: event.costInr,
            durationMs: event.durationMs,
            evaluatorScore: event.evaluatorScore ?? null,
            runningTotalCostInr: event.runningTotalCostInr,
            timestamp: new Date().toISOString(),
          });
        },
      });

      const finalStatus = cancelledRuns.has(runId)
        ? 'failed'
        : (result.status === 'completed' ? 'completed' : 'failed');

      db.prepare(`
        UPDATE workflow_runs
        SET status = ?, ended_at = CURRENT_TIMESTAMP, total_tokens = ?, total_cost_inr = ?
        WHERE id = ?
      `).run(finalStatus, result.totalTokens, result.totalCostInr, runId);

      emitRunEvent(runId, 'run_complete', {
        runId,
        status: finalStatus,
        totalTokens: result.totalTokens,
        totalCostInr: result.totalCostInr,
        durationMs: Date.now() - startedAt,
        error: result.error ?? (cancelledRuns.has(runId) ? 'Run stopped by user.' : null),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run failed.';
      db.prepare(`
        UPDATE workflow_runs
        SET status = 'failed', ended_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(runId);

      emitRunEvent(runId, 'run_complete', {
        runId,
        status: 'failed',
        totalTokens: 0,
        totalCostInr: 0,
        durationMs: Date.now() - startedAt,
        error: message,
      });
    } finally {
      cancelledRuns.delete(runId);
      activeWorkflowRuns.delete(runId);
    }
  };

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", db: "sqlite_ready" });
  });

  // Workflow CRUDS
  app.get("/api/workflows", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflows = db.prepare(`
      SELECT * FROM workflows
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all(user.userId) as WorkflowRow[];

    res.json({ workflows: workflows.map(serializeWorkflowRow) });
  });

  app.post("/api/workflows", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const { name, description, status, dag, prompt, estimatedCostPerRunInr } = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO workflows (
        id, user_id, workspace_id, name, description, prompt, dag, status, estimated_cost_per_run_inr, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      id,
      user.userId,
      user.workspaceId,
      name,
      description ?? '',
      prompt ?? null,
      dag ? JSON.stringify(dag) : null,
      status || 'draft',
      estimatedCostPerRunInr ?? 0,
    );
    res.status(201).json({ workflow: serializeWorkflowRow(getWorkflowById(id)) });
  });

  app.get("/api/workflows/:id", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflow = getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    res.json({ workflow: serializeWorkflowRow(workflow) });
  });

  app.patch("/api/workflows/:id", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflow = getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    const { name, status, description } = req.body;
    db.prepare(`
      UPDATE workflows
      SET name = COALESCE(?, name),
          status = COALESCE(?, status),
          description = COALESCE(?, description),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(name ?? null, status ?? null, description ?? null, req.params.id);
    res.json({ workflow: serializeWorkflowRow(getWorkflowById(req.params.id)) });
  });

  app.delete("/api/workflows/:id", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflow = getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    db.prepare(`DELETE FROM node_executions WHERE run_id IN (SELECT id FROM workflow_runs WHERE workflow_id = ?)`)
      .run(req.params.id);
    db.prepare(`DELETE FROM workflow_runs WHERE workflow_id = ?`).run(req.params.id);
    db.prepare("DELETE FROM workflows WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // ── Workflow Generation via Claude ─────────────────────────────────────
  app.post("/api/workflows/generate", async (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const { prompt } = req.body as { prompt?: string };
    const safePrompt = prompt?.trim() ?? '';

    if (safePrompt.length < 20) {
      return res.status(400).json({ error: 'Prompt must be at least 20 characters.' });
    }
    if (safePrompt.length > 500) {
      return res.status(400).json({ error: 'Prompt must be 500 characters or fewer.' });
    }

    const workflowId = uuidv4();
    db.prepare(`
      INSERT INTO workflows (
        id, user_id, workspace_id, name, description, prompt, dag, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `).run(
      workflowId,
      user.userId,
      user.workspaceId,
      'Generating...',
      '',
      safePrompt,
      null,
      'generating',
    );

    return res.status(201).json({ workflowId, status: 'generating' });
  });

  app.get('/api/workflows/:id/stream', (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflow = getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(403).json({ error: 'Forbidden.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    const serialized = serializeWorkflowRow(workflow);
    if (workflow.status !== 'generating') {
      if (workflow.status === 'failed') {
        writeSSE(res, 'error', { message: workflow.generation_error || 'Workflow generation failed.' });
      } else {
        writeSSE(res, 'complete', {
          workflowId: workflow.id,
          name: workflow.name,
          description: workflow.description ?? '',
          dag: serialized?.dag,
          estimatedCostPerRunInr: workflow.estimated_cost_per_run_inr ?? 0,
        });
      }
      return res.end();
    }

    if (workflow.name && workflow.name !== 'Generating...') {
      writeSSE(res, 'phase', {
        phase: 'named',
        name: workflow.name,
        description: workflow.description ?? '',
      });
    }

    const channel = `workflow:${workflow.id}`;
    const handler = (payload: { event: string; data: unknown }) => {
      writeSSE(res, payload.event, payload.data);
      if (payload.event === 'complete' || payload.event === 'error') {
        cleanup();
      }
    };

    const heartbeat = setInterval(() => {
      writeSSE(res, 'heartbeat', { timestamp: new Date().toISOString() });
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      runEventBus.off(channel, handler);
      res.end();
    };

    runEventBus.on(channel, handler);
    req.on('close', () => {
      clearInterval(heartbeat);
      runEventBus.off(channel, handler);
    });

    if (!activeWorkflowGenerations.has(workflow.id)) {
      void runWorkflowGeneration(workflow.id);
    }
  });

  app.post('/api/workflows/:id/runs', (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const workflow = getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }
    if (workflow.status === 'generating') {
      return res.status(409).json({ error: 'Workflow is still being generated' });
    }
    if (!['ready', 'active'].includes(workflow.status)) {
      return res.status(409).json({ error: 'Workflow must be ready or active before it can run.' });
    }

    const activeRun = db.prepare(`
      SELECT id FROM workflow_runs WHERE workflow_id = ? AND status = 'running' LIMIT 1
    `).get(workflow.id) as { id: string } | undefined;
    if (activeRun) {
      return res.status(409).json({ error: 'A run is already in progress' });
    }

    const runId = uuidv4();
    const trigger = req.body?.trigger === 'cron' ? 'cron' : 'manual';
    db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, status, trigger, started_at, total_tokens, total_cost_inr)
      VALUES (?, ?, 'running', ?, CURRENT_TIMESTAMP, 0, 0)
    `).run(runId, workflow.id, trigger);

    res.status(201).json({ runId });
    setImmediate(() => {
      void runWorkflowExecution(workflow.id, runId);
    });
  });

  app.get('/api/runs/:runId/stream', (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const run = db.prepare(`
      SELECT wr.*, w.user_id
      FROM workflow_runs wr
      INNER JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = ? AND w.user_id = ?
    `).get(req.params.runId, user.userId) as
      | { id: string; status: string; total_tokens: number; total_cost_inr: number; started_at: string; ended_at: string | null }
      | undefined;

    if (!run) {
      return res.status(404).json({ error: 'Run not found.' });
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders();

    if (run.status !== 'running') {
      writeSSE(res, 'run_complete', {
        runId: run.id,
        status: run.status,
        totalTokens: run.total_tokens,
        totalCostInr: run.total_cost_inr,
        durationMs: run.ended_at ? (new Date(run.ended_at).getTime() - new Date(run.started_at).getTime()) : 0,
      });
      return res.end();
    }

    const channel = `run:${run.id}`;
    const handler = (payload: { event: string; data: unknown }) => {
      writeSSE(res, payload.event, payload.data);
      if (payload.event === 'run_complete') {
        cleanup();
      }
    };

    const heartbeat = setInterval(() => {
      writeSSE(res, 'heartbeat', { timestamp: new Date().toISOString() });
    }, 15000);

    const cleanup = () => {
      clearInterval(heartbeat);
      runEventBus.off(channel, handler);
      res.end();
    };

    runEventBus.on(channel, handler);
    req.on('close', () => {
      clearInterval(heartbeat);
      runEventBus.off(channel, handler);
    });
  });

  app.delete('/api/runs/:runId', (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const run = db.prepare(`
      SELECT wr.id
      FROM workflow_runs wr
      INNER JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = ? AND w.user_id = ? AND wr.status = 'running'
    `).get(req.params.runId, user.userId) as { id: string } | undefined;

    if (!run) {
      return res.status(404).json({ error: 'Run not found or already finished.' });
    }

    cancelledRuns.add(run.id);
    res.json({ success: true });
  });

  // ── Terminal (streaming chat) ─────────────────────────────────────────
  app.post("/api/terminal", async (req, res) => {
    const { message, history } = req.body as {
      message?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required." });
    }
    if (message.length > 2000) {
      return res.status(400).json({ error: "Message must be 2000 characters or fewer." });
    }
    const safeHistory = (history ?? [])
      .filter(m => m.role && m.content)
      .slice(-20); // cap context window

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      const model = process.env.TERMINAL_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || "claude-haiku-4-5";
      const historyTranscript = safeHistory
        .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
        .join('\n\n');

      const response = await requestLlmCompletion({
        model,
        maxTokens: 1024,
        temperature: 0.2,
        system: `You are Automata AI, an intelligent assistant for building and debugging autonomous workflows. Help users design workflow logic, write system prompts, debug failures, understand AI agent patterns, and translate plain English descriptions into structured workflow DAGs. Be concise and practical.`,
        user: historyTranscript
          ? `${historyTranscript}\n\nUSER: ${message}`
          : message,
      });

      const text = response.text ?? '';
      for (let index = 0; index < text.length; index += 180) {
        const data = JSON.stringify({ delta: text.slice(index, index + 180) });
        res.write(`data: ${data}\n\n`);
      }
      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err: any) {
      console.error("[terminal]", err);
      res.write(`data: ${JSON.stringify({ error: err.message ?? "Stream failed." })}\n\n`);
      res.end();
    }
  });

  // Integrations
  app.get("/api/integrations", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    try {
      const rows = db.prepare(`
        SELECT provider, account_name as account, connected_at
        FROM integrations
        WHERE workspace_id = ? AND enabled = 1
        ORDER BY connected_at DESC
      `).all(user.workspaceId);
      res.json(rows);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/integrations/connect/:provider', (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    const provider = normalizeProviderFromRoute(req.params.provider);
    if (!provider || (provider !== 'gmail' && provider !== 'google_sheets')) {
      return res.status(400).json({ error: 'Unsupported integration provider.' });
    }
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_REDIRECT_URI) {
      return res.status(500).json({ error: 'Google OAuth is not configured.' });
    }

    const state = signOAuthState({
      userId: user.userId,
      workspaceId: user.workspaceId,
      provider,
      ts: Date.now(),
    });

    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set('redirect_uri', process.env.GOOGLE_REDIRECT_URI);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', [
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'openid',
      'email',
      'profile',
    ].join(' '));
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent');
    url.searchParams.set('state', state);

    return res.redirect(url.toString());
  });

  app.get('/api/integrations/callback/google', async (req, res) => {
    const code = String(req.query.code ?? '');
    const stateToken = String(req.query.state ?? '');
    if (!code || !stateToken) {
      return res.status(400).json({ error: 'Missing code or state.' });
    }

    const state = verifyOAuthState(stateToken);
    if (!state) {
      return res.status(400).json({ error: 'Invalid OAuth state.' });
    }

    const workspaceId = String(state.workspaceId ?? '').trim();
    const userId = String(state.userId ?? '').trim();
    const issuedAt = Number(state.ts ?? 0);
    if (!workspaceId || !userId || !issuedAt || Date.now() - issuedAt > 15 * 60 * 1000) {
      return res.status(400).json({ error: 'Expired or invalid OAuth state.' });
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      return res.status(500).json({ error: 'Google OAuth is not configured.' });
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenResponse.ok) {
        const details = await tokenResponse.text();
        return res.status(500).json({ error: `OAuth token exchange failed (${tokenResponse.status}): ${details}` });
      }

      const tokenData = await tokenResponse.json() as {
        access_token: string;
        refresh_token?: string;
        expires_in?: number;
      };

      const profileResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!profileResponse.ok) {
        const details = await profileResponse.text();
        return res.status(500).json({ error: `Google userinfo failed (${profileResponse.status}): ${details}` });
      }

      const profile = await profileResponse.json() as { email?: string; name?: string };
      const accountName = profile.email || profile.name || userId;
      const expiresAt = tokenData.expires_in
        ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
        : null;

      const encryptedAccessToken = encryptSecret(tokenData.access_token);
      const encryptedRefreshToken = tokenData.refresh_token ? encryptSecret(tokenData.refresh_token) : null;

      upsertIntegration(
        workspaceId,
        'gmail',
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        accountName,
      );

      upsertIntegration(
        workspaceId,
        'google_sheets',
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        accountName,
      );

      return res.redirect('/settings?connected=google');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'OAuth callback failed.';
      return res.status(500).json({ error: message });
    }
  });

  app.delete("/api/integrations/:provider", (req, res) => {
    const user = requireSession(req, res);
    if (!user) return;

    try {
      db.prepare("DELETE FROM integrations WHERE workspace_id = ? AND provider = ?")
        .run(user.workspaceId, req.params.provider);
    } catch { /* table may not exist yet */ }
    res.json({ success: true });
  });

  // User profile
  app.patch("/api/users/me", (req, res) => {
    const { name } = req.body as { name?: string };
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Name must be at least 2 characters." });
    }
    res.json({ user: { name: name.trim() } });
  });

  app.delete("/api/users/me", (req, res) => {
    res.json({ success: true });
  });

  app.post("/api/auth/change-password", (req, res) => {
    const { currentPassword, newPassword } = req.body as { currentPassword?: string; newPassword?: string };
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Both passwords are required." });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    res.json({ success: true });
  });

  // User preferences
  app.get("/api/users/preferences", (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || 'default';
    let prefs: any = db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get(userId);
    if (!prefs) {
      prefs = { sidebar_open: 0, theme: 'system' };
    }
    res.json({ sidebarOpen: Boolean(prefs.sidebar_open), theme: prefs.theme ?? 'system' });
  });

  app.patch("/api/users/preferences", (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || 'default';
    const { sidebarOpen, theme } = req.body as { sidebarOpen?: boolean; theme?: string };
    const existing = db.prepare("SELECT id FROM user_preferences WHERE user_id = ?").get(userId);
    if (existing) {
      db.prepare("UPDATE user_preferences SET sidebar_open = COALESCE(?, sidebar_open), theme = COALESCE(?, theme), updated_at = CURRENT_TIMESTAMP WHERE user_id = ?")
        .run(sidebarOpen !== undefined ? (sidebarOpen ? 1 : 0) : null, theme ?? null, userId);
    } else {
      db.prepare("INSERT INTO user_preferences (id, user_id, sidebar_open, theme) VALUES (?, ?, ?, ?)")
        .run(uuidv4(), userId, sidebarOpen ? 1 : 0, theme ?? 'system');
    }
    res.json({ success: true });
  });

  // Terminal messages persistence
  app.get("/api/terminal/messages", (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.json({ messages: [] });
    const rows = db.prepare(
      "SELECT id, role, content, tokens_used, cost_inr, created_at FROM terminal_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 100"
    ).all(sessionId);
    res.json({ messages: rows });
  });

  app.post("/api/terminal/messages", (req, res) => {
    const { sessionId, role, content, tokensUsed, costInr, userId } = req.body as any;
    if (!sessionId || !role || !content) return res.status(400).json({ error: "sessionId, role, content required." });
    const id = uuidv4();
    db.prepare(
      "INSERT INTO terminal_messages (id, user_id, session_id, role, content, tokens_used, cost_inr) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, userId ?? 'anonymous', sessionId, role, content, tokensUsed ?? 0, costInr ?? 0);
    res.json({ id });
  });

  // Workflow execute (manual trigger)
  app.post("/api/workflows/execute", async (req, res) => {
    const { workflowId } = req.body as { workflowId?: string };
    if (!workflowId) return res.status(400).json({ error: "workflowId required." });
    const workflow: any = db.prepare("SELECT * FROM workflows WHERE id = ?").get(workflowId);
    if (!workflow) return res.status(404).json({ error: "Workflow not found." });

    const runId = uuidv4();
    db.prepare(
      "INSERT INTO workflow_runs (id, workflow_id, status) VALUES (?, ?, ?)"
    ).run(runId, workflowId, 'running');

    try {
      const { executeWorkflow } = await import('./src/lib/workflowExecutor.js');
      let dag: any = { nodes: [], edges: [] };
      if (workflow.dag) {
        try { dag = JSON.parse(workflow.dag); } catch { /* use empty dag */ }
      }
      const workspaceId = workflow.workspace_id ?? `workspace:${workflow.user_id ?? 'anonymous'}`;
      const result = await executeWorkflow(dag, runId, {
        resolveIntegration: async (provider: string) => {
          return loadIntegrationToken(workspaceId, provider);
        },
        refreshIntegrationToken: async (provider: string, refreshToken: string) => {
          const normalizedProvider = provider === 'google_sheets' ? 'google_sheets' : 'gmail';
          return refreshGoogleToken(workspaceId, normalizedProvider, refreshToken);
        },
      });
      db.prepare(
        "UPDATE workflow_runs SET status = ?, ended_at = CURRENT_TIMESTAMP, total_tokens = ?, total_cost_inr = ? WHERE id = ?"
      ).run(result.status, result.totalTokens, result.totalCostInr, runId);
      res.json({ runId, status: result.status, totalTokens: result.totalTokens, totalCostInr: result.totalCostInr });
    } catch (err: any) {
      db.prepare("UPDATE workflow_runs SET status = ?, ended_at = CURRENT_TIMESTAMP WHERE id = ?").run('failed', runId);
      res.status(500).json({ error: err.message ?? 'Execution failed.' });
    }
  });

  // Analytics
  app.get("/api/analytics/summary", (req, res) => {
    res.json({
      success_rate: "99.98%",
      p99_latency: "24ms",
      total_runs: 2450,
      total_cost_inr: 42500
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const resolvedPort = await findAvailablePort(preferredPort, host);

  server.listen(resolvedPort, host, () => {
    if (resolvedPort !== preferredPort) {
      console.warn(`[AUTOMATA] Port ${preferredPort} is busy, using ${resolvedPort} instead.`);
    }
    console.log(`[AUTOMATA] Platform running on http://localhost:${resolvedPort}`);
  });
}

async function findAvailablePort(port: number, host: string): Promise<number> {
  try {
    await canListenOnPort(port, host);
    return port;
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;

    if (listenError.code === "EADDRINUSE") {
      return findAvailablePort(port + 1, host);
    }

    throw error;
  }
}

function canListenOnPort(port: number, host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const probe = createNetServer();

    probe.once("error", (error) => {
      reject(error);
    });

    probe.once("listening", () => {
      probe.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve();
      });
    });

    probe.listen(port, host);
  });
}

startServer();

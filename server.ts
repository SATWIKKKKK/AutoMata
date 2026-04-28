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
import db from "./src/lib/db.js";
import { DATABASE_SCHEMA_SQL } from "./src/lib/dbSchema.js";
import runEventBus from "./src/lib/runEvents.js";
import { requestLlmCompletion } from "./src/lib/llmGateway.js";
import { registerTool } from "./src/lib/toolRegistry.js";
import { decryptSecret, encryptSecret } from "./src/lib/tokenCrypto.js";
import { executeWorkflow, type NodeExecutionEvent } from "./src/lib/workflowExecutor.js";

type SessionUser = {
  userId: string;
  email: string;
  workspaceId: string;
  displayName: string;
};

type DbTimestamp = string | Date | null | undefined;

type IntegrationProvider = 'gmail' | 'google_sheets' | 'slack' | 'notion';

type IntegrationSource = 'oauth' | 'env';

type IntegrationRow = {
  provider: string;
  account: string | null;
  connected_at: DbTimestamp;
  source?: IntegrationSource;
};

const ENV_INTEGRATION_CONFIG: Record<Exclude<IntegrationProvider, 'gmail' | 'google_sheets'>, {
  tokenEnv: string;
  accountEnv?: string;
  fallbackAccount: string;
}> = {
  slack: {
    tokenEnv: 'SLACK_BOT_TOKEN',
    accountEnv: 'SLACK_BOT_NAME',
    fallbackAccount: 'Slack Bot (env token)',
  },
  notion: {
    tokenEnv: 'NOTION_TOKEN',
    accountEnv: 'NOTION_WORKSPACE_NAME',
    fallbackAccount: 'Notion Integration (env token)',
  },
};

type WorkflowRow = {
  id: string;
  user_id: string | null;
  workspace_id: string | null;
  name: string;
  description: string | null;
  prompt: string | null;
  dag: GeneratedWorkflowDag | string | null;
  status: string;
  cron_schedule: string | null;
  estimated_cost_per_run_inr: number | string | null;
  generation_error: string | null;
  created_at: DbTimestamp;
  updated_at: DbTimestamp;
};

type ExtractedMetric = {
  key: string;
  value: number;
  label?: string;
};

type MetricAnomaly = {
  key: string;
  current: number;
  mean: number;
  stddev: number;
  direction: 'above' | 'below';
};

const activeWorkflowGenerations = new Set<string>();
const activeWorkflowRuns = new Set<string>();
const cancelledRuns = new Set<string>();

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

function toIsoTimestamp(value: DbTimestamp): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) {
    return typeof value === 'string' ? value : null;
  }
  return date.toISOString();
}

function parseDag(value: WorkflowRow['dag']): GeneratedWorkflowDag | null {
  if (!value) return null;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as GeneratedWorkflowDag;
    } catch {
      return null;
    }
  }
  return value as GeneratedWorkflowDag;
}

function toJsonParam(value: unknown): string | null {
  return value == null ? null : JSON.stringify(value);
}

function extractJsonBlock(text: string): string {
  const trimmed = String(text ?? '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  return trimmed;
}

function parseJsonObject(text: string): Record<string, any> | null {
  try {
    const parsed = JSON.parse(extractJsonBlock(text));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseMetricsJson(text: string): ExtractedMetric[] {
  try {
    const parsed = JSON.parse(extractJsonBlock(text));
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => {
        const key = String(item?.key ?? '').trim();
        const value = Number(item?.value);
        const label = String(item?.label ?? '').trim();
        if (!key || !Number.isFinite(value)) return null;
        return { key, value, label };
      })
      .filter((item): item is ExtractedMetric => Boolean(item));
  } catch {
    return [];
  }
}

async function ensureDatabaseReady() {
  await db.exec(DATABASE_SCHEMA_SQL);
}

async function ensureUserWorkspace(user: SessionUser) {
  await db.prepare(`
    INSERT INTO workspaces (id, name)
    VALUES (?, ?)
    ON CONFLICT (id) DO NOTHING
  `).run(
    user.workspaceId,
    `${user.displayName}'s Workspace`,
  );

  await db.prepare(`
    INSERT INTO users (id, workspace_id, email, name, role, updated_at)
    VALUES (?, ?, ?, ?, ?, NOW())
    ON CONFLICT (id) DO UPDATE SET
      workspace_id = EXCLUDED.workspace_id,
      email = EXCLUDED.email,
      name = COALESCE(users.name, EXCLUDED.name),
      role = COALESCE(users.role, EXCLUDED.role),
      updated_at = NOW()
  `).run(
    user.userId,
    user.workspaceId,
    user.email,
    user.displayName,
    'owner',
  );
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

function normalizeProviderFromRoute(provider: string): IntegrationProvider | null {
  const normalized = provider.trim().toLowerCase();
  if (normalized === 'gmail' || normalized === 'google_sheets' || normalized === 'google') {
    return normalized === 'google' ? 'gmail' : normalized;
  }
  if (normalized === 'slack') return 'slack';
  if (normalized === 'notion') return 'notion';
  return null;
}

function isGoogleProvider(provider: string): provider is 'gmail' | 'google_sheets' {
  return provider === 'gmail' || provider === 'google_sheets';
}

function isEnvManagedProvider(provider: string): provider is 'slack' | 'notion' {
  return provider === 'slack' || provider === 'notion';
}

function getEnvTokenForProvider(provider: string): string | null {
  if (!isEnvManagedProvider(provider)) return null;
  const key = ENV_INTEGRATION_CONFIG[provider].tokenEnv;
  const token = process.env[key]?.trim();
  return token || null;
}

function getEnvAccountForProvider(provider: string): string {
  if (!isEnvManagedProvider(provider)) return 'Configured integration';
  const config = ENV_INTEGRATION_CONFIG[provider];
  const explicit = config.accountEnv ? process.env[config.accountEnv]?.trim() : '';
  return explicit || config.fallbackAccount;
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
  const dag = parseDag(row.dag);

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
    estimatedCostPerRunInr: Number(row.estimated_cost_per_run_inr ?? 0),
    generationError: row.generation_error,
    createdAt: toIsoTimestamp(row.created_at),
    updatedAt: toIsoTimestamp(row.updated_at ?? row.created_at),
    created_at: toIsoTimestamp(row.created_at),
    updated_at: toIsoTimestamp(row.updated_at ?? row.created_at),
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    }),
  ]);
}

function writeSSE(res: express.Response, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function getWorkflowById(workflowId: string) {
  return await db.prepare(`SELECT * FROM workflows WHERE id = ?`).get<WorkflowRow>(workflowId);
}

async function getOwnedWorkflow(workflowId: string, user: SessionUser) {
  return await db.prepare(`SELECT * FROM workflows WHERE id = ? AND user_id = ?`).get<WorkflowRow>(workflowId, user.userId);
}

async function startServer() {
  await ensureDatabaseReady();

  const app = express();
  const preferredPort = Number(process.env.PORT) || 3000;
  const host = process.env.HOST || "0.0.0.0";
  const server = createHttpServer(app);

  app.use(cors());
  app.use(express.json());

  const requireSession = async (req: express.Request, res: express.Response) => {
    const user = getSessionUser(req);
    if (!user) {
      res.status(401).json({ error: 'Authentication required.' });
      return null;
    }
    await ensureUserWorkspace(user);
    return user;
  };

  const getHaikuModel = () =>
    process.env.HAIKU_MODEL?.trim()
    || process.env.WORKFLOW_HAIKU_MODEL?.trim()
    || process.env.TERMINAL_MODEL?.trim()
    || process.env.ANTHROPIC_MODEL?.trim()
    || 'claude-haiku-4-5';

  const searchWorkflowMemories = async (userId: string, query: string, workflowId?: string | null) => {
    const q = String(query ?? '').trim();
    if (!q) return [];
    const likePattern = `%${q.replace(/[%_]/g, '\\$&')}%`;
    if (workflowId) {
      return db.prepare(`
        SELECT wm.content, wm.metric_key, wm.metric_value, wm.created_at, w.name AS workflow_name
        FROM workflow_memories wm
        INNER JOIN workflows w ON w.id = wm.workflow_id
        WHERE wm.user_id = ? AND wm.workflow_id = ? AND wm.content ILIKE ? ESCAPE '\\'
        ORDER BY wm.created_at DESC
        LIMIT 10
      `).all<{ content: string | null; metric_key: string | null; metric_value: number | string | null; created_at: DbTimestamp; workflow_name: string | null }>(
        userId,
        workflowId,
        likePattern,
      );
    }
    return db.prepare(`
      SELECT wm.content, wm.metric_key, wm.metric_value, wm.created_at, w.name AS workflow_name
      FROM workflow_memories wm
      INNER JOIN workflows w ON w.id = wm.workflow_id
      WHERE wm.user_id = ? AND wm.content ILIKE ? ESCAPE '\\'
      ORDER BY wm.created_at DESC
      LIMIT 10
    `).all<{ content: string | null; metric_key: string | null; metric_value: number | string | null; created_at: DbTimestamp; workflow_name: string | null }>(
      userId,
      likePattern,
    );
  };

  const extractMetricsFromText = async (text: string): Promise<ExtractedMetric[]> => {
    const raw = String(text ?? '').trim();
    if (!raw) return [];
    try {
      const response = await requestLlmCompletion({
        model: getHaikuModel(),
        maxTokens: 100,
        temperature: 0,
        system: "Extract all numeric business metrics from this text. Return ONLY JSON array: [{key: string, value: number, label: string}]. If none found return [].",
        user: raw,
      });
      return parseMetricsJson(response.text);
    } catch {
      return [];
    }
  };

  const detectAnomalies = async (
    workflowId: string,
    userId: string | null,
    runId: string,
    currentMetrics: ExtractedMetric[],
  ): Promise<MetricAnomaly[]> => {
    if (!userId) return [];
    const anomalies: MetricAnomaly[] = [];
    for (const metric of currentMetrics) {
      const rows = await db.prepare(`
        SELECT metric_value
        FROM workflow_memories
        WHERE workflow_id = ? AND user_id = ? AND metric_key = ? AND metric_value IS NOT NULL AND run_id <> ?
        ORDER BY created_at DESC
        LIMIT 10
      `).all<{ metric_value: number | string | null }>(workflowId, userId, metric.key, runId);
      const values = rows
        .map((row) => Number(row.metric_value))
        .filter((value) => Number.isFinite(value));
      if (values.length < 3) continue;
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      const variance = values.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / values.length;
      const stddev = Math.sqrt(variance);
      if (stddev === 0) continue;
      const upper = mean + (2 * stddev);
      const lower = mean - (2 * stddev);
      if (metric.value > upper) {
        anomalies.push({ key: metric.key, current: metric.value, mean, stddev, direction: 'above' });
      } else if (metric.value < lower) {
        anomalies.push({ key: metric.key, current: metric.value, mean, stddev, direction: 'below' });
      }
    }
    return anomalies;
  };

  const formatAnomalyAlerts = (anomalies: MetricAnomaly[]): string => {
    if (!anomalies.length) return '';
    return anomalies.map((anomaly) => {
      const deltaPct = anomaly.mean === 0 ? 0 : Math.abs(((anomaly.current - anomaly.mean) / anomaly.mean) * 100);
      return `\n\n⚠️ AutoMata Alert: ${anomaly.key} is ${deltaPct.toFixed(1)}% ${anomaly.direction} recent average (${anomaly.mean.toFixed(2)} avg, current: ${anomaly.current.toFixed(2)})`;
    }).join('');
  };

  const upsertIntegration = async (
    userId: string,
    workspaceId: string,
    provider: IntegrationProvider,
    accessToken: string,
    refreshToken: string | null,
    expiresAt: string | null,
    accountName: string,
  ) => {
    const existing = await db.prepare(`
      SELECT id
      FROM integrations
      WHERE workspace_id = ? AND provider = ?
      LIMIT 1
    `).get<{ id: string }>(workspaceId, provider);

    if (existing) {
      await db.prepare(`
        UPDATE integrations
        SET user_id = ?, access_token = ?, refresh_token = ?, expires_at = ?::timestamptz, account_name = ?, enabled = TRUE, connected_at = NOW()
        WHERE id = ?
      `).run(userId, accessToken, refreshToken, expiresAt, accountName, existing.id);
    } else {
      await db.prepare(`
        INSERT INTO integrations (id, user_id, workspace_id, provider, access_token, refresh_token, account_name, expires_at, enabled, connected_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?::timestamptz, TRUE, NOW())
      `).run(uuidv4(), userId, workspaceId, provider, accessToken, refreshToken, accountName, expiresAt);
    }
  };

  const loadIntegrationToken = async (workspaceId: string, provider: string) => {
    const row = await db.prepare(`
      SELECT access_token, refresh_token, expires_at
      FROM integrations
      WHERE workspace_id = ? AND provider = ? AND enabled = TRUE
      ORDER BY connected_at DESC
      LIMIT 1
    `).get<{ access_token: string | null; refresh_token: string | null; expires_at: DbTimestamp }>(workspaceId, provider);

    if (!row?.access_token) return null;

    return {
      accessToken: decryptSecret(row.access_token),
      refreshToken: row.refresh_token ? decryptSecret(row.refresh_token) : null,
      expiresAt: toIsoTimestamp(row.expires_at),
    };
  };

  const resolveIntegrationToken = async (workspaceId: string, provider: string) => {
    const normalizedProvider = normalizeProviderFromRoute(provider) ?? provider;
    const dbToken = await loadIntegrationToken(workspaceId, normalizedProvider);
    if (dbToken) return dbToken;

    const envToken = getEnvTokenForProvider(normalizedProvider);
    if (envToken) {
      return {
        accessToken: envToken,
        refreshToken: null,
        expiresAt: null,
      };
    }

    return null;
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

    await db.prepare(`
      UPDATE integrations
      SET access_token = ?, expires_at = ?::timestamptz
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

  const registerAliases = (aliases: string[], provider: IntegrationProvider, execute: (params: Record<string, any>, accessToken: string) => Promise<any>) => {
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

  registerAliases(['send_slack_message', 'slack.send', 'post_slack_message', 'post_message', 'slack.post_message'], 'slack', async (params, accessToken) => {
    const channel = String(params.channel ?? params.channel_id ?? process.env.SLACK_DEFAULT_CHANNEL ?? '').trim();
    const fallbackChannel = String(process.env.SLACK_DEFAULT_CHANNEL ?? '').trim();
    const text = String(params.text ?? params.message ?? '').trim();

    if (!channel) {
      throw new Error('Slack message requires channel.');
    }
    if (!text) {
      throw new Error('Slack message requires text.');
    }

    const postSlackMessage = async (targetChannel: string) => {
      const response = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          channel: targetChannel,
          text,
          unfurl_links: false,
        }),
      });

      const payload = await response.json() as {
        ok?: boolean;
        error?: string;
        ts?: string;
        channel?: string;
      };

      return { response, payload };
    };

    let attemptedChannel = channel;
    let { response, payload } = await postSlackMessage(channel);

    if ((!response.ok || !payload.ok) && payload.error === 'channel_not_found' && fallbackChannel && fallbackChannel !== channel) {
      attemptedChannel = fallbackChannel;
      ({ response, payload } = await postSlackMessage(fallbackChannel));
    }

    if (!response.ok || !payload.ok) {
      throw new Error(`Slack error: ${payload.error ?? `HTTP ${response.status}`}`);
    }

    return {
      messageId: payload.ts ?? null,
      channel: payload.channel ?? attemptedChannel,
      status: 'sent',
    };
  });

  registerAliases(['create_notion_page', 'notion.create_page', 'notion.create'], 'notion', async (params, accessToken) => {
    const notionVersion = process.env.NOTION_VERSION?.trim() || '2022-06-28';
    const headers = {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': notionVersion,
    };

    const title = String(params.title ?? params.name ?? 'Automata Update').trim();
    const content = String(params.content ?? params.body ?? params.text ?? '').trim();
    const explicitParentType = String(params.parent_type ?? '').trim().toLowerCase();
    const pageParentId = String(params.parent_id ?? params.page_id ?? '').trim();
    const databaseId = String(params.database_id ?? process.env.NOTION_DATABASE_ID ?? '').trim();

    let parent: Record<string, string>;
    const properties: Record<string, unknown> = {};

    if (databaseId && explicitParentType !== 'page') {
      let usePageParent = false;
      let titleProperty = 'Name';
      const databaseResponse = await fetch(`https://api.notion.com/v1/databases/${encodeURIComponent(databaseId)}`, {
        method: 'GET',
        headers,
      });

      if (databaseResponse.ok) {
        const databasePayload = await databaseResponse.json() as {
          properties?: Record<string, { type?: string }>;
        };
        for (const [propertyName, definition] of Object.entries(databasePayload.properties ?? {})) {
          if (definition?.type === 'title') {
            titleProperty = propertyName;
            break;
          }
        }
      } else {
        const databaseError = await databaseResponse.json().catch(() => null) as { message?: string } | null;
        const message = String(databaseError?.message ?? '').toLowerCase();
        if (message.includes('is a page') || message.includes('page, not a database')) {
          usePageParent = true;
        }
      }

      if (usePageParent) {
        parent = { page_id: databaseId };
        properties.title = {
          title: [{ type: 'text', text: { content: title } }],
        };
      } else {
        parent = { database_id: databaseId };
        properties[titleProperty] = {
          title: [{ type: 'text', text: { content: title } }],
        };
      }
    } else if (pageParentId) {
      parent = { page_id: pageParentId };
      properties.title = {
        title: [{ type: 'text', text: { content: title } }],
      };
    } else {
      throw new Error('Notion page requires parent_id/page_id or NOTION_DATABASE_ID.');
    }

    const children = content
      ? [{
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ type: 'text', text: { content } }],
          },
        }]
      : [];

    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        parent,
        properties,
        children,
      }),
    });

    const payload = await response.json() as {
      object?: string;
      message?: string;
      id?: string;
      url?: string;
    };

    if (!response.ok || payload.object === 'error') {
      throw new Error(`Notion error: ${payload.message ?? `HTTP ${response.status}`}`);
    }

    return {
      pageId: payload.id ?? null,
      url: payload.url ?? null,
      status: 'created',
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
      const workflow = await getWorkflowById(workflowId);
      if (!workflow) throw new Error('Workflow not found.');
      const prompt = workflow.prompt?.trim();
      if (!prompt) throw new Error('Workflow prompt is missing.');

      const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY?.trim());
      const summaryModel = process.env.WORKFLOW_SUMMARY_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || 'claude-haiku-4-5';
      const dagModel = process.env.WORKFLOW_DAG_MODEL?.trim() || process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
      const llmTimeoutMs = Number(process.env.WORKFLOW_LLM_TIMEOUT_MS ?? 45000);

      let name = String(workflow.name ?? 'Generated Workflow').trim().slice(0, 80) || 'Generated Workflow';
      let description = String(workflow.description ?? '').trim();

      if (hasAnthropicKey) {
        try {
          const summaryMessage = await withTimeout(
            requestLlmCompletion({
              model: summaryModel,
              maxTokens: 60,
              temperature: 0,
              system: 'Extract a short workflow name (max 6 words) and one sentence description from this workflow description. Return only JSON: { "name": string, "description": string }',
              user: prompt,
            }),
            llmTimeoutMs,
            'Workflow summary generation',
          );

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

      await db.prepare(`
        UPDATE workflows
        SET name = ?, description = ?, updated_at = NOW()
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
          const dagResponse = await withTimeout(
            requestLlmCompletion({
              model: dagModel,
              maxTokens: 2000,
              temperature: 0.2,
              system: WORKFLOW_DAG_SYSTEM_PROMPT,
              user: prompt,
            }),
            llmTimeoutMs,
            'Workflow DAG generation',
          );

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

      await db.prepare(`
        UPDATE workflows
        SET name = ?, description = ?, dag = ?::jsonb, status = 'ready', estimated_cost_per_run_inr = ?, generation_error = NULL, updated_at = NOW()
        WHERE id = ?
      `).run(name, dag.description || description, toJsonParam(dag), estimatedCostPerRunInr, workflowId);

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
      await db.prepare(`
        UPDATE workflows
        SET status = 'failed', generation_error = ?, updated_at = NOW()
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
    const runAnomalies: MetricAnomaly[] = [];
    const seenAnomalyKeys = new Set<string>();
    let hasEmailNode = false;
    const pendingMemories: Array<{ content: string; metrics: ExtractedMetric[] }> = [];

    try {
      const workflow = await getWorkflowById(workflowId);
      if (!workflow) throw new Error('Workflow not found.');
      const dag = parseDag(workflow.dag) ?? { nodes: [], edges: [] };
      const workspaceId = workflow.workspace_id ?? `workspace:${workflow.user_id ?? 'anonymous'}`;
      hasEmailNode = dag.nodes.some((node) => node.type === 'tool_call' && String(node.config?.tool_name ?? '').toLowerCase().includes('send_email'));

      const result = await executeWorkflow(dag, runId, {
        shouldStop: () => cancelledRuns.has(runId),
        resolveIntegration: async (provider: string) => {
          return resolveIntegrationToken(workspaceId, provider);
        },
        refreshIntegrationToken: async (provider: string, refreshToken: string) => {
          const normalizedProvider = normalizeProviderFromRoute(provider);
          if (!normalizedProvider || !isGoogleProvider(normalizedProvider)) {
            throw new Error(`Token refresh is not supported for provider: ${provider}`);
          }
          return refreshGoogleToken(workspaceId, normalizedProvider, refreshToken);
        },
        transformToolParams: async (node, params) => {
          if (node.type !== 'tool_call') return params;
          const toolName = String(node.config?.tool_name ?? '').toLowerCase();
          if (!toolName.includes('send_email') || runAnomalies.length === 0) return params;
          const existingBody = String(params.body ?? params.message ?? '');
          const alerts = formatAnomalyAlerts(runAnomalies);
          return {
            ...params,
            body: `${existingBody}${alerts}`,
          };
        },
        onNodeUpdate: async (event: NodeExecutionEvent) => {
          const executionId = nodeExecutionIds.get(event.nodeId) ?? uuidv4();
          const hasExecutionRow = nodeExecutionIds.has(event.nodeId);
          nodeExecutionIds.set(event.nodeId, executionId);

          if (event.status === 'running' || !hasExecutionRow) {
            await db.prepare(`
              INSERT INTO node_executions (
                id, run_id, node_id, node_label, node_type, status, input_data, output_data,
                tokens_used, cost_inr, duration_ms, evaluator_score
              ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?, ?, ?, ?)
              ON CONFLICT (id) DO UPDATE SET
                run_id = EXCLUDED.run_id,
                node_id = EXCLUDED.node_id,
                node_label = EXCLUDED.node_label,
                node_type = EXCLUDED.node_type,
                status = EXCLUDED.status,
                input_data = EXCLUDED.input_data,
                output_data = EXCLUDED.output_data,
                tokens_used = EXCLUDED.tokens_used,
                cost_inr = EXCLUDED.cost_inr,
                duration_ms = EXCLUDED.duration_ms,
                evaluator_score = EXCLUDED.evaluator_score
            `).run(
              executionId,
              runId,
              event.nodeId,
              event.nodeLabel,
              event.nodeType,
              event.status,
              null,
              toJsonParam(event.output),
              event.tokensUsed,
              event.costInr,
              event.durationMs,
              event.evaluatorScore ?? null,
            );
          } else {
            await db.prepare(`
              UPDATE node_executions
              SET node_label = ?, node_type = ?, status = ?, output_data = ?::jsonb, tokens_used = ?, cost_inr = ?, duration_ms = ?, evaluator_score = ?
              WHERE id = ?
            `).run(
              event.nodeLabel,
              event.nodeType,
              event.status,
              toJsonParam(event.output),
              event.tokensUsed,
              event.costInr,
              event.durationMs,
              event.evaluatorScore ?? null,
              executionId,
            );
          }

          const totals = await db.prepare(`
            SELECT COALESCE(SUM(tokens_used), 0) AS totalTokens, COALESCE(SUM(cost_inr), 0) AS totalCostInr
            FROM node_executions
            WHERE run_id = ?
          `).get<{ totaltokens: number | string; totalcostinr: number | string }>(runId);

          await db.prepare(`
            UPDATE workflow_runs
            SET total_tokens = ?, total_cost_inr = ?
            WHERE id = ?
          `).run(Number(totals?.totaltokens ?? 0), Number(totals?.totalcostinr ?? 0), runId);

          if (
            event.status === 'passed'
            && event.nodeType === 'llm_call'
            && workflow.user_id
          ) {
            const llmText = typeof event.output === 'string'
              ? event.output
              : JSON.stringify(event.output ?? '');
            if (llmText.trim()) {
              const metrics = await extractMetricsFromText(llmText);
              pendingMemories.push({ content: llmText, metrics });

              const detected = await detectAnomalies(workflowId, workflow.user_id, runId, metrics);
              for (const anomaly of detected) {
                const dedupeKey = `${anomaly.key}:${anomaly.current}`;
                if (seenAnomalyKeys.has(dedupeKey)) continue;
                seenAnomalyKeys.add(dedupeKey);
                runAnomalies.push(anomaly);
              }
            }
          }

          emitRunEvent(runId, 'node_update', {
            nodeId: event.nodeId,
            nodeLabel: event.nodeLabel,
            nodeType: event.nodeType,
            status: event.status,
            outputPreview: event.outputPreview,
            skipReason: event.status === 'skipped'
              ? String((event.output as { reason?: unknown } | null)?.reason ?? event.outputPreview ?? 'Skipped')
              : null,
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

      await db.prepare(`
        UPDATE workflow_runs
        SET status = ?, ended_at = NOW(), total_tokens = ?, total_cost_inr = ?, anomalies = ?::jsonb
        WHERE id = ?
      `).run(finalStatus, result.totalTokens, result.totalCostInr, JSON.stringify(runAnomalies), runId);

      if (finalStatus === 'completed' && workflow.user_id) {
        for (const memory of pendingMemories) {
          await db.prepare(`
            INSERT INTO workflow_memories (id, workflow_id, run_id, user_id, content, embedding_json, metric_key, metric_value, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
          `).run(uuidv4(), workflowId, runId, workflow.user_id, memory.content, '[]', null, null);

          for (const metric of memory.metrics) {
            await db.prepare(`
              INSERT INTO workflow_memories (id, workflow_id, run_id, user_id, content, embedding_json, metric_key, metric_value, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
            `).run(
              uuidv4(),
              workflowId,
              runId,
              workflow.user_id,
              memory.content,
              '[]',
              metric.key,
              metric.value,
            );
          }
        }
      }

      if (runAnomalies.length > 0 && !hasEmailNode) {
        console.warn(`[anomaly] workflow=${workflowId} run=${runId} anomalies=${JSON.stringify(runAnomalies)}`);
      }

      emitRunEvent(runId, 'run_complete', {
        runId,
        status: finalStatus,
        totalTokens: result.totalTokens,
        totalCostInr: result.totalCostInr,
        anomalies: runAnomalies,
        durationMs: Date.now() - startedAt,
        error: result.error ?? (cancelledRuns.has(runId) ? 'Run stopped by user.' : null),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Run failed.';
      await db.prepare(`
        UPDATE workflow_runs
        SET status = 'failed', ended_at = NOW(), anomalies = ?::jsonb
        WHERE id = ?
      `).run('[]', runId);

      emitRunEvent(runId, 'run_complete', {
        runId,
        status: 'failed',
        totalTokens: 0,
        totalCostInr: 0,
        anomalies: [],
        durationMs: Date.now() - startedAt,
        error: message,
      });
    } finally {
      cancelledRuns.delete(runId);
      activeWorkflowRuns.delete(runId);
    }
  };

  // API Routes
  app.get("/api/health", async (req, res) => {
    try {
      await db.queryOne('SELECT 1 AS ok');
      res.json({ status: "ok", db: "postgres_ready" });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database unavailable';
      res.status(500).json({ status: 'error', db: 'postgres_unavailable', error: message });
    }
  });

  // Workflow CRUDS
  app.get("/api/workflows", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflows = await db.prepare(`
      SELECT * FROM workflows
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).all<WorkflowRow>(user.userId);

    res.json({ workflows: workflows.map(serializeWorkflowRow) });
  });

  app.post("/api/workflows", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const { name, description, status, dag, prompt, estimatedCostPerRunInr } = req.body;
    const id = uuidv4();
    await db.prepare(`
      INSERT INTO workflows (
        id, user_id, workspace_id, name, description, prompt, dag, status, estimated_cost_per_run_inr, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, NOW(), NOW())
    `).run(
      id,
      user.userId,
      user.workspaceId,
      name,
      description ?? '',
      prompt ?? null,
      toJsonParam(dag),
      status || 'draft',
      estimatedCostPerRunInr ?? 0,
    );
    res.status(201).json({ workflow: serializeWorkflowRow(await getWorkflowById(id)) });
  });

  app.get("/api/workflows/:id", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflow = await getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    res.json({ workflow: serializeWorkflowRow(workflow) });
  });

  app.patch("/api/workflows/:id", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflow = await getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    const { name, status, description } = req.body;
    await db.prepare(`
      UPDATE workflows
      SET name = COALESCE(?, name),
          status = COALESCE(?, status),
          description = COALESCE(?, description),
          updated_at = NOW()
      WHERE id = ?
    `).run(name ?? null, status ?? null, description ?? null, req.params.id);
    res.json({ workflow: serializeWorkflowRow(await getWorkflowById(req.params.id)) });
  });

  app.delete("/api/workflows/:id", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflow = await getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }

    await db.prepare(`DELETE FROM node_executions WHERE run_id IN (SELECT id FROM workflow_runs WHERE workflow_id = ?)`)
      .run(req.params.id);
    await db.prepare(`DELETE FROM workflow_runs WHERE workflow_id = ?`).run(req.params.id);
    await db.prepare("DELETE FROM workflows WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // ── Workflow Generation via Claude ─────────────────────────────────────
  app.post("/api/workflows/generate", async (req, res) => {
    const user = await requireSession(req, res);
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
    await db.prepare(`
      INSERT INTO workflows (
        id, user_id, workspace_id, name, description, prompt, dag, status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?::jsonb, ?, NOW(), NOW())
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

    setImmediate(() => {
      void runWorkflowGeneration(workflowId);
    });

    return res.status(201).json({ workflowId, status: 'generating' });
  });

  app.get('/api/workflows/:id/stream', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflow = await getOwnedWorkflow(req.params.id, user);
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

  app.post('/api/workflows/:id/runs', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const workflow = await getOwnedWorkflow(req.params.id, user);
    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found.' });
    }
    if (workflow.status === 'generating') {
      return res.status(409).json({ error: 'Workflow is still being generated' });
    }
    if (!['ready', 'active'].includes(workflow.status)) {
      return res.status(409).json({ error: 'Workflow must be ready or active before it can run.' });
    }

    const activeRun = await db.prepare(`
      SELECT id FROM workflow_runs WHERE workflow_id = ? AND status = 'running' LIMIT 1
    `).get<{ id: string }>(workflow.id);
    if (activeRun) {
      return res.status(409).json({ error: 'A run is already in progress' });
    }

    const runId = uuidv4();
    const trigger = req.body?.trigger === 'cron' ? 'cron' : 'manual';
    await db.prepare(`
      INSERT INTO workflow_runs (id, workflow_id, status, trigger, started_at, total_tokens, total_cost_inr)
      VALUES (?, ?, 'running', ?, NOW(), 0, 0)
    `).run(runId, workflow.id, trigger);

    res.status(201).json({ runId });
    setImmediate(() => {
      void runWorkflowExecution(workflow.id, runId);
    });
  });

  app.get('/api/runs/:runId/stream', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const run = await db.prepare(`
      SELECT wr.*, w.user_id
      FROM workflow_runs wr
      INNER JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = ? AND w.user_id = ?
    `).get(req.params.runId, user.userId) as
      | { id: string; status: string; total_tokens: number; total_cost_inr: number; started_at: string; ended_at: string | null; anomalies?: unknown }
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
        totalTokens: Number(run.total_tokens ?? 0),
        totalCostInr: Number(run.total_cost_inr ?? 0),
        anomalies: Array.isArray(run.anomalies) ? run.anomalies : (() => {
          try { return JSON.parse(String(run.anomalies ?? '[]')); } catch { return []; }
        })(),
        durationMs: run.ended_at ? (new Date(String(run.ended_at)).getTime() - new Date(String(run.started_at)).getTime()) : 0,
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

  app.delete('/api/runs/:runId', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const run = await db.prepare(`
      SELECT wr.id
      FROM workflow_runs wr
      INNER JOIN workflows w ON w.id = wr.workflow_id
      WHERE wr.id = ? AND w.user_id = ? AND wr.status = 'running'
    `).get<{ id: string }>(req.params.runId, user.userId);

    if (!run) {
      return res.status(404).json({ error: 'Run not found or already finished.' });
    }

    cancelledRuns.add(run.id);
    res.json({ success: true });
  });

  app.get('/api/memories/search', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;
    const q = String(req.query.q ?? '').trim();
    const workflowId = String(req.query.workflow_id ?? '').trim() || null;
    if (!q) {
      return res.json({ memories: [] });
    }
    const rows = await searchWorkflowMemories(user.userId, q, workflowId);
    res.json({
      memories: rows.map((row) => ({
        content: row.content ?? '',
        metric_key: row.metric_key ?? null,
        metric_value: row.metric_value == null ? null : Number(row.metric_value),
        workflow_name: row.workflow_name ?? null,
        created_at: toIsoTimestamp(row.created_at),
      })),
    });
  });

  // ── Terminal (streaming chat) ─────────────────────────────────────────
  app.post("/api/terminal", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

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
      const haikuModel = getHaikuModel();
      const historyTranscript = safeHistory
        .map((entry) => `${entry.role.toUpperCase()}: ${entry.content}`)
        .join('\n\n');

      const classifierResponse = await requestLlmCompletion({
        model: haikuModel,
        maxTokens: 80,
        temperature: 0,
        system: "Classify this message. Return ONLY JSON:\n{ intent: 'workflow_edit'|'workflow_query'|'general', workflow_hint: string|null }\nworkflow_edit = user wants to change/pause/delete/update a workflow\nworkflow_query = user asking about past runs or workflow status\nworkflow_hint = name or description fragment of the target workflow",
        user: message,
      });
      const classifier = parseJsonObject(classifierResponse.text) ?? { intent: 'general', workflow_hint: null };
      const intent = String(classifier.intent ?? 'general');
      const workflowHint = classifier.workflow_hint == null ? null : String(classifier.workflow_hint);

      const allWorkflows = await db.prepare(`
        SELECT id, name, description, dag, status, cron_schedule
        FROM workflows
        WHERE user_id = ?
        ORDER BY created_at DESC
      `).all<{
        id: string;
        name: string;
        description: string | null;
        dag: unknown;
        status: string;
        cron_schedule: string | null;
      }>(user.userId);

      if (intent === 'workflow_edit') {
        const editResponse = await requestLlmCompletion({
          model: haikuModel,
          maxTokens: 300,
          temperature: 0,
          system: "You are a workflow editor. Given the user's edit request and their workflows, produce ONLY a JSON edit action:\n{ workflow_id: string, action: 'update_node_prompt'|'pause'|'resume'|'update_schedule'|'update_tool_param', node_id: string|null, field: string|null, new_value: string|null }\nIf you cannot determine which workflow: return { action: 'unclear' }",
          user: `Request: ${message}\n\nWorkflows: ${JSON.stringify(allWorkflows)}`,
        });
        const action = parseJsonObject(editResponse.text) ?? { action: 'unclear' };
        const actionName = String(action.action ?? 'unclear');
        const workflowId = String(action.workflow_id ?? '').trim();
        let responseText = "Done — I've applied the requested workflow update. The change is live.";

        if (!workflowId || actionName === 'unclear') {
          responseText = "Done — I've reviewed your request, but the target workflow edit was unclear. Please specify workflow and change.";
        } else {
          const workflow = await db.prepare(`
            SELECT id, name, description, dag, status, cron_schedule
            FROM workflows
            WHERE id = ? AND user_id = ?
            LIMIT 1
          `).get<WorkflowRow>(workflowId, user.userId);
          if (!workflow) {
            responseText = "Done — I've reviewed your request, but I couldn't find that workflow in your account.";
          } else if (actionName === 'pause') {
            await db.prepare(`UPDATE workflows SET status = 'paused', updated_at = NOW() WHERE id = ?`).run(workflowId);
            responseText = "Done — I've paused the workflow. The change is live.";
          } else if (actionName === 'resume') {
            await db.prepare(`UPDATE workflows SET status = 'active', updated_at = NOW() WHERE id = ?`).run(workflowId);
            responseText = "Done — I've resumed the workflow. The change is live.";
          } else if (actionName === 'update_schedule') {
            const schedule = String(action.new_value ?? '').trim();
            await db.prepare(`UPDATE workflows SET cron_schedule = ?, updated_at = NOW() WHERE id = ?`).run(schedule || null, workflowId);
            responseText = "Done — I've updated the schedule. The change is live.";
          } else if (actionName === 'update_node_prompt' || actionName === 'update_tool_param') {
            const dag = parseDag(workflow.dag) ?? { nodes: [], edges: [] };
            const nodeId = String(action.node_id ?? '').trim();
            const field = String(action.field ?? '').trim();
            const newValue = action.new_value == null ? null : String(action.new_value);
            const node = dag.nodes.find((n) => n.id === nodeId);
            if (!node) {
              responseText = "Done — I couldn't find the target node in that workflow.";
            } else {
              if (actionName === 'update_node_prompt') {
                node.config = {
                  ...(node.config ?? {}),
                  system_prompt: newValue ?? '',
                };
                responseText = "Done — I've updated the node prompt. The change is live.";
              } else {
                const params = { ...(node.config?.tool_params_template ?? {}) };
                if (field) {
                  params[field] = newValue;
                }
                node.config = {
                  ...(node.config ?? {}),
                  tool_params_template: params,
                };
                responseText = "Done — I've updated the tool parameters. The change is live.";
              }
              await db.prepare(`UPDATE workflows SET dag = ?::jsonb, updated_at = NOW() WHERE id = ?`)
                .run(JSON.stringify(dag), workflowId);
            }
          } else {
            responseText = "Done — I've reviewed your request, but that edit action is not supported yet.";
          }
        }

        const data = JSON.stringify({ delta: responseText });
        res.write(`data: ${data}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      let runContextSnippet = '';
      if (intent === 'workflow_query') {
        const hint = (workflowHint ?? message).trim();
        const workflows = hint
          ? allWorkflows.filter((w) =>
            w.name.toLowerCase().includes(hint.toLowerCase())
            || String(w.description ?? '').toLowerCase().includes(hint.toLowerCase()))
          : [];
        const targetWorkflow = workflows[0] ?? allWorkflows[0];
        if (targetWorkflow) {
          const recentRuns = await db.prepare(`
            SELECT id, status, started_at, ended_at, total_tokens, total_cost_inr, anomalies
            FROM workflow_runs
            WHERE workflow_id = ?
            ORDER BY started_at DESC
            LIMIT 10
          `).all(targetWorkflow.id);
          runContextSnippet = `RECENT RUN DATA FOR WORKFLOW "${targetWorkflow.name}":\n${JSON.stringify(recentRuns)}`;
        }
      }

      const memories = await searchWorkflowMemories(user.userId, message);
      const memorySnippet = memories.length > 0
        ? `RELEVANT HISTORY FROM USER'S PAST WORKFLOW RUNS:\n${memories.map((m) => {
          const metricPart = m.metric_key ? ` | ${m.metric_key}=${Number(m.metric_value ?? 0)}` : '';
          return `- [${toIsoTimestamp(m.created_at)}] ${m.workflow_name ?? 'Workflow'}${metricPart}: ${String(m.content ?? '').slice(0, 400)}`;
        }).join('\n')}\nUse this context to answer questions about past runs.`
        : '';

      const response = await requestLlmCompletion({
        model,
        maxTokens: 1024,
        temperature: 0.2,
        system: `You are Automata AI, an intelligent assistant for building and debugging autonomous workflows. Help users design workflow logic, write system prompts, debug failures, understand AI agent patterns, and translate plain English descriptions into structured workflow DAGs. Be concise and practical.${memorySnippet ? `\n\n${memorySnippet}` : ''}${runContextSnippet ? `\n\n${runContextSnippet}` : ''}`,
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
  app.get("/api/integrations", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    try {
      const rows = await db.prepare(`
        SELECT provider, account_name as account, connected_at
        FROM integrations
        WHERE workspace_id = ? AND enabled = TRUE
        ORDER BY connected_at DESC
      `).all<IntegrationRow>(user.workspaceId);

      const responseRows: IntegrationRow[] = rows.map((row) => ({
        ...row,
        source: 'oauth',
      }));
      const seenProviders = new Set(responseRows.map((row) => row.provider));

      (Object.keys(ENV_INTEGRATION_CONFIG) as Array<keyof typeof ENV_INTEGRATION_CONFIG>).forEach((provider) => {
        if (seenProviders.has(provider)) return;
        const token = getEnvTokenForProvider(provider);
        if (!token) return;
        responseRows.push({
          provider,
          account: getEnvAccountForProvider(provider),
          connected_at: new Date().toISOString(),
          source: 'env',
        });
      });

      res.json(responseRows);
    } catch {
      res.json([]);
    }
  });

  app.get('/api/integrations/connect/:provider', async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const provider = normalizeProviderFromRoute(req.params.provider);
    if (!provider) {
      return res.status(400).json({ error: 'Unsupported integration provider.' });
    }

    if (isEnvManagedProvider(provider)) {
      if (getEnvTokenForProvider(provider)) {
        return res.redirect(`/settings/integrations?connected=${provider}`);
      }
      const envVar = ENV_INTEGRATION_CONFIG[provider].tokenEnv;
      return res.status(400).json({ error: `${provider} is environment-managed. Set ${envVar} in .env and restart the server.` });
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

      await upsertIntegration(
        userId,
        workspaceId,
        'gmail',
        encryptedAccessToken,
        encryptedRefreshToken,
        expiresAt,
        accountName,
      );

      await upsertIntegration(
        userId,
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

  app.delete("/api/integrations/:provider", async (req, res) => {
    const user = await requireSession(req, res);
    if (!user) return;

    const provider = normalizeProviderFromRoute(req.params.provider);
    if (!provider) {
      return res.status(400).json({ error: 'Unsupported integration provider.' });
    }

    if (isEnvManagedProvider(provider) && getEnvTokenForProvider(provider)) {
      return res.status(409).json({
        error: `${provider} is managed via environment variables and cannot be disconnected from UI.`,
      });
    }

    try {
      await db.prepare("DELETE FROM integrations WHERE workspace_id = ? AND provider = ?")
        .run(user.workspaceId, provider);
    } catch { /* table may not exist yet */ }
    res.json({ success: true });
  });

  app.post('/api/auth/signout', (req, res) => {
    res.setHeader('Set-Cookie', 'automata_session=; Path=/; Max-Age=0; SameSite=Lax');
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
  app.get("/api/users/preferences", async (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || 'default';
    let prefs = await db.prepare("SELECT * FROM user_preferences WHERE user_id = ?").get<{ sidebar_open: boolean | null; theme: string | null }>(userId);
    if (!prefs) {
      prefs = { sidebar_open: false, theme: 'system' };
    }
    res.json({ sidebarOpen: Boolean(prefs.sidebar_open), theme: prefs.theme ?? 'system' });
  });

  app.patch("/api/users/preferences", async (req, res) => {
    const userId = (req.headers['x-user-id'] as string) || 'default';
    const { sidebarOpen, theme } = req.body as { sidebarOpen?: boolean; theme?: string };
    const existing = await db.prepare("SELECT id FROM user_preferences WHERE user_id = ?").get<{ id: string }>(userId);
    if (existing) {
      await db.prepare("UPDATE user_preferences SET sidebar_open = COALESCE(?, sidebar_open), theme = COALESCE(?, theme), updated_at = NOW() WHERE user_id = ?")
        .run(sidebarOpen !== undefined ? (sidebarOpen ? 1 : 0) : null, theme ?? null, userId);
    } else {
      await db.prepare("INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())")
        .run(uuidv4(), userId, sidebarOpen ? 1 : 0, theme ?? 'system');
    }
    res.json({ success: true });
  });

  // Terminal messages persistence
  app.get("/api/terminal/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) return res.json({ messages: [] });
    const rows = await db.prepare(
      "SELECT id, role, content, tokens_used, cost_inr, created_at FROM terminal_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 100"
    ).all(sessionId);
    res.json({ messages: rows });
  });

  app.post("/api/terminal/messages", async (req, res) => {
    const { sessionId, role, content, tokensUsed, costInr, userId } = req.body as any;
    if (!sessionId || !role || !content) return res.status(400).json({ error: "sessionId, role, content required." });
    const id = uuidv4();
    await db.prepare(
      "INSERT INTO terminal_messages (id, user_id, session_id, role, content, tokens_used, cost_inr) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(id, userId ?? 'anonymous', sessionId, role, content, tokensUsed ?? 0, costInr ?? 0);
    res.json({ id });
  });

  // Workflow execute (manual trigger)
  app.post("/api/workflows/execute", async (req, res) => {
    const { workflowId } = req.body as { workflowId?: string };
    if (!workflowId) return res.status(400).json({ error: "workflowId required." });
    const workflow = await db.prepare("SELECT * FROM workflows WHERE id = ?").get<WorkflowRow>(workflowId);
    if (!workflow) return res.status(404).json({ error: "Workflow not found." });

    const runId = uuidv4();
    await db.prepare(
      "INSERT INTO workflow_runs (id, workflow_id, status) VALUES (?, ?, ?)"
    ).run(runId, workflowId, 'running');

    try {
      const { executeWorkflow } = await import('./src/lib/workflowExecutor.js');
      const dag = parseDag(workflow.dag) ?? { nodes: [], edges: [] };
      const workspaceId = workflow.workspace_id ?? `workspace:${workflow.user_id ?? 'anonymous'}`;
      const result = await executeWorkflow(dag, runId, {
        resolveIntegration: async (provider: string) => {
          return resolveIntegrationToken(workspaceId, provider);
        },
        refreshIntegrationToken: async (provider: string, refreshToken: string) => {
          const normalizedProvider = normalizeProviderFromRoute(provider);
          if (!normalizedProvider || !isGoogleProvider(normalizedProvider)) {
            throw new Error(`Token refresh is not supported for provider: ${provider}`);
          }
          return refreshGoogleToken(workspaceId, normalizedProvider, refreshToken);
        },
      });
      await db.prepare(
        "UPDATE workflow_runs SET status = ?, ended_at = NOW(), total_tokens = ?, total_cost_inr = ? WHERE id = ?"
      ).run(result.status, result.totalTokens, result.totalCostInr, runId);
      res.json({ runId, status: result.status, totalTokens: result.totalTokens, totalCostInr: result.totalCostInr });
    } catch (err: any) {
      await db.prepare("UPDATE workflow_runs SET status = ?, ended_at = NOW() WHERE id = ?").run('failed', runId);
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

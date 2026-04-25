import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import sqlite3 from "better-sqlite3";

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
    workspace_id TEXT,
    name TEXT NOT NULL,
    description TEXT,
    prompt TEXT,
    status TEXT CHECK(status IN ('draft', 'active', 'paused', 'archived')) DEFAULT 'draft',
    cron_schedule TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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
    connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME,
    enabled BOOLEAN DEFAULT 1,
    FOREIGN KEY(workspace_id) REFERENCES workspaces(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // SSE Clients Store
  let sseClients: { id: number, res: any, runId: string }[] = [];

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", db: "sqlite_ready" });
  });

  // Real-time Logs SSE Endpoint
  app.get("/api/runs/:runId/logs", (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const clientId = Date.now();
    const newClient = { id: clientId, res, runId: req.params.runId };
    sseClients.push(newClient);

    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);

    const heartbeat = setInterval(() => {
      res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients = sseClients.filter(c => c.id !== clientId);
    });
  });

  // Workflow CRUDS
  app.get("/api/workflows", (req, res) => {
    const workflows = db.prepare("SELECT * FROM workflows ORDER BY created_at DESC").all();
    res.json(workflows);
  });

  app.post("/api/workflows", (req, res) => {
    const { name, description, status, workspace_id } = req.body;
    const id = uuidv4();
    db.prepare("INSERT INTO workflows (id, name, description, status, workspace_id) VALUES (?, ?, ?, ?, ?)")
      .run(id, name, description, status || 'draft', workspace_id || 'default');
    res.json({ id, name });
  });

  app.patch("/api/workflows/:id", (req, res) => {
    const { name, status, description } = req.body;
    db.prepare("UPDATE workflows SET name = COALESCE(?, name), status = COALESCE(?, status), description = COALESCE(?, description) WHERE id = ?")
      .run(name, status, description, req.params.id);
    res.json({ success: true });
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
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[ORREN] Platform running on http://localhost:${PORT}`);
  });
}

startServer();

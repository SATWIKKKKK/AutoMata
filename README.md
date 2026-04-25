<div align="center">

<br />


**Describe your workflow. Ship it in 60 seconds.**

*The autonomous AI workflow builder that plans, executes, evaluates, and self-corrects — so you don't have to.*

<br />

[![License: MIT](https://img.shields.io/badge/License-MIT-black.svg?style=for-the-badge)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.12+-black?style=for-the-badge&logo=python&logoColor=white)](https://python.org)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=nextdotjs&logoColor=white)](https://nextjs.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-black?style=for-the-badge&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Temporal](https://img.shields.io/badge/Temporal.io-black?style=for-the-badge)](https://temporal.io)
[![Claude](https://img.shields.io/badge/Powered%20by-Claude%20AI-black?style=for-the-badge)](https://anthropic.com)

<br />

![Orren Demo](https://raw.githubusercontent.com/yourusername/orren/main/docs/assets/demo.gif)

<br />

[**Live Demo**](https://orren.app) · [**Documentation**](https://docs.orren.app) · [**Report Bug**](https://github.com/yourusername/orren/issues) · [**Request Feature**](https://github.com/yourusername/orren/discussions)

<br />

</div>

---

## What is AutoMata?

Most automation tools make you think like a machine — build the flowchart first, wire each step manually, and fix failures yourself. **Orren flips this entirely.**

You describe what you want in plain English. Orren figures out the steps, builds the graph, deploys the agents, monitors their quality, and corrects itself when something goes wrong.

```
"Every Monday 9AM, read my Google Sheet 'Sales Tracker',
 summarize last 7 days, and email it to my team."
```

↓ *60 seconds later*

A fully autonomous, self-correcting workflow is live. Running every week. Costing ₹0.02 per run.

---

## Why AutoMata is Different

| Feature | Zapier / Make | n8n | **AutoMata** |
|---|---|---|---|
| Build method | Manual wiring | Manual wiring | **Plain English** |
| Self-correction | ✗ | ✗ | **✓ LLM-as-judge** |
| Output quality scoring | ✗ | ✗ | **✓ Evaluator layer** |
| DAG visualization | ✗ | Partial | **✓ Live React Flow** |
| Cost per run tracking | ✗ | ✗ | **✓ Per-node INR cost** |
| Human-in-the-loop gates | Webhooks only | Webhooks only | **✓ First-class node type** |
| Anomaly detection | ✗ | ✗ | **✓ Isolation Forest** |

---

## Features

### 🧠 Natural Language → Running Workflow
Type a description. A Claude-powered meta-agent decomposes it into a DAG of typed nodes: triggers, LLM calls, tool calls, evaluators, conditions, human gates, and loops. The visual graph appears in your editor in seconds.

### ⚡ Self-Correcting Execution
Every LLM output is scored by an evaluator node against user-defined criteria. Score too low? The system retries with a targeted fix instruction — automatically. No silent failures. No garbage outputs.

### 🔌 One-Click Integrations
Connect Gmail, Google Sheets, Slack, Notion, HubSpot, and Salesforce via OAuth in one click. Every integration is available as a tool node. No API keys to manage.

### 📊 Live Operator Console
Watch your workflow execute in real time. Every node lights up as it runs. Every output, token count, and cost is streamed live to your dashboard via SSE.

### 💰 Transparent Cost Tracking
Every run shows exactly how much it cost — per node, per model, in INR. Budget alerts notify you before costs drift. A weekly summary email workflow costs ₹0.02. A complex multi-step agent costs ₹0.50.

### 🛡️ Human-in-the-Loop Gates
Insert approval gates anywhere in the graph. The agent pauses, explains its reasoning, and waits for a human decision via Slack or email before proceeding.

### 📈 Anomaly Detection
An Isolation Forest model monitors each workflow's execution patterns over time. When behavior deviates from baseline, you get an alert before it becomes a problem.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Next.js Frontend                            │
│  ┌───────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │
│  │ Terminal Input │  │ React Flow DAG  │  │  Operator Console    │  │
│  │  (NL Prompt)   │  │    Editor       │  │  (SSE Live Stream)   │  │
│  └───────┬───────┘  └────────┬────────┘  └──────────┬───────────┘  │
└──────────┼───────────────────┼──────────────────────┼──────────────┘
           │                   │                      │ SSE
           ▼                   ▼                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         FastAPI Backend                             │
│  ┌──────────────┐  ┌───────────────┐  ┌────────────────────────┐   │
│  │ DAG Generator │  │  Workflow API  │  │   Analytics API        │   │
│  │ (Claude Meta  │  │  CRUD + Auth  │  │   (TimescaleDB)        │   │
│  │  Agent)       │  └───────────────┘  └────────────────────────┘   │
│  └──────┬───────┘                                                   │
└─────────┼───────────────────────────────────────────────────────────┘
          │ Start Workflow
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      Temporal.io Engine                             │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Temporal Worker                           │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌───────────────────┐  │   │
│  │  │ LLM Activity │  │ Tool Activity │  │ Evaluator Activity│  │   │
│  │  │ (Claude API) │  │ (MCP Servers) │  │ (Claude Haiku)   │  │   │
│  │  └──────┬───────┘  └──────┬───────┘  └─────────┬─────────┘  │   │
│  └─────────┼─────────────────┼──────────────────── ┼────────────┘   │
└────────────┼─────────────────┼─────────────────────┼───────────────┘
             │                 │                      │
             └────────────────►│◄─────────────────────┘
                               │ Publish events
                               ▼
                         ┌──────────┐     ┌──────────────────┐
                         │  Redis   │     │   PostgreSQL      │
                         │ Pub/Sub  │     │ + pgvector        │
                         └──────────┘     │ + TimescaleDB     │
                                          └──────────────────┘
```

---

## Tech Stack

### Backend
- **[FastAPI](https://fastapi.tiangolo.com)** — Async Python API with SSE streaming
- **[Temporal.io](https://temporal.io)** — Durable workflow execution with retries
- **[LangGraph](https://github.com/langchain-ai/langgraph)** — Stateful agent orchestration
- **[PostgreSQL 16](https://postgresql.org)** — Primary database with pgvector
- **[TimescaleDB](https://timescale.com)** — Time-series analytics for run metrics
- **[Redis 7](https://redis.io)** — Pub/sub for real-time event streaming
- **[Anthropic Claude API](https://anthropic.com)** — LLM backbone (Haiku + Sonnet)
- **[SQLAlchemy](https://sqlalchemy.org)** (async) — ORM with asyncpg driver
- **[Authlib](https://authlib.org)** — OAuth2 for integrations

### Frontend
- **[Next.js 14](https://nextjs.org)** — React framework (App Router)
- **[React Flow](https://reactflow.dev)** — Interactive DAG editor
- **[Tailwind CSS](https://tailwindcss.com)** — Utility-first styling
- **[Recharts](https://recharts.org)** — Analytics visualizations
- **[Zustand](https://zustand-demo.pmnd.rs)** — Local state management

### ML / AI
- **Claude Sonnet** — DAG generation, complex reasoning nodes
- **Claude Haiku** — Evaluator nodes, simple extraction (cost-optimized)
- **Isolation Forest** — Workflow anomaly detection
- **XGBoost** — (optional) Custom success prediction per workflow type

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 20+
- Docker & Docker Compose
- An [Anthropic API key](https://console.anthropic.com)
- Google OAuth credentials (for Gmail/Sheets integrations)

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/orren.git
cd orren
```

### 2. Set up environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in:

```env
# Core
DATABASE_URL=postgresql+asyncpg://orren:orren@localhost:5432/orren
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-super-secret-jwt-key-here
FERNET_KEY=your-fernet-encryption-key-here   # generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# AI
ANTHROPIC_API_KEY=sk-ant-...

# Google OAuth (for Gmail + Sheets)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/integrations/callback/google

# Temporal
TEMPORAL_HOST=localhost:7233

# Misc
FRONTEND_URL=http://localhost:3000
USD_TO_INR_RATE=84
```

### 3. Start infrastructure

```bash
docker compose up -d postgres redis temporal
```

This starts PostgreSQL (with TimescaleDB + pgvector), Redis, and the Temporal server.

### 4. Run database migrations

```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
```

### 5. Start the backend

```bash
# Terminal 1 — FastAPI server
uvicorn app.main:app --reload --port 8000

# Terminal 2 — Temporal worker
python -m app.workers.temporal_worker
```

### 6. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you're live.

---

## Usage

### Creating your first workflow

1. **Type your workflow** in the terminal on the home screen:
   ```
   Every Monday at 9AM, read my Google Sheet "Weekly Sales Tracker",
   summarize last 7 days revenue and best-selling products,
   write a clean email, and send it to team@company.com
   ```

2. **Connect your integrations** — click the plug icon and authenticate Gmail + Google Sheets via OAuth.

3. **Review the generated DAG** — Orren builds the workflow graph and opens it in the visual editor. Inspect each node, adjust prompts, add human gates if needed.

4. **Activate** — flip the toggle. Your workflow is live.

5. **Watch it run** — open the Operator Console to see real-time execution, node-by-node outputs, evaluator scores, and live cost tracking.

---

## Cost Reference

All costs in INR at ₹84/USD. Actual costs vary with data size.

| Workflow Type | Tokens/Run | Cost/Run | Cost/Month (4×) |
|---|---|---|---|
| Simple summary email | ~2,000 | **₹0.02** | **₹0.08** |
| Lead enrichment + outreach | ~8,000 | **₹0.08** | **₹0.32** |
| Monthly board report | ~25,000 | **₹0.25** | **₹1.00** |
| Multi-step with evaluator | ~50,000 | **₹0.50** | **₹2.00** |

> **Your ₹10 budget runs 50–500 workflow executions depending on complexity.**

---

## Project Structure

```
orren/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app entry
│   │   ├── core/
│   │   │   ├── config.py            # Pydantic settings
│   │   │   ├── database.py          # Async SQLAlchemy engine
│   │   │   ├── security.py          # JWT + workspace auth
│   │   │   └── redis.py             # Redis client
│   │   ├── models/                  # SQLAlchemy ORM models
│   │   ├── schemas/                 # Pydantic request/response
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── workflows.py
│   │   │   ├── runs.py              # Includes SSE streaming endpoint
│   │   │   ├── integrations.py      # OAuth flows
│   │   │   └── analytics.py
│   │   ├── services/
│   │   │   ├── dag_generator.py     # NL → DAG via Claude
│   │   │   ├── evaluator.py         # LLM-as-judge scoring
│   │   │   ├── cost_tracker.py      # Token → INR conversion
│   │   │   └── mcp_registry.py      # MCP server management
│   │   └── workers/
│   │       ├── temporal_worker.py
│   │       └── activities/
│   │           ├── llm_activity.py
│   │           ├── tool_activity.py
│   │           └── evaluator_activity.py
│   ├── alembic/                     # DB migrations
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── app/                     # Next.js App Router pages
│   │   ├── components/
│   │   │   ├── WorkflowTerminal/    # Hero input component
│   │   │   ├── WorkflowEditor/      # React Flow DAG editor
│   │   │   ├── OperatorConsole/     # SSE live run viewer
│   │   │   └── Analytics/           # Cost + run charts
│   │   ├── lib/
│   │   │   ├── api.ts               # API client
│   │   │   └── store.ts             # Zustand stores
│   │   └── types/
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## API Reference

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/workflows/generate` | Generate DAG from natural language prompt |
| `GET` | `/workflows/` | List all workflows in workspace |
| `GET` | `/workflows/{id}` | Get workflow with full DAG |
| `PATCH` | `/workflows/{id}` | Update workflow DAG or config |
| `POST` | `/workflows/{id}/activate` | Activate workflow (starts cron) |
| `POST` | `/workflows/{id}/run` | Trigger a manual run |
| `DELETE` | `/workflows/{id}` | Archive workflow |

### Runs

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/runs/{id}` | Get run details |
| `GET` | `/runs/{id}/logs` | **SSE stream** — real-time node updates |
| `GET` | `/workflows/{id}/runs` | Paginated run history |

### Integrations

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/integrations/` | List connected integrations |
| `GET` | `/integrations/connect/{provider}` | Start OAuth flow |
| `GET` | `/integrations/callback/{provider}` | OAuth callback handler |
| `DELETE` | `/integrations/{provider}` | Disconnect integration |

### Analytics

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/analytics/runs?days=30` | Run summary + daily breakdown |
| `GET` | `/analytics/costs?days=30` | Cost breakdown by workflow + model |

---

## Node Types Reference

| Node | Icon | Purpose | Typical Cost |
|------|------|---------|-------------|
| `cron_trigger` | 🕐 | Scheduled start (cron expression) | Free |
| `llm_call` | 🧠 | Claude API call with system prompt | ₹0.001–0.05 |
| `tool_call` | 🔌 | MCP tool execution (Gmail, Sheets…) | Free |
| `evaluator` | ✅ | Score LLM output, trigger retry if low | ₹0.001–0.01 |
| `condition` | 💎 | Branch based on expression | Free |
| `human_gate` | 👤 | Pause for human approval via Slack/email | Free |
| `loop` | 🔁 | Iterate over a list of items | Per-iteration |

---

## Roadmap

- [x] Natural language → DAG generation
- [x] Temporal.io durable execution
- [x] Self-correcting evaluator layer
- [x] Gmail + Google Sheets MCP integration
- [x] Real-time SSE operator console
- [x] Per-run INR cost tracking
- [ ] Slack + Notion + HubSpot integrations
- [ ] Voice input for workflow description
- [ ] Workflow templates marketplace
- [ ] Anomaly detection alerts (Isolation Forest)
- [ ] Multi-agent workflows (agents spawning sub-agents)
- [ ] Workflow versioning + rollback
- [ ] Collaborative editing (multi-user DAG editor)
- [ ] Mobile app for human gate approvals
- [ ] Custom MCP server registration

---

## Contributing

Contributions are what make open source incredible. Any contribution you make is **genuinely appreciated**.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for our code style guide and pull request process.

### Development Setup

```bash
# Run tests
cd backend && pytest

# Type checking
mypy app/

# Linting
ruff check app/

# Frontend type check
cd frontend && npx tsc --noEmit
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | ✅ | PostgreSQL connection string (asyncpg) |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | Secret for signing JWT tokens |
| `FERNET_KEY` | ✅ | Fernet key for encrypting OAuth tokens |
| `ANTHROPIC_API_KEY` | ✅ | Your Anthropic API key |
| `GOOGLE_CLIENT_ID` | ✅ | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | ✅ | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | ✅ | OAuth callback URL |
| `TEMPORAL_HOST` | ✅ | Temporal server address |
| `FRONTEND_URL` | ✅ | Frontend origin (CORS) |
| `USD_TO_INR_RATE` | ✅ | Conversion rate for cost display (default: 84) |

---

## License

Distributed under the MIT License. See [`LICENSE`](LICENSE) for full text.

---

## Acknowledgements

- [Anthropic](https://anthropic.com) — Claude API powering the agent intelligence
- [Temporal.io](https://temporal.io) — Battle-tested durable workflow execution
- [React Flow](https://reactflow.dev) — The DAG editor that makes it visual
- [LangGraph](https://github.com/langchain-ai/langgraph) — Stateful agent graph runtime
- [TimescaleDB](https://timescale.com) — Time-series cost analytics at scale

---

<div align="center">

<br />

Built with obsession in India 🇮🇳

<br />

**[⭐ Star this repo](https://github.com/yourusername/orren)** if Orren saves you time — it genuinely helps.

<br />

[![Twitter](https://img.shields.io/badge/Twitter-black?style=for-the-badge&logo=x&logoColor=white)](https://twitter.com/yourusername)
[![LinkedIn](https://img.shields.io/badge/LinkedIn-black?style=for-the-badge&logo=linkedin&logoColor=white)](https://linkedin.com/in/yourusername)
[![Discord](https://img.shields.io/badge/Discord-black?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/yourinvite)

</div>

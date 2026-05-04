# Promptly Shell Architecture

## Kept

- Existing visual system in `src/index.css`, including the blueprint grid, typography, color tokens, and shared utility classes.
- Core routing shell in `src/App.tsx`, now repointed to the Promptly flow.
- Shared navigation chrome in `src/components/Sidebar.tsx` and `src/components/Header.tsx`.
- Functional authentication UI in `src/views/Auth.tsx`.
- Backend database connection setup in `src/lib/db.ts`.
- Backend middleware surface: CORS, auth guard, and request rate limiting in `server.ts`.

## Removed From Active Runtime

- Automata workflow generation, execution, sharing, integrations, terminal orchestration, and analytics APIs from `server.ts`.
- FastAPI router registration for `workspaces`, `workflows`, `runs`, `integrations`, and `analytics` in `app/main.py`.
- Frontend workflow state stores and data hooks under `src/stores/` and `src/hooks/`.
- Frontend workflow/editor/integration business logic files:
  - `src/services/geminiService.ts`
  - `src/components/WorkflowTerminal.tsx`
  - `src/components/workflow/Nodes.tsx`
  - `src/lib/cronParser.ts`
  - `src/lib/llmGateway.ts`
  - `src/lib/runEvents.ts`
  - `src/lib/serverWorkflowUtils.ts`
  - `src/lib/templateRenderer.ts`
  - `src/lib/tokenCrypto.ts`
  - `src/lib/toolRegistry.ts`
  - `src/lib/workflowExecutor.ts`
- Python feature-specific controllers and worker surfaces:
  - `app/routers/analytics.py`
  - `app/routers/integrations.py`
  - `app/routers/runs.py`
  - `app/routers/workflows.py`
  - `app/routers/workspaces.py`
  - `app/worker.py`
  - `app/workers/activities/llm_activity.py`
- Obsolete SQLite migration script for the old Automata schema: `scripts/migrate-sqlite-to-postgres.ts`
- The active database schema was reduced to `users` and `user_preferences` in `src/lib/dbSchema.ts`.

## Placeholder Modules

- `QuizModule` in `src/components/ModulePlaceholders.tsx`
- `CodingPlayground` in `src/components/ModulePlaceholders.tsx`
- `ScenarioMCQ` in `src/components/ModulePlaceholders.tsx`
- `GapAnalysisDashboard` in `src/components/ModulePlaceholders.tsx`
- `ProjectScanner` in `src/components/ModulePlaceholders.tsx`
- `LiveCodingSession` in `src/components/ModulePlaceholders.tsx`

## Route Mapping

- `/builder` -> Workspace setup shell using `ProjectScanner`
- `/dashboard` -> Technical overview shell using `GapAnalysisDashboard`
- `/workflows` -> Company-specific prep shell
- `/workflows/:id` -> Session analysis shell with `QuizModule`
- `/analytics` -> Analytics and gaps shell using `GapAnalysisDashboard`
- `/registry` -> Scenario practice shell using `ScenarioMCQ`
- `/editor` -> Coding playground shell using `CodingPlayground`
- `/terminal` -> Live coding session shell using `LiveCodingSession`
- `/pulse` -> Session summary shell
- `/templates` -> Archive shell

## Active API Surface

- `POST /api/auth/signup`
- `POST /api/auth/signin`
- `GET /api/auth/session`
- `POST /api/auth/signout`
- `GET /api/users/me`
- `PATCH /api/users/me`
- `DELETE /api/users/me`
- `POST /api/auth/change-password`
- `GET /api/users/preferences`
- `PATCH /api/users/preferences`
- `GET /api/health`
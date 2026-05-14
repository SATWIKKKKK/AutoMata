
# AutoMata / Repoid Codebase Summary

- AutoMata is currently shaped as an interview-preparation web app called **Repoid**. The product helps users choose a technical domain, attach a GitHub repository, generate repo-specific interview questions, practice rounds, and review readiness/gap signals.

- The main frontend is a React 19 + Vite + TypeScript app under `src/`. Routing lives in `src/App.tsx`, with protected app pages such as dashboard, onboarding, practice tracks, scenario round, coding round, mock interview, question bank, GitHub repo scanner, results, and settings.

- The UI is organized around `src/views/` for full pages and `src/components/` for shared shell pieces like the sidebar, header, progress bar, domain picker, GitHub scanner overlay, and reusable placeholder modules.

- Styling is centralized in `src/index.css` with Tailwind CSS 4, custom design tokens, blueprint-grid visuals, light/dark theme support, and shared surface/card/text utility classes.

- The Node/Express backend is in `server.ts`. It serves API routes, handles auth/session cookies, user preferences, email-change OTP, question-bank access, round attempts, GitHub repo scanning, prep-plan generation, project analysis, and Vite dev/static serving.

- Persistent data access is handled through `src/lib/db.ts` and schema helpers in `src/lib/dbSchema.ts`, with migrations in `prisma/migrations/` and a migration runner at `scripts/migrate.ts`.

- Question content is stored as markdown files in `data/` for frontend, backend, AI/ML, data science, data analytics, and cybersecurity. TypeScript loaders in `src/lib/*CuratedQuestionBank.ts` convert those banks into usable application data.

- Practice and results state flows through `src/lib/questionBankStore.ts`, `src/lib/questionBankApi.ts`, and `src/lib/roundResults.ts`. These support starting attempts, submitting answers, tracking scores, and summarizing weak areas.

- User/session behavior is split between frontend helpers in `src/lib/session.ts`, `src/lib/userPreferences.ts`, `src/lib/theme.ts`, and backend auth routes in `server.ts`. Login/signup are handled by `src/views/Auth.tsx`, while profile, theme, sidebar, domain, password, and email changes are handled in `src/views/Settings.tsx`.

- GitHub repository scanning is surfaced through `src/views/GithubRepos.tsx`, `src/views/GithubProjectQuestions.tsx`, `src/components/GithubRepoScanner.tsx`, and backend routes in `server.ts`. The scanner can analyze repositories and create interview question sets tied to a repo record.

- There is also a legacy/minimal FastAPI surface under `app/`, with `app/main.py`, auth router wiring, config, database, and Redis setup. The active frontend/backend runtime for this repo is primarily the TypeScript Express server.

- Deployment entry points include `vercel.json` and `api/[...path].ts`, which reuses the Express app with `createApp({ listen: false })` for serverless handling.

- Useful scripts in `package.json` are `npm run dev` for local development, `npm run build` for production frontend builds, `npm run preview` for Vite preview, `npm run lint` for TypeScript checking, and `npm run db:migrate` for database migrations.

- The previous placeholder Python test file was removed because it did not test product behavior. No project-owned OTP test files or server-dev test files were present; OTP and dev-server code remain because they are runtime features, not tests.

export type MockQuestionType = 'technical' | 'design' | 'behavioral' | 'situational';

export type MockQuestionPool = Record<MockQuestionType, string[]>;

const frontend: MockQuestionPool = {
  technical: [
    'React reconciliation, fiber scheduling, and concurrent rendering tradeoffs',
    'Browser rendering pipeline, critical rendering path, reflow, repaint, and compositing',
    'useEffect dependency arrays, stale closures, cleanup, and async race conditions',
    'Hydration, SSR pitfalls, React Server Components, and client boundaries',
    'Accessibility tree, semantic HTML, ARIA usage, focus management, and keyboard navigation',
    'Virtualized lists, bundle splitting, tree shaking, and frontend performance budgets',
    'Service workers, offline caching, IndexedDB, localStorage, and cross-tab synchronization',
    'Animation performance with requestAnimationFrame, transforms, will-change, and layout thrash',
  ],
  design: [
    'Design a component library used by many teams with versioning, theming, and accessibility guarantees',
    'Design a real-time collaborative document editor with conflict resolution and presence',
    'Design an infinite scroll feed with optimistic updates, pagination, and offline support',
    'Design a dashboard with live WebSocket data and graceful degradation',
    'Design a drag-and-drop kanban board with keyboard accessibility',
    'Design a frontend caching layer with stale-while-revalidate behavior',
    'Design an offline-capable PWA with background sync',
    'Design a localization system for 40 languages including RTL support',
    'Design a browser-based spreadsheet with formulas and virtualized rendering',
    'Design a multi-panel workbench layout like VS Code',
  ],
  behavioral: [
    'Tell me about a time you refactored a massive component into composable pieces',
    'Tell me about a time a frontend performance regression affected users',
    'Tell me about a time you disagreed with a designer about a UX pattern',
    'Tell me about a time you diagnosed a memory leak in a long-running SPA',
    'Tell me about a time you pushed back on a feature because it was inaccessible',
    'Tell me about a time you introduced TypeScript or stricter types to an existing codebase',
    'Tell me about a time you reduced bundle size significantly',
    'Tell me about a time you coordinated a design system migration across teams',
  ],
  situational: [
    'Your bundle is 4MB and ships tomorrow; decide what to cut, defer, or keep',
    'A designer wants a custom date picker from scratch; decide build versus library',
    'A product needs SEO, auth-only dashboards, and social feeds; choose SSR, CSR, or SSG per surface',
    'A third-party analytics script slows LCP by 800ms; handle the business and technical tradeoff',
    'The team wants a frontend rewrite; evaluate whether to approve it',
    'A backend API returns inconsistent error shapes; contain the complexity in the frontend',
    'A feature needs real-time data but WebSockets will take a month; choose an interim approach',
    'A key dependency has a security vulnerability requiring a breaking major upgrade',
  ],
};

const backend: MockQuestionPool = {
  technical: [
    'HTTP/2 versus HTTP/3, connection pooling, and latency under load',
    'REST, GraphQL, and gRPC tradeoffs for internal and public APIs',
    'Idempotency, retries, exponential backoff, jitter, and duplicate request handling',
    'Cursor, offset, and keyset pagination tradeoffs',
    'Database indexes, query plans, N+1 detection, and connection pooling',
    'Optimistic locking, pessimistic locking, sagas, and outbox patterns',
    'Rate limiting algorithms, circuit breakers, bulkheads, and backpressure',
    'JWTs, sessions, refresh rotation, OAuth flows, PKCE, and API key management',
  ],
  design: [
    'Design a URL shortener with analytics and abuse prevention',
    'Design a durable job queue with retries and dead letter queues',
    'Design a rate limiter for a multi-tenant API',
    'Design an authentication service with refresh token rotation',
    'Design a notification delivery system across email, SMS, and push',
    'Design a webhook delivery system with retries and signatures',
    'Design a tamper-evident audit log system',
    'Design a multi-tenant API with isolation and per-tenant limits',
    'Design an API gateway with authentication, routing, and observability',
    'Design a caching layer for a high-read API',
  ],
  behavioral: [
    'Tell me about a time a service you owned went down in production',
    'Tell me about a time you designed an API consumed by other teams',
    'Tell me about a time you improved a slow database query significantly',
    'Tell me about a time you made a security fix under pressure',
    'Tell me about a time you pushed back on a feature request for technical reasons',
    'Tell me about a time you migrated a backend system without downtime',
    'Tell me about a time you debugged a distributed tracing signal',
    'Tell me about a time you handled a data consistency incident',
  ],
  situational: [
    'Choose SQL or NoSQL for a product with evolving schema and transactional writes',
    'A five-person team wants microservices; decide monolith versus services',
    'A user-facing action can be sync or async; decide based on UX and reliability',
    'A service is overloaded by downstream slowness; choose backpressure and fallback strategy',
    'A webhook customer demands exactly-once delivery; explain what you can guarantee',
    'A migration needs zero downtime while traffic stays live',
    'A cache invalidation bug is causing stale paid-plan state',
    'An auth provider outage blocks logins during business hours',
  ],
};

const fullStack: MockQuestionPool = {
  technical: [
    'Client-server state synchronization, optimistic UI, and rollback',
    'Cookie versus localStorage token storage, CSRF, XSS, and CORS',
    'File uploads from browser to object storage with presigned URLs and multipart upload',
    'WebSockets, SSE, and polling for real-time features',
    'API contract design, versioning, loading states, and error propagation to UI',
    'Image optimization, responsive images, font loading, and third-party scripts',
    'Feature flags, A/B testing, environment config, and CI/CD',
    'End-to-end testing strategy across frontend, API, and database',
  ],
  design: [
    'Design an e-commerce checkout flow end to end',
    'Design a SaaS onboarding flow with billing and activation signals',
    'Design a comments system with real-time updates',
    'Design a dashboard with role-based data access',
    'Design a file sharing system with permissions',
    'Design a multi-step data import flow with validation and rollback',
    'Design a reporting feature that does not overload the database',
    'Design notification preferences across UI and backend delivery',
  ],
  behavioral: [
    'Tell me about a time you debugged an issue crossing frontend and backend boundaries',
    'Tell me about a time you owned a feature end to end and shipped it',
    'Tell me about a time you traded UX polish against shipping speed',
    'Tell me about a time you aligned frontend and backend teams on an API contract',
    'Tell me about a time production data revealed a flaw in your UI assumptions',
    'Tell me about a time you changed architecture after learning from users',
  ],
  situational: [
    'Decide whether business logic belongs in frontend, backend, or a BFF',
    'Choose tRPC, REST, or GraphQL for a small team building quickly',
    'Choose SSR versus client-side data fetching for an authenticated product',
    'Decide monorepo versus separate repos for frontend and backend',
    'A report query slows the app for all users; protect the database and UX',
    'A product asks for offline support but data consistency matters',
  ],
};

const cybersecurity: MockQuestionPool = {
  technical: [
    'OWASP Top 10 exploitation examples and practical mitigations',
    'SQL injection variants, parameterized queries, and blind injection detection',
    'Stored, reflected, and DOM XSS plus CSP limitations',
    'CSRF, SameSite cookies, double-submit cookies, and session fixation',
    'JWT algorithm confusion, weak secrets, token storage, and OAuth threat modeling',
    'SSRF, open redirects, insecure deserialization, and IDOR',
    'Security headers, TLS configuration, HSTS, and certificate pinning',
    'Threat modeling with STRIDE, attack trees, and incident response phases',
  ],
  design: [
    'Design a secure authentication system for a multi-tenant SaaS product',
    'Design a secrets management service with rotation and auditability',
    'Design an audit logging system that cannot be tampered with silently',
    'Design a secure file upload and storage system',
    'Design a zero-trust network access model',
    'Design a WAF rule set for a public SaaS API',
    'Design an access control system for a multi-tenant app',
    'Design a vulnerability disclosure and triage workflow',
  ],
  behavioral: [
    'Tell me about a time you found a vulnerability in production',
    'Tell me about a time you communicated security risk to non-technical stakeholders',
    'Tell me about a time you balanced security requirements with delivery speed',
    'Tell me about a time you responded to a security incident',
    'Tell me about a time you got a team to adopt a secure pattern',
    'Tell me about a time you prioritized a large backlog of security findings',
  ],
  situational: [
    'A dependency has a known CVE you cannot immediately patch; decide the response',
    'A stakeholder wants to build auth in-house; evaluate build versus identity provider',
    'A low-severity issue chains with another bug into account takeover',
    'An incident is active and logs are incomplete; decide containment steps',
    'A security control slows product delivery; negotiate risk acceptance',
    'A pentest finding is disputed by engineering; resolve severity and ownership',
  ],
};

const dataScience: MockQuestionPool = {
  technical: [
    'Bias-variance tradeoff, overfitting detection, and regularization',
    'Cross-validation strategies including stratified and time-series splits',
    'Class imbalance, SMOTE, class weights, threshold tuning, and metric choice',
    'Missing data mechanisms, imputation, leakage, and target encoding risk',
    'Gradient boosting, random forest feature importance, and model calibration',
    'A/B testing, power analysis, multiple testing, and stopping rules',
    'Time series stationarity, seasonality, ARIMA intuition, and walk-forward validation',
    'Concept drift, data drift, shadow deployment, and model monitoring',
  ],
  design: [
    'Design an ML experiment tracking system',
    'Design a feature store for online and offline consistency',
    'Design a model monitoring system for drift and performance',
    'Design an A/B testing platform',
    'Design a recommendation system',
    'Design a churn prediction pipeline from data to production',
    'Design a fraud detection system with human review',
    'Design a data labeling pipeline with quality controls',
  ],
  behavioral: [
    'Tell me about a time a model you deployed degraded in production',
    'Tell me about a time your analysis changed a business decision',
    'Tell me about a time you caught data leakage in a model',
    'Tell me about a time you communicated uncertainty to a stakeholder',
    'Tell me about a time a simple baseline beat a complex model',
    'Tell me about a time you disagreed with a metric choice',
  ],
  situational: [
    'Choose a complex model or simple baseline when stakeholder pressure is high',
    'Decide whether there is enough data to train a model',
    'Handle a stakeholder who wants to overfit to recent data',
    'Choose train-test split strategy when data has temporal structure',
    'Decide when to retrain a model versus leave it stable',
    'A model ranks well but probabilities are miscalibrated; decide next steps',
  ],
};

const dataAnalytics: MockQuestionPool = {
  technical: [
    'Window functions, ranking, lag/lead, rolling aggregations, and cohort SQL',
    'CTEs, subqueries, temp tables, query plans, indexes, and full table scans',
    'JOIN types, NULL handling, COALESCE, self joins, and CROSS JOIN use cases',
    'Funnel analysis, retention curves, LTV, and attribution modeling',
    'A/B test analysis, practical significance, peeking, and stopping rules',
    'Metric definition, leading versus lagging indicators, and vanity metrics',
    'Star schema, snowflake schema, facts, dimensions, and slowly changing dimensions',
    'Data quality checks, duplicate detection, referential integrity, and outliers',
  ],
  design: [
    'Design a metrics platform for product teams',
    'Design a self-serve analytics system',
    'Design an A/B testing framework',
    'Design a data quality monitoring system',
    'Design a real-time dashboard for operational metrics',
    'Design a customer segmentation pipeline',
    'Design a data catalog with ownership and freshness metadata',
    'Design an executive dashboard that avoids misleading conclusions',
  ],
  behavioral: [
    'Tell me about a time your analysis was wrong and how you caught it',
    'Tell me about a time you pushed back on a stakeholder metric',
    'Tell me about a time you simplified a complex analysis for executives',
    'Tell me about a time your work directly influenced product strategy',
    'Tell me about a time you found a data quality issue late',
    'Tell me about a time stakeholders disagreed about definitions',
  ],
  situational: [
    'A simple average is misleading for a key business metric',
    'A stakeholder keeps changing the metric definition mid-analysis',
    'A PM wants to stop an A/B test early after a promising first week',
    'Explain correlation versus causation to a decision-maker under pressure',
    'Prioritize metrics for a new feature with limited instrumentation time',
    'A dashboard number differs from finance reporting; decide how to investigate',
  ],
};

const aiMl: MockQuestionPool = {
  technical: [
    'Transformer attention, positional encoding, tokenization, and context windows',
    'Temperature, top-k, top-p, beam search, and structured output generation',
    'Fine-tuning, LoRA, PEFT, prompt tuning, and when each is appropriate',
    'RAG chunking, embeddings, vector search, reranking, and hybrid search',
    'Hallucination causes, mitigation, tool use, agents, and context management',
    'LLM evaluation, LLM-as-judge, human review, and inter-annotator agreement',
    'Inference optimization, quantization, batching, KV cache, and latency tradeoffs',
    'Model versioning, rollback, safety filters, and production monitoring',
  ],
  design: [
    'Design a production RAG system for internal documents',
    'Design an LLM evaluation framework',
    'Design a prompt management and rollout system',
    'Design an AI-powered search feature',
    'Design a document Q-and-A system with citations',
    'Design an LLM caching layer',
    'Design model serving infrastructure for multiple model providers',
    'Design an agent with tool use and recovery from tool failures',
  ],
  behavioral: [
    'Tell me about a time an LLM feature hallucinated in production',
    'Tell me about a time you evaluated competing models and chose one',
    'Tell me about a time a prompt change broke behavior unexpectedly',
    'Tell me about a time you explained AI limitations to a non-technical stakeholder',
    'Tell me about a time you designed an evaluation that matched user satisfaction',
    'Tell me about a time you rolled back a model or prompt change',
  ],
  situational: [
    'Choose fine-tuning, RAG, or prompt engineering for a knowledge-heavy feature',
    'Choose open-source model versus API for a regulated product',
    'Handle a model that is confidently wrong in a user-facing workflow',
    'Decide when an LLM evaluation is good enough to ship',
    'Trade latency versus quality for an interactive AI feature',
    'A model upgrade improves benchmarks but worsens real user trust',
  ],
};

export const MOCK_QUESTION_POOLS: Record<string, MockQuestionPool> = {
  frontend,
  react: frontend,
  'next-js': frontend,
  typescript: frontend,
  backend,
  'backend-nodejs': backend,
  'backend-python': backend,
  'full-stack': fullStack,
  cybersecurity,
  security: cybersecurity,
  'data-science': dataScience,
  'data-analytics': dataAnalytics,
  'sql-databases': dataAnalytics,
  'ai-ml': aiMl,
};

export function selectMockQuestionSeeds(domain: string, interviewType: string) {
  const pool = MOCK_QUESTION_POOLS[domain] ?? frontend;
  const types: MockQuestionType[] = interviewType === 'technical'
    ? ['technical', 'situational', 'behavioral']
    : interviewType === 'design'
      ? ['technical', 'design', 'behavioral']
      : ['technical', 'design', 'behavioral'];
  return types.flatMap((type) => pool[type].slice(0, 6).map((seed) => `${type}: ${seed}`)).slice(0, 18);
}

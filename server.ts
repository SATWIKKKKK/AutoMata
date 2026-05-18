import cors from 'cors';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import { jsonrepair } from 'jsonrepair';
import net from 'node:net';
import nodemailer from 'nodemailer';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import db from './src/lib/db.js';
import { DATABASE_SCHEMA_SQL } from './src/lib/dbSchema.js';
import {
  createRoundAttempt,
  ensureQuestionBankSeeded,
  getLatestRoundAttempt,
  getRoundAttemptById,
  listQuestions,
  listQuestionStats,
  submitRoundAttempt,
} from './src/lib/questionBankStore.js';
import {
  PRACTICE_DOMAIN_LABELS,
  formatPracticeDomainList,
  getPracticeTagCloud,
  getPracticeTopicDomains,
  normalizePracticeTopic,
  toPracticeDomain,
  validatePracticeSession,
  type PracticeDomainId,
} from './src/lib/practiceSessionConfig.js';
import {
  formatScenarioDomainList,
  findScenarioTopicDomains,
  getScenarioTagCloud,
  getScenarioTopicCategories,
  normalizeScenarioTopic,
  SCENARIO_ANGLES,
  SCENARIO_DOMAIN_LABELS,
  toScenarioDomain,
  type ScenarioDomainId,
} from './src/lib/scenarioConfig.js';
import { selectMockQuestionSeeds } from './src/lib/mockQuestionPools.js';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const SESSION_COOKIE_NAME = 'promptly_session';
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS = 20;
const GITHUB_SCAN_INITIAL_RESPONSE_TIMEOUT_MS = Number(process.env.GITHUB_SCAN_INITIAL_RESPONSE_TIMEOUT_MS ?? 15000);
const GITHUB_SCAN_INPUT_CHAR_BUDGET = Number(process.env.GITHUB_SCAN_INPUT_CHAR_BUDGET ?? 240000);
const GITHUB_SCAN_MAX_TOKENS = Number(process.env.GITHUB_SCAN_MAX_TOKENS ?? 64000);
const GITHUB_SCAN_MODEL = process.env.GITHUB_SCAN_MODEL?.trim() || 'deepseek/deepseek-v4-pro';
const GITHUB_SCAN_FALLBACK_MODELS = String(process.env.GITHUB_SCAN_FALLBACK_MODELS ?? 'openai/gpt-4o')
  .split(',')
  .map((model) => model.trim())
  .filter(Boolean);
const GITHUB_SCAN_TIMEOUT_MS = Number(process.env.GITHUB_SCAN_TIMEOUT_MS ?? 900000);
const GITHUB_SCAN_TEMPERATURE = Number(process.env.GITHUB_SCAN_TEMPERATURE ?? 0.1);
const GITHUB_SCAN_TOP_P = Number(process.env.GITHUB_SCAN_TOP_P ?? 0.95);
const GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET = Number(process.env.GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET ?? 120000);
const GITHUB_SCAN_ENGINE_VERSION = 'deepseek-chat-single-flight-2026-05-13';
const EMBED_VITE_DEV_SERVER = String(process.env.EMBED_VITE_DEV_SERVER ?? 'true').trim().toLowerCase() !== 'false';
const SCENARIO_GENERATION_MODEL = process.env.SCENARIO_GENERATION_MODEL?.trim() || 'deepseek/deepseek-chat';
const SCENARIO_GENERATION_TIMEOUT_MS = Math.max(8_000, Number(process.env.SCENARIO_GENERATION_TIMEOUT_MS ?? 18_000));
const SCENARIO_GENERATION_ROUTE_TIMEOUT_MS = Math.max(
  SCENARIO_GENERATION_TIMEOUT_MS + 4_000,
  Number(process.env.SCENARIO_GENERATION_ROUTE_TIMEOUT_MS ?? (SCENARIO_GENERATION_TIMEOUT_MS + 4_000)),
);
const SCENARIO_GENERATION_MAX_TOKENS = Math.max(600, Number(process.env.SCENARIO_GENERATION_MAX_TOKENS ?? 800));
const SCENARIO_GENERATION_TEMPERATURE = Number(process.env.SCENARIO_GENERATION_TEMPERATURE ?? 0.6);
const SCENARIO_GENERATION_MAX_ATTEMPTS = Math.min(2, Math.max(1, Number(process.env.SCENARIO_GENERATION_MAX_ATTEMPTS ?? 2)));
const SCENARIO_STEP_EVALUATION_MODEL = process.env.SCENARIO_STEP_EVALUATION_MODEL?.trim() || 'deepseek/deepseek-chat';
const CODING_PROBLEM_GENERATION_MODEL = process.env.CODING_PROBLEM_GENERATION_MODEL?.trim() || 'deepseek/deepseek-chat';
const CODING_PROBLEM_GENERATION_TIMEOUT_MS = Math.max(10_000, Number(process.env.CODING_PROBLEM_GENERATION_TIMEOUT_MS ?? 20_000));
const CODING_PROBLEM_GENERATION_MAX_TOKENS = Math.max(1_200, Number(process.env.CODING_PROBLEM_GENERATION_MAX_TOKENS ?? 2_000));
const CODING_PROBLEM_GENERATION_MAX_ATTEMPTS = Math.min(2, Math.max(1, Number(process.env.CODING_PROBLEM_GENERATION_MAX_ATTEMPTS ?? 2)));
const CODING_PROBLEM_GENERATION_ROUTE_TIMEOUT_MS = Math.max(
  (CODING_PROBLEM_GENERATION_TIMEOUT_MS * CODING_PROBLEM_GENERATION_MAX_ATTEMPTS) + 8_000,
  Number(
    process.env.CODING_PROBLEM_GENERATION_ROUTE_TIMEOUT_MS
      ?? ((CODING_PROBLEM_GENERATION_TIMEOUT_MS * CODING_PROBLEM_GENERATION_MAX_ATTEMPTS) + 8_000),
  ),
);
const CODING_EVALUATION_MODEL = 'deepseek/deepseek-chat';
const oauthStates = new Map<string, { provider: 'google' | 'github'; createdAt: number; nextPath?: string }>();
const activeGithubScanRequests = new Map<string, string>();
let runtimeSchemaReadyPromise: Promise<void> | null = null;

type DbUserRow = {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  auth_provider: string | null;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string;
};

type AuthedRequest = express.Request & {
  user?: DbUserRow;
  rawBody?: Buffer;
};

type UserPreferencesRow = {
  sidebar_open: boolean | null;
  theme: string | null;
  domain: string | null;
};

type BillingPlan = 'free' | 'pro' | 'team';
type BillingInterval = 'monthly' | 'annual';

type SubscriptionRow = {
  id: string;
  user_id: string;
  plan: BillingPlan;
  status: string;
  provider: string | null;
  razorpay_customer_id: string | null;
  razorpay_subscription_id: string | null;
  razorpay_payment_id: string | null;
  current_period_end: string | null;
  billing_interval: BillingInterval | null;
  seats: number | null;
};

type EmailOtpPurpose = 'email_change';

const emailOtpCodes = new Map<string, { codeHash: string; expiresAt: number; purpose: EmailOtpPurpose }>();

const QUESTION_TYPE_VALUES = ['fundamentals', 'mcq', 'fill_blank', 'scenario', 'system_design', 'coding', 'mock'] as const;
type QuestionTypeParam = (typeof QUESTION_TYPE_VALUES)[number];
const QUESTION_TYPE_SET = new Set<string>(QUESTION_TYPE_VALUES);

type PrepPlanRequestBody = {
  domain?: string;
  interviewType?: string;
  companyType?: string;
  timeline?: string;
};

type PrepPlanResponse = {
  focusAreas: string[];
  interviewPattern: string[];
  projectRelevance: string;
  codingExpectation: {
    language: string;
    difficulty: string;
    timePressure: string;
  };
  prepStrategy: {
    '3-day': string[];
    '7-day': string[];
    '30-day': string[];
  };
};

type ProjectAnalysisResponse = {
  projectSummary: string;
  techStack: string[];
  keyFeatures: string[];
  interviewableTopics: string[];
  commonFollowUps: string[];
  weakPoints: string[];
  improvementSuggestions: string[];
  projectSpecificQuestions: string[];
};

type ManualProjectAnalysisResponse = {
  techStack: string[];
  likelyArchitecture: string[];
  whatInterviewerWillFocus: string[];
  gapsThatMightExist: string[];
  projectSpecificQuestions: string[];
  assumptions: string[];
};

type DiagnosticQuestion = {
  question: string;
  type: 'mcq' | 'true_false';
  options?: string[];
  correctAnswer: string;
  topicTag: string;
};

type GithubQuestion = {
  id: string;
  questionText: string;
  type: 'mcq' | 'open' | 'coding' | 'scenario';
  difficulty: 'easy' | 'medium' | 'hard';
  fileReference: string;
  conceptTag: string;
  options?: string[];
  correctAnswer: string;
};

type GithubQuestionSection = {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  questions: GithubQuestion[];
};

type GithubQuestionSet = {
  projectName: string;
  detectedDomains: string[];
  projectSummary: string;
  sections: GithubQuestionSection[];
  warnings?: string[];
};

type ModelConfig =
  | { provider: 'openai-compat'; apiKey: string; model: string; baseUrl: string }
  | { provider: 'gemini'; apiKey: string; model: string };

const authBuckets = new Map<string, { count: number; resetAt: number }>();

function isFilledString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function isRequestAbortedError(error: unknown) {
  if (!error || typeof error !== 'object') return false;
  const type = String((error as { type?: unknown }).type ?? '').trim().toLowerCase();
  const code = String((error as { code?: unknown }).code ?? '').trim().toLowerCase();
  const message = String((error as { message?: unknown }).message ?? '').trim().toLowerCase();
  return type === 'request.aborted' || code === 'ecconnreset' || code === 'econnreset' || message === 'request aborted';
}

function linkAbortSignal(target: AbortController, signal?: AbortSignal) {
  if (!signal) {
    return () => undefined;
  }

  const abort = () => {
    if (target.signal.aborted) return;
    const reason = signal.reason instanceof Error
      ? signal.reason
      : new Error(String(signal.reason ?? 'request_aborted'));
    target.abort(reason);
  };

  if (signal.aborted) {
    abort();
    return () => undefined;
  }

  signal.addEventListener('abort', abort, { once: true });
  return () => signal.removeEventListener('abort', abort);
}

function createRequestAbortHandle(request: express.Request, response: express.Response) {
  const controller = new AbortController();
  const abort = () => {
    if (!controller.signal.aborted) controller.abort(new Error('request_aborted'));
  };
  const handleRequestAborted = () => abort();
  const handleResponseClosed = () => {
    if (!response.writableEnded) abort();
  };

  request.on('aborted', handleRequestAborted);
  response.on('close', handleResponseClosed);

  return {
    signal: controller.signal,
    cleanup: () => {
      request.off('aborted', handleRequestAborted);
      response.off('close', handleResponseClosed);
    },
  };
}

async function withOperationTimeout<T>(label: string, timeoutMs: number, action: () => Promise<T>) {
  let timeoutId: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      action(),
      new Promise<T>((_resolve, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label}_timeout`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function readPort(name: string, fallback: number) {
  const rawValue = process.env[name]?.trim();
  if (!rawValue) return fallback;

  const port = Number(rawValue);
  if (Number.isInteger(port) && port > 0 && port <= 65535) return port;

  console.warn(`Ignoring invalid ${name} value "${rawValue}". Using ${fallback}.`);
  return fallback;
}

async function findAvailablePort(startPort: number, maxAttempts = 20) {
  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidatePort = startPort + offset;
    const available = await new Promise<boolean>((resolve) => {
      const probe = net.createServer();

      probe.once('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE' || error.code === 'EACCES') {
          resolve(false);
          return;
        }

        resolve(false);
      });

      probe.once('listening', () => {
        probe.close(() => resolve(true));
      });

      probe.listen(candidatePort, '0.0.0.0');
    });

    if (available) {
      return candidatePort;
    }
  }

  throw new Error(`Unable to find an open port starting at ${startPort}.`);
}

const ALLOWED_DOMAINS = new Set([
  'frontend',
  'react',
  'next-js',
  'typescript',
  'backend-nodejs',
  'backend-python',
  'backend',
  'full-stack',
  'system-design',
  'sql-databases',
  'devops',
  'cloud-aws',
  'cloud-gcp',
  'cloud-platform',
  'ai-ml',
  'data-analytics',
  'data-science',
  'data-engineering',
  'data',
  'cybersecurity',
  'security',
  'blockchain',
  'web3',
  'mobile-react-native',
  'mobile-flutter',
  'mobile',
  'dsa',
  'cs-fundamentals',
  'languages',
  'database',
  'testing',
]);

const DOMAIN_ALIASES = new Map<string, string>([
  ['database', 'sql-databases'],
  ['testing', 'frontend'],
]);

const BILLING_PLANS = ['free', 'pro', 'team'] as const;
const BILLING_INTERVALS = ['monthly', 'annual'] as const;

const PLAN_PRICING: Record<Exclude<BillingPlan, 'free'>, Record<BillingInterval, { amountPaise: number; displayPrice: string; label: string }>> = {
  pro: {
    monthly: { amountPaise: 9900, displayPrice: '₹99', label: 'Monthly' },
    annual: { amountPaise: 29900, displayPrice: '₹299', label: 'Yearly' },
  },
  team: {
    monthly: { amountPaise: 9900, displayPrice: '₹99', label: 'Monthly' },
    annual: { amountPaise: 29900, displayPrice: '₹299', label: 'Yearly' },
  },
};

const PLAN_LIMITS: Record<BillingPlan, {
  activeDomains: number | 'all';
  questionsPerDay: number | 'unlimited';
  practiceSessions: number | 'unlimited';
  mockInterviewsPerMonth: number | 'unlimited';
  codingRoundsPerMonth: number | 'unlimited';
  scenarioRounds: boolean | 'unlimited';
  githubRepos: number | 'unlimited';
  pdfExport: boolean;
  teamFeatures: boolean;
}> = {
  free: {
    activeDomains: 1,
    questionsPerDay: 20,
    practiceSessions: 'unlimited',
    mockInterviewsPerMonth: 0,
    codingRoundsPerMonth: 0,
    scenarioRounds: false,
    githubRepos: 1,
    pdfExport: false,
    teamFeatures: false,
  },
  pro: {
    activeDomains: 'all',
    questionsPerDay: 'unlimited',
    practiceSessions: 'unlimited',
    mockInterviewsPerMonth: 5,
    codingRoundsPerMonth: 10,
    scenarioRounds: 'unlimited',
    githubRepos: 5,
    pdfExport: true,
    teamFeatures: false,
  },
  team: {
    activeDomains: 'all',
    questionsPerDay: 'unlimited',
    practiceSessions: 'unlimited',
    mockInterviewsPerMonth: 'unlimited',
    codingRoundsPerMonth: 'unlimited',
    scenarioRounds: 'unlimited',
    githubRepos: 'unlimited',
    pdfExport: true,
    teamFeatures: true,
  },
};

function normalizeDomain(value: unknown, fallback = 'frontend') {
  const requested = String(value ?? '').trim();
  const domain = DOMAIN_ALIASES.get(requested) ?? requested;
  return ALLOWED_DOMAINS.has(domain) ? domain : fallback;
}

function normalizeOptionalDomain(value: unknown) {
  const requested = String(value ?? '').trim();
  const domain = DOMAIN_ALIASES.get(requested) ?? requested;
  return ALLOWED_DOMAINS.has(domain) ? domain : '';
}

function normalizeQuestionType(value: unknown): QuestionTypeParam | null {
  const type = String(value ?? '').trim();
  return QUESTION_TYPE_SET.has(type) ? (type as QuestionTypeParam) : null;
}

function parseQuestionTypes(value: unknown): QuestionTypeParam[] {
  const rawValues = Array.isArray(value)
    ? value.flatMap((item) => String(item ?? '').split(','))
    : String(value ?? '').split(',');

  const seen = new Set<QuestionTypeParam>();
  for (const rawValue of rawValues) {
    const normalized = normalizeQuestionType(rawValue);
    if (normalized) seen.add(normalized);
  }

  return [...seen];
}

function toStringArray(value: unknown, fallback: string[] = []): string[] {
  if (Array.isArray(value)) {
    const items = value
      .map((item) => String(item ?? '').trim())
      .filter(Boolean);
    return items.length ? items : fallback;
  }

  if (isFilledString(value)) {
    return value
      .split(/\n|,/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return fallback;
}

function extractJsonPayload(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error('The model returned an empty response.');
  }

  const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```\s*$/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const objectStart = trimmed.indexOf('{');
  const objectEnd = trimmed.lastIndexOf('}');
  const arrayStart = trimmed.indexOf('[');
  const arrayEnd = trimmed.lastIndexOf(']');

  if (arrayStart !== -1 && arrayEnd > arrayStart && (objectStart === -1 || arrayStart < objectStart)) {
    return trimmed.slice(arrayStart, arrayEnd + 1);
  }

  if (objectStart !== -1 && objectEnd > objectStart) {
    return trimmed.slice(objectStart, objectEnd + 1);
  }

  return trimmed;
}

function parseStructuredPayload(rawText: string) {
  const payload = extractJsonPayload(rawText);
  try {
    return JSON.parse(jsonrepair(payload));
  } catch {
    return JSON.parse(payload);
  }
}

function githubScanModelCandidates() {
  return Array.from(new Set([GITHUB_SCAN_MODEL, ...GITHUB_SCAN_FALLBACK_MODELS].filter(Boolean)));
}

function isRetryableGithubModelError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return (
    message === 'model_json_parse_failed'
    || message === 'model_empty_response'
    || message === 'model_invalid_repo_question_json'
    || message === 'model_missing_repo_references'
    || message === 'analysis_timeout'
    || /model_http_(400|402|404|408|409|429|5\d\d)/i.test(message)
  );
}

function readMessageText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) return String((item as { text?: unknown }).text ?? '');
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function normalizePrepPlanResponse(payload: unknown): PrepPlanResponse {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const codingExpectation = source.codingExpectation && typeof source.codingExpectation === 'object'
    ? source.codingExpectation as Record<string, unknown>
    : {};
  const prepStrategy = source.prepStrategy && typeof source.prepStrategy === 'object'
    ? source.prepStrategy as Record<string, unknown>
    : {};

  return {
    focusAreas: toStringArray(source.focusAreas).slice(0, 7),
    interviewPattern: toStringArray(source.interviewPattern),
    projectRelevance: String(source.projectRelevance ?? '').trim(),
    codingExpectation: {
      language: String(codingExpectation.language ?? '').trim(),
      difficulty: String(codingExpectation.difficulty ?? '').trim(),
      timePressure: String(codingExpectation.timePressure ?? '').trim(),
    },
    prepStrategy: {
      '3-day': toStringArray(prepStrategy['3-day']),
      '7-day': toStringArray(prepStrategy['7-day']),
      '30-day': toStringArray(prepStrategy['30-day']),
    },
  };
}

function normalizeProjectAnalysisResponse(payload: unknown): ProjectAnalysisResponse {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    projectSummary: String(source.projectSummary ?? '').trim(),
    techStack: toStringArray(source.techStack),
    keyFeatures: toStringArray(source.keyFeatures),
    interviewableTopics: toStringArray(source.interviewableTopics),
    commonFollowUps: toStringArray(source.commonFollowUps),
    weakPoints: toStringArray(source.weakPoints),
    improvementSuggestions: toStringArray(source.improvementSuggestions),
    projectSpecificQuestions: toStringArray(source.projectSpecificQuestions).slice(0, 30),
  };
}

function normalizeManualProjectAnalysisResponse(payload: unknown): ManualProjectAnalysisResponse {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    techStack: toStringArray(source.techStack),
    likelyArchitecture: toStringArray(source.likelyArchitecture),
    whatInterviewerWillFocus: toStringArray(source.whatInterviewerWillFocus),
    gapsThatMightExist: toStringArray(source.gapsThatMightExist),
    projectSpecificQuestions: toStringArray(source.projectSpecificQuestions),
    assumptions: toStringArray(source.assumptions),
  };
}

function normalizeDiagnosticQuestions(payload: unknown): DiagnosticQuestion[] {
  if (!Array.isArray(payload)) return [];

  return payload
    .map((item) => {
      const source = item && typeof item === 'object' ? item as Record<string, unknown> : {};
      const type = String(source.type ?? '').trim().toLowerCase() === 'true_false' ? 'true_false' : 'mcq';
      return {
        question: String(source.question ?? '').trim(),
        type,
        options: type === 'mcq' ? toStringArray(source.options) : undefined,
        correctAnswer: String(source.correctAnswer ?? '').trim(),
        topicTag: String(source.topicTag ?? '').trim(),
      } satisfies DiagnosticQuestion;
    })
    .filter((question) => question.question && question.correctAnswer && question.topicTag);
}

const GITHUB_SECTION_ID_ALIASES = new Map<string, string>([
  ['project-overview', 'project-overview'],
  ['overview', 'project-overview'],
  ['project-summary', 'project-overview'],
  ['repo-overview', 'project-overview'],
  ['frontend-deep-dive', 'frontend-deep-dive'],
  ['frontend-deepdive', 'frontend-deep-dive'],
  ['frontend', 'frontend-deep-dive'],
  ['ui-deep-dive', 'frontend-deep-dive'],
  ['backend-deep-dive', 'backend-deep-dive'],
  ['backend-deepdive', 'backend-deep-dive'],
  ['backend', 'backend-deep-dive'],
  ['api-deep-dive', 'backend-deep-dive'],
  ['service-deep-dive', 'backend-deep-dive'],
  ['most-probable', 'most-probable'],
  ['most-probable-interview-questions', 'most-probable'],
  ['likely-interview-questions', 'most-probable'],
  ['common-questions', 'most-probable'],
  ['scenario-based', 'scenario-based'],
  ['scenario-based-questions', 'scenario-based'],
  ['scenarios', 'scenario-based'],
  ['technical-deep-dive', 'technical-deep-dive'],
  ['technical-deepdive', 'technical-deep-dive'],
  ['technical-questions', 'technical-deep-dive'],
  ['deep-dive', 'technical-deep-dive'],
  ['red-flags-improvements', 'red-flags-improvements'],
  ['red-flags-and-improvements', 'red-flags-improvements'],
  ['red-flags', 'red-flags-improvements'],
  ['improvements', 'red-flags-improvements'],
]);

const DEFAULT_GITHUB_SECTION_TITLES: Record<string, string> = {
  'project-overview': 'Project Overview',
  'frontend-deep-dive': 'Frontend Deep Dive',
  'backend-deep-dive': 'Backend Deep Dive',
  'most-probable': 'Most Probable Interview Questions',
  'scenario-based': 'Scenario Based Questions',
  'technical-deep-dive': 'Technical Deep Dive',
  'red-flags-improvements': 'Red Flags and Improvements',
};

function normalizeGithubSectionKey(value: unknown) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function canonicalizeGithubSectionId(sectionId: unknown, sectionTitle: unknown) {
  const candidates = [sectionId, sectionTitle]
    .map((value) => normalizeGithubSectionKey(value))
    .filter(Boolean);

  for (const candidate of candidates) {
    const alias = GITHUB_SECTION_ID_ALIASES.get(candidate);
    if (alias) return alias;
  }

  return candidates[0] ?? '';
}

function normalizeGithubQuestionType(value: unknown): GithubQuestion['type'] {
  const normalized = normalizeGithubSectionKey(value);
  if (['mcq', 'multiple-choice', 'multiple-choice-question', 'multiplechoice'].includes(normalized)) return 'mcq';
  if (['coding', 'code', 'implementation'].includes(normalized)) return 'coding';
  if (['scenario', 'scenario-based'].includes(normalized)) return 'scenario';
  return 'open';
}

function normalizeGithubQuestionDifficulty(value: unknown): GithubQuestion['difficulty'] {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') return normalized;
  if (normalized === 'difficult' || normalized === 'senior') return 'hard';
  return 'medium';
}

function normalizeGithubDetectedDomain(value: unknown) {
  const normalized = String(value ?? '').trim();
  const key = normalized.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (['ai', 'ai ml', 'aiml', 'ai and ml', 'machine learning', 'ml', 'ai integration'].includes(key)) return 'AI and ML';
  if (['fullstack', 'full stack'].includes(key)) return 'Full Stack';
  if (['front end', 'frontend', 'react'].includes(key)) return 'Frontend';
  if (['back end', 'backend', 'api'].includes(key)) return 'Backend';
  if (['security', 'cyber security', 'cybersecurity'].includes(key)) return 'Cybersecurity';
  if (['devops', 'infrastructure', 'devops and infrastructure'].includes(key)) return 'DevOps and Infrastructure';
  if (['data', 'data science', 'data engineering', 'analytics'].includes(key)) return 'Data Engineering';
  return normalized || 'General Software';
}

function deriveGithubConceptTag(value: unknown, fileReference: string, sectionTitle: string) {
  const explicit = String(value ?? '').trim();
  if (explicit) return explicit;

  const fileStem = fileReference
    .split('/')
    .pop()
    ?.replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .trim();

  return fileStem || sectionTitle || 'repo question';
}

function normalizeGithubQuestionSet(payload: unknown): GithubQuestionSet {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const sections = Array.isArray(source.sections) ? source.sections : [];
  const normalizedSections = sections.map((section, sectionIndex) => {
    const sectionSource = section && typeof section === 'object' ? section as Record<string, unknown> : {};
    const sectionId = canonicalizeGithubSectionId(sectionSource.sectionId, sectionSource.sectionTitle) || `section-${sectionIndex + 1}`;
    const sectionTitle = String(sectionSource.sectionTitle ?? '').trim() || DEFAULT_GITHUB_SECTION_TITLES[sectionId] || `Section ${sectionIndex + 1}`;
    const sectionDescription = String(sectionSource.sectionDescription ?? '').trim() || 'Repo-grounded interview questions derived from the provided files.';
    const questions = Array.isArray(sectionSource.questions) ? sectionSource.questions : [];

    return {
      sectionId,
      sectionTitle,
      sectionDescription,
      questions: questions.map((question) => {
        const questionSource = question && typeof question === 'object' ? question as Record<string, unknown> : {};
        const type = normalizeGithubQuestionType(questionSource.type);
        const fileReference = String(
          questionSource.fileReference
            ?? questionSource.file
            ?? questionSource.filePath
            ?? questionSource.path
            ?? questionSource.sourceFile
            ?? '',
        ).trim();

        return {
          id: String(questionSource.id ?? '').trim(),
          questionText: String(questionSource.questionText ?? questionSource.question ?? '').trim(),
          type,
          difficulty: normalizeGithubQuestionDifficulty(questionSource.difficulty),
          fileReference,
          conceptTag: deriveGithubConceptTag(
            questionSource.conceptTag ?? questionSource.concept ?? questionSource.tag ?? questionSource.topic,
            fileReference,
            sectionTitle,
          ),
          options: type === 'mcq' ? toStringArray(questionSource.options).slice(0, 4) : undefined,
          correctAnswer: String(questionSource.correctAnswer ?? questionSource.answer ?? questionSource.expectedAnswer ?? '').trim(),
        };
      }).filter((question) => question.questionText && question.fileReference && question.correctAnswer),
    };
  }).filter((section) => section.sectionId && section.sectionTitle && section.questions.length);

  const mergedSections = new Map<string, GithubQuestionSection>();
  for (const section of normalizedSections) {
    const existing = mergedSections.get(section.sectionId);
    if (existing) {
      existing.questions.push(...section.questions);
      continue;
    }

    mergedSections.set(section.sectionId, {
      sectionId: section.sectionId,
      sectionTitle: section.sectionTitle,
      sectionDescription: section.sectionDescription,
      questions: [...section.questions],
    });
  }

  let nextQuestionId = 1;
  const finalizedSections = Array.from(mergedSections.values()).map((section) => ({
    ...section,
    questions: section.questions.map((question) => ({
      ...question,
      id: `q${nextQuestionId++}`,
    })),
  }));

  const warnings = new Set(toStringArray(source.warnings));
  const totalQuestions = finalizedSections.reduce((sum, section) => sum + section.questions.length, 0);
  if (finalizedSections.length < 7) warnings.add('reduced_section_count');
  if (totalQuestions < 56) warnings.add('reduced_question_count');

  return {
    projectName: String(source.projectName ?? source.repoName ?? '').trim(),
    detectedDomains: toStringArray(source.detectedDomains ?? source.domains).map(normalizeGithubDetectedDomain).slice(0, 2),
    projectSummary: String(source.projectSummary ?? source.summary ?? '').trim(),
    warnings: Array.from(warnings),
    sections: finalizedSections,
  };
}

function resolveModelConfig(modelOverride?: string): ModelConfig {
  const compatBaseUrl = process.env.AICREDITS_BASE_URL?.trim()
    || process.env.OPENAI_COMPAT_BASE_URL?.trim()
    || 'https://api.aicredits.in/v1';
  const compatApiKey = process.env.AICREDITS_API_KEY?.trim()
    || process.env.OPENAI_API_KEY?.trim()
    || process.env.ANTHROPIC_API_KEY?.trim();
  if (compatApiKey) {
    return {
      provider: 'openai-compat',
      apiKey: compatApiKey,
      baseUrl: compatBaseUrl.replace(/\/$/, ''),
      model: modelOverride
        || process.env.PREP_MODEL?.trim()
        || process.env.INTERVIEW_ANALYST_MODEL?.trim()
        || process.env.WORKFLOW_SUMMARY_MODEL?.trim()
        || process.env.ANTHROPIC_MODEL?.trim()
        || 'deepseek/deepseek-chat',
    };
  }

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiApiKey) {
    return {
      provider: 'gemini',
      apiKey: geminiApiKey,
      model: modelOverride || process.env.GEMINI_MODEL?.trim() || 'gemini-2.5-flash',
    };
  }

  throw new Error('No compatible LLM provider is configured for prep analysis.');
}

function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  if (typeof value === 'string') {
    try {
      return parseJsonArray(JSON.parse(value));
    } catch {
      return value.trim() ? [value.trim()] : [];
    }
  }
  return [];
}

function parseJsonRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as unknown;
      return parseJsonRecord(parsed);
    } catch {
      return {};
    }
  }
  return {};
}

function clampScore(value: unknown, fallback = 5) {
  const score = Number(value);
  if (!Number.isFinite(score)) return fallback;
  return Math.min(10, Math.max(1, Math.round(score)));
}

type MockRoundFeedbackPayload = {
  aiUnavailable: boolean;
  score: number;
  feedback: string;
  whatWorked: string;
  whatWasMissed: string;
  spokenResponse: string;
  followUpQuestion: string | null;
  internalFlags: string[];
};

type ScenarioRoundFeedbackPayload = {
  aiUnavailable: boolean;
  score: number;
  feedback: string;
  whatWorked: string;
  whatWasMissed: string;
  seniorEngineerWouldHaveSaid: string;
};

type RoundFeedbackPayload = MockRoundFeedbackPayload | ScenarioRoundFeedbackPayload;

function fallbackRoundFeedback(mode: 'scenario' | 'mock', answer: string): RoundFeedbackPayload {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = words >= 90 ? 8 : words >= 45 ? 6 : 4;
  if (mode === 'mock') {
    return {
      aiUnavailable: true,
      score,
      feedback: 'Saved locally because the AI evaluator was unavailable. The answer is strongest when it names the problem, decision, tradeoff, result, and validation signal.',
      whatWorked: words >= 45 ? 'You gave enough substance to evaluate the answer.' : 'You started the answer with a clear direction.',
      whatWasMissed: 'Add more concrete evidence, tradeoffs, and verification details.',
      spokenResponse: words >= 45 ? 'That gives me the shape of your thinking. I would push you to be more specific about the signal that proved the decision worked.' : 'I need a more concrete example before I can judge the depth of that answer.',
      followUpQuestion: 'What metric, user signal, or production symptom proved your decision was correct?',
      internalFlags: ['fallback-evaluation'],
    };
  }
  return {
    aiUnavailable: true,
    score,
    feedback: 'Saved locally because the AI evaluator was unavailable. Strong scenario answers diagnose first, name the risk, then propose a bounded action.',
    whatWorked: words >= 45 ? 'You responded with enough context to show a decision path.' : 'You identified an initial direction.',
    whatWasMissed: 'Make the constraints, failure mode, and next verification step more explicit.',
    seniorEngineerWouldHaveSaid: 'I would isolate the failing boundary, protect users from the current blast radius, ship the smallest reversible fix, then add a metric or test that catches the regression next time.',
  };
}

function normalizeRoundFeedbackPayload(mode: 'scenario' | 'mock', payload: unknown): RoundFeedbackPayload {
  const source = parseJsonRecord(payload);
  if (mode === 'mock') {
    return {
      aiUnavailable: Boolean(source.aiUnavailable),
      score: clampScore(source.internalScore ?? source.score, 6),
      feedback: String(source.feedback ?? source.spokenResponse ?? 'Response recorded.'),
      whatWorked: String(source.whatWorked ?? source.strengthSignal ?? 'The answer had a usable starting point.'),
      whatWasMissed: String(source.whatWasMissed ?? 'Add more concrete tradeoffs and validation details.'),
      spokenResponse: String(source.spokenResponse ?? source.response ?? 'Thanks. I would like you to go one level deeper on the tradeoff.'),
      followUpQuestion: source.followUpQuestion === null ? null : String(source.followUpQuestion ?? ''),
      internalFlags: parseJsonArray(source.internalFlags ?? source.flags),
    };
  }
  return {
    aiUnavailable: Boolean(source.aiUnavailable),
    score: clampScore(source.score, 6),
    feedback: String(source.feedback ?? 'Scenario step recorded.'),
    whatWorked: String(source.whatWorked ?? 'The answer identified a plausible next step.'),
    whatWasMissed: String(source.whatWasMissed ?? 'Add clearer constraints, risks, and verification.'),
    seniorEngineerWouldHaveSaid: String(source.seniorEngineerWouldHaveSaid ?? 'A senior answer would diagnose the boundary first, contain the risk, and validate the fix with a concrete signal.'),
  };
}

async function getLatestRepoContext(userId: string) {
  const row = await db.prepare(`
    SELECT gr.repo_name, gr.detected_stack, gr.raw_analysis_json, rqs.project_summary
      FROM github_repos gr
      LEFT JOIN repo_question_sets rqs ON rqs.repo_id = gr.id
     WHERE gr.user_id = ? AND gr.status = 'complete'
     ORDER BY gr.scanned_at DESC
     LIMIT 1
  `).get<{ repo_name: string; detected_stack: unknown; raw_analysis_json: unknown; project_summary: string | null }>(userId);
  if (!row) return 'none';
  return JSON.stringify({
    repoName: row.repo_name,
    detectedStack: parseJsonArray(row.detected_stack).slice(0, 8),
    summary: row.project_summary ?? 'Repository scan completed.',
  });
}

async function checkAiRateLimit(userId: string, eventType: string, weight: number) {
  const row = await db.prepare(`
    SELECT COALESCE(SUM(weight), 0)::int AS total
      FROM ai_rate_limit_events
     WHERE user_id = ?
       AND created_at >= NOW() - INTERVAL '60 minutes'
  `).get<{ total: number }>(userId);
  const current = Number(row?.total ?? 0);
  if (current + weight > 60) {
    const error = new Error("You're moving fast - slow down a bit, your results are still accurate.");
    (error as Error & { statusCode?: number }).statusCode = 429;
    throw error;
  }
  await db.prepare(`
    INSERT INTO ai_rate_limit_events (id, user_id, event_type, weight)
    VALUES (?, ?, ?, ?)
  `).run(crypto.randomUUID(), userId, eventType, Math.max(1, Math.round(weight)));
}

async function queueAiRetryJob(userId: string, feature: string, attemptId: string, payload: Record<string, unknown>) {
  await db.prepare(`
    INSERT INTO ai_retry_jobs (id, user_id, feature, attempt_id, payload, status)
    VALUES (?, ?, ?, ?, ?::jsonb, 'pending')
  `).run(crypto.randomUUID(), userId, feature, attemptId, JSON.stringify(payload));
}

async function markAiRetryJobsFailed(userId: string, feature: string, attemptId: string, message: string) {
  await db.prepare(`
    UPDATE ai_retry_jobs
       SET status = 'failed',
           error_message = ?,
           updated_at = NOW()
     WHERE user_id = ?
       AND feature = ?
       AND attempt_id = ?
       AND status = 'pending'
  `).run(message.slice(0, 500), userId, feature, attemptId);
}

type TrackQuestionRow = {
  id: string;
  domain: string;
  domain_label: string;
  topic: string;
  type: string;
  difficulty: number;
  question_text: string;
  options: unknown;
  correct_answer: string;
  explanation: string;
  code_snippet: string | null;
  tags: unknown;
  time_limit_minutes: number;
};

type PracticeQuestionType = 'fill-blank' | 'mcq' | 'code-reading';
type PracticeQuestionDifficulty = 'easy' | 'medium' | 'hard';

type PracticeSessionQuestion = {
  id: string;
  type: PracticeQuestionType;
  question: string;
  codeBlock: string | null;
  blank: string | null;
  options: string[] | null;
  correctAnswer: string;
  explanation: string;
  difficulty: PracticeQuestionDifficulty;
  tags: string[];
};

type PracticeSessionAnswer = {
  questionId: string;
  answer: string;
  confirmedAt: string;
};

type PracticeSessionResult = {
  questionId: string;
  type: PracticeQuestionType;
  question: string;
  codeBlock?: string | null;
  userAnswer: string;
  correctAnswer: string;
  explanation: string;
  isCorrect: boolean;
  tags: string[];
};

type PracticeSessionPayload = {
  id: string;
  domain: PracticeDomainId;
  domainLabel: string;
  topic: string;
  status: string;
  questions: PracticeSessionQuestion[];
  answers: PracticeSessionAnswer[];
  score: number | null;
  correctAnswers: number;
  totalQuestions: number;
  timeSpentSeconds: number | null;
  generatedAt: string;
  completedAt: string | null;
  savedAt: string | null;
  performanceLabel: string | null;
  weakTags: string[];
  results: PracticeSessionResult[];
};

type PracticeSessionSummary = Pick<
  PracticeSessionPayload,
  'id' | 'domain' | 'domainLabel' | 'topic' | 'status' | 'score' | 'correctAnswers' | 'totalQuestions' | 'generatedAt' | 'completedAt' | 'savedAt' | 'weakTags'
>;

function hashText(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function practiceQuestionHistoryHash(question: Pick<PracticeSessionQuestion, 'question' | 'correctAnswer'>) {
  return hashText(normalizePracticeAnswerText(`${question.question} ${question.correctAnswer}`).slice(0, 80));
}

function normalizePracticeAnswerText(value: string) {
  return value
    .toLowerCase()
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanPracticeTag(value: string) {
  return value
    .trim()
    .replace(/^#+\s*/, '')
    .replace(/\s+/g, ' ')
    .slice(0, 48);
}

function parsePracticeQuestionType(value: unknown): PracticeQuestionType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'code reading' || normalized === 'code_reading' || normalized === 'code-reading') return 'code-reading';
  if (normalized === 'fill blank' || normalized === 'fill_blank' || normalized === 'fill-blank') return 'fill-blank';
  return 'mcq';
}

function parsePracticeDifficulty(value: unknown): PracticeQuestionDifficulty {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'hard' || normalized === 'medium') return normalized;
  return 'easy';
}

function normalizePracticeQuestionPayload(value: unknown, index: number, topic: string): PracticeSessionQuestion | null {
  const source = parseJsonRecord(value);
  const type = parsePracticeQuestionType(source.type);
  const explicitId = String(source.id ?? '').trim();
  const question = String(source.question ?? '').trim().replace(/^Q\d+[.:]\s*/, '');
  const codeBlock = type === 'code-reading' ? stripCodeFences(String(source.codeBlock ?? source.code ?? '').trim()) : null;
  const correctAnswer = String(source.correctAnswer ?? source.answer ?? source.blank ?? '').trim();
  const explanation = String(source.explanation ?? '').trim();
  const tags = parseJsonArray(source.tags)
    .map((tag) => cleanPracticeTag(String(tag)))
    .filter(Boolean)
    .slice(0, 6);

  if (!question || !correctAnswer) return null;
  if (type === 'code-reading' && !codeBlock) return null;

  if (type === 'mcq') {
    const options = parseJsonArray(source.options).map((option) => String(option).trim()).filter(Boolean).slice(0, 4);
    if (options.length !== 4) return null;
    return {
      id: explicitId || `${hashText(`${topic}:${question}:${correctAnswer}`).slice(0, 12)}-${index + 1}`,
      type,
      question,
      codeBlock,
      blank: null,
      options,
      correctAnswer,
      explanation,
      difficulty: parsePracticeDifficulty(source.difficulty),
      tags,
    };
  }

  if (type === 'code-reading') {
    const options = parseJsonArray(source.options).map((option) => String(option).trim()).filter(Boolean).slice(0, 4);
    return {
      id: explicitId || `${hashText(`${topic}:${question}:${correctAnswer}`).slice(0, 12)}-${index + 1}`,
      type,
      question,
      codeBlock,
      blank: String(source.blank ?? '').trim() || null,
      options: options.length === 4 ? options : null,
      correctAnswer,
      explanation,
      difficulty: parsePracticeDifficulty(source.difficulty),
      tags,
    };
  }

  return {
    id: explicitId || `${hashText(`${topic}:${question}:${correctAnswer}`).slice(0, 12)}-${index + 1}`,
    type,
    question,
    codeBlock: null,
    blank: String(source.blank ?? correctAnswer).trim() || correctAnswer,
    options: null,
    correctAnswer,
    explanation,
    difficulty: parsePracticeDifficulty(source.difficulty),
    tags,
  };
}

function stripCodeFences(value: string) {
  return value
    .replace(/^\s*```[a-zA-Z0-9_-]*\s*\r?\n/, '')
    .replace(/\r?\n```\s*$/, '')
    .replace(/^\s*~~~[a-zA-Z0-9_-]*\s*\r?\n/, '')
    .replace(/\r?\n~~~\s*$/, '')
    .trim();
}

function parsePracticeQuestions(value: unknown): PracticeSessionQuestion[] {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item, index) => normalizePracticeQuestionPayload(item, index, 'practice-session'))
    .filter((item): item is PracticeSessionQuestion => Boolean(item));
}

function buildPracticeTopUpQuestion(params: {
  domain: PracticeDomainId;
  topic: string;
  index: number;
  variant: number;
}): PracticeSessionQuestion {
  const domainLabel = PRACTICE_DOMAIN_LABELS[params.domain];
  const topic = params.topic.trim() || domainLabel;
  const tags = [cleanPracticeTag(topic), domainLabel, params.index >= 20 ? 'Hard Coding Scenario' : 'Practice Top-Up'].filter(Boolean).slice(0, 6);
  if (params.index < 0) {
    const answers = ['dependency array', 'idempotency', 'authorization check', 'data leakage', 'evaluation metric'];
    const correctAnswer = answers[params.index % answers.length];
    return {
      id: `topup-${hashText(`${params.domain}:${topic}:fill:${params.index}:${params.variant}`).slice(0, 12)}-${params.index + 1}`,
      type: 'fill-blank',
      question: `In ${domainLabel} ${topic} work, the missing concept in this production review is ________: the specific control or decision that prevents repeated work, unsafe access, or misleading results. Focus on the strongest term for scenario ${params.variant + 1}.`,
      codeBlock: null,
      blank: correctAnswer,
      options: null,
      correctAnswer,
      explanation: `${correctAnswer} is the key concept because it names the control that keeps the implementation reliable under realistic interview constraints.`,
      difficulty: params.index < 4 ? 'easy' : 'medium',
      tags,
    };
  }

  if (params.index < 0) {
    const correctAnswer = 'Identify the boundary, validate the assumption, and make the smallest reversible fix.';
    return {
      id: `topup-${hashText(`${params.domain}:${topic}:mcq:${params.index}:${params.variant}`).slice(0, 12)}-${params.index + 1}`,
      type: 'mcq',
      question: `A ${domainLabel} interview question on ${topic} describes a bug but gives incomplete logs. What is the strongest first response? Scenario ${params.variant + 1}: choose the best option.`,
      codeBlock: null,
      blank: null,
      options: [
        correctAnswer,
        'Rewrite the entire module before checking the failure boundary.',
        'Assume the newest deployment is unrelated and ignore it.',
        'Skip validation and only optimize the code path that looks slow.',
      ],
      correctAnswer,
      explanation: 'Strong engineering answers isolate the failing boundary, validate the assumption with evidence, and keep the first fix reversible.',
      difficulty: 'medium',
      tags,
    };
  }

  const snippets: Partial<Record<PracticeDomainId, { question: string; options: string[]; correctAnswer: string; explanation: string }>> = {
    frontend: {
      question: `In a ${topic} component, a developer writes: useEffect(() => { fetch('/api/items').then(r => r.json()).then(setItems); }, [items]); The list updates after every response. What will happen here?`,
      options: [
        'The effect runs once because fetch is asynchronous.',
        'The effect can loop because setItems changes items, which is also a dependency.',
        'React ignores arrays in dependency lists.',
        'The browser caches the request and prevents re-rendering.',
      ],
      correctAnswer: 'The effect can loop because setItems changes items, which is also a dependency.',
      explanation: 'The state updated inside the effect is also listed as a dependency, so each fetch response can trigger another render and another fetch. Use an empty dependency list for load-once behavior or depend on a stable query key instead.',
    },
    backend: {
      question: `In a ${topic} API handler, code checks the database, then inserts a row only if no existing row is found. Two identical requests arrive at the same time and there is no unique constraint. What will happen here?`,
      options: [
        'The database automatically serializes both HTTP requests.',
        'Duplicate rows can be created because the check and insert are not atomic.',
        'Only the first request reaches the handler.',
        'The second request always receives a 409 response.',
      ],
      correctAnswer: 'Duplicate rows can be created because the check and insert are not atomic.',
      explanation: 'A read-before-write flow without a transaction, lock, or unique constraint is race-prone. Enforce uniqueness at the database layer and use an atomic upsert or handle the constraint violation.',
    },
    'full-stack': {
      question: `In a ${topic} feature, the client optimistically marks an item as saved before POST /api/save returns, and the server can reject the request for authorization. What is the safest outcome to implement?`,
      options: [
        'Keep the optimistic state forever because the UI felt faster.',
        'Rollback the UI state and show a clear failure when the server rejects the request.',
        'Retry forever in the background without telling the user.',
        'Disable authorization for this endpoint.',
      ],
      correctAnswer: 'Rollback the UI state and show a clear failure when the server rejects the request.',
      explanation: 'Optimistic UI must reconcile with the authoritative server result. On rejection, restore the prior state and communicate the failure so client and server do not drift.',
    },
    cybersecurity: {
      question: `In a ${topic} endpoint, the server reads userId from the request body and updates /users/:userId/settings without comparing it to the authenticated session. What vulnerability is most likely?`,
      options: [
        'CSRF only, because all state changes are CSRF.',
        'IDOR or broken access control because a user can target another user id.',
        'SQL injection because userId is a string.',
        'Clickjacking because settings are visible in the browser.',
      ],
      correctAnswer: 'IDOR or broken access control because a user can target another user id.',
      explanation: 'Authorization must be based on the authenticated principal and allowed resource ownership, not a client-supplied user id. The fix is to derive user identity from the session and enforce object-level access checks.',
    },
    'data-analytics': {
      question: `In a ${topic} SQL report, revenue is joined to events on user_id only, while users can have many events per order. The dashboard suddenly overstates revenue. What happened?`,
      options: [
        'The join likely multiplied revenue rows because the grain of the tables did not match.',
        'SUM automatically removes duplicate revenue values.',
        'The database converted revenue into percentages.',
        'Window functions are required for every dashboard query.',
      ],
      correctAnswer: 'The join likely multiplied revenue rows because the grain of the tables did not match.',
      explanation: 'Joining facts at incompatible grains can fan out measures. Aggregate to the intended grain first or join on keys that preserve one row per measured entity.',
    },
    'data-science': {
      question: `In a ${topic} notebook, preprocessing is fit on the full dataset before train_test_split, then model accuracy looks unusually high. What is the most likely issue?`,
      options: [
        'The test set influenced preprocessing, causing data leakage.',
        'The model is definitely production-ready.',
        'The split function removes leakage automatically.',
        'High accuracy always means low variance.',
      ],
      correctAnswer: 'The test set influenced preprocessing, causing data leakage.',
      explanation: 'Preprocessing steps such as scaling, imputation, or encoding must be fit on training data only. Use a pipeline and evaluate on untouched validation or test data.',
    },
    'ai-ml': {
      question: `In a ${topic} RAG flow, code retrieves chunks after the LLM has already drafted the answer, then appends citations afterward. What will happen here?`,
      options: [
        'The answer is grounded because citations exist.',
        'The model may hallucinate because retrieval did not condition generation.',
        'Vector databases prevent unsupported claims automatically.',
        'The citations will rewrite the answer.',
      ],
      correctAnswer: 'The model may hallucinate because retrieval did not condition generation.',
      explanation: 'Retrieved context must be supplied before or during generation so the model can ground its answer. Appending citations after generation creates unsupported citation risk.',
    },
  };
  const scenario = snippets[params.domain] ?? snippets.frontend!;
  const salt = `${params.domain}:${topic}:top-up:${params.index}:${params.variant}`;
  return {
    id: `topup-${hashText(salt).slice(0, 12)}-${params.index + 1}`,
    type: params.index >= 20 ? 'code-reading' : 'mcq',
    question: `${scenario.question} Scenario ${params.variant + 1}: choose the strongest answer.`,
    codeBlock: params.index >= 20
      ? `async function handleRequest(req, res) {\n  const userId = req.body.userId;\n  const record = await repository.findByUserId(userId);\n  if (!record) {\n    await repository.create({ userId, topic: '${topic}' });\n  }\n  const payload = await service.buildPayload(userId);\n  await audit.log({ userId, action: 'practice.topup' });\n  res.json({ ok: true, payload });\n}\n\nrouter.post('/practice/topup', authenticate, handleRequest);`
      : null,
    blank: null,
    options: scenario.options,
    correctAnswer: scenario.correctAnswer,
    explanation: scenario.explanation,
    difficulty: 'hard',
    tags,
  };
}

function ensurePracticeQuestionCount(
  questions: PracticeSessionQuestion[],
  params: { domain: PracticeDomainId; topic: string; targetCount?: number },
) {
  const targetCount = params.targetCount ?? 40;
  const seen = new Set(questions.map((question) => hashText(`${question.question}:${question.correctAnswer}`)));
  const nextQuestions = [...questions];
  let variant = 0;
  while (nextQuestions.length < targetCount) {
    const topUp = buildPracticeTopUpQuestion({
      domain: params.domain,
      topic: params.topic,
      index: nextQuestions.length,
      variant,
    });
    const topUpHash = hashText(`${topUp.question}:${topUp.correctAnswer}`);
    if (!seen.has(topUpHash) || variant > targetCount * 2) {
      seen.add(topUpHash);
      nextQuestions.push(topUp);
    }
    variant += 1;
  }
  return nextQuestions.slice(0, targetCount);
}

function parsePracticeAnswers(value: unknown): PracticeSessionAnswer[] {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const source = parseJsonRecord(item);
      const questionId = String(source.questionId ?? '').trim();
      const answer = String(source.answer ?? '').trim();
      const confirmedAt = String(source.confirmedAt ?? '').trim() || new Date().toISOString();
      if (!questionId || !answer) return null;
      return { questionId, answer, confirmedAt } satisfies PracticeSessionAnswer;
    })
    .filter((item): item is PracticeSessionAnswer => Boolean(item));
}

function parsePracticeResults(value: unknown): PracticeSessionResult[] {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => {
      const source = parseJsonRecord(item);
      const questionId = String(source.questionId ?? '').trim();
      const question = String(source.question ?? '').trim();
      const userAnswer = String(source.userAnswer ?? '').trim();
      const correctAnswer = String(source.correctAnswer ?? '').trim();
      if (!questionId || !question || !correctAnswer) return null;
      return {
        questionId,
        type: parsePracticeQuestionType(source.type),
        question,
        userAnswer,
        correctAnswer,
        explanation: String(source.explanation ?? '').trim(),
        isCorrect: Boolean(source.isCorrect),
        tags: parseJsonArray(source.tags),
      } satisfies PracticeSessionResult;
    })
    .filter((item): item is PracticeSessionResult => Boolean(item));
}

function isPracticeAnswerCorrect(question: PracticeSessionQuestion, answer: string) {
  const submitted = normalizePracticeAnswerText(answer);
  const expected = normalizePracticeAnswerText(question.correctAnswer);
  if (!submitted || !expected) return false;
  if (submitted === expected) return true;
  if (question.type === 'fill-blank') {
    return expected.includes(submitted) || submitted.includes(expected);
  }
  return false;
}

async function listPracticeSessions(userId: string, options: { domain?: PracticeDomainId; savedOnly?: boolean } = {}) {
  const clauses = ['user_id = $1'];
  const params: string[] = [userId];
  if (options.domain) {
    clauses.push(`domain = $${params.length + 1}`);
    params.push(options.domain);
  }
  if (options.savedOnly) {
    clauses.push('saved_at IS NOT NULL');
  }

  const rows = await db.query<{
    id: string;
    domain: string;
    topic: string;
    status: string;
    questions: unknown;
    score: number | null;
    correct_answers: number;
    generated_at: string;
    completed_at: string | null;
    saved_at: string | null;
    result_payload: unknown;
  }>(`
    SELECT id, domain, topic, status, questions, score, correct_answers, generated_at, completed_at, saved_at, result_payload
      FROM open_practice_sessions
     WHERE ${clauses.join(' AND ')}
     ORDER BY generated_at DESC
     LIMIT 40
  `, params);

  return rows.map((row) => {
    const domain = toPracticeDomain(row.domain) || 'frontend';
    const resultPayload = parseJsonRecord(row.result_payload);
    const totalQuestions = parsePracticeQuestions(row.questions).length;
    return {
      id: row.id,
      domain,
      domainLabel: PRACTICE_DOMAIN_LABELS[domain],
      topic: row.topic,
      status: row.status,
      score: row.score === null ? null : Number(row.score),
      correctAnswers: Number(row.correct_answers ?? 0),
      totalQuestions,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
      savedAt: row.saved_at,
      weakTags: parseJsonArray(resultPayload.weakTags),
    } satisfies PracticeSessionSummary;
  });
}

async function loadPracticeSession(sessionId: string, userId: string): Promise<PracticeSessionPayload | null> {
  const row = await db.prepare(`
    SELECT id, domain, topic, status, questions, answers, score, correct_answers, time_spent_seconds, generated_at, completed_at, saved_at, result_payload
      FROM open_practice_sessions
     WHERE id = ? AND user_id = ?
  `).get<{
    id: string;
    domain: string;
    topic: string;
    status: string;
    questions: unknown;
    answers: unknown;
    score: number | null;
    correct_answers: number;
    time_spent_seconds: number | null;
    generated_at: string;
    completed_at: string | null;
    saved_at: string | null;
    result_payload: unknown;
  }>(sessionId, userId);
  if (!row) return null;

  const domain = toPracticeDomain(row.domain) || 'frontend';
  const questions = parsePracticeQuestions(row.questions);
  const resultPayload = parseJsonRecord(row.result_payload);

  return {
    id: row.id,
    domain,
    domainLabel: PRACTICE_DOMAIN_LABELS[domain],
    topic: row.topic,
    status: row.status,
    questions,
    answers: parsePracticeAnswers(row.answers),
    score: row.score === null ? null : Number(row.score),
    correctAnswers: Number(row.correct_answers ?? 0),
    totalQuestions: questions.length,
    timeSpentSeconds: row.time_spent_seconds === null ? null : Number(row.time_spent_seconds),
    generatedAt: row.generated_at,
    completedAt: row.completed_at,
    savedAt: row.saved_at,
    performanceLabel: typeof resultPayload.performanceLabel === 'string' ? resultPayload.performanceLabel : null,
    weakTags: parseJsonArray(resultPayload.weakTags),
    results: parsePracticeResults(resultPayload.results),
  } satisfies PracticeSessionPayload;
}

function buildPracticeSessionReport(questions: PracticeSessionQuestion[], answers: PracticeSessionAnswer[]) {
  const answersByQuestionId = new Map(answers.map((answer) => [answer.questionId, answer.answer]));
  const tagStats = new Map<string, { total: number; incorrect: number }>();

  const results = questions.map((question) => {
    const userAnswer = String(answersByQuestionId.get(question.id) ?? '').trim();
    const isCorrect = userAnswer ? isPracticeAnswerCorrect(question, userAnswer) : false;

    for (const tag of question.tags) {
      const existing = tagStats.get(tag) ?? { total: 0, incorrect: 0 };
      existing.total += 1;
      if (!isCorrect) existing.incorrect += 1;
      tagStats.set(tag, existing);
    }

    return {
      questionId: question.id,
      type: question.type,
      question: question.question,
      codeBlock: question.codeBlock,
      userAnswer,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      isCorrect,
      tags: question.tags,
    } satisfies PracticeSessionResult;
  });

  const correctAnswers = results.filter((result) => result.isCorrect).length;
  const totalQuestions = questions.length || 1;
  const score = Math.round((correctAnswers / totalQuestions) * 100);
  const weakTags = Array.from(tagStats.entries())
    .filter(([, stats]) => stats.incorrect > 0)
    .sort((left, right) => {
      if (right[1].incorrect !== left[1].incorrect) return right[1].incorrect - left[1].incorrect;
      if (right[1].total !== left[1].total) return right[1].total - left[1].total;
      return left[0].localeCompare(right[0]);
    })
    .slice(0, 8)
    .map(([tag]) => tag);

  const performanceLabel = score >= 85
    ? 'Strong recall and judgment'
    : score >= 70
      ? 'Solid, with a few weak spots'
      : score >= 50
        ? 'Needs another focused pass'
        : 'Rebuild the fundamentals';

  return {
    score,
    correctAnswers,
    performanceLabel,
    weakTags,
    results,
  };
}

async function validatePracticeTopicForDomain(userId: string, topic: string, domain: PracticeDomainId) {
  const mappedDomains = getPracticeTopicDomains(topic);
  if (mappedDomains?.length) {
    if (mappedDomains.includes(domain)) {
      return { valid: true as const };
    }

    const suggestedDomain = mappedDomains[0];
    return {
      valid: false as const,
      suggestedDomain,
      error: `${topic.trim()} is a ${formatPracticeDomainList(mappedDomains)} topic. You're currently in ${PRACTICE_DOMAIN_LABELS[domain]} mode. Switch to ${PRACTICE_DOMAIN_LABELS[suggestedDomain]} or search for a ${PRACTICE_DOMAIN_LABELS[domain]} topic instead.`,
    };
  }

  try {
    await checkAiRateLimit(userId, 'practice-domain-validation', 1);
    const classification = await callStructuredModel(
      'You classify whether a search topic is valid for an interview practice domain. Return only valid JSON.',
      JSON.stringify({
        topic,
        domain: PRACTICE_DOMAIN_LABELS[domain],
        schema: {
          valid: 'boolean',
          reason: 'string',
        },
      }),
      (payload) => {
        const source = parseJsonRecord(payload);
        return {
          valid: Boolean(source.valid),
          reason: String(source.reason ?? '').trim(),
        };
      },
      { maxTokens: 100, timeoutMs: 12000, model: 'deepseek/deepseek-chat', temperature: 0 },
    );
    if (classification.result.valid) return { valid: true as const };
    return {
      valid: false as const,
      suggestedDomain: null,
      error: classification.result.reason || `${topic.trim()} does not look like a strong ${PRACTICE_DOMAIN_LABELS[domain]} practice topic. Search for a different topic or switch domains.`,
    };
  } catch {
    return { valid: true as const };
  }
}

type ScenarioStepType = 'decision' | 'technical' | 'tradeoff' | 'communication';

type ScenarioStep = {
  stepNumber: number;
  question: string;
  type: ScenarioStepType;
  hint: string;
};

type ScenarioRecord = {
  id: string;
  userId: string | null;
  domain: ScenarioDomainId;
  topic: string;
  level: string;
  scenarioType: string;
  title: string;
  context: string;
  role: string;
  steps: ScenarioStep[];
  seed: string;
  questionHash: string;
  generatedAt: string;
};

type ScenarioStepFeedback = {
  aiUnavailable: boolean;
  score: number;
  feedback: string;
  whatWorked: string;
  whatWasMissed: string;
  seniorEngineerWouldSay: string;
};

type ScenarioAttemptAnswerRecord = {
  stepNumber: number;
  answer: string;
  feedback: ScenarioStepFeedback | null;
  updatedAt: string;
};

type StoredScenarioAttempt = {
  id: string;
  scenario: ScenarioRecord;
  status: string;
  startedAt: string;
  durationMinutes: number;
  completedAt: string | null;
  score: number;
  timeSpentSeconds: number | null;
  answers: ScenarioAttemptAnswerRecord[];
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
  results: Array<{
    questionId: string;
    topic: string;
    prompt: string;
    submittedAnswer: string | null;
    correctAnswer: string;
    explanation: string;
    isCorrect: boolean;
    score: number;
    observations: string[];
  }>;
};

const SCENARIO_STEP_TYPE_SET = new Set<ScenarioStepType>(['decision', 'technical', 'tradeoff', 'communication']);
const PREFERRED_SCENARIO_STEP_TYPE_SEQUENCE: ScenarioStepType[] = ['communication', 'technical', 'decision', 'technical', 'tradeoff'];

function formatScenarioStepTypeLabel(type: ScenarioStepType) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function buildScenarioStepId(scenarioId: string, stepNumber: number) {
  return `${scenarioId}:step-${stepNumber}`;
}

function buildScenarioQuestionHash(context: string, firstQuestion: string) {
  const normalized = normalizeScenarioTopic(`${context} ${firstQuestion}`).slice(0, 80);
  return hashText(normalized);
}

function parseScenarioSteps(value: unknown) {
  if (!Array.isArray(value)) return [] as ScenarioStep[];

  return value
    .map((item, index) => {
      const source = parseJsonRecord(item);
      const type = String(source.type ?? '').trim().toLowerCase() as ScenarioStepType;
      const stepNumber = Number(source.stepNumber ?? index + 1);
      const question = String(source.question ?? '').trim();
      const hint = String(source.hint ?? '').trim();
      if (!Number.isInteger(stepNumber) || stepNumber < 1 || !question || !hint || !SCENARIO_STEP_TYPE_SET.has(type)) {
        return null;
      }
      return {
        stepNumber,
        question,
        type,
        hint,
      } satisfies ScenarioStep;
    })
    .filter((item): item is ScenarioStep => Boolean(item))
    .sort((left, right) => left.stepNumber - right.stepNumber);
}

function normalizeScenarioStepTypeSequence(steps: ScenarioStep[]) {
  return steps.reduce<ScenarioStep[]>((normalized, step, index) => {
    const previousType = normalized[index - 1]?.type ?? null;
    const preferredType = PREFERRED_SCENARIO_STEP_TYPE_SEQUENCE[index] ?? 'technical';
    let nextType = step.type;

    if (index === steps.length - 1 && nextType !== 'tradeoff' && nextType !== 'decision') {
      nextType = preferredType;
    }

    if (previousType && nextType === previousType) {
      nextType = preferredType;
    }

    if (previousType && nextType === previousType) {
      nextType = PREFERRED_SCENARIO_STEP_TYPE_SEQUENCE.find((candidate) => candidate !== previousType)
        ?? 'tradeoff';
    }

    normalized.push({
      ...step,
      type: nextType,
    });
    return normalized;
  }, []);
}

function normalizeGeneratedScenarioPayload(
  payload: unknown,
  domain: ScenarioDomainId,
  topic: string,
  level: string,
  scenarioType: string,
) {
  const source = parseJsonRecord(payload);
  const title = String(source.title ?? '').trim();
  const context = String(source.context ?? '').trim();
  const role = String(source.role ?? '').trim();
  const steps = normalizeScenarioStepTypeSequence(parseScenarioSteps(source.steps));

  if (!title) throw new Error('scenario_validation_failed:title');
  if (!context) throw new Error('scenario_validation_failed:context');
  if (!role) throw new Error('scenario_validation_failed:role');
  if (steps.length !== 5) throw new Error(`scenario_validation_failed:steps:${steps.length}`);
  for (let index = 1; index < steps.length; index += 1) {
    if (steps[index].type === steps[index - 1].type) {
      throw new Error(`scenario_validation_failed:consecutive_step_type:${steps[index].type}`);
    }
  }

  return {
    title,
    domain,
    topic,
    level,
    context,
    role,
    steps,
    scenarioType,
  };
}

function fallbackScenarioStepFeedback(answer: string, topic: string, question: string): ScenarioStepFeedback {
  const words = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = words >= 90 ? 8 : words >= 45 ? 6 : 4;
  return {
    aiUnavailable: true,
    score,
    feedback: 'Saved locally because the AI evaluator was unavailable. Strong scenario answers stay specific to the step, name the constraint, and justify the next action.',
    whatWorked: words >= 45 ? 'You gave enough substance to show a direction and some context.' : 'You identified a plausible starting point.',
    whatWasMissed: 'Make the tradeoff, risk, and validation signal explicit for this exact step.',
    seniorEngineerWouldSay: `For ${topic}, I would answer "${question}" by naming the concrete tradeoff, the immediate risk, and the exact signal I would check before committing to a change.`,
  };
}

function normalizeScenarioStepFeedbackPayload(payload: unknown): ScenarioStepFeedback {
  const source = parseJsonRecord(payload);
  return {
    aiUnavailable: Boolean(source.aiUnavailable),
    score: clampScore(source.score, 6),
    feedback: String(source.feedback ?? 'Scenario step recorded.'),
    whatWorked: String(source.whatWorked ?? 'The answer identified a concrete direction.'),
    whatWasMissed: String(source.whatWasMissed ?? 'Add a clearer tradeoff, constraint, and validation step.'),
    seniorEngineerWouldSay: String(
      source.seniorEngineerWouldSay
      ?? source.seniorEngineerWouldHaveSaid
      ?? 'A stronger senior answer would stay tightly tied to this topic and step, rather than falling back to a generic incident response.',
    ),
  };
}

function mapScenarioRow(row: {
  id: string;
  user_id: string | null;
  domain: string;
  topic: string;
  level: string;
  scenario_type: string;
  title: string;
  context: string;
  role: string;
  steps: unknown;
  seed: string | null;
  question_hash: string | null;
  generated_at: string;
}): ScenarioRecord {
  return {
    id: row.id,
    userId: row.user_id,
    domain: toScenarioDomain(row.domain) || 'frontend',
    topic: row.topic,
    level: row.level,
    scenarioType: row.scenario_type,
    title: row.title,
    context: row.context,
    role: row.role,
    steps: parseScenarioSteps(row.steps),
    seed: row.seed ?? '',
    questionHash: row.question_hash ?? '',
    generatedAt: row.generated_at,
  };
}

async function loadScenarioById(userId: string, scenarioId: string) {
  const rows = await db.query<{
    id: string;
    user_id: string | null;
    domain: string;
    topic: string;
    level: string;
    scenario_type: string;
    title: string;
    context: string;
    role: string;
    steps: unknown;
    seed: string | null;
    question_hash: string | null;
    generated_at: string;
  }>(
    `SELECT id, user_id, domain, topic, level, scenario_type, title, context, role, steps, seed, question_hash, generated_at
       FROM scenarios
      WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
      LIMIT 1`,
    [scenarioId, userId],
  );
  return rows[0] ? mapScenarioRow(rows[0]) : null;
}

function buildScenarioAttemptResults(scenario: ScenarioRecord, answers: ScenarioAttemptAnswerRecord[]) {
  const answersByStep = new Map(answers.map((answer) => [answer.stepNumber, answer]));
  const results = scenario.steps.map((step) => {
    const savedAnswer = answersByStep.get(step.stepNumber);
    const feedback = savedAnswer?.feedback ?? fallbackScenarioStepFeedback(savedAnswer?.answer ?? '', scenario.topic, step.question);
    const normalizedScore = savedAnswer?.answer ? clampScore(feedback.score, 5) * 10 : 0;
    return {
      questionId: buildScenarioStepId(scenario.id, step.stepNumber),
      topic: `Step ${step.stepNumber} · ${formatScenarioStepTypeLabel(step.type)}`,
      prompt: step.question,
      submittedAnswer: savedAnswer?.answer ?? null,
      correctAnswer: feedback.seniorEngineerWouldSay,
      explanation: [feedback.feedback, feedback.whatWorked, feedback.whatWasMissed].filter(Boolean).join(' '),
      isCorrect: normalizedScore >= 70,
      score: normalizedScore,
      observations: [feedback.whatWorked, feedback.whatWasMissed].filter(Boolean),
    };
  });

  const score = results.length
    ? Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length)
    : 0;
  const weakResults = [...results].sort((left, right) => left.score - right.score).slice(0, 3);
  const focusAreas = weakResults.map((result) => result.topic);
  const nextSteps = weakResults.length
    ? weakResults.map((result) => `Redo ${result.topic.toLowerCase()} and make the tradeoff, risk, and validation signal explicit before answering.`)
    : [
      `Generate a fresh ${scenario.topic} scenario with a different angle to keep your reasoning sharp.`,
      'Tighten one answer by making the business constraint explicit before you propose the action.',
      'Practice saying the validation signal out loud before your final recommendation.',
    ];

  return {
    results,
    score,
    correctAnswers: results.filter((result) => result.isCorrect).length,
    focusAreas,
    nextSteps,
    summary: `Scenario round on ${scenario.topic} scored ${score}% across ${results.length} evaluated steps.`,
  };
}

async function loadScenarioAttempt(userId: string, attemptId: string) {
  const rows = await db.query<{
    attempt_id: string;
    status: string;
    started_at: string;
    duration_minutes: number;
    completed_at: string | null;
    score: number;
    time_spent_seconds: number | null;
    result_payload: unknown;
    scenario_id: string;
    user_id: string | null;
    domain: string;
    topic: string;
    level: string;
    scenario_type: string;
    title: string;
    context: string;
    role: string;
    steps: unknown;
    seed: string | null;
    question_hash: string | null;
    generated_at: string;
  }>(
    `SELECT
        sa.id AS attempt_id,
        sa.status,
        sa.started_at,
        sa.duration_minutes,
        sa.completed_at,
        sa.score,
        sa.time_spent_seconds,
        sa.result_payload,
        s.id AS scenario_id,
        s.user_id,
        s.domain,
        s.topic,
        s.level,
        s.scenario_type,
        s.title,
        s.context,
        s.role,
        s.steps,
        s.seed,
        s.question_hash,
        s.generated_at
      FROM scenario_attempts sa
      JOIN scenarios s ON s.id = sa.scenario_id
     WHERE sa.id = $1 AND sa.user_id = $2
     LIMIT 1`,
    [attemptId, userId],
  );
  const row = rows[0];
  if (!row) return null;

  const scenario = mapScenarioRow({
    id: row.scenario_id,
    user_id: row.user_id,
    domain: row.domain,
    topic: row.topic,
    level: row.level,
    scenario_type: row.scenario_type,
    title: row.title,
    context: row.context,
    role: row.role,
    steps: row.steps,
    seed: row.seed,
    question_hash: row.question_hash,
    generated_at: row.generated_at,
  });
  const answerRows = await db.query<{
    step_number: number;
    user_answer: string;
    feedback_payload: unknown;
    updated_at: string;
  }>(
    `SELECT step_number, user_answer, feedback_payload, updated_at
       FROM scenario_step_answers
      WHERE attempt_id = $1
      ORDER BY step_number ASC`,
    [attemptId],
  );
  const answers = answerRows.map((answerRow) => ({
    stepNumber: Number(answerRow.step_number),
    answer: answerRow.user_answer,
    feedback: Object.keys(parseJsonRecord(answerRow.feedback_payload)).length
      ? normalizeScenarioStepFeedbackPayload(answerRow.feedback_payload)
      : null,
    updatedAt: answerRow.updated_at,
  }));
  const resultPayload = parseJsonRecord(row.result_payload);
  const computed = buildScenarioAttemptResults(scenario, answers);
  const storedResults = Array.isArray(resultPayload.results)
    ? resultPayload.results.map((item) => parseJsonRecord(item)).map((item) => ({
      questionId: String(item.questionId ?? ''),
      topic: String(item.topic ?? ''),
      prompt: String(item.prompt ?? ''),
      submittedAnswer: item.submittedAnswer === null ? null : String(item.submittedAnswer ?? ''),
      correctAnswer: String(item.correctAnswer ?? ''),
      explanation: String(item.explanation ?? ''),
      isCorrect: Boolean(item.isCorrect),
      score: Number(item.score ?? 0),
      observations: parseJsonArray(item.observations),
    }))
    : computed.results;

  return {
    id: row.attempt_id,
    scenario,
    status: row.status,
    startedAt: row.started_at,
    durationMinutes: Number(row.duration_minutes ?? 30),
    completedAt: row.completed_at,
    score: Number(row.score ?? resultPayload.score ?? computed.score ?? 0),
    timeSpentSeconds: row.time_spent_seconds === null ? null : Number(row.time_spent_seconds),
    answers,
    summary: String(resultPayload.summary ?? computed.summary),
    focusAreas: Array.isArray(resultPayload.focusAreas) ? resultPayload.focusAreas.map(String) : computed.focusAreas,
    nextSteps: Array.isArray(resultPayload.nextSteps) ? resultPayload.nextSteps.map(String) : computed.nextSteps,
    results: storedResults,
  } satisfies StoredScenarioAttempt;
}

function toStoredRoundAttemptFromScenarioAttempt(attempt: StoredScenarioAttempt) {
  const domainLabel = SCENARIO_DOMAIN_LABELS[attempt.scenario.domain];
  const questions = attempt.scenario.steps.map((step) => ({
    id: buildScenarioStepId(attempt.scenario.id, step.stepNumber),
    domain: attempt.scenario.domain,
    domainLabel,
    topic: attempt.scenario.topic,
    type: 'scenario' as const,
    difficulty: 2 as const,
    questionText: step.question,
    correctAnswer: step.hint,
    explanation: attempt.scenario.context,
    tags: [attempt.scenario.topic, step.type, attempt.scenario.scenarioType],
    timeLimitMinutes: Math.max(4, Math.floor(attempt.durationMinutes / Math.max(attempt.scenario.steps.length, 1))),
  }));
  const answers = attempt.scenario.steps.map((step) => {
    const saved = attempt.answers.find((answer) => answer.stepNumber === step.stepNumber);
    return {
      questionId: buildScenarioStepId(attempt.scenario.id, step.stepNumber),
      selectedAnswer: saved?.answer ?? null,
      notes: saved?.answer ?? null,
    };
  });

  return {
    id: attempt.id,
    roundType: 'scenario-round',
    questionType: 'scenario',
    domain: attempt.scenario.domain,
    status: attempt.status,
    durationMinutes: attempt.durationMinutes,
    totalQuestions: attempt.scenario.steps.length,
    correctAnswers: attempt.results.filter((result) => result.isCorrect).length,
    score: attempt.score,
    timeSpentSeconds: attempt.timeSpentSeconds,
    startedAt: attempt.startedAt,
    submittedAt: attempt.completedAt,
    expiresAt: new Date(new Date(attempt.startedAt).getTime() + (attempt.durationMinutes * 60 * 1000)).toISOString(),
    summary: attempt.summary,
    focusAreas: attempt.focusAreas,
    nextSteps: attempt.nextSteps,
    questions,
    answers,
    results: attempt.results,
  };
}

async function getLatestScenarioAttempt(userId: string, domain?: ScenarioDomainId) {
  const params: unknown[] = [userId];
  const domainClause = domain ? 'AND s.domain = $2' : '';
  if (domain) params.push(domain);
  const rows = await db.query<{ attempt_id: string }>(
    `SELECT sa.id AS attempt_id
       FROM scenario_attempts sa
       JOIN scenarios s ON s.id = sa.scenario_id
      WHERE sa.user_id = $1 ${domainClause}
      ORDER BY COALESCE(sa.completed_at, sa.started_at) DESC, sa.started_at DESC
      LIMIT 1`,
    params,
  );
  return rows[0] ? loadScenarioAttempt(userId, rows[0].attempt_id) : null;
}

async function listScenarioOverview(userId: string, domain: ScenarioDomainId) {
  const rows = await db.query<{
    attempt_id: string;
    scenario_id: string;
    topic: string;
    title: string;
    status: string;
    score: number;
    generated_at: string;
    completed_at: string | null;
    step_count: number;
  }>(
    `SELECT
        sa.id AS attempt_id,
        s.id AS scenario_id,
        s.topic,
        s.title,
        sa.status,
        sa.score,
        s.generated_at,
        sa.completed_at,
        jsonb_array_length(s.steps) AS step_count
      FROM scenario_attempts sa
      JOIN scenarios s ON s.id = sa.scenario_id
     WHERE sa.user_id = $1 AND s.domain = $2
     ORDER BY COALESCE(sa.completed_at, sa.started_at) DESC, sa.started_at DESC
     LIMIT 12`,
    [userId, domain],
  );

  return {
    domain,
    suggestedTopics: getScenarioTagCloud(domain),
    history: rows.map((row) => ({
      attemptId: row.attempt_id,
      scenarioId: row.scenario_id,
      topic: row.topic,
      title: row.title,
      status: row.status,
      score: Number.isFinite(Number(row.score)) ? Number(row.score) : null,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
      stepCount: Math.max(0, Number(row.step_count ?? 0)),
    })),
  };
}

async function pickScenarioAngle(userId: string, domain: ScenarioDomainId, topic: string, existingScenarioCount: number) {
  const moduleKey = `scenario:${normalizeScenarioTopic(topic)}`;
  const rows = await db.query<{ angle: string }>(
    `SELECT angle
       FROM question_angle_history
      WHERE user_id = $1 AND domain = $2 AND module_key = $3
      ORDER BY used_at DESC
      LIMIT 7`,
    [userId, domain, moduleKey],
  );
  const recentAngles = rows.map((row) => row.angle);
  if (existingScenarioCount < 3) {
    return SCENARIO_ANGLES[existingScenarioCount % SCENARIO_ANGLES.length];
  }
  return SCENARIO_ANGLES.find((angle) => !recentAngles.slice(0, 3).includes(angle)) ?? SCENARIO_ANGLES[existingScenarioCount % SCENARIO_ANGLES.length];
}

async function recordScenarioAngle(userId: string, domain: ScenarioDomainId, topic: string, angle: string) {
  const moduleKey = `scenario:${normalizeScenarioTopic(topic)}`;
  await db.prepare(`
    INSERT INTO question_angle_history (id, user_id, domain, module_key, angle, first_used_at, used_at)
    VALUES (?, ?, ?, ?, ?, NOW(), NOW())
    ON CONFLICT (user_id, domain, module_key, angle)
    DO UPDATE SET used_at = NOW()
  `).run(crypto.randomUUID(), userId, domain, moduleKey, angle);
}

async function validateScenarioTopicForDomain(userId: string, topic: string, domain: ScenarioDomainId) {
  const mappedDomains = findScenarioTopicDomains(topic);
  if (mappedDomains?.length) {
    if (mappedDomains.includes(domain)) {
      return { valid: true as const };
    }
  }

  if (!mappedDomains?.length) {
    return { valid: true as const };
  }

  try {
    await checkAiRateLimit(userId, 'scenario-domain-validation', 1);
    const classification = await callStructuredModel(
      'You answer a domain-fit classifier with a single yes or no only. No JSON. No punctuation. No explanation.',
      `Is ${topic.trim()} a valid topic for a ${SCENARIO_DOMAIN_LABELS[domain]} engineer to practice? Reply only yes or no.`,
      (payload) => {
        const normalized = typeof payload === 'string'
          ? payload.trim().toLowerCase()
          : String(payload ?? '').trim().toLowerCase();
        return normalized.startsWith('yes') ? 'yes' : 'no';
      },
      { maxTokens: 100, timeoutMs: 12000, model: 'deepseek/deepseek-chat', temperature: 0 },
    );
    if (classification.result === 'yes') return { valid: true as const };
    return {
      valid: false as const,
      suggestedDomain: mappedDomains[0] ?? null,
      error: `This topic doesn't seem to fall under ${SCENARIO_DOMAIN_LABELS[domain]}. Try a topic relevant to your domain.`,
    };
  } catch {
    return { valid: true as const };
  }
}

async function generateScenarioForTopic(params: {
  userId: string;
  domain: ScenarioDomainId;
  topic: string;
  level: string;
  abortSignal?: AbortSignal;
}) {
  const seenRows = await db.query<{ question_hash: string; scenario_type: string }>(
    `SELECT question_hash, scenario_type
       FROM scenarios
      WHERE user_id = $1 AND domain = $2 AND topic = $3
      ORDER BY generated_at DESC
      LIMIT 6`,
    [params.userId, params.domain, params.topic],
  );
  const seenHashes = new Set(seenRows.map((row) => String(row.question_hash ?? '')).filter(Boolean));
  const additionalAvoidHashes: string[] = [];
  const scenarioType = await pickScenarioAngle(params.userId, params.domain, params.topic, seenRows.length);
  const repoContext = await getLatestRepoContext(params.userId);
  let lastError = 'unknown';

  for (let attempt = 1; attempt <= SCENARIO_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    await checkAiRateLimit(params.userId, 'scenario-generation', 1);
    const seed = hashText(`${params.userId}:${params.topic}:${Date.now()}:scenario:${attempt}`).slice(0, 20);
    const startedAt = Date.now();
    console.log('[scenario-gen] start', {
      topic: params.topic,
      domain: params.domain,
      userId: params.userId,
      attempt,
      scenarioType,
    });
    try {
      const systemPrompt = `You are a senior ${SCENARIO_DOMAIN_LABELS[params.domain]} engineer creating a realistic workplace scenario for interview preparation. The scenario must reflect real engineering situations. Return only valid JSON. Start with { and end with }. No markdown fences. No preamble.`;
      const seenHashList = JSON.stringify([...seenHashes, ...additionalAvoidHashes]);
      const userPrompt = `Domain: ${SCENARIO_DOMAIN_LABELS[params.domain]}. Topic: ${params.topic}. Level: ${params.level}. Repo context: ${repoContext || 'none'}. Session seed: ${seed}. Preferred scenario angle: ${scenarioType}. Avoid hashes: ${seenHashList}. Generate a scenario with exactly 5 steps. Return JSON: { id: string, title: string, domain: string, topic: string, level: string, context: string, role: string, steps: [ { stepNumber: number, question: string, type: 'decision' | 'technical' | 'tradeoff' | 'communication', hint: string } ] }. Rules: the context must be specific to ${params.topic} - not generic. Steps must escalate in complexity - step 1 is situational awareness, step 5 is a hard tradeoff or architectural decision. Use this step-type pattern unless the scenario strongly requires a different one: step 1 communication, step 2 technical, step 3 decision, step 4 technical, step 5 tradeoff. Never repeat the same step type consecutively. The scenario must feel like a real conversation with a senior engineer, not a quiz. If a similar scenario hash appears in Avoid hashes, generate a different angle on the same topic.`;

      const generated = await callStructuredModel(
        systemPrompt,
        userPrompt,
        (payload) => normalizeGeneratedScenarioPayload(payload, params.domain, params.topic, params.level, scenarioType),
        {
          abortSignal: params.abortSignal,
          maxTokens: SCENARIO_GENERATION_MAX_TOKENS,
          timeoutMs: SCENARIO_GENERATION_TIMEOUT_MS,
          model: SCENARIO_GENERATION_MODEL,
          temperature: SCENARIO_GENERATION_TEMPERATURE,
        },
      );

      const questionHash = buildScenarioQuestionHash(generated.result.context, generated.result.steps[0]?.question ?? '');
      if (seenHashes.has(questionHash) || additionalAvoidHashes.includes(questionHash)) {
        lastError = 'scenario_duplicate_hash';
        additionalAvoidHashes.push(questionHash);
        console.warn('[scenario-gen] duplicate-hash', {
          topic: params.topic,
          domain: params.domain,
          attempt,
          questionHash,
        });
        continue;
      }

      const scenarioId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO scenarios (
          id, user_id, domain, topic, level, scenario_type, title, context, role, steps, seed, question_hash, status, generated_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?, ?, 'active', NOW(), NOW(), NOW()
        )
      `).run(
        scenarioId,
        params.userId,
        params.domain,
        params.topic,
        params.level,
        scenarioType,
        generated.result.title,
        generated.result.context,
        generated.result.role,
        JSON.stringify(generated.result.steps),
        seed,
        questionHash,
      );
      await db.prepare(`
        INSERT INTO question_history (id, user_id, domain, round_type, question_hash, question_text, seen_at)
        VALUES (?, ?, ?, 'scenario', ?, ?, NOW())
        ON CONFLICT (user_id, domain, round_type, question_hash) DO NOTHING
      `).run(
        crypto.randomUUID(),
        params.userId,
        params.domain,
        questionHash,
        `${generated.result.context}\n${generated.result.steps[0]?.question ?? ''}`,
      );
      await recordScenarioAngle(params.userId, params.domain, params.topic, scenarioType);

      console.log('[scenario-gen] done', {
        topic: params.topic,
        domain: params.domain,
        attempt,
        scenarioId,
        rawLength: generated.rawLength,
        durationMs: Date.now() - startedAt,
      });

      const scenario = await loadScenarioById(params.userId, scenarioId);
      if (!scenario) throw new Error('scenario_load_failed');
      return scenario;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const rawText = typeof (error as { rawResponse?: unknown }).rawResponse === 'string'
        ? String((error as { rawResponse?: unknown }).rawResponse)
        : '';
      console.error('[scenario-gen] failed', {
        topic: params.topic,
        domain: params.domain,
        attempt,
        error: lastError,
        rawLength: rawText.length,
        rawPreview: rawText.slice(0, 400),
        rawTail: rawText.slice(-200),
      });
    }
  }

  throw new Error(`aiUnavailable: Unable to generate a fresh scenario right now. Last error: ${lastError}`);
}

type SingleScenarioType = 'decision' | 'technical' | 'tradeoff' | 'communication';

type SingleScenarioRecord = {
  id: string;
  userId: string | null;
  domain: ScenarioDomainId;
  topic: string;
  level: string;
  scenarioType: string;
  title: string;
  context: string;
  role: string;
  question: string;
  type: SingleScenarioType;
  hint: string;
  seed: string;
  questionHash: string;
  generatedAt: string;
};

type SingleScenarioEvaluation = {
  aiUnavailable: boolean;
  score: number;
  feedback: string;
  whatWorked: string;
  whatWasMissed: string;
  seniorEngineerWouldSay: string;
};

type SingleScenarioAttempt = {
  id: string;
  scenario: SingleScenarioRecord;
  status: string;
  startedAt: string;
  durationMinutes: number;
  completedAt: string | null;
  score: number | null;
  timeSpentSeconds: number | null;
  answer: string;
  evaluation: SingleScenarioEvaluation | null;
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
};

type ScenarioResultsAttemptPayload = ReturnType<typeof buildScenarioResultsPayload>;

function normalizeSingleScenarioType(value: unknown): SingleScenarioType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'decision' || normalized === 'technical' || normalized === 'tradeoff' || normalized === 'communication') {
    return normalized;
  }
  return 'technical';
}

function readLegacyScenarioPrompt(steps: unknown) {
  const firstStep = parseScenarioSteps(steps)[0];
  return {
    question: String(firstStep?.question ?? '').trim(),
    type: normalizeSingleScenarioType(firstStep?.type ?? 'technical'),
    hint: String(firstStep?.hint ?? '').trim(),
  };
}

function mapSingleScenarioRow(row: {
  id: string;
  user_id: string | null;
  domain: string;
  topic: string;
  level: string;
  scenario_type: string;
  title: string;
  context: string;
  role: string;
  question: string | null;
  question_type: string | null;
  hint: string | null;
  steps?: unknown;
  seed: string | null;
  question_hash: string | null;
  generated_at: string;
}): SingleScenarioRecord {
  const legacyPrompt = readLegacyScenarioPrompt(row.steps);
  return {
    id: row.id,
    userId: row.user_id,
    domain: toScenarioDomain(row.domain) || 'frontend',
    topic: row.topic,
    level: row.level,
    scenarioType: row.scenario_type,
    title: row.title,
    context: row.context,
    role: row.role,
    question: String(row.question ?? '').trim() || legacyPrompt.question || 'Describe how you would approach this scenario end to end.',
    type: normalizeSingleScenarioType(row.question_type ?? legacyPrompt.type),
    hint: String(row.hint ?? '').trim() || legacyPrompt.hint,
    seed: row.seed ?? '',
    questionHash: row.question_hash ?? '',
    generatedAt: row.generated_at,
  };
}

async function loadSingleScenarioById(userId: string, scenarioId: string) {
  const rows = await db.query<{
    id: string;
    user_id: string | null;
    domain: string;
    topic: string;
    level: string;
    scenario_type: string;
    title: string;
    context: string;
    role: string;
    question: string | null;
    question_type: string | null;
    hint: string | null;
    steps: unknown;
    seed: string | null;
    question_hash: string | null;
    generated_at: string;
  }>(
    `SELECT id, user_id, domain, topic, level, scenario_type, title, context, role, question, question_type, hint, steps, seed, question_hash, generated_at
       FROM scenarios
      WHERE id = $1 AND (user_id IS NULL OR user_id = $2)
      LIMIT 1`,
    [scenarioId, userId],
  );
  return rows[0] ? mapSingleScenarioRow(rows[0]) : null;
}

function normalizeGeneratedSingleScenarioPayload(
  payload: unknown,
  domain: ScenarioDomainId,
  topic: string,
  level: string,
  scenarioType: string,
) {
  const source = parseJsonRecord(payload);
  const title = String(source.title ?? '').trim();
  const context = String(source.context ?? '').trim();
  const role = String(source.role ?? '').trim();
  const question = String(source.question ?? '').trim();
  const type = normalizeSingleScenarioType(source.type ?? 'technical');
  const hint = String(source.hint ?? '').trim();

  if (!title) throw new Error('scenario_validation_failed:title');
  if (!context) throw new Error('scenario_validation_failed:context');
  if (!role) throw new Error('scenario_validation_failed:role');
  if (!question || question.length < 80) throw new Error('scenario_validation_failed:question');
  if (!hint) throw new Error('scenario_validation_failed:hint');

  return {
    title,
    domain,
    topic,
    level,
    context,
    role,
    question,
    type,
    hint,
    scenarioType,
  };
}

function fallbackSingleScenarioEvaluation(answer: string, scenario: SingleScenarioRecord): SingleScenarioEvaluation {
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const score = wordCount >= 150 ? 8 : wordCount >= 100 ? 6 : wordCount >= 50 ? 4 : 2;
  return {
    aiUnavailable: true,
    score,
    feedback: 'Your answer was saved, but the evaluator was unavailable. Strong scenario answers stay anchored to the exact context, surface the tradeoff clearly, and explain how you would validate the outcome.',
    whatWorked: wordCount >= 100
      ? 'You provided enough detail to show a concrete plan and some engineering judgment.'
      : 'You identified a plausible direction for the scenario.',
    whatWasMissed: 'Make the business constraint, engineering tradeoff, and validation signal explicit for this specific scenario.',
    seniorEngineerWouldSay: `For ${scenario.topic}, I would answer by stating the immediate constraint, the technical tradeoff I am choosing, the risk I am accepting, and the exact signal I would watch to prove the decision is working.`,
  };
}

function normalizeSingleScenarioEvaluationPayload(payload: unknown): SingleScenarioEvaluation {
  const source = parseJsonRecord(payload);
  return {
    aiUnavailable: Boolean(source.aiUnavailable),
    score: clampScore(source.score, 6),
    feedback: String(source.feedback ?? 'Scenario answer recorded.'),
    whatWorked: String(source.whatWorked ?? 'The answer identified a concrete direction.'),
    whatWasMissed: String(source.whatWasMissed ?? 'Add a clearer tradeoff, risk, and validation step.'),
    seniorEngineerWouldSay: String(
      source.seniorEngineerWouldSay
      ?? source.seniorEngineerWouldHaveSaid
      ?? 'A stronger senior answer would tie the recommendation directly to the scenario context and the engineering tradeoff being made.',
    ),
  };
}

function buildScenarioResultsPayload(scenario: SingleScenarioRecord, answer: string, evaluation: SingleScenarioEvaluation | null) {
  const resolvedEvaluation = evaluation ?? fallbackSingleScenarioEvaluation(answer, scenario);
  const normalizedScore = clampScore(resolvedEvaluation.score, 5);
  const focusAreas = [scenario.topic, formatScenarioStepTypeLabel(resolvedEvaluation.score >= 6 ? 'tradeoff' : scenario.type)].slice(0, 2);
  const nextSteps = [
    `Retry a ${scenario.topic} scenario and make the tradeoff explicit before recommending the action.`,
    'State the validation signal you would watch after the change is shipped.',
    'Name the risk you are accepting so the answer sounds deliberate instead of generic.',
  ];

  return {
    score: normalizedScore,
    summary: `Scenario round on ${scenario.topic} scored ${normalizedScore}/10.`,
    focusAreas,
    nextSteps,
    evaluation: resolvedEvaluation,
  };
}

async function loadSingleScenarioAttempt(userId: string, attemptId: string) {
  const rows = await db.query<{
    attempt_id: string;
    status: string;
    started_at: string;
    duration_minutes: number;
    completed_at: string | null;
    score: number;
    time_spent_seconds: number | null;
    result_payload: unknown;
    scenario_id: string;
    user_id: string | null;
    domain: string;
    topic: string;
    level: string;
    scenario_type: string;
    title: string;
    context: string;
    role: string;
    question: string | null;
    question_type: string | null;
    hint: string | null;
    steps: unknown;
    seed: string | null;
    question_hash: string | null;
    generated_at: string;
  }>(
    `SELECT
        sa.id AS attempt_id,
        sa.status,
        sa.started_at,
        sa.duration_minutes,
        sa.completed_at,
        sa.score,
        sa.time_spent_seconds,
        sa.result_payload,
        s.id AS scenario_id,
        s.user_id,
        s.domain,
        s.topic,
        s.level,
        s.scenario_type,
        s.title,
        s.context,
        s.role,
        s.question,
        s.question_type,
        s.hint,
        s.steps,
        s.seed,
        s.question_hash,
        s.generated_at
      FROM scenario_attempts sa
      JOIN scenarios s ON s.id = sa.scenario_id
     WHERE sa.id = $1 AND sa.user_id = $2
     LIMIT 1`,
    [attemptId, userId],
  );
  const row = rows[0];
  if (!row) return null;

  const scenario = mapSingleScenarioRow({
    id: row.scenario_id,
    user_id: row.user_id,
    domain: row.domain,
    topic: row.topic,
    level: row.level,
    scenario_type: row.scenario_type,
    title: row.title,
    context: row.context,
    role: row.role,
    question: row.question,
    question_type: row.question_type,
    hint: row.hint,
    steps: row.steps,
    seed: row.seed,
    question_hash: row.question_hash,
    generated_at: row.generated_at,
  });

  const answerRow = await db.queryOne<{
    user_answer: string;
    feedback_payload: unknown;
    updated_at: string;
  }>(
    `SELECT user_answer, feedback_payload, updated_at
       FROM scenario_step_answers
      WHERE attempt_id = $1
      ORDER BY updated_at DESC
      LIMIT 1`,
    [attemptId],
  );

  const resultPayload = parseJsonRecord(row.result_payload);
  const answer = String(answerRow?.user_answer ?? resultPayload.answer ?? '').trim();
  const evaluationSource = answerRow && Object.keys(parseJsonRecord(answerRow.feedback_payload)).length
    ? answerRow.feedback_payload
    : resultPayload.evaluation;
  const evaluation = evaluationSource ? normalizeSingleScenarioEvaluationPayload(evaluationSource) : null;
  const computed = answer || evaluation ? buildScenarioResultsPayload(scenario, answer, evaluation) : null;
  const storedScore = Number(resultPayload.score ?? row.score ?? 0);
  const score = Number.isFinite(storedScore) && storedScore > 0
    ? clampScore(storedScore, computed?.score ?? 5)
    : (computed?.score ?? null);

  return {
    id: row.attempt_id,
    scenario,
    status: row.status,
    startedAt: row.started_at,
    durationMinutes: Number(row.duration_minutes ?? 30),
    completedAt: row.completed_at,
    score,
    timeSpentSeconds: row.time_spent_seconds === null ? null : Number(row.time_spent_seconds),
    answer,
    evaluation: computed?.evaluation ?? null,
    summary: String(resultPayload.summary ?? computed?.summary ?? ''),
    focusAreas: Array.isArray(resultPayload.focusAreas) ? resultPayload.focusAreas.map(String) : (computed?.focusAreas ?? []),
    nextSteps: Array.isArray(resultPayload.nextSteps) ? resultPayload.nextSteps.map(String) : (computed?.nextSteps ?? []),
  } satisfies SingleScenarioAttempt;
}

function toStoredRoundAttemptFromSingleScenarioAttempt(attempt: SingleScenarioAttempt) {
  const domainLabel = SCENARIO_DOMAIN_LABELS[attempt.scenario.domain];
  const normalizedScore = (attempt.score ?? 0) * 10;
  const questionId = `${attempt.scenario.id}:question`;

  return {
    id: attempt.id,
    roundType: 'scenario-round',
    questionType: 'scenario',
    domain: attempt.scenario.domain,
    status: attempt.status,
    durationMinutes: attempt.durationMinutes,
    totalQuestions: 1,
    correctAnswers: normalizedScore >= 80 ? 1 : 0,
    score: normalizedScore,
    timeSpentSeconds: attempt.timeSpentSeconds,
    startedAt: attempt.startedAt,
    submittedAt: attempt.completedAt,
    expiresAt: new Date(new Date(attempt.startedAt).getTime() + (attempt.durationMinutes * 60 * 1000)).toISOString(),
    summary: attempt.summary,
    focusAreas: attempt.focusAreas,
    nextSteps: attempt.nextSteps,
    questions: [{
      id: questionId,
      domain: attempt.scenario.domain,
      domainLabel,
      topic: attempt.scenario.topic,
      type: 'scenario' as const,
      difficulty: 2 as const,
      questionText: attempt.scenario.question,
      correctAnswer: attempt.evaluation?.seniorEngineerWouldSay ?? attempt.scenario.hint,
      explanation: attempt.scenario.context,
      tags: [attempt.scenario.topic, attempt.scenario.type, attempt.scenario.role],
      timeLimitMinutes: attempt.durationMinutes,
    }],
    answers: [{
      questionId,
      selectedAnswer: attempt.answer || null,
      notes: attempt.answer || null,
    }],
    results: [{
      questionId,
      topic: attempt.scenario.topic,
      prompt: attempt.scenario.question,
      submittedAnswer: attempt.answer || null,
      correctAnswer: attempt.evaluation?.seniorEngineerWouldSay ?? attempt.scenario.hint,
      explanation: [attempt.evaluation?.feedback, attempt.evaluation?.whatWorked, attempt.evaluation?.whatWasMissed].filter(Boolean).join(' '),
      isCorrect: normalizedScore >= 80,
      score: normalizedScore,
      observations: [attempt.evaluation?.whatWorked, attempt.evaluation?.whatWasMissed].filter(Boolean) as string[],
    }],
  };
}

function toScenarioResultAttemptPayload(attempt: SingleScenarioAttempt) {
  return {
    ...toStoredRoundAttemptFromSingleScenarioAttempt(attempt),
    scenario: {
      id: attempt.scenario.id,
      title: attempt.scenario.title,
      topic: attempt.scenario.topic,
      domain: attempt.scenario.domain,
      domainLabel: SCENARIO_DOMAIN_LABELS[attempt.scenario.domain],
      context: attempt.scenario.context,
      role: attempt.scenario.role,
      question: attempt.scenario.question,
      type: attempt.scenario.type,
      hint: attempt.scenario.hint,
      score: attempt.score,
      answer: attempt.answer,
      feedback: attempt.evaluation?.feedback ?? '',
      whatWorked: attempt.evaluation?.whatWorked ?? '',
      whatWasMissed: attempt.evaluation?.whatWasMissed ?? '',
      seniorEngineerWouldSay: attempt.evaluation?.seniorEngineerWouldSay ?? '',
      startedAt: attempt.startedAt,
      completedAt: attempt.completedAt,
    },
  };
}

async function getLatestSingleScenarioAttempt(userId: string, domain?: ScenarioDomainId) {
  const params: unknown[] = [userId];
  const domainClause = domain ? 'AND s.domain = $2' : '';
  if (domain) params.push(domain);
  const rows = await db.query<{ attempt_id: string }>(
    `SELECT sa.id AS attempt_id
       FROM scenario_attempts sa
       JOIN scenarios s ON s.id = sa.scenario_id
      WHERE sa.user_id = $1 ${domainClause}
      ORDER BY COALESCE(sa.completed_at, sa.started_at) DESC, sa.started_at DESC
      LIMIT 1`,
    params,
  );
  return rows[0] ? loadSingleScenarioAttempt(userId, rows[0].attempt_id) : null;
}

async function listSingleScenarioOverview(userId: string, domain: ScenarioDomainId) {
  const rows = await db.query<{
    attempt_id: string;
    scenario_id: string;
    topic: string;
    title: string;
    status: string;
    score: number;
    generated_at: string;
    completed_at: string | null;
  }>(
    `SELECT
        sa.id AS attempt_id,
        s.id AS scenario_id,
        s.topic,
        s.title,
        sa.status,
        sa.score,
        s.generated_at,
        sa.completed_at
      FROM scenario_attempts sa
      JOIN scenarios s ON s.id = sa.scenario_id
     WHERE sa.user_id = $1 AND s.domain = $2
     ORDER BY COALESCE(sa.completed_at, sa.started_at) DESC, sa.started_at DESC
     LIMIT 12`,
    [userId, domain],
  );

  return {
    domain,
    suggestedTopics: getScenarioTagCloud(domain),
    history: rows.map((row) => ({
      attemptId: row.attempt_id,
      scenarioId: row.scenario_id,
      topic: row.topic,
      title: row.title,
      status: row.status,
      score: Number.isFinite(Number(row.score)) && Number(row.score) > 0 ? Number(row.score) : null,
      generatedAt: row.generated_at,
      completedAt: row.completed_at,
    })),
  };
}

async function generateSingleScenarioForTopic(params: {
  userId: string;
  domain: ScenarioDomainId;
  topic: string;
  level: string;
  abortSignal?: AbortSignal;
}) {
  const seenRows = await db.query<{ question_hash: string; scenario_type: string }>(
    `SELECT question_hash, scenario_type
       FROM scenarios
      WHERE user_id = $1 AND domain = $2 AND topic = $3
      ORDER BY generated_at DESC
      LIMIT 6`,
    [params.userId, params.domain, params.topic],
  );
  const seenHashes = new Set(seenRows.map((row) => String(row.question_hash ?? '')).filter(Boolean));
  const extraAvoidHashes: string[] = [];
  const scenarioType = await pickScenarioAngle(params.userId, params.domain, params.topic, seenRows.length);
  const repoContext = await getLatestRepoContext(params.userId);
  let lastError = 'unknown';

  for (let attempt = 1; attempt <= SCENARIO_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    await checkAiRateLimit(params.userId, 'scenario-generation', 1);
    const seed = hashText(`${params.userId}:${params.topic}:${Date.now()}:single-scenario:${attempt}`).slice(0, 20);
    try {
      const generated = await callStructuredModel(
        `You are a senior ${SCENARIO_DOMAIN_LABELS[params.domain]} engineer creating one realistic interview scenario question. Return only valid JSON starting with { and ending with }. No markdown fences. No preamble.`,
        `Domain: ${SCENARIO_DOMAIN_LABELS[params.domain]}. Topic: ${params.topic}. Difficulty level: ${params.level}. Repo context: ${repoContext || 'none'}. Session seed: ${seed}. Scenario angle: ${scenarioType}. Previously seen scenario hashes: ${JSON.stringify([...seenHashes, ...extraAvoidHashes])}. Generate one interview-realistic scenario. Return JSON: { id: string, title: string, domain: string, topic: string, level: string, context: string, role: string, question: string, type: 'decision' | 'technical' | 'tradeoff' | 'communication', hint: string }. Rules: context must be specific to ${params.topic}. The question must be one substantive open-ended prompt that requires at least 150 words to answer well. Do not return steps. Do not split the prompt into parts. The hint must be brief and useful, not the full answer. If a similar hash appears in the seen list, generate a clearly different angle on the same topic.`,
        (payload) => normalizeGeneratedSingleScenarioPayload(payload, params.domain, params.topic, params.level, scenarioType),
        {
          abortSignal: params.abortSignal,
          maxTokens: SCENARIO_GENERATION_MAX_TOKENS,
          timeoutMs: SCENARIO_GENERATION_TIMEOUT_MS,
          model: SCENARIO_GENERATION_MODEL,
          temperature: SCENARIO_GENERATION_TEMPERATURE,
        },
      );

      const questionHash = buildScenarioQuestionHash(generated.result.context, generated.result.question);
      if (seenHashes.has(questionHash) || extraAvoidHashes.includes(questionHash)) {
        lastError = 'scenario_duplicate_hash';
        extraAvoidHashes.push(questionHash);
        continue;
      }

      const scenarioId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO scenarios (
          id, user_id, domain, topic, level, scenario_type, title, context, role, question, question_type, hint, steps, seed, question_hash, status, generated_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '[]'::jsonb, ?, ?, 'active', NOW(), NOW(), NOW()
        )
      `).run(
        scenarioId,
        params.userId,
        params.domain,
        params.topic,
        params.level,
        scenarioType,
        generated.result.title,
        generated.result.context,
        generated.result.role,
        generated.result.question,
        generated.result.type,
        generated.result.hint,
        seed,
        questionHash,
      );
      await db.prepare(`
        INSERT INTO question_history (id, user_id, domain, round_type, question_hash, question_text, seen_at)
        VALUES (?, ?, ?, 'scenario-round', ?, ?, NOW())
        ON CONFLICT (user_id, domain, round_type, question_hash) DO NOTHING
      `).run(
        crypto.randomUUID(),
        params.userId,
        params.domain,
        questionHash,
        `${generated.result.context}\n${generated.result.question}`,
      );
      await recordScenarioAngle(params.userId, params.domain, params.topic, scenarioType);

      const scenario = await loadSingleScenarioById(params.userId, scenarioId);
      if (!scenario) throw new Error('scenario_load_failed');
      return scenario;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`aiUnavailable: Unable to generate a fresh scenario right now. Last error: ${lastError}`);
}

type CodingDifficulty = 'easy' | 'medium' | 'hard';
type CodingVerdict = 'pass' | 'needs-work' | 'fail';

type CodingProblemExample = {
  input: string;
  output: string;
  explanation: string;
};

type CodingProblemRecord = {
  id: string;
  userId: string | null;
  domain: string;
  difficulty: CodingDifficulty;
  title: string;
  language: 'typescript' | 'javascript' | 'python' | 'sql' | 'bash';
  starterCode: string;
  problemStatement: string;
  requirements: string[];
  examples: CodingProblemExample[];
  constraints: string[];
  evaluationCriteria: string[];
  questionHash: string;
  generatedAt: string;
};

type CodingEvaluation = {
  score: number;
  verdict: CodingVerdict;
  correctness: string;
  codeQuality: string;
  edgeCases: string;
  bestPractices?: string;
  dimensionScores?: {
    correctness: number;
    codeQuality: number;
    edgeCases: number;
    bestPractices: number;
  };
  improvements: string[];
  modelSolutionSketch: string;
  modelSolutionCode?: string;
};

const CODING_SCORING_RUBRIC = 'Score the submission on a 1-10 scale using this rubric strictly: 1-2 = code does not compile or has fundamental logic errors that prevent it from running at all. 3-4 = code runs but produces wrong output for most cases, missing core requirements. 5 = code handles the basic happy path but fails edge cases and is missing requirements. 6 = code mostly works, handles main cases, minor issues with edge cases or code quality. 7 = code works correctly for all stated requirements, reasonable quality, minor improvements possible. 8 = code works correctly, handles edge cases, clean readable structure, good naming. 9 = code works correctly, handles all edge cases including unstated ones, excellent structure, production-ready. 10 = exceptional — optimal approach, handles all cases, clean, well-named, would pass a strict senior engineer review immediately. Apply this rubric honestly. A TODO comment left unimplemented is a 3 or below. A partially implemented function is a 4 or below. Do not cluster scores around 7.';

type CodingAttemptRecord = {
  id: string;
  problem: CodingProblemRecord;
  status: string;
  code: string;
  notes: string;
  language: 'typescript' | 'javascript' | 'python' | 'sql' | 'bash';
  startedAt: string;
  durationMinutes: number;
  submittedAt: string | null;
  score: number | null;
  timeSpentSeconds: number | null;
  savedAt: string | null;
  scratchNotes: string;
  evaluation: CodingEvaluation | null;
  aiUnavailable: boolean;
  evaluationError: string | null;
  summary: string;
  focusAreas: string[];
  nextSteps: string[];
};

function normalizeCodingDifficulty(value: unknown, fallback: CodingDifficulty = 'medium'): CodingDifficulty {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') return normalized;
  return fallback;
}

function normalizeCodingVerdict(value: unknown, fallback: CodingVerdict = 'needs-work'): CodingVerdict {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'pass' || normalized === 'needs-work' || normalized === 'fail') return normalized;
  return fallback;
}

function normalizeCodingLanguage(value: unknown, fallback: 'typescript' | 'javascript' | 'python' | 'sql' | 'bash'): 'typescript' | 'javascript' | 'python' | 'sql' | 'bash' {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized.includes('javascript') || normalized === 'js') return 'javascript';
  if (normalized.includes('python')) return 'python';
  if (normalized.includes('sql')) return 'sql';
  if (normalized.includes('bash') || normalized === 'sh' || normalized.includes('shell')) return 'bash';
  return fallback;
}

function getCodingLanguageForDomain(domain: string): 'typescript' | 'javascript' | 'python' | 'sql' | 'bash' {
  const normalized = String(domain ?? '').trim().toLowerCase();
  if (normalized === 'backend-python') return 'python';
  if (normalized === 'data-science' || normalized === 'ai-ml') return 'python';
  if (normalized === 'data-analytics') return 'sql';
  if (normalized === 'cybersecurity') return 'python';
  return 'typescript';
}

function formatCodingLanguageLabel(language: 'typescript' | 'javascript' | 'python' | 'sql' | 'bash') {
  if (language === 'javascript') return 'JavaScript';
  if (language === 'python') return 'Python';
  if (language === 'sql') return 'SQL';
  if (language === 'bash') return 'Bash';
  return 'TypeScript';
}

function formatNumberedList(items: string[]) {
  if (!items.length) return '1. None provided';
  return items.map((item, index) => `${index + 1}. ${item}`).join('\n');
}

function hasStoredCodingEvaluation(payload: Record<string, unknown>) {
  if (Boolean(payload.aiUnavailable)) return false;
  return Boolean(payload.correctness && payload.codeQuality && payload.edgeCases && payload.modelSolutionSketch);
}

function buildCodingEvaluationUnavailablePayload(problem: CodingProblemRecord, errorMessage: string) {
  return {
    aiUnavailable: true,
    error: errorMessage,
    summary: `Evaluation unavailable for ${problem.title}. Your code is saved.`,
    focusAreas: [],
    nextSteps: [],
  };
}

function getCodingDurationMinutes(difficulty: CodingDifficulty) {
  if (difficulty === 'hard') return 50;
  if (difficulty === 'easy') return 40;
  return 45;
}

function parseJsonObjectList(value: unknown) {
  if (Array.isArray(value)) return value.map((item) => parseJsonRecord(item));
  if (typeof value === 'string') {
    try {
      return parseJsonObjectList(JSON.parse(value));
    } catch {
      return [] as Array<Record<string, unknown>>;
    }
  }
  return [] as Array<Record<string, unknown>>;
}

function parseCodingExamples(value: unknown) {
  return parseJsonObjectList(value)
    .map((item) => ({
      input: String(item.input ?? '').trim(),
      output: String(item.output ?? '').trim(),
      explanation: String(item.explanation ?? '').trim(),
    }))
    .filter((item) => item.input && item.output && item.explanation)
    .slice(0, 3);
}

function codingDifficultyRank(difficulty: CodingDifficulty): 1 | 2 | 3 {
  if (difficulty === 'hard') return 3;
  if (difficulty === 'medium') return 2;
  return 1;
}

function buildCodingProblemHash(title: string, problemStatement: string) {
  return hashText(`${title.toLowerCase().trim()}::${problemStatement.toLowerCase().trim().slice(0, 80)}`);
}

function mapCodingProblemRow(row: {
  id: string;
  user_id: string | null;
  domain: string;
  difficulty: string;
  title: string;
  description: string;
  starter_code: string;
  language: string;
  requirements: unknown;
  examples: unknown;
  constraints: unknown;
  evaluation_criteria: unknown;
  question_hash: string | null;
  generated_at: string;
}): CodingProblemRecord {
  return {
    id: row.id,
    userId: row.user_id,
    domain: row.domain,
    difficulty: normalizeCodingDifficulty(row.difficulty),
    title: row.title,
    language: normalizeCodingLanguage(row.language, getCodingLanguageForDomain(row.domain)),
    starterCode: row.starter_code,
    problemStatement: row.description,
    requirements: parseJsonArray(row.requirements).slice(0, 5),
    examples: parseCodingExamples(row.examples),
    constraints: parseJsonArray(row.constraints).slice(0, 4),
    evaluationCriteria: parseJsonArray(row.evaluation_criteria).slice(0, 5),
    questionHash: row.question_hash ?? '',
    generatedAt: row.generated_at,
  };
}

function normalizeGeneratedCodingProblemPayload(payload: unknown, domain: string, difficulty: CodingDifficulty) {
  const source = parseJsonRecord(payload);
  const title = String(source.title ?? '').trim();
  const problemStatement = String(source.problemStatement ?? source.description ?? '').trim();
  const starterCode = String(source.starterCode ?? source.starter_code ?? '').trim();
  const language = normalizeCodingLanguage(source.language, getCodingLanguageForDomain(domain));
  const requirements = parseJsonArray(source.requirements).slice(0, 5);
  const examples = parseCodingExamples(source.examples);
  const constraints = parseJsonArray(source.constraints).slice(0, 4);
  const evaluationCriteria = parseJsonArray(source.evaluationCriteria ?? source.evaluation_criteria).slice(0, 5);

  if (!title) throw new Error('coding_problem_validation_failed:title');
  if (!problemStatement || problemStatement.length < 80) throw new Error('coding_problem_validation_failed:problem_statement');
  if (!starterCode || starterCode.length < 40) throw new Error('coding_problem_validation_failed:starter_code');
  if (requirements.length < 3) throw new Error('coding_problem_validation_failed:requirements');
  if (examples.length < 2) throw new Error('coding_problem_validation_failed:examples');
  if (constraints.length < 2) throw new Error('coding_problem_validation_failed:constraints');
  if (evaluationCriteria.length < 4) throw new Error('coding_problem_validation_failed:evaluation_criteria');

  return {
    title,
    domain,
    difficulty,
    language,
    starterCode,
    problemStatement,
    requirements,
    examples,
    constraints,
    evaluationCriteria,
  };
}

function fallbackCodingEvaluation(problem: CodingProblemRecord, code: string, notes: string): CodingEvaluation {
  const codeLength = code.trim().length;
  const score = codeLength >= 500 ? 7 : codeLength >= 250 ? 5 : codeLength >= 120 ? 4 : 2;
  return {
    score,
    verdict: score >= 7 ? 'pass' : score >= 5 ? 'needs-work' : 'fail',
    correctness: 'AI evaluation was unavailable. The draft was saved, but a strong answer here should clearly satisfy the stated requirements and explain how the core logic works.',
    codeQuality: 'Use clearer structure, naming, and helper boundaries so an interviewer can scan the solution quickly.',
    edgeCases: 'Call out the edge cases that matter for this prompt and make the handling visible either in code or notes.',
    bestPractices: 'Prefer readable, testable code with clear boundaries and predictable failure handling.',
    dimensionScores: {
      correctness: score,
      codeQuality: Math.min(10, score + 1),
      edgeCases: Math.max(1, score - 1),
      bestPractices: score,
    },
    improvements: [
      `Tie the implementation back to the concrete requirements for ${problem.title}.`,
      'Use the notes field to explain the expected output for one example if execution is unavailable.',
      'Make failure handling or boundary conditions more explicit.',
    ],
    modelSolutionSketch: notes.trim() || 'Start by mapping each requirement to one clear code path, then handle edge cases before the final return value.',
    modelSolutionCode: code.trim(),
  };
}

function normalizeCodingEvaluationPayload(payload: unknown): CodingEvaluation {
  const source = parseJsonRecord(payload);
  return {
    score: clampScore(source.score, 5),
    verdict: normalizeCodingVerdict(source.verdict),
    correctness: String(source.correctness ?? 'No correctness review was returned.'),
    codeQuality: String(source.codeQuality ?? source.code_quality ?? 'No code quality review was returned.'),
    edgeCases: String(source.edgeCases ?? source.edge_cases ?? 'No edge case review was returned.'),
    bestPractices: String(source.bestPractices ?? source.best_practices ?? 'No best-practices review was returned.'),
    dimensionScores: (() => {
      const dimensions = parseJsonRecord(source.dimensionScores ?? source.dimension_scores);
      const fallbackScore = clampScore(source.score, 5);
      return {
        correctness: clampScore(dimensions.correctness, fallbackScore),
        codeQuality: clampScore(dimensions.codeQuality ?? dimensions.code_quality, fallbackScore),
        edgeCases: clampScore(dimensions.edgeCases ?? dimensions.edge_cases, fallbackScore),
        bestPractices: clampScore(dimensions.bestPractices ?? dimensions.best_practices, fallbackScore),
      };
    })(),
    improvements: parseJsonArray(source.improvements).slice(0, 5),
    modelSolutionSketch: String(source.modelSolutionSketch ?? source.model_solution_sketch ?? 'No model solution sketch was returned.'),
    modelSolutionCode: String(source.modelSolutionCode ?? source.model_solution_code ?? '').trim(),
  };
}

function buildCodingResultMeta(problem: CodingProblemRecord, evaluation: CodingEvaluation | null, aiUnavailable = false) {
  if (!evaluation) {
    return {
      score: 0,
      summary: aiUnavailable ? `Evaluation unavailable for ${problem.title}. Your code is saved.` : '',
      focusAreas: [],
      nextSteps: [],
    };
  }
  const focusAreas = evaluation.improvements.slice(0, 3);
  const nextSteps = evaluation.improvements.slice(0, 3).map((item) => `Before the next problem, fix this: ${item}`);
  return {
    score: evaluation.score,
    summary: `Coding round on ${problem.title} scored ${evaluation.score}/10.`,
    focusAreas,
    nextSteps,
  };
}

async function evaluateCodingSubmission(params: {
  userId: string;
  problem: CodingProblemRecord;
  language: 'typescript' | 'javascript' | 'python' | 'sql' | 'bash';
  code: string;
  notes: string;
}) {
  const domainLabel = PRACTICE_DOMAIN_LABELS[toPracticeDomain(params.problem.domain) || 'frontend'];
  const systemPrompt = `You are a strict senior ${domainLabel} engineer doing a real technical interview evaluation. You have zero tolerance for incomplete implementations. A partially written solution scores below 5. A solution that does not compile or has obvious syntax errors scores below 3. Be honest and specific - do not give vague feedback. Return only valid JSON starting with { and ending with }.`;
  const userPrompt = [
    `Problem title: ${params.problem.title}.`,
    `Difficulty: ${params.problem.difficulty}.`,
    `Language: ${formatCodingLanguageLabel(params.language)}.`,
    `Problem statement: ${params.problem.problemStatement}.`,
    'Requirements the solution must satisfy:',
    formatNumberedList(params.problem.requirements),
    'Evaluation criteria:',
    formatNumberedList(params.problem.evaluationCriteria),
    'The candidate submitted this code:',
    params.code || '(no code submitted)',
    `Their notes: ${params.notes || 'none provided'}.`,
    'Evaluate strictly. For correctness: actually read the code line by line and determine if it correctly implements the requirements. If the code is incomplete (has TODO comments not implemented, missing return statements, empty function bodies), state this explicitly and score correctness below 4. For edge cases: identify specific edge cases the problem requires and state whether each is handled or not. For code quality: evaluate naming, structure, and whether an interviewer would approve. For model solution sketch: write a concrete 3-4 sentence description of what a correct optimal solution looks like - specific to this problem, not generic.',
    CODING_SCORING_RUBRIC,
    `In the modelSolutionCode field, provide a complete correct implementation of this problem in ${formatCodingLanguageLabel(params.language)}. The code must be complete, runnable, and implement all requirements. This is shown to the candidate after submission for learning. Do not provide a sketch — provide actual working code.`,
    "Return JSON: { score: number (1-10), verdict: 'pass' | 'needs-work' | 'fail', correctness: string (specific - does this code actually work? what does it do correctly and what is wrong?), codeQuality: string (specific feedback on the actual code structure), edgeCases: string (list the specific edge cases and whether each is handled), bestPractices: string, dimensionScores: { correctness: number, codeQuality: number, edgeCases: number, bestPractices: number }, improvements: string[] (3-5 concrete specific improvements for this exact code), modelSolutionSketch: string (3-4 sentences describing the optimal approach for this specific problem), modelSolutionCode: string }",
  ].join('\n');

  const startedAt = Date.now();
  console.log('[coding-eval] start');

  let lastFailure = {
    message: 'unknown',
    rawLength: 0,
    rawPreview: '',
  };

  for (let retry = 0; retry < 2; retry += 1) {
    try {
      await checkAiRateLimit(params.userId, 'coding-answer-evaluation', 1);
      const ai = await callStructuredModel(
        systemPrompt,
        userPrompt,
        (payload) => normalizeCodingEvaluationPayload(payload),
        {
          maxTokens: 1200,
          timeoutMs: 20_000,
          model: CODING_EVALUATION_MODEL,
          temperature: 0.6,
        },
      );
      if (ai.result.modelSolutionSketch.trim().length < 80) {
        const error = new Error('coding_evaluation_insufficient_model_solution_sketch') as Error & { rawResponse?: string };
        error.rawResponse = JSON.stringify(ai.result);
        throw error;
      }
      console.log('[coding-eval] done', { score: ai.result.score, verdict: ai.result.verdict, durationMs: Date.now() - startedAt });
      return ai.result;
    } catch (error) {
      if ((error as Error & { statusCode?: number }).statusCode === 429) {
        throw error;
      }
      const rawResponse = typeof (error as Error & { rawResponse?: unknown }).rawResponse === 'string'
        ? String((error as Error & { rawResponse?: string }).rawResponse ?? '')
        : '';
      lastFailure = {
        message: error instanceof Error ? error.message : String(error),
        rawLength: rawResponse.length,
        rawPreview: (rawResponse || (error instanceof Error ? error.message : String(error))).slice(0, 240),
      };
      console.error('[coding-eval] failed', { rawLength: lastFailure.rawLength, rawPreview: lastFailure.rawPreview, error: lastFailure.message });
    }
  }

  const failure = new Error(`aiUnavailable: DeepSeek could not evaluate this submission right now. Last error: ${lastFailure.message}`) as Error & { rawLength?: number; rawPreview?: string };
  failure.rawLength = lastFailure.rawLength;
  failure.rawPreview = lastFailure.rawPreview;
  throw failure;
}

async function loadCodingAttempt(userId: string, attemptId: string) {
  const rows = await db.query<{
    attempt_id: string;
    status: string;
    code_draft: string | null;
    notes: string | null;
    language: string;
    started_at: string;
    duration_minutes: number;
    score: number;
    time_spent_seconds: number | null;
    submitted_at: string | null;
    saved_at: string | null;
    scratch_notes: string | null;
    evaluation_payload: unknown;
    problem_id: string;
    problem_user_id: string | null;
    domain: string;
    difficulty: string;
    title: string;
    description: string;
    starter_code: string;
    requirements: unknown;
    examples: unknown;
    constraints: unknown;
    evaluation_criteria: unknown;
    question_hash: string | null;
    generated_at: string;
  }>(
    `SELECT
        ca.id AS attempt_id,
        ca.status,
        ca.code_draft,
        ca.notes,
        ca.language,
        ca.started_at,
        ca.duration_minutes,
        ca.score,
        ca.time_spent_seconds,
        ca.submitted_at,
        ca.saved_at,
        ca.scratch_notes,
        ca.evaluation_payload,
        cp.id AS problem_id,
        cp.user_id AS problem_user_id,
        cp.domain,
        cp.difficulty,
        cp.title,
        cp.description,
        cp.starter_code,
        cp.requirements,
        cp.examples,
        cp.constraints,
        cp.evaluation_criteria,
        cp.question_hash,
        cp.generated_at
      FROM coding_attempts ca
      JOIN coding_problems cp ON cp.id = ca.problem_id
     WHERE ca.id = $1 AND ca.user_id = $2
     LIMIT 1`,
    [attemptId, userId],
  );
  const row = rows[0];
  if (!row) return null;

  const problem = mapCodingProblemRow({
    id: row.problem_id,
    user_id: row.problem_user_id,
    domain: row.domain,
    difficulty: row.difficulty,
    title: row.title,
    description: row.description,
    starter_code: row.starter_code,
    language: row.language,
    requirements: row.requirements,
    examples: row.examples,
    constraints: row.constraints,
    evaluation_criteria: row.evaluation_criteria,
    question_hash: row.question_hash,
    generated_at: row.generated_at,
  });

  const evaluationPayload = parseJsonRecord(row.evaluation_payload);
  const aiUnavailable = Boolean(evaluationPayload.aiUnavailable);
  const evaluation = hasStoredCodingEvaluation(evaluationPayload) ? normalizeCodingEvaluationPayload(evaluationPayload) : null;
  const meta = buildCodingResultMeta(problem, evaluation, aiUnavailable);
  const storedScore = aiUnavailable ? null : Number(row.score ?? evaluationPayload.score ?? 0);

  return {
    id: row.attempt_id,
    problem,
    status: row.status,
    code: String(row.code_draft ?? ''),
    notes: String(row.notes ?? ''),
    language: normalizeCodingLanguage(row.language, problem.language),
    startedAt: row.started_at,
    durationMinutes: Number(row.duration_minutes ?? getCodingDurationMinutes(problem.difficulty)),
    submittedAt: row.submitted_at,
    score: typeof storedScore === 'number' && Number.isFinite(storedScore) && storedScore > 0 ? clampScore(storedScore, meta.score) : (evaluation ? meta.score : null),
    timeSpentSeconds: row.time_spent_seconds === null ? null : Number(row.time_spent_seconds),
    savedAt: row.saved_at,
    scratchNotes: String(row.scratch_notes ?? ''),
    evaluation,
    aiUnavailable,
    evaluationError: aiUnavailable ? String(evaluationPayload.error ?? 'DeepSeek could not evaluate your submission right now.') : null,
    summary: String(evaluationPayload.summary ?? ((evaluation || aiUnavailable) ? meta.summary : '')),
    focusAreas: Array.isArray(evaluationPayload.focusAreas) ? evaluationPayload.focusAreas.map(String) : (evaluation ? meta.focusAreas : []),
    nextSteps: Array.isArray(evaluationPayload.nextSteps) ? evaluationPayload.nextSteps.map(String) : (evaluation ? meta.nextSteps : []),
  } satisfies CodingAttemptRecord;
}

function toStoredRoundAttemptFromCodingAttempt(attempt: CodingAttemptRecord) {
  const domainLabel = PRACTICE_DOMAIN_LABELS[toPracticeDomain(attempt.problem.domain) || 'frontend'];
  const normalizedScore = (attempt.score ?? 0) * 10;
  return {
    id: attempt.id,
    roundType: 'coding-round',
    questionType: 'coding',
    domain: attempt.problem.domain,
    status: attempt.status,
    durationMinutes: attempt.durationMinutes,
    totalQuestions: 1,
    correctAnswers: attempt.evaluation?.verdict === 'pass' ? 1 : 0,
    score: normalizedScore,
    timeSpentSeconds: attempt.timeSpentSeconds,
    startedAt: attempt.startedAt,
    submittedAt: attempt.submittedAt,
    expiresAt: new Date(new Date(attempt.startedAt).getTime() + (attempt.durationMinutes * 60 * 1000)).toISOString(),
    summary: attempt.summary,
    focusAreas: attempt.focusAreas,
    nextSteps: attempt.nextSteps,
    questions: [{
      id: attempt.problem.id,
      domain: attempt.problem.domain,
      domainLabel,
      topic: attempt.problem.title,
      type: 'coding' as const,
      difficulty: codingDifficultyRank(attempt.problem.difficulty),
      questionText: attempt.problem.problemStatement,
      correctAnswer: attempt.evaluation?.modelSolutionSketch ?? '',
      explanation: attempt.problem.requirements.join(' '),
      codeSnippet: attempt.problem.starterCode,
      tags: [attempt.problem.domain, attempt.problem.difficulty],
      timeLimitMinutes: attempt.durationMinutes,
    }],
    answers: [{
      questionId: attempt.problem.id,
      codeAnswer: attempt.code || null,
      notes: attempt.notes || null,
    }],
    results: [{
      questionId: attempt.problem.id,
      topic: attempt.problem.title,
      prompt: attempt.problem.problemStatement,
      submittedAnswer: attempt.code || null,
      correctAnswer: attempt.evaluation?.modelSolutionSketch ?? '',
      explanation: [attempt.evaluation?.correctness, attempt.evaluation?.codeQuality, attempt.evaluation?.edgeCases].filter(Boolean).join(' '),
      isCorrect: attempt.evaluation?.verdict === 'pass',
      score: normalizedScore,
      observations: attempt.evaluation?.improvements ?? [],
    }],
  };
}

function toCodingResultAttemptPayload(attempt: CodingAttemptRecord) {
  return {
    ...toStoredRoundAttemptFromCodingAttempt(attempt),
    coding: {
      id: attempt.problem.id,
      title: attempt.problem.title,
      domain: attempt.problem.domain,
      difficulty: attempt.problem.difficulty,
      language: attempt.language,
      starterCode: attempt.problem.starterCode,
      problemStatement: attempt.problem.problemStatement,
      requirements: attempt.problem.requirements,
      examples: attempt.problem.examples,
      constraints: attempt.problem.constraints,
      evaluationCriteria: attempt.problem.evaluationCriteria,
      score: attempt.score,
      verdict: attempt.evaluation?.verdict ?? 'needs-work',
      correctness: attempt.evaluation?.correctness ?? '',
      codeQuality: attempt.evaluation?.codeQuality ?? '',
      edgeCases: attempt.evaluation?.edgeCases ?? '',
      bestPractices: attempt.evaluation?.bestPractices ?? '',
      dimensionScores: attempt.evaluation?.dimensionScores ?? null,
      improvements: attempt.evaluation?.improvements ?? [],
      modelSolutionSketch: attempt.evaluation?.modelSolutionSketch ?? '',
      modelSolutionCode: attempt.evaluation?.modelSolutionCode ?? '',
      code: attempt.code,
      notes: attempt.notes,
      startedAt: attempt.startedAt,
      submittedAt: attempt.submittedAt,
      aiUnavailable: attempt.aiUnavailable,
      evaluationError: attempt.evaluationError,
    },
  };
}

async function findActiveCodingAttempt(userId: string, domain: string) {
  const rows = await db.query<{ attempt_id: string }>(
    `SELECT ca.id AS attempt_id
       FROM coding_attempts ca
       JOIN coding_problems cp ON cp.id = ca.problem_id
      WHERE ca.user_id = $1
        AND cp.domain = $2
        AND ca.status = 'started'
        AND NOW() < (ca.started_at + (ca.duration_minutes * INTERVAL '1 minute'))
      ORDER BY ca.started_at DESC
      LIMIT 1`,
    [userId, domain],
  );
  return rows[0] ? loadCodingAttempt(userId, rows[0].attempt_id) : null;
}

async function getLatestCodingAttempt(userId: string, domain?: string) {
  const params: unknown[] = [userId];
  const domainClause = domain ? 'AND cp.domain = $2' : '';
  if (domain) params.push(domain);
  const rows = await db.query<{ attempt_id: string }>(
    `SELECT ca.id AS attempt_id
       FROM coding_attempts ca
       JOIN coding_problems cp ON cp.id = ca.problem_id
      WHERE ca.user_id = $1 ${domainClause}
      ORDER BY COALESCE(ca.submitted_at, ca.started_at) DESC, ca.started_at DESC
      LIMIT 1`,
    params,
  );
  return rows[0] ? loadCodingAttempt(userId, rows[0].attempt_id) : null;
}

async function buildCodingOverview(userId: string, domain: string) {
  const activeAttempt = await findActiveCodingAttempt(userId, domain);
  const rows = await db.query<{ difficulty: string; total: number }>(
    `SELECT cp.difficulty, COUNT(*)::int AS total
       FROM coding_attempts ca
       JOIN coding_problems cp ON cp.id = ca.problem_id
      WHERE ca.user_id = $1 AND cp.domain = $2 AND ca.status = 'submitted'
      GROUP BY cp.difficulty`,
    [userId, domain],
  );
  const counts = new Map(rows.map((row) => [normalizeCodingDifficulty(row.difficulty), Number(row.total)] as const));
  let suggestedFromDifficulty: CodingDifficulty | null = null;
  let suggestedDifficulty: CodingDifficulty | null = null;

  if ((counts.get('easy') ?? 0) >= 5) {
    suggestedFromDifficulty = 'easy';
    suggestedDifficulty = 'medium';
  } else if ((counts.get('medium') ?? 0) >= 5) {
    suggestedFromDifficulty = 'medium';
    suggestedDifficulty = 'hard';
  }

  return {
    activeAttemptId: activeAttempt?.id ?? null,
    suggestedFromDifficulty,
    suggestedDifficulty,
    suggestionMessage: suggestedFromDifficulty && suggestedDifficulty
      ? `You've done 5 ${suggestedFromDifficulty[0].toUpperCase()}${suggestedFromDifficulty.slice(1)} problems - want to try ${suggestedDifficulty[0].toUpperCase()}${suggestedDifficulty.slice(1)}?`
      : null,
  };
}

async function generateCodingAttemptForUser(params: {
  userId: string;
  domain: string;
  difficulty: CodingDifficulty;
  abortSignal?: AbortSignal;
}) {
  const seenRows = await db.query<{ question_hash: string }>(
    `SELECT question_hash
       FROM question_history
      WHERE user_id = $1 AND domain = $2 AND round_type = 'coding-round'
      ORDER BY seen_at DESC
      LIMIT 16`,
    [params.userId, params.domain],
  );
  const seenHashes = new Set(seenRows.map((row) => String(row.question_hash ?? '')).filter(Boolean));
  const extraAvoidHashes: string[] = [];
  const repoContext = await getLatestRepoContext(params.userId);
  const language = getCodingLanguageForDomain(params.domain);
  let lastError = 'unknown';

  for (let attempt = 1; attempt <= CODING_PROBLEM_GENERATION_MAX_ATTEMPTS; attempt += 1) {
    await checkAiRateLimit(params.userId, 'coding-problem-generation', 1);
    try {
      const generated = await callStructuredModel(
        `You are a senior ${PRACTICE_DOMAIN_LABELS[toPracticeDomain(params.domain) || 'frontend']} engineer creating a real interview coding problem. Return only valid JSON starting with { and ending with }. No markdown fences. No preamble.`,
        `Domain: ${PRACTICE_DOMAIN_LABELS[toPracticeDomain(params.domain) || 'frontend']}. Difficulty: ${params.difficulty}. Generate one coding interview problem appropriate for a ${params.difficulty} ${PRACTICE_DOMAIN_LABELS[toPracticeDomain(params.domain) || 'frontend']} engineering interview. The problem must be practical, interview-realistic, and domain-specific - not a generic algorithm puzzle. Previously seen problem hashes for this user: ${JSON.stringify([...seenHashes, ...extraAvoidHashes])}. Return JSON: { id: string, title: string, difficulty: string, domain: string, language: string, starterCode: string, problemStatement: string, requirements: string[], examples: [ { input: string, output: string, explanation: string } ], constraints: string[], evaluationCriteria: string[] }. Rules: the language must align with this domain and should be ${language}. starterCode must be realistic starter code with TODO comments marking what to implement. problemStatement must be 3-5 clear sentences. Provide 3-5 requirements, 2-3 examples, 2-4 constraints, and 4-5 evaluation criteria. Repo context: ${repoContext || 'none'}.`,
        (payload) => normalizeGeneratedCodingProblemPayload(payload, params.domain, params.difficulty),
        {
          abortSignal: params.abortSignal,
          maxTokens: CODING_PROBLEM_GENERATION_MAX_TOKENS,
          timeoutMs: CODING_PROBLEM_GENERATION_TIMEOUT_MS,
          model: CODING_PROBLEM_GENERATION_MODEL,
          temperature: 0.8,
        },
      );

      const questionHash = buildCodingProblemHash(generated.result.title, generated.result.problemStatement);
      if (seenHashes.has(questionHash) || extraAvoidHashes.includes(questionHash)) {
        lastError = 'coding_problem_duplicate_hash';
        extraAvoidHashes.push(questionHash);
        continue;
      }

      const problemId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO coding_problems (
          id, user_id, domain, difficulty, category, title, description, context, starter_code, language, question_hash, requirements, examples, constraints, evaluation_criteria, hints, status, generated_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, '', ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?::jsonb, '[]'::jsonb, 'active', NOW(), NOW(), NOW()
        )
      `).run(
        problemId,
        params.userId,
        params.domain,
        params.difficulty,
        params.domain,
        generated.result.title,
        generated.result.problemStatement,
        generated.result.starterCode,
        generated.result.language,
        questionHash,
        JSON.stringify(generated.result.requirements),
        JSON.stringify(generated.result.examples),
        JSON.stringify(generated.result.constraints),
        JSON.stringify(generated.result.evaluationCriteria),
      );
      await db.prepare(`
        INSERT INTO question_history (id, user_id, domain, round_type, question_hash, question_text, seen_at)
        VALUES (?, ?, ?, 'coding-round', ?, ?, NOW())
        ON CONFLICT (user_id, domain, round_type, question_hash) DO NOTHING
      `).run(
        crypto.randomUUID(),
        params.userId,
        params.domain,
        questionHash,
        `${generated.result.title}\n${generated.result.problemStatement.slice(0, 180)}`,
      );

      const attemptId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO coding_attempts (
          id, problem_id, user_id, status, code_draft, notes, language, started_at, duration_minutes, paused_ms, last_saved_at, score, time_spent_seconds, submitted_at, evaluation_payload
        ) VALUES (
          ?, ?, ?, 'started', ?, '', ?, NOW(), ?, 0, NOW(), 0, NULL, NULL, '{}'::jsonb
        )
      `).run(attemptId, problemId, params.userId, generated.result.starterCode, generated.result.language, getCodingDurationMinutes(params.difficulty));

      const codingAttempt = await loadCodingAttempt(params.userId, attemptId);
      if (!codingAttempt) throw new Error('coding_attempt_load_failed');
      return codingAttempt;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  throw new Error(`aiUnavailable: Unable to generate a fresh coding problem right now. Last error: ${lastError}`);
}

type MockLevel = 'junior' | 'mid' | 'senior';
type MockInterviewType = 'technical' | 'design' | 'mixed';
type MockPersona = 'alex' | 'jordan' | 'sam';
type MockQuestionType = 'technical' | 'design' | 'behavioral' | 'situational';

type MockQuestionRecord = {
  id: string;
  question: string;
  type: MockQuestionType;
  whatWeAreLookingFor: string;
  followUpIfStrong: string;
  followUpIfWeak: string;
};

type MockResponseRecord = {
  questionId: string;
  answer: string;
  followUpAnswer?: string;
  spokenResponse: string;
  followUpQuestion: string | null;
  internalScore: number | null;
  internalFlags: string[];
  aiUnavailable?: boolean;
  answeredAt: string;
};

function normalizeMockLevel(value: unknown): MockLevel {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'junior' || normalized === 'mid' || normalized === 'senior') return normalized;
  return 'mid';
}

function normalizeMockInterviewType(value: unknown): MockInterviewType {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'technical' || normalized === 'design' || normalized === 'mixed') return normalized;
  return 'mixed';
}

function normalizeMockPersona(value: unknown): MockPersona {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (normalized === 'jordan' || normalized === 'sam') return normalized;
  return 'alex';
}

function mockLevelLabel(level: MockLevel) {
  if (level === 'junior') return 'Junior (0-2 years)';
  if (level === 'senior') return 'Senior (5+ years)';
  return 'Mid (2-5 years)';
}

function mockInterviewTypeLabel(type: MockInterviewType) {
  if (type === 'technical') return 'Technical Deep Dive';
  if (type === 'design') return 'System Design';
  return 'Behavioral + Technical Mix';
}

function mockPersonaName(persona: MockPersona) {
  if (persona === 'jordan') return 'Jordan';
  if (persona === 'sam') return 'Sam';
  return 'Alex';
}

function mockPersonaSystemPrompt(persona: MockPersona) {
  if (persona === 'jordan') return 'You are Jordan, a skeptical senior engineer. Push for depth. Challenge vague answers directly. Return only JSON.';
  if (persona === 'sam') return 'You are Sam, a startup CTO. Terse, pragmatic, focused on judgment and ownership. Return only JSON.';
  return 'You are Alex, a supportive senior engineer interviewer. Respond warmly, acknowledge what the candidate said, ask a follow-up if incomplete. Return only JSON.';
}

function mockQuestionHash(question: string) {
  return hashText(question.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 80));
}

function normalizeMockQuestions(payload: unknown): { interviewTitle: string; questions: MockQuestionRecord[] } {
  const source = parseJsonRecord(payload);
  const interviewTitle = String(source.interviewTitle ?? 'Mock Interview').trim() || 'Mock Interview';
  const rawQuestions = Array.isArray(source.questions) ? source.questions : [];
  const questions = rawQuestions.map((raw, index) => {
    const item = parseJsonRecord(raw);
    const type = String(item.type ?? '').trim().toLowerCase();
    const normalizedType = (['technical', 'design', 'behavioral', 'situational'].includes(type) ? type : 'technical') as MockQuestionType;
    return {
      id: String(item.id ?? `q-${index + 1}`).trim() || `q-${index + 1}`,
      question: String(item.question ?? '').trim(),
      type: normalizedType,
      whatWeAreLookingFor: String(item.whatWeAreLookingFor ?? item.what_we_are_looking_for ?? '').trim(),
      followUpIfStrong: String(item.followUpIfStrong ?? item.follow_up_if_strong ?? '').trim(),
      followUpIfWeak: String(item.followUpIfWeak ?? item.follow_up_if_weak ?? '').trim(),
    };
  }).filter((item) => item.question && item.whatWeAreLookingFor).slice(0, 8);
  if (questions.length !== 8) throw new Error(`mock_question_validation_failed:${questions.length}`);
  return { interviewTitle, questions };
}

function normalizeMockResponsePayload(payload: unknown) {
  const source = parseJsonRecord(payload);
  return {
    spokenResponse: String(source.spokenResponse ?? 'Take a moment, then continue to the next question.').trim() || 'Take a moment, then continue to the next question.',
    followUpQuestion: source.followUpQuestion === null ? null : String(source.followUpQuestion ?? '').trim() || null,
    internalScore: clampScore(source.internalScore, 5),
    internalFlags: parseJsonArray(source.internalFlags).slice(0, 5),
  };
}

function normalizeMockReportPayload(payload: unknown) {
  const source = parseJsonRecord(payload);
  const verdict = String(source.readinessVerdict ?? '').trim();
  return {
    overallScore: clampScore(source.overallScore, 5),
    readinessVerdict: ['not-ready', 'borderline', 'ready', 'strong-yes'].includes(verdict) ? verdict : 'borderline',
    technicalDepth: String(source.technicalDepth ?? 'Evaluation unavailable for some questions.'),
    communicationClarity: String(source.communicationClarity ?? 'Use clearer structure and examples.'),
    designThinking: String(source.designThinking ?? 'Name tradeoffs and failure modes more explicitly.'),
    behavioralMaturity: String(source.behavioralMaturity ?? 'Tie answers to ownership, impact, and learning.'),
    topThreeStrengths: parseJsonArray(source.topThreeStrengths).slice(0, 3),
    topThreeWeaknesses: parseJsonArray(source.topThreeWeaknesses).slice(0, 3),
    criticalGaps: parseJsonArray(source.criticalGaps).slice(0, 5),
    studyPlan: parseJsonObjectList(source.studyPlan).slice(0, 5).map((item) => ({
      area: String(item.area ?? 'Interview readiness'),
      action: String(item.action ?? 'Review missed questions and write stronger structured answers.'),
      estimatedDays: Math.max(1, Number(item.estimatedDays ?? 3)),
    })),
    hiringPanelSummary: String(source.hiringPanelSummary ?? 'The interview showed useful signal, but some evaluation details were unavailable.'),
  };
}

function parseMockResponses(value: unknown): MockResponseRecord[] {
  return parseJsonObjectList(value).map((item) => ({
    questionId: String(item.questionId ?? ''),
    answer: String(item.answer ?? ''),
    followUpAnswer: item.followUpAnswer === undefined ? undefined : String(item.followUpAnswer ?? ''),
    spokenResponse: String(item.spokenResponse ?? 'Take a moment, then continue to the next question.'),
    followUpQuestion: item.followUpQuestion === null ? null : String(item.followUpQuestion ?? '').trim() || null,
    internalScore: item.internalScore === null ? null : clampScore(item.internalScore, 5),
    internalFlags: parseJsonArray(item.internalFlags),
    aiUnavailable: Boolean(item.aiUnavailable),
    answeredAt: String(item.answeredAt ?? new Date().toISOString()),
  })).filter((item) => item.questionId);
}

function mapMockInterviewRow(row: {
  id: string;
  domain: string;
  level: string;
  persona: string;
  interview_type: string;
  interview_title: string;
  status: string;
  questions: unknown;
  responses: unknown;
  current_question_index: number;
  started_at: string;
  paused_ms: number;
  duration_minutes: number;
  last_saved_at: string | null;
  saved_at: string | null;
  completed_at: string | null;
  report_payload: unknown;
}) {
  const questions = parseJsonObjectList(row.questions).map((item, index) => ({
    id: String(item.id ?? `q-${index + 1}`),
    question: String(item.question ?? ''),
    type: (['technical', 'design', 'behavioral', 'situational'].includes(String(item.type)) ? String(item.type) : 'technical') as MockQuestionType,
    whatWeAreLookingFor: String(item.whatWeAreLookingFor ?? ''),
    followUpIfStrong: String(item.followUpIfStrong ?? ''),
    followUpIfWeak: String(item.followUpIfWeak ?? ''),
  })).filter((item) => item.question);
  const report = parseJsonRecord(row.report_payload);
  const hasReport = Object.keys(report).length > 0;
  return {
    id: row.id,
    domain: row.domain,
    domainLabel: PRACTICE_DOMAIN_LABELS[toPracticeDomain(row.domain) || 'frontend'] ?? row.domain,
    level: normalizeMockLevel(row.level),
    interviewType: normalizeMockInterviewType(row.interview_type),
    persona: normalizeMockPersona(row.persona),
    interviewTitle: row.interview_title || 'Mock Interview',
    status: row.status,
    questions,
    responses: parseMockResponses(row.responses),
    currentQuestionIndex: Number(row.current_question_index ?? 0),
    startedAt: row.started_at,
    pausedMs: Number(row.paused_ms ?? 0),
    durationMinutes: Number(row.duration_minutes ?? 45),
    lastSavedAt: row.last_saved_at,
    completedAt: row.completed_at,
    savedAt: row.saved_at,
    report: hasReport ? normalizeMockReportPayload(report) : null,
  };
}

async function loadMockInterview(userId: string, interviewId: string) {
  const rows = await db.query<{
    id: string;
    domain: string;
    level: string;
    persona: string;
    interview_type: string;
    interview_title: string;
    status: string;
    questions: unknown;
    responses: unknown;
    current_question_index: number;
    started_at: string;
    paused_ms: number;
    duration_minutes: number;
    last_saved_at: string | null;
    saved_at: string | null;
    completed_at: string | null;
    report_payload: unknown;
  }>(`
    SELECT id, domain, level, persona, interview_type, interview_title, status, questions, responses,
           current_question_index, started_at, paused_ms, duration_minutes, last_saved_at, saved_at, completed_at, report_payload
      FROM mock_interviews
     WHERE id = $1 AND user_id = $2
     LIMIT 1
  `, [interviewId, userId]);
  return rows[0] ? mapMockInterviewRow(rows[0]) : null;
}

async function getLatestMockInterview(userId: string, domain?: string) {
  const params: unknown[] = [userId];
  const domainClause = domain ? 'AND domain = $2' : '';
  if (domain) params.push(domain);
  const rows = await db.query<{ id: string }>(`
    SELECT id FROM mock_interviews
     WHERE user_id = $1 ${domainClause}
     ORDER BY COALESCE(completed_at, started_at) DESC
     LIMIT 1
  `, params);
  return rows[0] ? loadMockInterview(userId, rows[0].id) : null;
}

async function findActiveMockInterview(userId: string, domain: string) {
  const rows = await db.query<{ id: string }>(`
    SELECT id FROM mock_interviews
     WHERE user_id = $1
       AND domain = $2
       AND status = 'started'
       AND NOW() < (started_at + (duration_minutes * INTERVAL '1 minute'))
     ORDER BY started_at DESC
     LIMIT 1
  `, [userId, domain]);
  return rows[0] ? loadMockInterview(userId, rows[0].id) : null;
}

async function generateMockInterviewForUser(params: { userId: string; domain: string; level: MockLevel; interviewType: MockInterviewType; persona: MockPersona }) {
  const seenRows = await db.query<{ question_hash: string; question_text: string }>(`
    SELECT question_hash, question_text
      FROM question_history
     WHERE user_id = $1 AND domain = $2 AND round_type = 'mock-interview'
     ORDER BY seen_at DESC
     LIMIT 80
  `, [params.userId, params.domain]);
  const usedAngles = seenRows.length >= 24 ? seenRows.map((row) => row.question_text).slice(0, 12) : [];
  const seeds = selectMockQuestionSeeds(params.domain, params.interviewType);
  const domainLabel = PRACTICE_DOMAIN_LABELS[toPracticeDomain(params.domain) || 'frontend'] ?? params.domain;
  await checkAiRateLimit(params.userId, 'mock-question-generation', 3);
  const generated = await callStructuredModel(
    `You are a technical hiring manager at a tier-1 tech company preparing a mock interview for a ${domainLabel} ${mockLevelLabel(params.level)} engineer. Generate 8 realistic interview questions. Never generate DSA or competitive programming questions. Questions must reflect real engineering work at ${domainLabel} domain. Return only valid JSON.`,
    `Domain: ${domainLabel}. Level: ${mockLevelLabel(params.level)}. Interview type: ${mockInterviewTypeLabel(params.interviewType)}. Previously seen question hashes for this user+domain: ${JSON.stringify(seenRows.map((row) => row.question_hash))}. These question angles have been used: ${JSON.stringify(usedAngles)}. Draw your 8 questions from this relevant pool: ${JSON.stringify(seeds)}. Generate 8 questions: 2 technical depth, 2 system design or architecture, 2 behavioral/past experience, 2 situational/tradeoff. Vary question types - no two consecutive questions of the same type. For behavioral questions, reframe them as open questions to the candidate. For situational questions, present them as real scenarios. For system design, present them as "Design a [system]" prompts. Return JSON: { interviewTitle: string, questions: [ { id, question, type: 'technical'|'design'|'behavioral'|'situational', whatWeAreLookingFor: string, followUpIfStrong: string, followUpIfWeak: string } ] }`,
    normalizeMockQuestions,
    {
      maxTokens: 2000,
      timeoutMs: 30_000,
      model: 'deepseek/deepseek-chat',
      temperature: 0.8,
    },
  );
  const questions = generated.result.questions.map((question, index) => ({ ...question, id: `q-${index + 1}` }));
  const interviewId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO mock_interviews (
      id, user_id, domain, level, persona, interview_type, interview_title, status, questions, responses,
      current_question_index, started_at, paused_ms, last_saved_at, duration_minutes, completed_at, report_payload
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, 'started', ?::jsonb, '[]'::jsonb, 0, NOW(), 0, NOW(), 45, NULL, '{}'::jsonb
    )
  `).run(
    interviewId,
    params.userId,
    params.domain,
    params.level,
    params.persona,
    params.interviewType,
    generated.result.interviewTitle,
    JSON.stringify(questions),
  );
  for (const question of questions) {
    await db.prepare(`
      INSERT INTO question_history (id, user_id, domain, round_type, question_hash, question_text, seen_at)
      VALUES (?, ?, ?, 'mock-interview', ?, ?, NOW())
      ON CONFLICT (user_id, domain, round_type, question_hash) DO NOTHING
    `).run(crypto.randomUUID(), params.userId, params.domain, mockQuestionHash(question.question), question.question);
  }
  const interview = await loadMockInterview(params.userId, interviewId);
  if (!interview) throw new Error('mock_interview_load_failed');
  return interview;
}

function buildFallbackMockReport(interview: Awaited<ReturnType<typeof mapMockInterviewRow>>) {
  const scored = interview.responses.map((response) => response.internalScore).filter((score): score is number => typeof score === 'number');
  const average = scored.length ? Math.round(scored.reduce((sum, score) => sum + score, 0) / scored.length) : 5;
  return {
    overallScore: average,
    readinessVerdict: average >= 8 ? 'ready' : average >= 6 ? 'borderline' : 'not-ready',
    technicalDepth: 'Use more concrete mechanisms, failure modes, and examples from real systems.',
    communicationClarity: 'Structure each answer with context, decision, tradeoff, outcome, and validation.',
    designThinking: 'Call out constraints, alternatives, and how you would monitor the chosen approach.',
    behavioralMaturity: 'Tie ownership stories to impact and learning.',
    topThreeStrengths: ['Completed the interview flow', 'Provided answer signal across questions', 'Stayed engaged through the round'],
    topThreeWeaknesses: ['Needs more specificity', 'Some evaluations may be unavailable', 'Tradeoffs can be sharper'],
    criticalGaps: interview.responses.some((response) => response.internalScore === null) ? ['evaluation unavailable for one or more questions'] : ['deeper examples needed'],
    studyPlan: [
      { area: 'Answer structure', action: 'Practice STAR plus technical tradeoff framing for each answer.', estimatedDays: 3 },
      { area: 'Domain depth', action: 'Review the weak question types from this interview and write model answers.', estimatedDays: 5 },
    ],
    hiringPanelSummary: 'The candidate showed useful signal but needs more concrete, domain-specific depth before a strong recommendation.',
  };
}

async function generatePracticeSessionQuestions(params: {
  userId: string;
  domain: PracticeDomainId;
  topic: string;
  level: string;
}) {
  const roundType = `practice:${normalizePracticeTopic(params.topic).replace(/\s+/g, '-')}`;
  const seenRows = await db.query<{ question_hash: string; question_text: string }>(`
    SELECT question_hash, question_text
      FROM question_history
     WHERE user_id = $1
       AND domain = $2
       AND round_type = $3
     ORDER BY seen_at DESC
     LIMIT 24
  `, [params.userId, params.domain, roundType]);
  const seenHashes = new Set(seenRows.map((row) => String(row.question_hash ?? '')));
  const repoContext = await getLatestRepoContext(params.userId);

  const maxAttempts = 2;
  const comprehensionPhaseTimeoutMs = 45_000;
  const codeReadingSubphaseTimeoutMs = 40_000;
  let questions: PracticeSessionQuestion[] = [];
  let lastError: string | null = null;

  const runPhaseWithTimeout = async <T,>(phaseLabel: string, timeoutMs: number, action: () => Promise<T>) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    try {
      return await Promise.race([
        action(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error(`practice_phase_timeout:${phaseLabel}`)), timeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    await checkAiRateLimit(params.userId, 'practice-session-generation', 5);
    const sessionSeed = hashText(`${params.userId}:${params.topic}:${Date.now()}:attempt-${attempt}`).slice(0, 20);
    const start = Date.now();
    console.log('[practice-gen] start', { topic: params.topic, domain: params.domain, userId: params.userId });
    try {
      const generatePhase = async (phase: 'phase1' | 'phase2a' | 'phase2b', extraSeenHashes: string[] = []) => {
        const isComprehensionPhase = phase === 'phase1';
        const phaseLabel = phase;
        const expectedCount = isComprehensionPhase ? 20 : 10;
        const timeoutMs = isComprehensionPhase ? comprehensionPhaseTimeoutMs : codeReadingSubphaseTimeoutMs;
        const maxTokens = isComprehensionPhase ? 7000 : 3500;
        const phaseSeed = phase === 'phase1' ? 'phase-1' : phase === 'phase2a' ? 'phase-2a' : 'phase-2b';
        const codeReadingBatch = phase === 'phase2b' ? '2 of 2' : '1 of 2';
        const promptSeenHashes = JSON.stringify([...seenHashes, ...extraSeenHashes]);
        const modelConfig = resolveModelConfig('deepseek/deepseek-chat');
        const endpoint = modelConfig.provider === 'openai-compat'
          ? `${modelConfig.baseUrl}/chat/completions`
          : `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelConfig.model)}:generateContent`;
        console.log(`[practice-gen] ${phaseLabel} config:`, {
          attempt,
          provider: modelConfig.provider,
          model: modelConfig.model,
          endpoint,
          stream: false,
          timeoutMs,
          maxTokens,
        });
        const systemPrompt = `You are a senior ${PRACTICE_DOMAIN_LABELS[params.domain]} engineer. Questions must test real engineering judgment. No trivia. No memorization-only questions. Return only valid JSON matching the schema. Your entire response must be a single JSON object. Start your response with { and end with }. Do not include any text before or after the JSON object. Do not use markdown code fences.`;
        const userPrompt = isComprehensionPhase
          ? `Domain: ${PRACTICE_DOMAIN_LABELS[params.domain]}. Topic: ${params.topic}. User level: ${params.level || 'intermediate'}. Repo context: ${repoContext || 'none'}. Session seed: ${sessionSeed}:${phaseSeed}. Previously seen question hashes: ${promptSeenHashes}. Generate exactly 20 questions: 10 MCQ and 10 fill-in-the-blank. Do not generate code-reading questions in this phase. Return JSON: { topic: string, domain: string, totalQuestions: 20, questions: [ { id: string, type: 'mcq' | 'fill-blank', question: string, codeBlock: null, blank: string | null, options: string[] | null, correctAnswer: string, explanation: string, difficulty: 'easy' | 'medium' | 'hard', tags: string[] } ] }. Rules: MCQ must have exactly 4 options. fill-blank must have a non-trivial blank - a technical term, pattern name, or decision, not a single letter. For MCQ and fill-blank questions, the question field must contain only plain prose. Never use markdown backtick fences inside the question string. If a question needs code to be shown, do not emit it in this phase; that question belongs in the code-reading phase where the code goes in codeBlock. Count the questions before returning. The questions array for this call must have length 20. Vary difficulty: roughly 30% easy, 50% medium, 20% hard.`
          : `Domain: ${PRACTICE_DOMAIN_LABELS[params.domain]}. Topic: ${params.topic}. User level: ${params.level || 'intermediate'}. Repo context: ${repoContext || 'none'}. Session seed: ${sessionSeed}:${phaseSeed}. Previously seen question hashes: ${promptSeenHashes}. Code-reading batch: ${codeReadingBatch}. Generate exactly 10 code-reading questions. Each must include a realistic codeBlock of 10-25 lines. Your entire response is a single JSON object starting with { and ending with }. No markdown fences. No preamble. Return JSON: { topic: string, domain: string, totalQuestions: 10, questions: [ { id: string, type: 'code-reading', question: string, codeBlock: string, blank: string | null, options: string[] | null, correctAnswer: string, explanation: string, difficulty: 'easy' | 'medium' | 'hard', tags: string[] } ] }. Rules: The questions array for this call must have length 10. Each question must ask a specific judgment question about the code - what is wrong, what will happen, what should be changed, what pattern is this, or what is the output. The question field must contain only plain prose. Put code only in codeBlock. Never use markdown backtick fences inside the question string. If options are present, provide exactly 4 options; otherwise set options to null and use a short answer correctAnswer. Code snippets must be real-world patterns, not toy examples. Escape JSON strings correctly. Vary difficulty: roughly 30% easy, 50% medium, 20% hard.`;

        const phaseStartedAt = Date.now();
        try {
          const generated = await runPhaseWithTimeout(phaseLabel, timeoutMs, () => callStructuredModel(
            systemPrompt,
            userPrompt,
            (payload) => {
              const source = payload && typeof payload === 'object' ? payload as { questions?: unknown } : {};
              const rawQuestions = Array.isArray(source.questions) ? source.questions : [];
              console.log(`[practice-gen] ${phaseLabel} raw count:`, rawQuestions.length);
              const validation = validatePracticeSession(payload, expectedCount);
              console.log('[practice-gen] after-validation count:', validation.validQuestions.length, {
                phase: phaseLabel,
                invalidCount: validation.invalidCount,
              });
              if (!validation.valid) {
                console.warn('[practice-gen] validation-failed', {
                  domain: params.domain,
                  topic: params.topic,
                  attempt,
                  phase,
                  invalidCount: validation.invalidCount,
                  invalidIndexes: validation.invalidIndexes.slice(0, 12),
                  invalidDetails: validation.invalidDetails.slice(0, 12),
                });
                if (validation.invalidCount > 4) {
                  throw new Error(`practice_validation_failed:${phase}:${validation.invalidCount}`);
                }
              }
              return validation.validQuestions
                .map((item, index) => normalizePracticeQuestionPayload(item, index, params.topic))
                .filter((item): item is PracticeSessionQuestion => Boolean(item));
            },
            {
              maxTokens,
              timeoutMs,
              model: 'deepseek/deepseek-chat',
              temperature: 0.7,
            },
          ));
          console.log(`[practice-gen] ${phaseLabel} count:`, generated.result.length);
          console.log(`[practice-gen] ${phaseLabel} rawLength:`, generated.rawLength);
          return generated.result;
        } finally {
          console.log(`[practice-gen] ${phaseLabel} duration:`, Date.now() - phaseStartedAt, 'ms');
        }
      };

      const comprehensionQuestions = await generatePhase('phase1');
      const phase2aQuestions = await generatePhase('phase2a');
      const phase2aHashes = phase2aQuestions.map((question) => practiceQuestionHistoryHash(question));
      const phase2bQuestions = await generatePhase('phase2b', phase2aHashes);

      console.log('[practice-gen] done', { topic: params.topic, domain: params.domain, durationMs: Date.now() - start });
      const mcq = comprehensionQuestions.filter((question) => question.type === 'mcq').slice(0, 10);
      const fillBlank = comprehensionQuestions.filter((question) => question.type === 'fill-blank').slice(0, 10);
      const codeReading = [...phase2aQuestions, ...phase2bQuestions].filter((question) => question.type === 'code-reading').slice(0, 20);
      questions = [...mcq, ...fillBlank, ...codeReading];
      const mergedValidation = validatePracticeSession({ questions }, 40);
      console.log('[practice-gen] merged after-validation count:', mergedValidation.validQuestions.length, {
        invalidCount: mergedValidation.invalidCount,
      });
      if (!mergedValidation.valid) {
        lastError = `practice_merged_validation_failed:${mergedValidation.invalidCount}`;
        console.warn('[practice-gen] merged-validation-failed', {
          domain: params.domain,
          topic: params.topic,
          attempt,
          invalidCount: mergedValidation.invalidCount,
          invalidIndexes: mergedValidation.invalidIndexes.slice(0, 12),
          invalidDetails: mergedValidation.invalidDetails.slice(0, 12),
        });
        questions = [];
        continue;
      }
      const questionHashes = questions.map((question) => practiceQuestionHistoryHash(question));
      const duplicateCount = questionHashes.length - new Set(questionHashes).size;
      const repeatCount = questionHashes.filter((hash) => seenHashes.has(hash)).length;
      const hasCodeBlocksWithinTarget = codeReading.length === 20 && codeReading.every((question) => {
        const lineCount = (question.codeBlock ?? '').split(/\r?\n/).filter(Boolean).length;
        return lineCount >= 10 && lineCount <= 25;
      });
      if (mcq.length === 10 && fillBlank.length === 10 && codeReading.length === 20 && questions.length === 40 && duplicateCount === 0 && repeatCount <= 8) {
        if (!hasCodeBlocksWithinTarget) {
          console.warn('[practice-gen] code-block-line-target-missed', {
            domain: params.domain,
            topic: params.topic,
            attempt,
          });
        }
        break;
      }
      lastError = `quality_check_failed:length=${questions.length},mcq=${mcq.length},fill=${fillBlank.length},code=${codeReading.length},duplicates=${duplicateCount},repeats=${repeatCount},codeBlocks=${hasCodeBlocksWithinTarget}`;
      console.warn('[practice-gen] quality-check-failed', {
        domain: params.domain,
        topic: params.topic,
        attempt,
        totalQuestions: questions.length,
        mcq: mcq.length,
        fillBlank: fillBlank.length,
        codeReading: codeReading.length,
        duplicateCount,
        repeatCount,
        hasCodeBlocks: hasCodeBlocksWithinTarget,
      });
      questions = [];
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      const rawText = typeof (error as { rawResponse?: unknown }).rawResponse === 'string'
        ? String((error as { rawResponse?: unknown }).rawResponse)
        : '';
      if (/phase2a|phase2b/i.test(lastError)) {
        console.warn('[practice-gen] phase2 failure rawLength:', rawText.length, {
          domain: params.domain,
          topic: params.topic,
          attempt,
          error: lastError,
        });
      }
      if (rawText) {
        console.error('[practice-gen] parse-failed', {
          domain: params.domain,
          topic: params.topic,
          attempt,
          rawLength: rawText.length,
          rawPreview: rawText.slice(0, 500),
          rawTail: rawText.slice(-200),
          error: lastError,
        });
      }
      console.warn('Practice session model generation attempt failed.', {
        domain: params.domain,
        topic: params.topic,
        attempt,
        error: lastError,
      });
      if (/^(analysis_timeout|practice_phase_timeout:)/.test(lastError)) {
        break;
      }
    }
  }

  if (questions.length !== 40) {
    throw new Error(`aiUnavailable: Unable to generate 40 practice questions right now. Last error: ${lastError ?? 'unknown'}`);
  }

  for (const question of questions) {
    const questionHash = practiceQuestionHistoryHash(question);
    await db.prepare(`
      INSERT INTO question_history (id, user_id, domain, round_type, question_hash, question_text, seen_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON CONFLICT (user_id, domain, round_type, question_hash) DO NOTHING
    `).run(crypto.randomUUID(), params.userId, params.domain, roundType, questionHash, question.question);
  }

  return questions;
}

async function callStructuredModel<T>(
  systemPrompt: string,
  userPrompt: string,
  normalize: (payload: unknown) => T,
  options: { maxTokens?: number; timeoutMs?: number; model?: string; temperature?: number; topP?: number; abortSignal?: AbortSignal } = {},
): Promise<{ result: T; provider: string; model: string; rawLength: number }> {
  const config = resolveModelConfig(options.model);
  const abortController = new AbortController();
  const timeout = options.timeoutMs
    ? setTimeout(() => abortController.abort(new Error('analysis_timeout')), options.timeoutMs)
    : null;
  const unlinkAbortSignal = linkAbortSignal(abortController, options.abortSignal);

  let rawText = '';
  try {
    if (config.provider === 'openai-compat') {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: abortController.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: options.temperature ?? 0.2,
        top_p: options.topP ?? undefined,
        max_tokens: options.maxTokens ?? 4000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    });

    const responseText = await response.text();
    const data = (() => {
      try {
        return JSON.parse(responseText) as {
          error?: { message?: string };
          choices?: Array<{ message?: { content?: unknown } }>;
        };
      } catch {
        return { error: { message: responseText } };
      }
    })();
    if (!response.ok) {
      throw new Error(`model_http_${response.status}: ${String(data.error?.message ?? (responseText || 'Prep analysis request failed.'))}`);
    }

    rawText = readMessageText(data.choices?.[0]?.message?.content);
  } else {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
      {
        method: 'POST',
        signal: abortController.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [{ parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: options.temperature ?? 0.2,
            topP: options.topP ?? undefined,
            responseMimeType: 'application/json',
            maxOutputTokens: options.maxTokens ?? 4000,
          },
        }),
      },
    );

    const responseText = await response.text();
    const data = (() => {
      try {
        return JSON.parse(responseText) as {
          error?: { message?: string };
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
      } catch {
        return { error: { message: responseText } };
      }
    })();
    if (!response.ok) {
      throw new Error(`model_http_${response.status}: ${String(data.error?.message ?? (responseText || 'Gemini prep analysis request failed.'))}`);
    }

    rawText = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  }

    if (!rawText.trim()) {
      const error = new Error('model_empty_response') as Error & { rawResponse?: string };
      error.rawResponse = rawText;
      throw error;
    }

    let parsed: unknown;
    try {
      parsed = parseStructuredPayload(rawText);
    } catch (parseError) {
      const error = new Error('model_json_parse_failed') as Error & { rawResponse?: string };
      error.rawResponse = rawText;
      throw error;
    }
    let result: T;
    try {
      result = normalize(parsed);
    } catch (normalizeError) {
      if (normalizeError instanceof Error) {
        (normalizeError as Error & { rawResponse?: string }).rawResponse = rawText;
      }
      throw normalizeError;
    }
    return {
      result,
      provider: config.provider,
      model: config.model,
      rawLength: rawText.length,
    };
  } catch (error) {
    if (abortController.signal.aborted) {
      const reason = abortController.signal.reason;
      if (reason instanceof Error) throw reason;
      throw new Error(String(reason ?? 'analysis_timeout'));
    }
    throw error;
  } finally {
    unlinkAbortSignal();
    if (timeout) clearTimeout(timeout);
  }
}

async function callTextModel(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; timeoutMs?: number; model?: string; temperature?: number; topP?: number; abortSignal?: AbortSignal } = {},
): Promise<{ text: string; provider: string; model: string; rawLength: number }> {
  const config = resolveModelConfig(options.model);
  const abortController = new AbortController();
  const timeout = options.timeoutMs
    ? setTimeout(() => abortController.abort(new Error('analysis_timeout')), options.timeoutMs)
    : null;
  const unlinkAbortSignal = linkAbortSignal(abortController, options.abortSignal);

  try {
    let rawText = '';
    if (config.provider === 'openai-compat') {
      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        signal: abortController.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: options.temperature ?? 0,
          top_p: options.topP ?? undefined,
          max_tokens: options.maxTokens ?? 100,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        }),
      });

      const responseText = await response.text();
      const data = (() => {
        try {
          return JSON.parse(responseText) as {
            error?: { message?: string };
            choices?: Array<{ message?: { content?: unknown } }>;
          };
        } catch {
          return { error: { message: responseText } };
        }
      })();
      if (!response.ok) {
        throw new Error(`model_http_${response.status}: ${String(data.error?.message ?? (responseText || 'Text model request failed.'))}`);
      }

      rawText = readMessageText(data.choices?.[0]?.message?.content).trim();
    } else {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.apiKey)}`,
        {
          method: 'POST',
          signal: abortController.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [{ parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: options.temperature ?? 0,
              topP: options.topP ?? undefined,
              responseMimeType: 'text/plain',
              maxOutputTokens: options.maxTokens ?? 100,
            },
          }),
        },
      );

      const responseText = await response.text();
      const data = (() => {
        try {
          return JSON.parse(responseText) as {
            error?: { message?: string };
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
          };
        } catch {
          return { error: { message: responseText } };
        }
      })();
      if (!response.ok) {
        throw new Error(`model_http_${response.status}: ${String(data.error?.message ?? (responseText || 'Gemini text request failed.'))}`);
      }

      rawText = String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
    }

    if (!rawText) {
      throw new Error('model_empty_response');
    }

    return {
      text: rawText,
      provider: config.provider,
      model: config.model,
      rawLength: rawText.length,
    };
  } catch (error) {
    if (abortController.signal.aborted) {
      const reason = abortController.signal.reason;
      if (reason instanceof Error) throw reason;
      throw new Error(String(reason ?? 'analysis_timeout'));
    }
    throw error;
  } finally {
    unlinkAbortSignal();
    if (timeout) clearTimeout(timeout);
  }
}

async function callGithubStructuredModel<T>(
  systemPrompt: string,
  userPrompt: string,
  normalize: (payload: unknown) => T,
  options: { maxTokens?: number; timeoutMs?: number; temperature?: number; topP?: number; jobId?: string; repoName?: string; stage?: string } = {},
): Promise<{ result: T; provider: string; model: string }> {
  let lastError: unknown = null;
  for (const model of githubScanModelCandidates()) {
    try {
      return await callStructuredModel<T>(systemPrompt, userPrompt, normalize, {
        model,
        maxTokens: options.maxTokens,
        timeoutMs: options.timeoutMs,
        temperature: options.temperature,
        topP: options.topP,
      });
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error ?? '');
      console.warn('GitHub repo scan model attempt failed', {
        jobId: options.jobId,
        repoName: options.repoName,
        stage: options.stage,
        model,
        error: message,
      });
      if (!isRetryableGithubModelError(error)) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('model_generation_failed');
}

function parseGitHubRepository(input: string): { owner: string; repo: string } | null {
  const match = input.trim().match(/github\.com\/(.+?)\/(.+?)(?:\.git|\/|$)/i);
  if (!match) return null;
  return {
    owner: match[1],
    repo: match[2],
  };
}

function normalizeGithubRepoUrl(input: string): string | null {
  const parsed = parseGitHubRepository(input);
  if (!parsed) return null;
  return `https://github.com/${parsed.owner}/${parsed.repo.replace(/\.git$/i, '')}`;
}

type RepoTreeItem = {
  path?: string;
  type?: string;
  url?: string;
};

function categorizeRepoPath(filePath: string): string | null {
  const lower = filePath.toLowerCase();
  const fileName = lower.split('/').pop() ?? lower;
  if (['package.json', 'requirements.txt', 'pyproject.toml', 'go.mod', 'cargo.toml'].includes(fileName)) return 'stack';
  if (fileName === 'readme.md') return 'readme';
  if (fileName === '.env.example') return 'envExample';
  if (/(route|routes|controller|api|handler)/i.test(filePath)) return 'apiLayer';
  if (/(auth|middleware|guard|session|jwt|oauth)/i.test(filePath)) return 'authLayer';
  if (/(schema|model|migration|prisma|drizzle|entity|database)/i.test(filePath)) return 'databaseLayer';
  return null;
}

async function fetchGitHubRepositoryContext(projectInput: string, accessToken?: string | null): Promise<string> {
  const parsed = parseGitHubRepository(projectInput);
  if (!parsed) return projectInput;

  const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const token = accessToken?.trim() || process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const rawHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const [repoResponse, languagesResponse] = await Promise.all([
    fetch(repoUrl, { headers }).catch(() => null),
    fetch(`${repoUrl}/languages`, { headers }).catch(() => null),
  ]);

  if (repoResponse?.status === 404) {
    throw new Error('Repository not found or private. Add a public repository or configure GITHUB_TOKEN.');
  }
  if (repoResponse?.status === 403) {
    const retryAfter = repoResponse.headers.get('retry-after');
    throw new Error(`GitHub rate limit reached.${retryAfter ? ` Retry after ${retryAfter} seconds.` : ''}`);
  }

  const repoData = repoResponse && repoResponse.ok
    ? await repoResponse.json().catch(() => ({})) as Record<string, unknown>
    : {};
  const languagesData = languagesResponse && languagesResponse.ok
    ? await languagesResponse.json().catch(() => ({})) as Record<string, number>
    : {};

  const repoDescription = String(repoData.description ?? '').trim();
  const defaultBranch = String(repoData.default_branch ?? '').trim();
  const primaryLanguage = String(repoData.language ?? '').trim();
  const topics = Array.isArray(repoData.topics) ? repoData.topics.map((topic) => String(topic)).join(', ') : '';
  const languages = Object.keys(languagesData).join(', ');
  const treeResponse = defaultBranch
    ? await fetch(`${repoUrl}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, { headers }).catch(() => null)
    : null;
  const treeData = treeResponse && treeResponse.ok
    ? await treeResponse.json().catch(() => ({})) as { tree?: RepoTreeItem[] }
    : {};

  const grouped = new Map<string, RepoTreeItem[]>();
  (treeData.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path)
    .forEach((item) => {
      const category = categorizeRepoPath(item.path!);
      if (!category) return;
      grouped.set(category, [...(grouped.get(category) ?? []), item]);
    });

  const priority = ['authLayer', 'databaseLayer', 'apiLayer', 'stack', 'readme', 'envExample'];
  const selectedFiles = priority.flatMap((category) => (grouped.get(category) ?? []).slice(0, category === 'stack' ? 8 : 10));
  let remainingBudget = 80000;
  const fileBlocks: string[] = [];

  for (const file of selectedFiles) {
    if (!file.path || remainingBudget <= 0) break;
    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(defaultBranch)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const rawResponse = await fetch(rawUrl, { headers: rawHeaders }).catch(() => null);
    if (!rawResponse?.ok) continue;
    const content = (await rawResponse.text().catch(() => '')).slice(0, remainingBudget);
    if (!content.trim()) continue;
    remainingBudget -= content.length;
    fileBlocks.push(`FILE: ${file.path}\n${content}`);
  }

  return [
    `Project input: ${projectInput}`,
    repoDescription ? `Repository description: ${repoDescription}` : '',
    primaryLanguage ? `Primary language: ${primaryLanguage}` : '',
    defaultBranch ? `Default branch: ${defaultBranch}` : '',
    topics ? `Topics: ${topics}` : '',
    languages ? `Detected languages: ${languages}` : '',
    fileBlocks.length ? `Detected key files:\n\n${fileBlocks.join('\n\n---\n\n')}` : '',
  ].filter(Boolean).join('\n\n');
}

type GithubRepoContext = {
  repoName: string;
  repoUrl: string;
  detectedStack: string[];
  fileContents: string;
  readmeContent: string;
  limited: boolean;
};

type RepoFileCategory = 'auth' | 'schema' | 'routes' | 'stack' | 'readme' | 'env' | 'components' | 'other';

export async function fetchGithubRepoForQuestionSet(repoUrlInput: string, accessToken?: string | null): Promise<GithubRepoContext> {
  const parsed = parseGitHubRepository(repoUrlInput);
  if (!parsed) throw new Error('invalid_github_url');
  const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const token = accessToken?.trim() || process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const rawHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const repoResponse = await fetch(repoUrl, { headers }).catch(() => null);
  if (repoResponse?.status === 404) throw new Error('private_repo');
  if (repoResponse?.status === 403) throw new Error('rate_limited');
  if (!repoResponse?.ok) throw new Error('github_fetch_failed');
  const repoData = await repoResponse.json().catch(() => ({})) as Record<string, unknown>;
  const defaultBranch = String(repoData.default_branch ?? 'main');
  const repoName = String(repoData.name ?? parsed.repo);
  const [languagesResponse, treeResponse] = await Promise.all([
    fetch(`${repoUrl}/languages`, { headers }).catch(() => null),
    fetch(`${repoUrl}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, { headers }).catch(() => null),
  ]);
  const languagesData = languagesResponse?.ok ? await languagesResponse.json().catch(() => ({})) as Record<string, number> : {};
  if (treeResponse?.status === 403) throw new Error('rate_limited');
  if (treeResponse?.status === 404) throw new Error('private_repo');
  if (!treeResponse?.ok) throw new Error('github_fetch_failed');
  const treeData = await treeResponse.json().catch(() => ({})) as { tree?: RepoTreeItem[] };
  const codeExtensions = /\.(tsx?|jsx?|py|go|rs|java|cs|php|rb|sql|prisma|json|md|yml|yaml|toml|css|scss|svelte|vue)$/i;
  const ignored = /(^|\/)(node_modules|dist|build|coverage|\.git|vendor|__pycache__|\.next|target)\//i;
  const categoryForPath = (filePath: string): RepoFileCategory | null => {
    const lower = filePath.toLowerCase();
    const fileName = lower.split('/').pop() ?? lower;
    if (['package.json', 'requirements.txt', 'pyproject.toml'].includes(fileName)) return 'stack';
    if (lower === 'readme.md') return 'readme';
    if (fileName === '.env.example') return 'env';
    if (/(auth|middleware|guard)/i.test(filePath)) return 'auth';
    if (/(schema|model|migration|prisma)/i.test(filePath)) return 'schema';
    if (/(route|controller|api|handler)/i.test(filePath)) return 'routes';
    if (/(^|\/)(components|component|views|pages|app|src)\//i.test(filePath) && /\.(tsx|jsx|ts|js|vue|svelte|css|scss)$/i.test(filePath)) return 'components';
    if (codeExtensions.test(filePath)) return 'other';
    return null;
  };
  const priorityScore = (category: RepoFileCategory) => ({
    auth: 0,
    schema: 1,
    routes: 2,
    stack: 3,
    readme: 4,
    env: 5,
    components: 6,
    other: 7,
  })[category];
  const files = (treeData.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path && !ignored.test(item.path))
    .map((item) => {
      const category = categoryForPath(item.path!);
      return category ? { path: item.path!, category } : null;
    })
    .filter((item): item is { path: string; category: RepoFileCategory } => Boolean(item))
    .sort((a, b) => {
      return priorityScore(a.category) - priorityScore(b.category) || a.path.length - b.path.length || a.path.localeCompare(b.path);
    })
    .slice(0, 140);
  const fetchedFiles = await Promise.all(files.map(async (file) => {
    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(defaultBranch)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const rawResponse = await fetch(rawUrl, { headers: rawHeaders }).catch(() => null);
    if (!rawResponse?.ok) return null;
    const content = await rawResponse.text().catch(() => '');
    if (!content.trim()) return null;
    return { ...file, content };
  }));
  const blocks: string[] = [];
  let readmeContent = '';
  let meaningfulFileCount = 0;
  let remainingBudget = GITHUB_SCAN_INPUT_CHAR_BUDGET;
  const stackHints = new Set<string>([
    ...Object.keys(languagesData),
    String(repoData.language ?? ''),
  ].filter(Boolean));

  for (const file of fetchedFiles.filter(Boolean) as Array<{ path: string; category: RepoFileCategory; content: string }>) {
    if (remainingBudget <= 0) break;
    const text = file.content.slice(0, remainingBudget);
    if (!text.trim()) continue;
    remainingBudget -= text.length;
    if (file.category === 'stack') {
      stackHints.add(file.path.split('/').pop() ?? file.path);
      if (file.path.toLowerCase().endsWith('package.json')) {
        try {
          const packageJson = JSON.parse(text) as { dependencies?: Record<string, unknown>; devDependencies?: Record<string, unknown> };
          Object.keys({ ...(packageJson.dependencies ?? {}), ...(packageJson.devDependencies ?? {}) })
            .slice(0, 16)
            .forEach((dependency) => stackHints.add(dependency));
        } catch {
          // Keep the raw package file in the prompt even if dependency parsing fails.
        }
      }
    }
    if (file.category === 'readme') {
      readmeContent = text;
      continue;
    }
    if (['auth', 'schema', 'routes', 'components', 'other'].includes(file.category)) {
      meaningfulFileCount += 1;
    }
    blocks.push(`FILE: ${file.path}\n${text}`);
  }
  const stack = Array.from(stackHints).slice(0, 14);
  return {
    repoName,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
    detectedStack: stack,
    fileContents: blocks.join('\n\n---\n\n'),
    readmeContent,
    limited: meaningfulFileCount < 3,
  };
}

const GITHUB_REPO_SCAN_SYSTEM_PROMPT = `You are a senior software engineer with 10 years of experience conducting technical interviews at product companies. You have been given the complete file contents of a GitHub repository. Your only job is to generate interview questions that are strictly and exclusively derived from what exists in this specific codebase. You are not allowed to generate generic questions about the technologies used. Every single question must reference something that actually exists in this repo — a specific file, a specific function, a specific pattern, a specific architectural decision, or a specific piece of logic found in the code. If you cannot tie a question directly to something found in the files provided, do not include that question. No generic React questions. No generic Node questions. No generic SQL questions. Only questions that could not exist without this specific repo.`;

const GITHUB_REPO_SCAN_USER_PROMPT = `REPO NAME: {repoName}

DETECTED FILES AND CONTENTS:
{fileContents}

README:
{readmeContent}

Before generating any questions, detect the primary domain of this repository from the files provided. The domain must be one of: Frontend, Backend, Full Stack, AI and ML, Cybersecurity, Blockchain and Web3, DevOps and Infrastructure, Data Engineering, Mobile, or General Software. You may detect up to two domains if the repo genuinely spans both, for example a Full Stack repo or an AI app with a backend API layer.

Before generating any questions, perform a deep read of every file provided and extract implementation intelligence separately for frontend and backend where those layers exist.

For frontend analysis, identify: every React component and what it renders, every custom hook and what state or side effect it manages, every context provider and what it exposes, every page component and its routing logic, every fetch or API call made from the client side and what endpoint it hits, every form and what validation it performs, every state management pattern used whether useState or useReducer or Zustand or Redux, every use of useEffect and what dependency array it has and what cleanup it performs, every conditional render and what condition controls it, every client side navigation pattern, every loading and error state handling, and every prop drilling chain or context consumption pattern.

For backend analysis, identify: every API route and its HTTP method and what it does, every middleware and what it validates or transforms, every database query and whether it is optimized or could cause N plus 1 problems, every authentication check and whether it is correctly placed, every input validation and whether it is complete or missing fields, every error response and whether it leaks sensitive information, every environment variable usage and whether any are missing or insecure, every async operation and whether errors are properly caught, every data transformation between database and response, and every potential race condition or missing transaction.

Use this intelligence exclusively to generate the questions below. Every frontend question must reference a specific component, hook, page, or client side pattern found in the files. Every backend question must reference a specific route, middleware, query, or server side pattern found in the files.

Generate exactly 56 interview questions divided into seven sections. Return only a valid JSON object. Do not return any prose, explanation, markdown formatting, code fences, or any text outside the JSON object. The JSON object must have exactly this structure:

projectName: string — the repository name.

detectedDomains: array of one or two strings — the detected domain or domains.

projectSummary: string — a single paragraph of 3 to 4 sentences describing what this application does, what stack it uses, and what the two or three most technically interesting aspects of the codebase are. Write this as if you are briefing an interviewer who has 30 seconds to understand the project. Be specific — name actual libraries, actual file names, actual patterns found in the code. Do not write generic descriptions.

sections: array of exactly 7 objects. Each object has: sectionId (string), sectionTitle (string), sectionDescription (string, one sentence describing what this section tests), and questions (array of question objects).

Each question object must have: id (string, q1 through q56 sequentially across all sections), questionText (string, the full question), type (string, one of: mcq, open, coding, scenario), difficulty (string, one of: easy, medium, hard), fileReference (string, the exact file name or path from this repo that this question is based on — this field is mandatory, never null, never generic like "src folder", must be a specific file name found in the provided content), conceptTag (string, short concept name like "JWT refresh token" or "useEffect cleanup" or "Prisma relation query"), and correctAnswer (string, mandatory for every question, containing the proper answer an interviewer would expect for this exact repo-specific question). For type mcq only, also include options (array of 4 strings), and correctAnswer must match one of the options exactly.

Answer rules you must follow without exception: Every question must have a proper, useful correctAnswer. For open questions, correctAnswer must be a concise model answer in 3 to 6 sentences that references the specific file or implementation detail. For scenario questions, correctAnswer must explain the recommended production response, the code area to inspect or change, and the tradeoff involved. For coding questions, correctAnswer must include the completed/fixed/explained code or a precise explanation of the expected fix, grounded in the actual snippet shown in questionText. Do not use vague answers like "answers may vary" or "depends"; give the strongest expected answer based on the repository content.

Section rules you must follow without exception:

Section one: sectionId "project-overview", sectionTitle "Project Overview", exactly 6 questions of type open at difficulty easy or medium. These cover what the app does, the overall architecture, folder structure decisions, technology choices, and how data flows from the client to the database and back. Every question must reference a specific file found in the repo.

Section two: sectionId "frontend-deep-dive", sectionTitle "Frontend Deep Dive" if frontend files exist. If the repo is not frontend-heavy, replace the title with the most accurate detected domain deep dive title, such as "AI and ML Deep Dive", "Security Deep Dive", "Smart Contract Deep Dive", "Infrastructure Deep Dive", "Data Pipeline Deep Dive", or "Mobile Deep Dive". Exactly 10 questions total: 3 open medium questions, 3 coding medium or hard questions, 2 scenario medium questions, and 2 mcq medium questions. Ground every question in actual files.

Section three: sectionId "backend-deep-dive", sectionTitle "Backend Deep Dive" if backend files exist. If the repo is not backend-heavy and section two already covers the primary domain, use the best complementary implementation deep dive title that fits actual files. Exactly 10 questions total: 3 open medium or hard questions, 3 coding hard questions, 2 scenario hard questions, and 2 mcq medium questions. Ground every question in actual route, middleware, query, schema, infrastructure, or service files.

Section four: sectionId "most-probable", sectionTitle "Most Probable Interview Questions", exactly 9 questions mixing open and mcq at medium difficulty. These are the questions that statistically come up in 80 percent of interviews when an interviewer has read this specific type of project.

Section five: sectionId "scenario-based", sectionTitle "Scenario Based Questions", exactly 8 questions of type scenario at medium or hard difficulty. Each scenario must describe a realistic production situation — a bug reported by a user, a performance degradation under load, a security incident, or a failed deployment — and ground it in the specific files and implementation choices of this repo.

Section six: sectionId "technical-deep-dive", sectionTitle "Technical Deep Dive", exactly 8 questions of type open at hard difficulty. These assume the interviewer has thoroughly read the code and wants to test whether the candidate truly understands the implications of every decision made.

Section seven: sectionId "red-flags-improvements", sectionTitle "Red Flags and Improvements", exactly 5 questions of type open at hard difficulty. These are questions about real weaknesses found in this specific codebase. The model must identify actual problems — missing input validation on a specific route, an in-memory store that breaks under horizontal scaling, a component that fetches on every render, a missing database index on a frequently queried field, an auth check that can be bypassed, or another genuine issue — and ask the candidate to explain the problem and propose a fix. Every question in this section must cite the specific file and specific code pattern where the issue exists. Do not invent problems; only flag things that are genuinely present in the provided files.

Additional rules you must never violate: Do not generate any question that could appear in a generic domain interview without referencing this specific repo. Every question must be answerable by someone who has thoroughly read this codebase. The fileReference field is not optional on any question — if you cannot cite a specific file, drop the question and replace it with one you can cite. The correctAnswer field is not optional on any question — if you cannot provide a specific, repo-grounded answer, drop the question and replace it with one you can answer properly. Questions about database must reference actual schema or model files found in the content. Questions about auth must reference the actual auth implementation files found. Questions about components must reference actual component files found. If the repo has no auth layer, generate zero auth questions. If the repo has no database files, generate zero database questions. Only generate questions about what actually exists in the provided files. The coding-based questions must embed actual code from the provided files inside the questionText — do not write fictional code. If a section genuinely cannot be filled with repo-specific questions due to limited file content, reduce its count and add a warnings array at the root of the JSON listing which sections were reduced and why.`;

const GITHUB_REPO_SCAN_PROFILE_PROMPT = `REPO NAME: {repoName}

DETECTED FILES AND CONTENTS:
{fileContents}

README:
{readmeContent}

Return only a valid JSON object with:
- projectName: string
- detectedDomains: array of one or two strings chosen only from Frontend, Backend, Full Stack, AI and ML, Cybersecurity, Blockchain and Web3, DevOps and Infrastructure, Data Engineering, Mobile, or General Software
- projectSummary: one concise paragraph of 3 to 4 sentences that names concrete libraries, files, or implementation choices from this repository

Do not return markdown, prose, or text outside JSON.`;

type GithubSectionSpec = {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  questionCount: number;
  instructions: string;
  sectionKind?: 'overview' | 'primary-domain' | 'secondary-domain' | 'standard';
};

const BASE_GITHUB_SECTION_SPECS: GithubSectionSpec[] = [
  {
    sectionId: 'project-overview',
    sectionTitle: 'Project Overview',
    sectionDescription: 'Repository-grounded overview questions about architecture, stack, folder structure, and data flow.',
    questionCount: 6,
    instructions: 'Create exactly 6 open questions at easy or medium difficulty.',
    sectionKind: 'overview',
  },
  {
    sectionId: 'most-probable',
    sectionTitle: 'Most Probable Interview Questions',
    sectionDescription: 'The highest-probability repository-specific questions an interviewer would ask.',
    questionCount: 9,
    instructions: 'Create exactly 9 medium-difficulty questions mixing open and mcq.',
    sectionKind: 'standard',
  },
  {
    sectionId: 'scenario-based',
    sectionTitle: 'Scenario Based Questions',
    sectionDescription: 'Production scenarios grounded in files and decisions from this repository.',
    questionCount: 8,
    instructions: 'Create exactly 8 scenario questions at medium or hard difficulty.',
    sectionKind: 'standard',
  },
  {
    sectionId: 'technical-deep-dive',
    sectionTitle: 'Technical Deep Dive',
    sectionDescription: 'Hard implementation and design questions for a code-reading interviewer.',
    questionCount: 8,
    instructions: 'Create exactly 8 open questions at hard difficulty.',
    sectionKind: 'standard',
  },
  {
    sectionId: 'red-flags-improvements',
    sectionTitle: 'Red Flags and Improvements',
    sectionDescription: 'Repo-specific weaknesses, risks, and realistic improvement opportunities.',
    questionCount: 5,
    instructions: 'Create exactly 5 open hard questions about genuine weaknesses present in the repo. Do not invent problems.',
    sectionKind: 'standard',
  },
];

type DomainDeepDiveProfile = {
  title: string;
  description: string;
};

function normalizeDetectedDomain(value: string | undefined) {
  const normalized = String(value ?? '').trim();
  return normalized || 'General Software';
}

function domainDeepDiveProfile(domain: string, layer: 'primary' | 'secondary'): DomainDeepDiveProfile {
  const normalized = normalizeDetectedDomain(domain);
  const suffix = layer === 'primary' ? 'Deep Dive' : 'Systems Deep Dive';
  const descriptions: Record<string, DomainDeepDiveProfile> = {
    Frontend: {
      title: layer === 'primary' ? 'Frontend Deep Dive' : 'Client Architecture Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded client rendering, state, data flow, and interaction questions.'
        : 'Deeper questions about browser behavior, client orchestration, and frontend architecture choices in this repo.',
    },
    Backend: {
      title: layer === 'primary' ? 'Backend Deep Dive' : 'Service Architecture Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded APIs, persistence, auth, and service-layer questions.'
        : 'Deeper questions about backend orchestration, reliability, and data flow across service boundaries.',
    },
    'Full Stack': {
      title: layer === 'primary' ? 'Frontend Application Deep Dive' : 'Backend Service Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded browser, UI-state, and client-to-server interaction questions.'
        : 'Repo-grounded APIs, persistence, auth, and backend orchestration questions.',
    },
    'AI and ML': {
      title: layer === 'primary' ? 'AI and ML Deep Dive' : 'Model and Data Pipeline Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded model, inference, feature, and ML application questions.'
        : 'Deeper questions about preprocessing, evaluation, data flow, and model-serving architecture.',
    },
    Cybersecurity: {
      title: layer === 'primary' ? 'Security Deep Dive' : 'Threat Modeling and Hardening Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded security controls, auth boundaries, and exploit-resistance questions.'
        : 'Deeper questions about abuse paths, trust boundaries, and hardening tradeoffs in the codebase.',
    },
    'Blockchain and Web3': {
      title: layer === 'primary' ? 'Smart Contract Deep Dive' : 'Protocol and On-Chain Security Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded contract logic, state transitions, and integration questions.'
        : 'Deeper questions about protocol safety, transaction flows, and on-chain risk handling.',
    },
    'DevOps and Infrastructure': {
      title: layer === 'primary' ? 'Infrastructure Deep Dive' : 'Deployment and Reliability Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded build, deployment, provisioning, and runtime infrastructure questions.'
        : 'Deeper questions about rollout safety, observability, resilience, and environment management.',
    },
    'Data Engineering': {
      title: layer === 'primary' ? 'Data Pipeline Deep Dive' : 'Storage and Processing Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded ingestion, transformation, and pipeline control-flow questions.'
        : 'Deeper questions about storage layout, scheduling, consistency, and backfill behavior.',
    },
    Mobile: {
      title: layer === 'primary' ? 'Mobile Deep Dive' : 'Device Integration and Runtime Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded mobile state, navigation, data sync, and screen architecture questions.'
        : 'Deeper questions about device APIs, offline behavior, performance, and platform constraints.',
    },
    'General Software': {
      title: layer === 'primary' ? 'Core Implementation Deep Dive' : 'Architecture and Tradeoffs Deep Dive',
      description: layer === 'primary'
        ? 'Repo-grounded questions about the project’s primary implementation layer.'
        : 'Deeper questions about architecture, reliability, and tradeoffs visible in the codebase.',
    },
  };
  return descriptions[normalized] ?? {
    title: `${normalized} ${suffix}`,
    description: `Repo-grounded ${normalized.toLowerCase()} implementation and architecture questions.`,
  };
}

function buildStagedSectionSpecs(profile: GithubProjectProfile): GithubSectionSpec[] {
  const primaryDomain = normalizeDetectedDomain(profile.detectedDomains[0]);
  const secondaryDomain = normalizeDetectedDomain(
    profile.detectedDomains[1]
      ?? (primaryDomain === 'Full Stack' ? 'Backend' : primaryDomain),
  );
  const primary = domainDeepDiveProfile(primaryDomain, 'primary');
  const secondary = domainDeepDiveProfile(secondaryDomain, 'secondary');

  const deepDiveSpecs: GithubSectionSpec[] = [
    {
      sectionId: 'primary-domain-deep-dive',
      sectionTitle: primary.title,
      sectionDescription: primary.description,
      questionCount: 10,
      instructions: `Create exactly 10 ${primaryDomain}-specific questions total: 3 open medium, 3 coding medium or hard, 2 scenario medium, and 2 mcq medium. Focus on this repository's ${primaryDomain.toLowerCase()} implementation only.`,
      sectionKind: 'primary-domain',
    },
    {
      sectionId: 'secondary-domain-deep-dive',
      sectionTitle: secondary.title,
      sectionDescription: secondary.description,
      questionCount: 10,
      instructions: `Create exactly 10 repo-grounded ${secondaryDomain}-focused questions total: 3 open medium or hard, 3 coding hard, 2 scenario hard, and 2 mcq medium. Focus on the strongest complementary system layer present in this codebase.`,
      sectionKind: 'secondary-domain',
    },
  ];

  return [
    BASE_GITHUB_SECTION_SPECS[0],
    ...deepDiveSpecs,
    ...BASE_GITHUB_SECTION_SPECS.slice(1),
  ];
}

function extractRepoFilesFromContext(context: GithubRepoContext) {
  const matches = Array.from(context.fileContents.matchAll(/(?:^|\n)FILE:\s+([^\n]+)\n/g));
  const files = matches.map((match) => match[1].trim()).filter(Boolean);
  return files.length ? Array.from(new Set(files)) : ['README.md'];
}

function inferGithubFallbackDomains(context: GithubRepoContext) {
  const haystack = `${context.detectedStack.join(' ')}\n${context.fileContents.slice(0, 40000)}\n${context.readmeContent}`.toLowerCase();
  const domains: string[] = [];
  if (/(sklearn|tensorflow|torch|keras|pandas|numpy|model|classifier|training|inference|notebook|\.ipynb|streamlit|gradio)/i.test(haystack)) {
    domains.push('AI and ML');
  }
  if (/(react|vite|next|tsx|jsx|component|tailwind|css|frontend)/i.test(haystack)) domains.push('Frontend');
  if (/(express|fastify|django|flask|api|route|controller|server|postgres|prisma|mongoose|sql)/i.test(haystack)) domains.push('Backend');
  if (/(dockerfile|kubernetes|helm|terraform|github actions|workflow|vercel|deploy)/i.test(haystack)) domains.push('DevOps and Infrastructure');
  if (/(auth|jwt|oauth|csrf|xss|encrypt|hash|security|permission)/i.test(haystack)) domains.push('Cybersecurity');
  if (!domains.length) domains.push('General Software');
  return Array.from(new Set(domains)).slice(0, 2);
}

function fileConceptTag(filePath: string) {
  const lower = filePath.toLowerCase();
  if (/(readme|package|requirements|pyproject|vite|config|toml|yaml|yml|json)$/.test(lower)) return 'project configuration';
  if (/(model|classifier|train|predict|inference|pipeline|notebook|feature|data)/.test(lower)) return 'model pipeline';
  if (/(route|api|server|controller|handler)/.test(lower)) return 'request handling';
  if (/(auth|middleware|guard|session|token)/.test(lower)) return 'auth flow';
  if (/(schema|migration|prisma|sql|db|database)/.test(lower)) return 'data model';
  if (/(component|page|view|hook|tsx|jsx|css)/.test(lower)) return 'UI implementation';
  if (/(docker|k8s|deploy|workflow|ci|cd)/.test(lower)) return 'deployment';
  return 'implementation detail';
}

function fallbackQuestionFor(
  index: number,
  section: GithubSectionSpec,
  filePath: string,
  context: GithubRepoContext,
): GithubQuestion {
  const conceptTag = fileConceptTag(filePath);
  const ordinal = index + 1;
  const type: GithubQuestion['type'] = section.sectionKind === 'overview'
    ? 'open'
    : section.sectionId === 'scenario-based'
      ? 'scenario'
      : ordinal % 7 === 0
        ? 'mcq'
        : ordinal % 5 === 0
          ? 'coding'
          : 'open';
  const difficulty: GithubQuestion['difficulty'] = section.sectionId === 'red-flags-improvements' || section.sectionId === 'technical-deep-dive'
    ? 'hard'
    : type === 'coding' || type === 'scenario'
      ? 'medium'
      : 'easy';

  const stack = context.detectedStack.slice(0, 5).join(', ') || 'the detected project stack';
  const baseQuestion = `In ${filePath}, explain the ${conceptTag} decision this repository appears to make and how it affects ${context.repoName}'s behavior.`;
  const questionText = type === 'coding'
    ? `In ${filePath}, identify one small refactor or guard you would add around the ${conceptTag} logic. Describe the exact code area you would change and the expected safer behavior.`
    : type === 'scenario'
      ? `A production issue is traced to behavior connected to ${filePath}. How would you inspect the ${conceptTag} logic, verify the root cause, and ship a safe fix for ${context.repoName}?`
      : type === 'mcq'
        ? `Which area should an interviewer inspect first to understand the ${conceptTag} behavior in ${context.repoName}?`
        : baseQuestion;

  const options = type === 'mcq'
    ? [
        filePath,
        'A generic framework tutorial',
        'Only the deployment provider dashboard',
        'Browser cache settings without checking code',
      ]
    : undefined;

  const correctAnswer = type === 'mcq'
    ? filePath
    : type === 'coding'
      ? `Start in ${filePath} and isolate the ${conceptTag} branch into a named helper or add validation at the boundary where the file receives input. Keep the change small, preserve the existing data flow, and add a focused test or manual check for the path that currently lacks protection. The expected result is that ${context.repoName} handles this path predictably without changing unrelated behavior.`
      : type === 'scenario'
        ? `First reproduce the issue and inspect ${filePath}, because this scan found it as a relevant ${conceptTag} file. Add logging or a narrow test around the failing path, then patch the smallest boundary where invalid state or unexpected input enters. The tradeoff is speed versus certainty: ship the minimal safe fix first, then follow with broader cleanup if the same pattern appears elsewhere.`
        : `${filePath} is one of the concrete files read from the repository, and it should be used to explain the ${conceptTag} part of ${context.repoName}. A strong answer should name the code path in that file, connect it to the detected stack (${stack}), and describe how data or control flows through it. Avoid generic framework talk; the answer should stay grounded in the implementation visible in this repository.`;

  return {
    id: `q${ordinal}`,
    questionText,
    type,
    difficulty,
    fileReference: filePath,
    conceptTag,
    options,
    correctAnswer,
  };
}

function buildFallbackGithubQuestionSet(context: GithubRepoContext, cause: unknown): GithubQuestionSet {
  const detectedDomains = inferGithubFallbackDomains(context);
  const profile: GithubProjectProfile = {
    projectName: context.repoName,
    detectedDomains,
    projectSummary: `${context.repoName} was scanned successfully from GitHub, including concrete files such as ${extractRepoFilesFromContext(context).slice(0, 3).join(', ')}. The model provider did not return a usable structured response, so Repoid generated a fallback question set from the fetched repository files. The questions still cite actual file paths and focus on stack signals such as ${context.detectedStack.slice(0, 6).join(', ') || 'the repository contents'}.`,
  };
  const specs = buildStagedSectionSpecs(profile);
  const files = extractRepoFilesFromContext(context);
  let nextFile = 0;
  let nextQuestionId = 1;
  const sections = specs.map((spec) => {
    const questions = Array.from({ length: spec.questionCount }, (_, index) => {
      const question = fallbackQuestionFor(index, spec, files[nextFile++ % files.length], context);
      return { ...question, id: `q${nextQuestionId++}` };
    });
    return {
      sectionId: spec.sectionId,
      sectionTitle: spec.sectionTitle,
      sectionDescription: spec.sectionDescription,
      questions,
    };
  });
  const causeMessage = cause instanceof Error ? cause.message : String(cause ?? 'unknown');
  return {
    projectName: context.repoName,
    detectedDomains,
    projectSummary: profile.projectSummary,
    warnings: Array.from(new Set([
      'model_generation_failed_fallback_used',
      causeMessage,
      ...(context.limited ? ['limited_code_files'] : []),
    ])).slice(0, 5),
    sections,
  };
}

function ensureGithubQuestionTargetCount(result: GithubQuestionSet, context: GithubRepoContext, targetCount = 56) {
  const currentCount = result.sections.reduce((sum, section) => sum + section.questions.length, 0);
  if (currentCount >= targetCount) return result;

  const warnings = new Set(result.warnings ?? []);
  warnings.add('repo_file_top_up_questions_added');
  warnings.delete('reduced_question_count');

  const files = extractRepoFilesFromContext(context);
  const fallbackSpec: GithubSectionSpec = {
    sectionId: 'red-flags-improvements',
    sectionTitle: 'Red Flags and Improvements',
    sectionDescription: 'Repo-specific weaknesses, risks, and realistic improvement opportunities.',
    questionCount: targetCount - currentCount,
    instructions: 'Top up missing repo-grounded questions from fetched files.',
    sectionKind: 'standard',
  };
  let nextQuestionId = currentCount + 1;
  const topUps = Array.from({ length: targetCount - currentCount }, (_, index) => ({
    ...fallbackQuestionFor(index, fallbackSpec, files[index % files.length], context),
    id: `q${nextQuestionId++}`,
  }));
  const targetSection = result.sections[result.sections.length - 1];
  if (targetSection) {
    targetSection.questions.push(...topUps);
  } else {
    result.sections.push({
      sectionId: fallbackSpec.sectionId,
      sectionTitle: fallbackSpec.sectionTitle,
      sectionDescription: fallbackSpec.sectionDescription,
      questions: topUps,
    });
  }
  result.warnings = Array.from(warnings);
  return result;
}

function buildGithubQuestionUserPrompt(context: GithubRepoContext, options: { compact?: boolean } = {}) {
  const fileContents = options.compact
    ? context.fileContents.slice(0, 120000)
    : context.fileContents;
  const readmeContent = options.compact
    ? context.readmeContent.slice(0, 16000)
    : context.readmeContent;

  return GITHUB_REPO_SCAN_USER_PROMPT
    .replace('{repoName}', context.repoName)
    .replace('{fileContents}', fileContents || 'No meaningful code files found.')
    .replace('{readmeContent}', readmeContent || 'No README found.');
}

function buildGithubQuestionProfilePrompt(context: GithubRepoContext) {
  return GITHUB_REPO_SCAN_PROFILE_PROMPT
    .replace('{repoName}', context.repoName)
    .replace('{fileContents}', context.fileContents.slice(0, GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET) || 'No meaningful code files found.')
    .replace('{readmeContent}', context.readmeContent.slice(0, 12000) || 'No README found.');
}

function buildGithubSectionPrompt(
  context: GithubRepoContext,
  spec: GithubSectionSpec,
  options: { compact?: boolean; instructions?: string } = {},
) {
  const fileContents = context.fileContents.slice(0, options.compact ? Math.min(GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET, 80000) : GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET);
  const readmeContent = context.readmeContent.slice(0, options.compact ? 8000 : 12000);
  return `REPO NAME: ${context.repoName}

DETECTED FILES AND CONTENTS:
${fileContents || 'No meaningful code files found.'}

README:
${readmeContent || 'No README found.'}

Return only a valid JSON object with this structure:
{
  "sections": [
    {
      "sectionId": "${spec.sectionId}",
      "sectionTitle": "${spec.sectionTitle}",
      "sectionDescription": "${spec.sectionDescription}",
      "questions": []
    }
  ]
}

${options.instructions ?? spec.instructions}

Every question object must include:
- id
- questionText
- type: one of mcq, open, coding, scenario
- difficulty: one of easy, medium, hard
- fileReference: an exact file path from the provided repository context
- conceptTag
- correctAnswer
- options: required only for mcq, exactly 4 strings, with correctAnswer matching one option exactly

Rules:
- Every question must be strictly repo-grounded.
- Every answer must mention the concrete file, route, component, schema, algorithm, or code decision involved.
- If a coding question is used, embed actual code from the supplied files inside questionText.
- Do not return markdown, commentary, or text outside JSON.`;
}

type GithubProjectProfile = Pick<GithubQuestionSet, 'projectName' | 'detectedDomains' | 'projectSummary'>;

function normalizeGithubProjectProfile(payload: unknown): GithubProjectProfile {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  return {
    projectName: String(source.projectName ?? source.repoName ?? '').trim(),
    detectedDomains: toStringArray(source.detectedDomains ?? source.domains).map(normalizeGithubDetectedDomain).slice(0, 2),
    projectSummary: String(source.projectSummary ?? source.summary ?? '').trim(),
  };
}

function stagedSectionOutputBudget(spec: GithubSectionSpec) {
  if (spec.sectionKind === 'primary-domain' || spec.sectionKind === 'secondary-domain') return Math.min(GITHUB_SCAN_MAX_TOKENS, 32000);
  if (spec.sectionId === 'scenario-based' || spec.sectionId === 'technical-deep-dive') return Math.min(GITHUB_SCAN_MAX_TOKENS, 24000);
  if (spec.sectionId === 'most-probable') return Math.min(GITHUB_SCAN_MAX_TOKENS, 20000);
  return Math.min(GITHUB_SCAN_MAX_TOKENS, 16000);
}

type GithubSectionBatchSpec = {
  label: string;
  questionCount: number;
  instructions: string;
};

function stagedSectionBatches(spec: GithubSectionSpec): GithubSectionBatchSpec[] {
  if (spec.sectionKind === 'primary-domain') {
    return [
      { label: 'open-and-mcq', questionCount: 5, instructions: 'Create exactly 5 questions total: 3 open medium and 2 mcq medium.' },
      { label: 'coding', questionCount: 3, instructions: 'Create exactly 3 coding questions at medium or hard difficulty.' },
      { label: 'scenario', questionCount: 2, instructions: 'Create exactly 2 scenario questions at medium difficulty.' },
    ];
  }
  if (spec.sectionKind === 'secondary-domain') {
    return [
      { label: 'open-and-mcq', questionCount: 5, instructions: 'Create exactly 5 questions total: 3 open medium or hard and 2 mcq medium.' },
      { label: 'coding-1', questionCount: 1, instructions: 'Create exactly 1 coding question at hard difficulty.' },
      { label: 'coding-2', questionCount: 1, instructions: 'Create exactly 1 different coding question at hard difficulty.' },
      { label: 'coding-3', questionCount: 1, instructions: 'Create exactly 1 additional coding question at hard difficulty.' },
      { label: 'scenario', questionCount: 2, instructions: 'Create exactly 2 scenario questions at hard difficulty.' },
    ];
  }
  return [{ label: 'full', questionCount: spec.questionCount, instructions: spec.instructions }];
}

function assertUsableGithubQuestionSet(result: GithubQuestionSet) {
  const totalQuestions = result.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const requiredSectionIds = new Set([
    'project-overview',
    'frontend-deep-dive',
    'backend-deep-dive',
    'primary-domain-deep-dive',
    'secondary-domain-deep-dive',
    'most-probable',
    'scenario-based',
    'technical-deep-dive',
    'red-flags-improvements',
  ]);
  const returnedSections = new Set(result.sections.map((section) => section.sectionId));
  const matchedRequiredSections = [...requiredSectionIds].filter((sectionId) => returnedSections.has(sectionId));
  const hasLegacyDeepDives = returnedSections.has('frontend-deep-dive') || returnedSections.has('backend-deep-dive');
  const hasDomainDeepDives = returnedSections.has('primary-domain-deep-dive') && returnedSections.has('secondary-domain-deep-dive');
  if (!result.projectName || !result.projectSummary || result.sections.length < 4 || (!hasLegacyDeepDives && !hasDomainDeepDives) || totalQuestions < 24) {
    throw new Error('model_invalid_repo_question_json');
  }
  const hasMissingReferences = result.sections.some((section) => (
    section.questions.some((question) => !question.fileReference || !question.questionText || !question.correctAnswer)
  ));
  if (hasMissingReferences) {
    throw new Error('model_missing_repo_references');
  }

  const warnings = new Set(result.warnings ?? []);
  if (matchedRequiredSections.length < 5) warnings.add('partial_section_coverage');
  if (result.sections.length < 7) warnings.add('reduced_section_count');
  if (totalQuestions < 56) warnings.add('reduced_question_count');
  result.warnings = Array.from(warnings);
}

export async function generateGithubQuestionSet(context: GithubRepoContext, jobId: string, userId?: string): Promise<GithubQuestionSet> {
  let lastError: unknown = null;
  const stagedFullOnly = process.env.GITHUB_SCAN_STAGED_FULL === 'true' || GITHUB_SCAN_MODEL === 'deepseek/deepseek-v4-pro';
  if (stagedFullOnly) {
    lastError = new Error('model_empty_response');
  } else {
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        const compactRetry = attempt > 1;
        if (userId) await assertGithubScanJobActive(jobId, userId);
        const analysis = await callGithubStructuredModel<GithubQuestionSet>(
          GITHUB_REPO_SCAN_SYSTEM_PROMPT,
          buildGithubQuestionUserPrompt(context, { compact: compactRetry }),
          normalizeGithubQuestionSet,
          {
            maxTokens: GITHUB_SCAN_MAX_TOKENS,
            timeoutMs: GITHUB_SCAN_TIMEOUT_MS,
            temperature: GITHUB_SCAN_TEMPERATURE,
            topP: GITHUB_SCAN_TOP_P,
            jobId,
            repoName: context.repoName,
            stage: compactRetry ? 'full-compact' : 'full',
          },
        );
        const result = analysis.result;
        if (context.limited) {
          result.warnings = Array.from(new Set([...(result.warnings ?? []), 'limited_code_files']));
        }
        ensureGithubQuestionTargetCount(result, context);
        assertUsableGithubQuestionSet(result);
        return result;
      } catch (error) {
        lastError = error;
        if (attempt === 1) {
          console.error('GitHub repo scan generation attempt failed; retrying with compact context', {
            jobId,
            repoName: context.repoName,
            error: error instanceof Error ? error.message : error,
          });
          await db.prepare('UPDATE repo_scan_jobs SET retry_count = retry_count + 1 WHERE id = ?').run(jobId);
          await wait(3000);
        }
      }
    }
  }

  const lastMessage = lastError instanceof Error ? lastError.message : '';
  if (['model_json_parse_failed', 'model_empty_response', 'model_invalid_repo_question_json', 'model_missing_repo_references', 'analysis_timeout'].includes(lastMessage)) {
    console.warn('GitHub repo scan switching to staged full question-set generation', {
      jobId,
      repoName: context.repoName,
      previousError: lastMessage,
    });
    if (userId) await assertGithubScanJobActive(jobId, userId);
    const profileAnalysis = await callGithubStructuredModel<GithubProjectProfile>(
      GITHUB_REPO_SCAN_SYSTEM_PROMPT,
      buildGithubQuestionProfilePrompt(context),
      normalizeGithubProjectProfile,
      {
        maxTokens: Math.min(GITHUB_SCAN_MAX_TOKENS, 6000),
        timeoutMs: GITHUB_SCAN_TIMEOUT_MS,
        temperature: GITHUB_SCAN_TEMPERATURE,
        topP: GITHUB_SCAN_TOP_P,
        jobId,
        repoName: context.repoName,
        stage: 'profile',
      },
    );
    const stagedSectionSpecs = buildStagedSectionSpecs(profileAnalysis.result);
    const stagedSections: GithubQuestionSection[] = [];
    for (const spec of stagedSectionSpecs) {
      console.info('GitHub repo scan staged section started', {
        jobId,
        repoName: context.repoName,
        sectionId: spec.sectionId,
      });
      const batchQuestions: GithubQuestion[] = [];
      let sectionDescription = spec.sectionDescription;
      for (const batch of stagedSectionBatches(spec)) {
        if (userId) await assertGithubScanJobActive(jobId, userId);
        console.info('GitHub repo scan staged section batch started', {
          jobId,
          repoName: context.repoName,
          sectionId: spec.sectionId,
          batch: batch.label,
        });
        let sectionAnalysis: { result: GithubQuestionSet } | null = null;
        let sectionError: unknown = null;
        for (let attempt = 1; attempt <= 2; attempt += 1) {
          try {
            sectionAnalysis = await callGithubStructuredModel<GithubQuestionSet>(
              GITHUB_REPO_SCAN_SYSTEM_PROMPT,
              buildGithubSectionPrompt(context, spec, { compact: attempt > 1, instructions: batch.instructions }),
              normalizeGithubQuestionSet,
              {
                maxTokens: stagedSectionOutputBudget(spec),
                timeoutMs: GITHUB_SCAN_TIMEOUT_MS,
                temperature: GITHUB_SCAN_TEMPERATURE,
                topP: GITHUB_SCAN_TOP_P,
                jobId,
                repoName: context.repoName,
                stage: `${spec.sectionId}:${batch.label}${attempt > 1 ? ':compact' : ''}`,
              },
            );
            break;
          } catch (error) {
            sectionError = error;
            const errorMessage = error instanceof Error ? error.message : '';
            if (attempt === 1 && ['model_json_parse_failed', 'model_empty_response', 'analysis_timeout'].includes(errorMessage)) {
              console.warn('GitHub repo scan staged section batch retrying with compact context', {
                jobId,
                repoName: context.repoName,
                sectionId: spec.sectionId,
                batch: batch.label,
                error: errorMessage,
              });
              continue;
            }
            throw error;
          }
        }
        if (!sectionAnalysis) {
          throw sectionError instanceof Error ? sectionError : new Error('model_generation_failed');
        }
        const section = sectionAnalysis.result.sections.find((item) => item.sectionId === spec.sectionId)
          ?? sectionAnalysis.result.sections[0];
        if (!section || section.questions.length !== batch.questionCount) {
          throw new Error('model_invalid_repo_question_json');
        }
        sectionDescription = section.sectionDescription || sectionDescription;
        batchQuestions.push(...section.questions);
        console.info('GitHub repo scan staged section batch complete', {
          jobId,
          repoName: context.repoName,
          sectionId: spec.sectionId,
          batch: batch.label,
          questionCount: section.questions.length,
        });
      }
      if (batchQuestions.length !== spec.questionCount) {
        throw new Error('model_invalid_repo_question_json');
      }
      stagedSections.push({
        sectionId: spec.sectionId,
        sectionTitle: spec.sectionTitle,
        sectionDescription,
        questions: batchQuestions,
      });
      console.info('GitHub repo scan staged section complete', {
        jobId,
        repoName: context.repoName,
        sectionId: spec.sectionId,
        questionCount: batchQuestions.length,
      });
    }
    let nextStagedQuestionId = 1;
    const normalizedStagedSections = stagedSections.map((section) => ({
      ...section,
      questions: section.questions.map((question) => ({
        ...question,
        id: `q${nextStagedQuestionId++}`,
      })),
    }));
    const stagedResult: GithubQuestionSet = {
      projectName: profileAnalysis.result.projectName || context.repoName,
      detectedDomains: profileAnalysis.result.detectedDomains,
      projectSummary: profileAnalysis.result.projectSummary,
      warnings: Array.from(new Set([
        'staged_full_generation',
        ...(context.limited ? ['limited_code_files'] : []),
      ])),
      sections: normalizedStagedSections,
    };
    ensureGithubQuestionTargetCount(stagedResult, context);
    const stagedQuestionCount = stagedResult.sections.reduce((sum, section) => sum + section.questions.length, 0);
    if (!stagedResult.projectSummary || stagedResult.sections.length !== stagedSectionSpecs.length || stagedQuestionCount !== 56) {
      throw new Error('model_invalid_repo_question_json');
    }
    assertUsableGithubQuestionSet(stagedResult);
    return stagedResult;
  }

  throw lastError instanceof Error ? lastError : new Error('model_generation_failed');
}

function githubScanErrorDetails(error: unknown, userId: string, repoUrl: string) {
  const message = error instanceof Error ? error.message : 'scan_failed';
  const rawResponse = error && typeof error === 'object' && 'rawResponse' in error
    ? String((error as { rawResponse?: unknown }).rawResponse ?? '')
    : '';

  if (message === 'private_repo') {
    return {
      status: 'private',
      jobStatus: 'failed',
      httpStatus: 403,
      message: 'This repository is private. Please make it public or connect your GitHub account.',
    };
  }

  if (message === 'rate_limited') {
    console.error('GitHub rate limit reached while scanning repo', { userId, repoUrl, timestamp: new Date().toISOString() });
    return {
      status: 'rate_limited',
      jobStatus: 'failed',
      httpStatus: 429,
      message: 'GitHub rate limit reached. Please try again in a few minutes.',
    };
  }

  if (message === 'model_json_parse_failed' || message === 'model_empty_response') {
    console.error('GitHub repo scan returned invalid JSON after retry', { userId, repoUrl, rawResponse });
    return {
      status: 'failed',
      jobStatus: 'failed',
      httpStatus: 502,
      message: 'The AI provider returned an unreadable repository analysis. Please retry the scan.',
    };
  }

  if (message === 'model_invalid_repo_question_json' || message === 'model_missing_repo_references') {
    return {
      status: 'failed',
      jobStatus: 'failed',
      httpStatus: 502,
      message: 'The AI provider returned an incomplete repository analysis without enough repo-grounded questions. Please retry the scan.',
    };
  }

  if (/model_http_402|budget exceeded|payment required/i.test(message)) {
    return {
      status: 'failed',
      jobStatus: 'failed',
      httpStatus: 402,
      message: 'The AI provider rejected this DeepSeek request because the API key budget is unavailable. Please check the key and try again.',
    };
  }

  if (/model_http_4\d\d|model_http_5\d\d/i.test(message)) {
    console.error('GitHub repo scan provider request failed', {
      userId,
      repoUrl,
      providerError: message,
    });
    return {
      status: 'failed',
      jobStatus: 'failed',
      httpStatus: 502,
      message: 'We had trouble analyzing this repository. Please try again.',
    };
  }

  if (message === 'scan_job_replaced') {
    return {
      status: 'failed',
      jobStatus: 'failed',
      httpStatus: 409,
      message: 'This scan was replaced by a newer re-scan.',
    };
  }

  return {
    status: 'failed',
    jobStatus: 'failed',
    httpStatus: 502,
    message: 'Unable to analyze this repository right now.',
  };
}

const GITHUB_SCAN_STALE_AFTER_MINUTES = Math.max(5, Number(process.env.GITHUB_SCAN_STALE_AFTER_MINUTES ?? 15));

async function expireStaleGithubScanJobs(userId?: string) {
  const params: unknown[] = [
    'failed',
    'Repository scan timed out before completion. Please start a fresh scan.',
    GITHUB_SCAN_STALE_AFTER_MINUTES,
  ];
  const userClause = userId ? ' AND user_id = ?' : '';
  if (userId) params.push(userId);

  await db.prepare(`
    UPDATE repo_scan_jobs
       SET status = ?,
           completed_at = NOW(),
           error_message = ?
     WHERE status = 'pending'
       AND created_at < NOW() - (?::text || ' minutes')::interval
       ${userClause}
  `).run(...params);
}

async function assertGithubScanJobActive(jobId: string, userId: string) {
  const activeJob = await db.prepare('SELECT status FROM repo_scan_jobs WHERE id = ? AND user_id = ?')
    .get<{ status: string }>(jobId, userId);
  if (activeJob?.status !== 'pending') {
    throw new Error('scan_job_replaced');
  }
}

export async function completeGithubScanJob(params: {
  jobId: string;
  userId: string;
  repoUrl: string;
  existingRepoId?: string;
  accessToken?: string | null;
}) {
  try {
    console.info('GitHub repo scan stage started', {
      jobId: params.jobId,
      repoUrl: params.repoUrl,
      stage: 'fetch-context',
    });
    const context = await fetchGithubRepoForQuestionSet(params.repoUrl, params.accessToken);
    console.info('GitHub repo scan stage complete', {
      jobId: params.jobId,
      repoUrl: params.repoUrl,
      stage: 'fetch-context',
      detectedStackCount: context.detectedStack.length,
      fileContextCharacters: context.fileContents.length,
      readmeCharacters: context.readmeContent.length,
      limited: context.limited,
    });
    await assertGithubScanJobActive(params.jobId, params.userId);
    const repoId = params.existingRepoId ?? crypto.randomUUID();
    console.info('GitHub repo scan stage started', {
      jobId: params.jobId,
      repoUrl: params.repoUrl,
      stage: 'generate-question-set',
    });
    let result: GithubQuestionSet;
    try {
      result = await generateGithubQuestionSet(context, params.jobId, params.userId);
    } catch (generationError) {
      if (generationError instanceof Error && generationError.message === 'scan_job_replaced') {
        throw generationError;
      }
      console.warn('GitHub repo scan model generation failed; using repo-grounded fallback question set', {
        jobId: params.jobId,
        repoUrl: params.repoUrl,
        error: generationError instanceof Error ? generationError.message : generationError,
      });
      result = buildFallbackGithubQuestionSet(context, generationError);
    }
    console.info('GitHub repo scan stage complete', {
      jobId: params.jobId,
      repoUrl: params.repoUrl,
      stage: 'generate-question-set',
      sectionCount: result.sections.length,
      questionCount: result.sections.reduce((sum, section) => sum + section.questions.length, 0),
      warnings: result.warnings ?? [],
    });
    await assertGithubScanJobActive(params.jobId, params.userId);
    const totalQuestions = result.sections.reduce((sum, section) => sum + section.questions.length, 0);

    if (params.existingRepoId) {
      await db.prepare('UPDATE github_repos SET repo_name = ?, detected_stack = ?::jsonb, scanned_at = NOW(), status = ?, raw_analysis_json = ?::jsonb, updated_at = NOW() WHERE id = ?')
        .run(result.projectName || context.repoName, JSON.stringify(context.detectedStack), 'complete', JSON.stringify(result), repoId);
    } else {
      await db.prepare('INSERT INTO github_repos (id, user_id, repo_url, repo_name, detected_stack, scanned_at, status, raw_analysis_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?::jsonb, NOW(), ?, ?::jsonb, NOW(), NOW())')
        .run(repoId, params.userId, context.repoUrl, result.projectName || context.repoName, JSON.stringify(context.detectedStack), 'complete', JSON.stringify(result));
    }

    await db.prepare('DELETE FROM repo_question_sets WHERE repo_id = ?').run(repoId);
    await db.prepare('INSERT INTO repo_question_sets (id, repo_id, generated_at, project_summary, total_questions, sections_json) VALUES (?, ?, NOW(), ?, ?, ?::jsonb)')
      .run(crypto.randomUUID(), repoId, result.projectSummary, totalQuestions, JSON.stringify(result.sections));
    await db.prepare('UPDATE repo_scan_jobs SET status = ?, completed_at = NOW(), error_message = NULL WHERE id = ?').run('complete', params.jobId);
    console.info('GitHub repo scan stage complete', {
      jobId: params.jobId,
      repoUrl: params.repoUrl,
      stage: 'persist-question-set',
      repoId,
      totalQuestions,
    });
    return { repoId };
  } catch (error) {
    const details = githubScanErrorDetails(error, params.userId, params.repoUrl);
    try {
      await db.prepare('UPDATE repo_scan_jobs SET status = ?, completed_at = NOW(), error_message = ? WHERE id = ?')
        .run(details.jobStatus, details.message, params.jobId);
    } catch (failurePersistenceError) {
      console.error('Unable to persist GitHub repo scan failure status', {
        userId: params.userId,
        repoUrl: params.repoUrl,
        jobId: params.jobId,
        scanError: error instanceof Error ? error.message : error,
        persistenceError: failurePersistenceError instanceof Error ? failurePersistenceError.message : failurePersistenceError,
      });
    }
    const scanError = new Error(details.message) as Error & { status?: string; httpStatus?: number };
    scanError.status = details.status;
    scanError.httpStatus = details.httpStatus;
    throw scanError;
  }
}

function parseCookies(cookieHeader?: string): Record<string, string> {
  return String(cookieHeader ?? '')
    .split(';')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce<Record<string, string>>((accumulator, segment) => {
      const separatorIndex = segment.indexOf('=');
      if (separatorIndex === -1) return accumulator;
      const key = segment.slice(0, separatorIndex).trim();
      const value = segment.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function getClientKey(request: express.Request): string {
  const forwardedFor = request.headers['x-forwarded-for'];
  const forwardedValue = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
  return String(forwardedValue ?? request.ip ?? 'local').split(',')[0].trim() || 'local';
}

function applyAuthRateLimit(request: express.Request, response: express.Response, next: express.NextFunction) {
  const key = getClientKey(request);
  const now = Date.now();
  const bucket = authBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    authBuckets.set(key, { count: 1, resetAt: now + AUTH_WINDOW_MS });
    next();
    return;
  }

  if (bucket.count >= AUTH_MAX_REQUESTS) {
    response.status(429).json({ error: 'Too many authentication requests. Please retry shortly.' });
    return;
  }

  bucket.count += 1;
  next();
}

function normalizeEmail(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derivedKey}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, expectedHash] = String(storedHash ?? '').split(':');
  if (!salt || !expectedHash) return false;
  const actualHash = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actualHash, 'hex'), Buffer.from(expectedHash, 'hex'));
}

function otpKey(email: string, purpose: EmailOtpPurpose) {
  return `${purpose}:${email}`;
}

function createEmailOtp(email: string, purpose: EmailOtpPurpose) {
  const code = String(crypto.randomInt(100000, 1000000));
  emailOtpCodes.set(otpKey(email, purpose), {
    codeHash: hashPassword(code),
    expiresAt: Date.now() + 10 * 60_000,
    purpose,
  });
  console.info(`Email OTP for ${purpose} ${email}: ${code}`);
  return code;
}

async function sendEmailOtp(email: string, purpose: EmailOtpPurpose, code: string) {
  const smtpUser = process.env.SMTP_USER?.trim() || process.env.GMAIL_USER?.trim();
  const smtpPass = process.env.SMTP_PASS?.trim() || process.env.GMAIL_APP_PASSWORD?.trim();
  const smtpFrom = process.env.SMTP_FROM?.trim() || process.env.EMAIL_FROM?.trim() || (smtpUser ? `Repoid <${smtpUser}>` : '');
  const subject = 'Verify your new Repoid email';
  const html = `
    <div style="font-family:Inter,Arial,sans-serif;background:#050505;color:#f4f4f4;padding:28px">
      <div style="max-width:520px;margin:0 auto;border:1px solid #2f2f2f;border-radius:16px;padding:24px;background:#101010">
        <p style="font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#b8b8b8;margin:0 0 12px">Repoid verification</p>
        <h1 style="font-size:28px;line-height:1.2;margin:0 0 16px">Your OTP is ${code}</h1>
        <p style="color:#cfcfcf;line-height:1.6;margin:0">Use this code within 10 minutes to change your email address.</p>
      </div>
    </div>
  `;

  if (!smtpUser || !smtpPass) {
    return { sent: false, reason: 'Email delivery is not configured. Add SMTP_USER and SMTP_PASS with a Gmail App Password.' };
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });

  try {
    await transporter.sendMail({
      from: smtpFrom,
      to: email,
      subject,
      html,
      text: `Your Repoid OTP is ${code}. It expires in 10 minutes.`,
    });
  } catch (error) {
    throw new Error(error instanceof Error ? `Gmail SMTP error: ${error.message}` : 'Gmail SMTP error.');
  }

  return { sent: true };
}

function consumeEmailOtp(email: string, purpose: EmailOtpPurpose, code: unknown) {
  const key = otpKey(email, purpose);
  const entry = emailOtpCodes.get(key);
  if (!entry || entry.purpose !== purpose || Date.now() > entry.expiresAt) {
    emailOtpCodes.delete(key);
    return false;
  }

  const valid = verifyPassword(String(code ?? '').trim(), entry.codeHash);
  if (valid) emailOtpCodes.delete(key);
  return valid;
}

function setSessionCookie(response: express.Response, userId: string) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(userId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}${secureFlag}`,
  );
}

function clearSessionCookie(response: express.Response) {
  const secureFlag = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secureFlag}`);
}

function getPublicBaseUrl(request: express.Request) {
  const configured = process.env.FRONTEND_URL?.trim();
  if (configured) return configured.replace(/\/$/, '');
  const host = request.headers.host ?? `localhost:${process.env.PORT ?? 3000}`;
  const protocol = request.headers['x-forwarded-proto'] ?? 'http';
  return `${protocol}://${host}`;
}

async function findOrCreateOAuthUser(provider: 'google' | 'github', providerAccountId: string, email: string, name: string) {
  const normalizedEmail = normalizeEmail(email);
  const linkedAccount = await db.queryOne<{ id: string; user_id: string }>(
    `SELECT id, user_id
       FROM oauth_accounts
      WHERE provider = $1 AND provider_account_id = $2`,
    [provider, providerAccountId],
  );

  let user = linkedAccount ? await db.queryOne<DbUserRow>(
    `SELECT u.id, u.email, u.name, u.password_hash, u.auth_provider, u.email_verified, u.created_at, u.updated_at
       FROM users u
      WHERE u.id = $1`,
    [linkedAccount.user_id],
  ) : null;
  if (!user) {
    user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE email = ?')
      .get<DbUserRow>(normalizedEmail);
  }

  if (user) {
    if (!linkedAccount) {
      await db.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
        .run(crypto.randomUUID(), user.id, provider, providerAccountId, normalizedEmail);
      await db.prepare('UPDATE users SET auth_provider = ?, email_verified = ?, updated_at = NOW() WHERE id = ?')
        .run(provider, 1, user.id);
      user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?')
        .get<DbUserRow>(user.id);
    }
    if (!user) throw new Error('Unable to load OAuth user after linking.');
    return user;
  }

  const userId = crypto.randomUUID();
  await db.prepare('INSERT INTO users (id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())')
    .run(userId, normalizedEmail, name || normalizedEmail.split('@')[0], hashPassword(crypto.randomUUID()), provider, 1);
    await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
      .run(crypto.randomUUID(), userId, 0, 'light', '');
  await db.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
    .run(crypto.randomUUID(), userId, provider, providerAccountId, normalizedEmail);
  user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?')
    .get<DbUserRow>(userId);
  if (!user) throw new Error('Unable to create OAuth user.');
  return user;
}

async function saveGithubAccessToken(userId: string, accessToken: string) {
  await db.prepare('UPDATE oauth_accounts SET access_token = ?, updated_at = NOW() WHERE user_id = ? AND provider = ?')
    .run(accessToken, userId, 'github');
}

async function getGithubAccessToken(userId: string) {
  const row = await db.prepare('SELECT access_token FROM oauth_accounts WHERE user_id = ? AND provider = ? ORDER BY updated_at DESC LIMIT 1')
    .get<{ access_token: string | null }>(userId, 'github');
  return row?.access_token ?? null;
}

function consumeOAuthState(provider: 'google' | 'github', state: unknown) {
  const stateValue = String(state ?? '');
  const stored = oauthStates.get(stateValue);
  oauthStates.delete(stateValue);
  if (!stored || stored.provider !== provider || Date.now() - stored.createdAt >= 10 * 60_000) return null;
  return stored;
}

function safeOAuthNextPath(value: unknown) {
  const nextPath = String(value ?? '').trim();
  if (!nextPath || !nextPath.startsWith('/') || nextPath.startsWith('//') || nextPath.includes('\\')) return '';
  return nextPath;
}

function toSessionUser(user: DbUserRow) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    authProvider: user.auth_provider ?? 'local',
    emailVerified: Boolean(user.email_verified),
    joinedAt: user.created_at,
    loggedIn: true,
  };
}

async function getUserFromRequest(request: express.Request): Promise<DbUserRow | null> {
  const cookies = parseCookies(request.headers.cookie);
  const sessionId = String(cookies[SESSION_COOKIE_NAME] ?? '').trim();
  if (!sessionId) return null;

  const user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?')
    .get<DbUserRow>(sessionId);

  return user ?? null;
}

async function requireUser(request: AuthedRequest, response: express.Response, next: express.NextFunction) {
  const user = await getUserFromRequest(request);
  if (!user) {
    response.status(401).json({ error: 'Authentication required.' });
    return;
  }

  request.user = user;
  next();
}

async function getUserSelectedDomain(userId: string) {
  const row = await db.prepare('SELECT domain FROM user_preferences WHERE user_id = ?').get<{ domain: string | null }>(userId);
  return normalizeOptionalDomain(row?.domain);
}

function normalizeBillingPlan(value: unknown): BillingPlan {
  const plan = String(value ?? '').trim().toLowerCase();
  return (BILLING_PLANS as readonly string[]).includes(plan) ? (plan as BillingPlan) : 'free';
}

function normalizeBillingInterval(value: unknown): BillingInterval {
  const interval = String(value ?? '').trim().toLowerCase();
  return (BILLING_INTERVALS as readonly string[]).includes(interval) ? (interval as BillingInterval) : 'monthly';
}

function getPeriodEnd(interval: BillingInterval) {
  const date = new Date();
  if (interval === 'annual') {
    date.setFullYear(date.getFullYear() + 1);
  } else {
    date.setMonth(date.getMonth() + 1);
  }
  return date.toISOString();
}

function toSubscriptionPayload(row: SubscriptionRow | null) {
  const plan = normalizeBillingPlan(row?.plan);
  const status = row?.status ?? 'active';
  return {
    plan,
    status,
    provider: row?.provider ?? 'manual',
    billingInterval: row?.billing_interval ?? 'monthly',
    seats: Number(row?.seats ?? 1),
    currentPeriodEnd: row?.current_period_end ?? null,
    limits: PLAN_LIMITS[plan],
  };
}

async function getUserSubscription(userId: string) {
  const row = await db.prepare(`
    SELECT id, user_id, plan, status, provider, razorpay_customer_id, razorpay_subscription_id,
           razorpay_payment_id, current_period_end, billing_interval, seats
      FROM subscriptions
     WHERE user_id = ?
  `).get<SubscriptionRow>(userId);

  if (!row) return null;
  const expired = row.current_period_end ? new Date(row.current_period_end).getTime() < Date.now() : false;
  if (expired && row.plan !== 'free') {
    await db.prepare('UPDATE subscriptions SET plan = ?, status = ?, updated_at = NOW() WHERE user_id = ?').run('free', 'expired', userId);
    return null;
  }
  return row;
}

async function getEffectivePlan(userId: string): Promise<BillingPlan> {
  const subscription = await getUserSubscription(userId);
  if (!subscription || subscription.status !== 'active') return 'free';
  return normalizeBillingPlan(subscription.plan);
}

async function upsertSubscription(params: {
  userId: string;
  plan: BillingPlan;
  status: string;
  provider: string;
  billingInterval: BillingInterval;
  seats: number;
  currentPeriodEnd: string | null;
  razorpayPaymentId?: string | null;
}) {
  await db.prepare(`
    INSERT INTO subscriptions (
      id, user_id, plan, status, provider, billing_interval, seats, current_period_end,
      razorpay_payment_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      provider = EXCLUDED.provider,
      billing_interval = EXCLUDED.billing_interval,
      seats = EXCLUDED.seats,
      current_period_end = EXCLUDED.current_period_end,
      razorpay_payment_id = EXCLUDED.razorpay_payment_id,
      updated_at = NOW()
  `).run(
    crypto.randomUUID(),
    params.userId,
    params.plan,
    params.status,
    params.provider,
    params.billingInterval,
    params.seats,
    params.currentPeriodEnd,
    params.razorpayPaymentId ?? null,
  );
}

async function getMonthlyRoundUsage(userId: string, roundType: string) {
  const row = await db.prepare(`
    SELECT COUNT(*)::int AS total
      FROM round_attempts
     WHERE user_id = ?
       AND round_type = ?
       AND created_at >= date_trunc('month', NOW())
  `).get<{ total: number }>(userId, roundType);
  return Number(row?.total ?? 0);
}

async function getGithubRepoUsage(userId: string) {
  const row = await db.prepare(`
    SELECT COUNT(*)::int AS total
      FROM github_repos
     WHERE user_id = ?
  `).get<{ total: number }>(userId);
  return Number(row?.total ?? 0);
}

async function getEntitlement(userId: string, feature: string) {
  const plan = await getEffectivePlan(userId);
  const limits = PLAN_LIMITS[plan];
  const usage: Record<string, number> = {};
  let hasAccess = true;
  let reason: string | null = null;
  let suggestedPlan: BillingPlan | null = null;

  if (feature === 'mock-interview') {
    usage.mockInterviewsThisMonth = await getMonthlyRoundUsage(userId, 'mock-interview');
    hasAccess = true;
    reason = null;
    suggestedPlan = null;
  } else if (feature === 'coding-round') {
    usage.codingRoundsThisMonth = await getMonthlyRoundUsage(userId, 'coding-round');
    hasAccess = true;
    reason = null;
    suggestedPlan = null;
  } else if (feature === 'scenario-round') {
    hasAccess = true;
    reason = null;
    suggestedPlan = null;
  } else if (feature === 'github-scan') {
    usage.githubRepos = await getGithubRepoUsage(userId);
    const limit = limits.githubRepos;
    hasAccess = limit === 'unlimited' || usage.githubRepos < limit;
    reason = hasAccess ? null : 'You have reached the GitHub repository scan limit for your plan.';
    suggestedPlan = plan === 'free' ? 'pro' : 'team';
  } else if (feature === 'pdf-export') {
    hasAccess = limits.pdfExport;
    reason = hasAccess ? null : 'PDF report export is available on Pro and Team.';
    suggestedPlan = 'pro';
  }

  return {
    hasAccess,
    reason,
    upgradeRequired: !hasAccess,
    feature,
    currentPlan: plan,
    suggestedPlan,
    usage,
    limits,
    upgradeMessage: hasAccess ? null : `Upgrade to ${suggestedPlan === 'team' ? 'Team' : 'Pro'} to use ${feature.replace(/-/g, ' ')}.`,
  };
}

function requireRazorpayCredentials() {
  const keyId = process.env.RAZORPAY_KEY_ID?.trim();
  const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId || !keySecret) {
    throw new Error('Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  }
  return { keyId, keySecret };
}

function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string, keySecret: string) {
  const expected = crypto
    .createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

async function ensureRuntimeSchemaReady() {
  if (!runtimeSchemaReadyPromise) {
    runtimeSchemaReadyPromise = db.execute(DATABASE_SCHEMA_SQL).then(() => undefined).catch((error) => {
      runtimeSchemaReadyPromise = null;
      throw error;
    });
  }
  await runtimeSchemaReadyPromise;
}

export async function createApp(options: { listen?: boolean } = {}) {
  const listen = options.listen ?? true;
  await ensureRuntimeSchemaReady();
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({
    verify: (request, _response, buffer) => {
      (request as AuthedRequest).rawBody = Buffer.from(buffer);
    },
  }));

  if (process.env.NODE_ENV !== 'production' || process.env.SEED_QUESTIONS_ON_START === 'true') {
    await ensureQuestionBankSeeded();
  }

  app.get('/api/health', async (_request, response) => {
    await db.query('SELECT 1');
    response.json({
      status: 'ok',
      githubScanner: {
        version: GITHUB_SCAN_ENGINE_VERSION,
        model: GITHUB_SCAN_MODEL,
        fallbackModels: GITHUB_SCAN_FALLBACK_MODELS,
        stagedFull: process.env.GITHUB_SCAN_STAGED_FULL === 'true' || GITHUB_SCAN_MODEL === 'deepseek/deepseek-v4-pro',
        contextCharBudget: GITHUB_SCAN_STAGED_CONTEXT_CHAR_BUDGET,
      },
    });
  });

  app.get('/api/billing/plans', (_request, response) => {
    response.json({
      currency: 'INR',
      plans: {
        free: {
          plan: 'free',
          name: 'Free',
          monthly: { amountPaise: 0, displayPrice: '₹0' },
          annual: { amountPaise: 0, displayPrice: '₹0' },
          limits: PLAN_LIMITS.free,
        },
        pro: {
          plan: 'pro',
          name: 'Monthly',
          monthly: PLAN_PRICING.pro.monthly,
          annual: PLAN_PRICING.pro.annual,
          limits: PLAN_LIMITS.pro,
        },
        team: {
          plan: 'team',
          name: 'Yearly',
          monthly: PLAN_PRICING.team.monthly,
          annual: PLAN_PRICING.team.annual,
          limits: PLAN_LIMITS.team,
        },
      },
    });
  });

  app.get('/api/billing/subscription', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const subscription = await getUserSubscription(user.id);
    response.json({ subscription: toSubscriptionPayload(subscription) });
  });

  app.get('/api/billing/entitlement', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const feature = String(request.query.feature ?? '').trim();
    if (!feature) {
      response.status(400).json({ error: 'feature is required.' });
      return;
    }
    response.json({ entitlement: await getEntitlement(user.id, feature) });
  });

  app.post('/api/billing/create-order', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const plan = normalizeBillingPlan(request.body?.plan);
    const billingInterval = normalizeBillingInterval(request.body?.billingInterval);
    const seats = 1;

    if (plan === 'free') {
      await upsertSubscription({
        userId: user.id,
        plan: 'free',
        status: 'active',
        provider: 'manual',
        billingInterval: 'monthly',
        seats: 1,
        currentPeriodEnd: null,
      });
      response.json({ success: true, subscription: toSubscriptionPayload(await getUserSubscription(user.id)) });
      return;
    }

    try {
      const { keyId, keySecret } = requireRazorpayCredentials();
      const unitPricing = PLAN_PRICING[plan][billingInterval];
      const amountPaise = unitPricing.amountPaise * seats;
      const receipt = `repoid_${plan}_${Date.now()}`.slice(0, 40);
      const razorpayResponse = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${keyId}:${keySecret}`).toString('base64')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountPaise,
          currency: 'INR',
          receipt,
          notes: {
            userId: user.id,
            email: user.email,
            plan,
            billingInterval,
            seats: String(seats),
          },
        }),
      });
      const order = await razorpayResponse.json().catch(() => ({})) as { id?: string; error?: { description?: string } };
      if (!razorpayResponse.ok || !order.id) {
        throw new Error(order.error?.description ?? 'Unable to create Razorpay order.');
      }

      await db.prepare(`
        INSERT INTO billing_orders (
          id, user_id, razorpay_order_id, plan, billing_interval, seats, amount_paise,
          currency, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
      `).run(crypto.randomUUID(), user.id, order.id, plan, billingInterval, seats, amountPaise, 'INR', 'created');

      response.status(201).json({
        keyId,
        orderId: order.id,
        amountPaise,
        currency: 'INR',
        plan,
        billingInterval,
        seats,
        name: 'Repoid',
        description: unitPricing.label,
        prefill: {
          name: user.name,
          email: user.email,
        },
      });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to create billing order.' });
    }
  });

  app.post('/api/billing/verify', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const orderId = String(request.body?.razorpay_order_id ?? '').trim();
    const paymentId = String(request.body?.razorpay_payment_id ?? '').trim();
    const signature = String(request.body?.razorpay_signature ?? '').trim();

    if (!orderId || !paymentId || !signature) {
      response.status(400).json({ error: 'Razorpay order id, payment id, and signature are required.' });
      return;
    }

    try {
      const { keySecret } = requireRazorpayCredentials();
      if (!verifyRazorpaySignature(orderId, paymentId, signature, keySecret)) {
        response.status(400).json({ error: 'Razorpay signature verification failed.' });
        return;
      }

      const order = await db.prepare(`
        SELECT plan, billing_interval, seats, status
          FROM billing_orders
         WHERE user_id = ? AND razorpay_order_id = ?
      `).get<{ plan: BillingPlan; billing_interval: BillingInterval; seats: number; status: string }>(user.id, orderId);

      if (!order) {
        response.status(404).json({ error: 'Billing order not found.' });
        return;
      }

      const plan = normalizeBillingPlan(order.plan);
      const billingInterval = normalizeBillingInterval(order.billing_interval);
      const seats = Math.max(1, Number(order.seats ?? 1));

      await db.prepare(`
        UPDATE billing_orders
           SET status = ?, razorpay_payment_id = ?, verified_at = NOW()
         WHERE user_id = ? AND razorpay_order_id = ?
      `).run('paid', paymentId, user.id, orderId);

      await upsertSubscription({
        userId: user.id,
        plan,
        status: 'active',
        provider: 'razorpay',
        billingInterval,
        seats,
        currentPeriodEnd: getPeriodEnd(billingInterval),
        razorpayPaymentId: paymentId,
      });

      response.json({ success: true, subscription: toSubscriptionPayload(await getUserSubscription(user.id)) });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to verify payment.' });
    }
  });

  app.post('/api/webhooks/razorpay', async (request, response) => {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET?.trim();
    if (!webhookSecret) {
      response.status(501).json({ error: 'Razorpay webhook secret is not configured.' });
      return;
    }

    const signature = String(request.headers['x-razorpay-signature'] ?? '');
    const rawBody = (request as AuthedRequest).rawBody;
    if (!signature || !rawBody) {
      response.status(400).json({ error: 'Missing Razorpay webhook signature.' });
      return;
    }

    const expected = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
    if (expected.length !== signature.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) {
      response.status(400).json({ error: 'Invalid Razorpay webhook signature.' });
      return;
    }

    response.json({ received: true });
  });

  app.get('/api/questions/stats', requireUser, async (_request, response) => {
    try {
      const stats = await listQuestionStats();
      response.json({ stats });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load question stats.' });
    }
  });

  app.get('/api/practice/overview', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const canonicalDomain = toPracticeDomain(String(request.query.domain ?? selectedDomain));
      if (!canonicalDomain) {
        response.status(400).json({ error: 'Choose your interview domain in onboarding before opening practice sessions.' });
        return;
      }
      const history = await listPracticeSessions(user.id, { domain: canonicalDomain });
      response.json({
        domain: canonicalDomain,
        suggestedTopics: getPracticeTagCloud(canonicalDomain),
        history,
      });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load practice overview.' });
    }
  });

  app.get('/api/practice/sessions', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const canonicalDomain = request.query.domain ? toPracticeDomain(String(request.query.domain)) : '';
      const savedOnly = String(request.query.savedOnly ?? '').trim().toLowerCase() === 'true';
      const sessions = await listPracticeSessions(user.id, {
        domain: canonicalDomain || undefined,
        savedOnly,
      });
      response.json({ sessions });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load practice sessions.' });
    }
  });

  app.get('/api/saved-sessions', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const requestedRoundType = String(request.query.roundType ?? 'all').trim().toLowerCase();
      const requestedDomain = String(request.query.domain ?? 'all').trim();
      const sessions: Array<{
        id: string;
        roundType: 'practice' | 'scenario' | 'coding' | 'mock';
        domain: string;
        domainLabel: string;
        title: string;
        savedAt: string;
        status: string;
        score: number | null;
        resumePath: string;
        resultsPath: string;
      }> = [];

      if (requestedRoundType === 'all' || requestedRoundType === 'practice') {
        const practiceRows = await listPracticeSessions(user.id, {
          domain: requestedDomain === 'all' ? undefined : toPracticeDomain(requestedDomain) || undefined,
          savedOnly: true,
        });
        for (const item of practiceRows) {
          if (!item.savedAt) continue;
          sessions.push({
            id: item.id,
            roundType: 'practice',
            domain: item.domain,
            domainLabel: item.domainLabel,
            title: item.topic,
            savedAt: item.savedAt,
            status: item.status,
            score: item.score,
            resumePath: item.status === 'completed' ? `/results/practice/${item.id}` : `/round/practice/${item.id}`,
            resultsPath: `/results/practice/${item.id}`,
          });
        }
      }

      if (requestedRoundType === 'all' || requestedRoundType === 'scenario') {
        const domainClause = requestedDomain === 'all' ? '' : 'AND s.domain = $2';
        const params: unknown[] = [user.id];
        if (requestedDomain !== 'all') params.push(toScenarioDomain(requestedDomain) || requestedDomain);
        const rows = await db.query<{ id: string; domain: string; topic: string; status: string; score: number | null; saved_at: string; completed_at: string | null }>(`
          SELECT sa.id, s.domain, s.topic, sa.status, sa.score, sa.saved_at, sa.completed_at
            FROM scenario_attempts sa
            JOIN scenarios s ON s.id = sa.scenario_id
           WHERE sa.user_id = $1 AND sa.saved_at IS NOT NULL ${domainClause}
           ORDER BY sa.saved_at DESC
        `, params);
        for (const row of rows) {
          sessions.push({
            id: row.id,
            roundType: 'scenario',
            domain: row.domain,
            domainLabel: SCENARIO_DOMAIN_LABELS[toScenarioDomain(row.domain) || 'frontend'] ?? row.domain,
            title: row.topic,
            savedAt: row.saved_at,
            status: row.status,
            score: row.completed_at ? Number(row.score ?? 0) : null,
            resumePath: row.status === 'completed' ? `/results/scenario/${row.id}` : `/round/scenario/${row.id}`,
            resultsPath: `/results/scenario/${row.id}`,
          });
        }
      }

      if (requestedRoundType === 'all' || requestedRoundType === 'coding') {
        const domainClause = requestedDomain === 'all' ? '' : 'AND cp.domain = $2';
        const params: unknown[] = [user.id];
        if (requestedDomain !== 'all') params.push(requestedDomain);
        const rows = await db.query<{ id: string; domain: string; title: string; status: string; score: number | null; saved_at: string; submitted_at: string | null }>(`
          SELECT ca.id, cp.domain, cp.title, ca.status, ca.score, ca.saved_at, ca.submitted_at
            FROM coding_attempts ca
            JOIN coding_problems cp ON cp.id = ca.problem_id
           WHERE ca.user_id = $1 AND ca.saved_at IS NOT NULL ${domainClause}
           ORDER BY ca.saved_at DESC
        `, params);
        for (const row of rows) {
          sessions.push({
            id: row.id,
            roundType: 'coding',
            domain: row.domain,
            domainLabel: PRACTICE_DOMAIN_LABELS[toPracticeDomain(row.domain) || 'frontend'] ?? row.domain,
            title: row.title,
            savedAt: row.saved_at,
            status: row.status,
            score: row.submitted_at ? Number(row.score ?? 0) : null,
            resumePath: row.status === 'submitted' ? `/results/coding/${row.id}` : `/round/coding/${row.id}`,
            resultsPath: `/results/coding/${row.id}`,
          });
        }
      }

      if (requestedRoundType === 'all' || requestedRoundType === 'mock') {
        const domainClause = requestedDomain === 'all' ? '' : 'AND domain = $2';
        const params: unknown[] = [user.id];
        if (requestedDomain !== 'all') params.push(requestedDomain);
        const rows = await db.query<{ id: string; domain: string; interview_title: string; status: string; saved_at: string; report_payload: unknown; completed_at: string | null }>(`
          SELECT id, domain, interview_title, status, saved_at, report_payload, completed_at
            FROM mock_interviews
           WHERE user_id = $1 AND saved_at IS NOT NULL ${domainClause}
           ORDER BY saved_at DESC
        `, params);
        for (const row of rows) {
          const report = parseJsonRecord(row.report_payload);
          sessions.push({
            id: row.id,
            roundType: 'mock',
            domain: row.domain,
            domainLabel: PRACTICE_DOMAIN_LABELS[toPracticeDomain(row.domain) || 'frontend'] ?? row.domain,
            title: row.interview_title,
            savedAt: row.saved_at,
            status: row.status,
            score: row.completed_at ? clampScore(report.overallScore, 0) : null,
            resumePath: row.status === 'completed' ? `/results/mock/${row.id}` : `/round/mock/${row.id}`,
            resultsPath: `/results/mock/${row.id}`,
          });
        }
      }

      sessions.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
      response.json({ sessions });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load saved sessions.' });
    }
  });

  app.post('/api/practice/search', requireUser, async (request, response) => {
    try {
      const practiceSearchTimeoutMs = 130_000;
      request.setTimeout(practiceSearchTimeoutMs);
      response.setTimeout(practiceSearchTimeoutMs);
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      if (!selectedDomain) {
        response.status(400).json({ error: 'Choose your interview domain in onboarding before starting a practice session.' });
        return;
      }

      const selectedPracticeDomain = toPracticeDomain(selectedDomain);
      const domain = toPracticeDomain(String(request.body?.domain ?? selectedDomain));
      if (!selectedPracticeDomain || !domain || domain !== selectedPracticeDomain) {
        response.status(400).json({ error: 'Practice sessions must use your selected domain. Change it in Settings first.' });
        return;
      }

      const topic = String(request.body?.topic ?? '').trim();
      if (!topic) {
        response.status(400).json({ error: 'Topic is required.' });
        return;
      }

      const validation = await validatePracticeTopicForDomain(user.id, topic, domain);
      if (!validation.valid) {
        response.status(400).json({
          error: validation.error,
          suggestedDomain: validation.suggestedDomain,
        });
        return;
      }

      const level = String(request.body?.level ?? '').trim().toLowerCase() || 'intermediate';
      const questions = await generatePracticeSessionQuestions({ userId: user.id, domain, topic, level });
      const sessionId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO open_practice_sessions (
          id, user_id, domain, topic, status, questions, question_type_breakdown, answers, generated_at, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, 'in-progress', ?::jsonb, ?::jsonb, '[]'::jsonb, NOW(), NOW(), NOW()
        )
      `).run(sessionId, user.id, domain, topic, JSON.stringify(questions), JSON.stringify({ mcq: 10, 'fill-blank': 10, 'code-reading': 20 }));
      const session = await loadPracticeSession(sessionId, user.id);
      response.status(201).json({ session });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate a practice session.';
      if (message.startsWith('aiUnavailable:')) {
        response.status(503).json({ aiUnavailable: true, error: message.replace(/^aiUnavailable:\s*/, '') });
        return;
      }
      response.status(500).json({ error: message });
    }
  });

  app.get('/api/practice/:sessionId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const sessionId = String(request.params.sessionId ?? '').trim();
      const session = await loadPracticeSession(sessionId, user.id);
      if (!session) {
        response.status(404).json({ error: 'Practice session not found.' });
        return;
      }
      response.json({ session });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load practice session.' });
    }
  });

  app.patch('/api/practice/:sessionId/answers', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const sessionId = String(request.params.sessionId ?? '').trim();
      const session = await loadPracticeSession(sessionId, user.id);
      if (!session) {
        response.status(404).json({ error: 'Practice session not found.' });
        return;
      }
      if (session.status === 'completed') {
        response.status(409).json({ error: 'This practice session is already completed.' });
        return;
      }

      const answers = parsePracticeAnswers(request.body?.answers);
      await db.prepare(`
        UPDATE open_practice_sessions
           SET answers = ?::jsonb,
               updated_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(answers), sessionId, user.id);
      response.json({ success: true, savedAt: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save practice progress.' });
    }
  });

  app.post('/api/practice/:sessionId/complete', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const sessionId = String(request.params.sessionId ?? '').trim();
      const session = await loadPracticeSession(sessionId, user.id);
      if (!session) {
        response.status(404).json({ error: 'Practice session not found.' });
        return;
      }

      const answers = parsePracticeAnswers(request.body?.answers);
      const finalAnswers = answers.length ? answers : session.answers;
      const report = buildPracticeSessionReport(session.questions, finalAnswers);
      const timeSpentSeconds = Number.isFinite(Number(request.body?.timeSpentSeconds))
        ? Math.max(0, Math.round(Number(request.body?.timeSpentSeconds)))
        : session.timeSpentSeconds;

      await db.prepare(`
        UPDATE open_practice_sessions
           SET status = 'completed',
               answers = ?::jsonb,
               score = ?,
               correct_answers = ?,
               time_spent_seconds = ?,
               result_payload = ?::jsonb,
               completed_at = NOW(),
               updated_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(
        JSON.stringify(finalAnswers),
        report.score,
        report.correctAnswers,
        timeSpentSeconds ?? null,
        JSON.stringify({
          performanceLabel: report.performanceLabel,
          weakTags: report.weakTags,
          results: report.results,
        }),
        sessionId,
        user.id,
      );

      response.json({ session: await loadPracticeSession(sessionId, user.id) });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to complete practice session.' });
    }
  });

  app.post('/api/practice/:sessionId/save', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const sessionId = String(request.params.sessionId ?? '').trim();
      const session = await loadPracticeSession(sessionId, user.id);
      if (!session) {
        response.status(404).json({ error: 'Practice session not found.' });
        return;
      }

      const saved = Boolean(request.body?.saved);
      await db.prepare(`
        UPDATE open_practice_sessions
           SET saved_at = CASE WHEN ? THEN NOW() ELSE NULL END,
               updated_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(saved, sessionId, user.id);
      response.json({ savedAt: saved ? new Date().toISOString() : null });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to update saved state.' });
    }
  });

  app.get('/api/questions', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const requestedDomain = String(request.query.domain ?? '');
      const domain = !requestedDomain || requestedDomain === 'all' ? await getUserSelectedDomain(user.id) : normalizeDomain(requestedDomain);
      const types = parseQuestionTypes(request.query.types);
      const type = normalizeQuestionType(request.query.type) ?? 'all';
      const search = String(request.query.search ?? '');
      const topics = toStringArray(request.query.topics);
      const roundTags = toStringArray(request.query.roundTags);
      const pageSize = Math.min(60, Math.max(1, Number(request.query.pageSize ?? request.query.limit ?? 12)));
      const page = Math.max(1, Number(request.query.page ?? 1));
      const faangOnly = String(request.query.faangOnly ?? 'false') === 'true';
      const result = await listQuestions({
        domain,
        types: types.length ? types : undefined,
        type: types.length ? undefined : type,
        search,
        faangOnly,
        topics,
        roundTags,
        limit: pageSize,
        offset: (page - 1) * pageSize,
      });
      response.json({ ...result, totalReturned: result.questions.length });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load questions.' });
    }
  });

  app.get('/api/round-drafts/:feature/:attemptId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const feature = String(request.params.feature ?? '').trim();
      const attemptId = String(request.params.attemptId ?? '').trim();
      const row = await db.prepare(`
        SELECT draft_payload, saved_at
          FROM round_drafts
         WHERE user_id = ? AND feature = ? AND attempt_id = ?
      `).get<{ draft_payload: unknown; saved_at: string }>(user.id, feature, attemptId);
      response.json({ draft: row ? { payload: parseJsonRecord(row.draft_payload), savedAt: row.saved_at } : null });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load draft.' });
    }
  });

  app.post('/api/round-drafts/:feature/:attemptId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const feature = String(request.params.feature ?? '').trim();
      const attemptId = String(request.params.attemptId ?? '').trim();
      const payload = request.body?.payload && typeof request.body.payload === 'object' ? request.body.payload : {};
      await db.prepare(`
        INSERT INTO round_drafts (id, user_id, attempt_id, feature, draft_payload, saved_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?::jsonb, NOW(), NOW(), NOW())
        ON CONFLICT (user_id, attempt_id, feature)
        DO UPDATE SET draft_payload = EXCLUDED.draft_payload, saved_at = NOW(), updated_at = NOW()
      `).run(crypto.randomUUID(), user.id, attemptId, feature, JSON.stringify(payload));
      await db.prepare('UPDATE round_attempts SET last_saved_at = NOW() WHERE id = ? AND user_id = ?').run(attemptId, user.id);
      response.json({ success: true, savedAt: new Date().toISOString() });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save draft.' });
    }
  });

  app.post('/api/rounds/:attemptId/focus-event', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const feature = String(request.body?.feature ?? 'round').trim();
      const eventType = String(request.body?.eventType ?? 'unknown').trim();
      const detail = request.body?.detail && typeof request.body.detail === 'object' ? request.body.detail : {};
      await db.prepare(`
        INSERT INTO round_focus_events (id, user_id, attempt_id, feature, event_type, detail)
        VALUES (?, ?, ?, ?, ?, ?::jsonb)
      `).run(crypto.randomUUID(), user.id, attemptId, feature, eventType, JSON.stringify(detail));
      response.json({ success: true });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save focus event.' });
    }
  });

  app.post('/api/rounds/:attemptId/abandon', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      await db.prepare(`
        UPDATE round_attempts
           SET status = 'abandoned', updated_at = NOW(), last_saved_at = NOW()
         WHERE id = ? AND user_id = ? AND status = 'started'
      `).run(attemptId, user.id);
      await db.prepare(`
        INSERT INTO round_focus_events (id, user_id, attempt_id, feature, event_type, detail)
        VALUES (?, ?, ?, ?, 'abandoned', ?::jsonb)
      `).run(crypto.randomUUID(), user.id, attemptId, String(request.body?.feature ?? 'round'), JSON.stringify({ reason: request.body?.reason ?? 'user_left' }));
      response.json({ success: true });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to abandon round.' });
    }
  });

  app.get('/api/scenarios/overview', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const selectedScenarioDomain = toScenarioDomain(selectedDomain || '');
      const domain = toScenarioDomain(String(request.query.domain ?? selectedDomain ?? ''));
      if (!selectedScenarioDomain || !domain || domain !== selectedScenarioDomain) {
        response.status(400).json({ error: 'Scenario rounds must use your selected domain. Change it in Settings first.' });
        return;
      }
      response.json(await listSingleScenarioOverview(user.id, domain));
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load scenario overview.' });
    }
  });

  app.get('/api/scenarios', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const selectedScenarioDomain = toScenarioDomain(selectedDomain || '');
      const domain = toScenarioDomain(String(request.query.domain ?? selectedDomain ?? ''));
      if (!selectedScenarioDomain || !domain || domain !== selectedScenarioDomain) {
        response.status(400).json({ error: 'Scenario rounds must use your selected domain. Change it in Settings first.' });
        return;
      }
      response.json(await listSingleScenarioOverview(user.id, domain));
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load scenarios.' });
    }
  });

  app.post('/api/scenarios/generate', requireUser, async (request, response) => {
    const requestAbortHandle = createRequestAbortHandle(request, response);
    try {
      const scenarioGenerationTimeoutMs = SCENARIO_GENERATION_ROUTE_TIMEOUT_MS;
      request.setTimeout(scenarioGenerationTimeoutMs);
      response.setTimeout(scenarioGenerationTimeoutMs);

      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const selectedScenarioDomain = toScenarioDomain(selectedDomain || '');
      const domain = toScenarioDomain(String(request.body?.domain ?? selectedDomain ?? ''));
      if (!selectedScenarioDomain || !domain || domain !== selectedScenarioDomain) {
        response.status(400).json({ error: 'Scenario rounds must use your selected domain. Change it in Settings first.' });
        return;
      }

      const topic = String(request.body?.topic ?? '').trim();
      if (!topic) {
        response.status(400).json({ error: 'Topic is required.' });
        return;
      }

      const validation = await validateScenarioTopicForDomain(user.id, topic, domain);
      if (!validation.valid) {
        response.status(400).json({
          error: validation.error,
          suggestedDomain: validation.suggestedDomain,
        });
        return;
      }

      const level = String(request.body?.level ?? '').trim().toLowerCase() || 'intermediate';
      const scenario = await withOperationTimeout('scenario_generation', scenarioGenerationTimeoutMs, () => generateSingleScenarioForTopic({
        userId: user.id,
        domain,
        topic,
        level,
        abortSignal: requestAbortHandle.signal,
      }));
      if (requestAbortHandle.signal.aborted || request.aborted || response.destroyed) {
        return;
      }
      response.status(201).json({ scenario });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate scenario.';
      if (message === 'request_aborted') {
        return;
      }
      if (message === 'scenario_generation_timeout' || message === 'analysis_timeout') {
        response.status(504).json({ error: 'Scenario generation timed out. Please retry with a more specific topic.' });
        return;
      }
      if (message.startsWith('aiUnavailable:')) {
        response.status(503).json({ aiUnavailable: true, error: message.replace(/^aiUnavailable:\s*/, '') });
        return;
      }
      response.status(500).json({ error: message });
    } finally {
      requestAbortHandle.cleanup();
    }
  });

  app.get('/api/scenarios/attempts/:attemptId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const attempt = await loadSingleScenarioAttempt(user.id, attemptId);
      if (!attempt) {
        response.status(404).json({ error: 'Scenario attempt not found.' });
        return;
      }
      response.json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load scenario attempt.' });
    }
  });

  app.get('/api/scenarios/:scenarioId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const scenarioId = String(request.params.scenarioId ?? '').trim();
      const scenario = await loadSingleScenarioById(user.id, scenarioId);
      if (!scenario) {
        response.status(404).json({ error: 'Scenario not found.' });
        return;
      }
      response.json({ scenario });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load scenario.' });
    }
  });

  app.post('/api/scenarios/:scenarioId/start', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    try {
      const entitlement = await getEntitlement(user.id, 'scenario-round');
      if (!entitlement.hasAccess) {
        response.status(403).json({ error: entitlement.upgradeMessage ?? 'Upgrade required.', ...entitlement });
        return;
      }

      const selectedDomain = await getUserSelectedDomain(user.id);
      const selectedScenarioDomain = toScenarioDomain(selectedDomain || '');
      const scenarioId = String(request.params.scenarioId ?? '').trim();
      const scenario = await loadSingleScenarioById(user.id, scenarioId);
      if (!scenario) {
        response.status(404).json({ error: 'Scenario not found.' });
        return;
      }
      if (!selectedScenarioDomain || scenario.domain !== selectedScenarioDomain) {
        response.status(400).json({ error: 'Scenario rounds must use your selected domain. Change it in Settings first.' });
        return;
      }

      const existingRows = await db.query<{ id: string }>(
        `SELECT id
           FROM scenario_attempts
          WHERE user_id = $1 AND scenario_id = $2 AND status = 'started'
          ORDER BY started_at DESC
          LIMIT 1`,
        [user.id, scenario.id],
      );
      if (existingRows[0]?.id) {
        const existingAttempt = await loadSingleScenarioAttempt(user.id, existingRows[0].id);
        if (existingAttempt) {
          response.json({ attempt: existingAttempt });
          return;
        }
      }

      const attemptId = crypto.randomUUID();
      await db.prepare(`
        INSERT INTO scenario_attempts (
          id, scenario_id, user_id, status, started_at, duration_minutes, paused_ms, last_saved_at, score, time_spent_seconds, completed_at, result_payload
        ) VALUES (
          ?, ?, ?, 'started', NOW(), 30, 0, NOW(), 0, NULL, NULL, '{}'::jsonb
        )
      `).run(attemptId, scenario.id, user.id);

      const attempt = await loadSingleScenarioAttempt(user.id, attemptId);
      response.status(201).json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start scenario.' });
    }
  });

  app.post('/api/scenarios/:scenarioId/attempts/:attemptId/step', requireUser, async (request, response) => {
    response.status(410).json({ error: 'Scenario rounds now use one question and one submission. Submit the full answer with the /submit endpoint.' });
  });

  app.post('/api/scenarios/:scenarioId/attempts/:attemptId/submit', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    try {
      const scenarioId = String(request.params.scenarioId ?? '').trim();
      const attemptId = String(request.params.attemptId ?? '').trim();
      const timeSpentSeconds = Number.isFinite(Number(request.body?.timeSpentSeconds))
        ? Math.max(0, Math.round(Number(request.body?.timeSpentSeconds)))
        : null;

      const attempt = await loadSingleScenarioAttempt(user.id, attemptId);
      if (!attempt || attempt.scenario.id !== scenarioId) {
        response.status(404).json({ error: 'Scenario attempt not found.' });
        return;
      }

      const answer = String(request.body?.answer ?? attempt.answer ?? '').trim();
      let evaluation = answer ? fallbackSingleScenarioEvaluation(answer, attempt.scenario) : null;

      if (answer) {
        try {
          await checkAiRateLimit(user.id, 'scenario-answer-evaluation', 1);
          const ai = await callStructuredModel(
            `You are a senior ${SCENARIO_DOMAIN_LABELS[attempt.scenario.domain]} engineer evaluating one scenario interview answer. Return only valid JSON starting with { and ending with }. No markdown. No preamble. The candidate's answer may be a voice transcription. Evaluate the technical content and reasoning only. Do not penalize for filler words or speech-to-text artifacts.`,
            `Scenario context: ${attempt.scenario.context}. Role: ${attempt.scenario.role}. Topic: ${attempt.scenario.topic}. Question type: ${attempt.scenario.type}. Question: ${attempt.scenario.question}. Candidate answer: ${answer}. Return JSON: { score: number (1-10), feedback: string, whatWorked: string, whatWasMissed: string, seniorEngineerWouldSay: string }. The response must be specific to this exact topic and question, not generic interview advice.`,
            (payload) => normalizeSingleScenarioEvaluationPayload(payload),
            {
              maxTokens: 500,
              timeoutMs: 20000,
              model: SCENARIO_STEP_EVALUATION_MODEL,
              temperature: 0.7,
            },
          );
          evaluation = ai.result;
        } catch (error) {
          if ((error as Error & { statusCode?: number }).statusCode === 429) {
            response.status(429).json({ error: error instanceof Error ? error.message : "You're moving fast - slow down a bit.", retryAfterSeconds: 3600 });
            return;
          }
        }
      }

      const computed = buildScenarioResultsPayload(attempt.scenario, answer, evaluation);
      await db.prepare(`
        INSERT INTO scenario_step_answers (id, attempt_id, step_number, user_answer, feedback_payload, created_at, updated_at)
        VALUES (?, ?, 1, ?, ?::jsonb, NOW(), NOW())
        ON CONFLICT (attempt_id, step_number)
        DO UPDATE SET user_answer = EXCLUDED.user_answer, feedback_payload = EXCLUDED.feedback_payload, updated_at = NOW()
      `).run(crypto.randomUUID(), attemptId, answer, JSON.stringify(computed.evaluation));
      await db.prepare(`
        UPDATE scenario_attempts
           SET status = 'completed',
               score = ?,
               time_spent_seconds = ?,
               completed_at = NOW(),
               last_saved_at = NOW(),
               result_payload = ?::jsonb
         WHERE id = ? AND user_id = ?
      `).run(
        computed.score,
        timeSpentSeconds,
        JSON.stringify({
          summary: computed.summary,
          focusAreas: computed.focusAreas,
          nextSteps: computed.nextSteps,
          evaluation: computed.evaluation,
          answer,
          score: computed.score,
        }),
        attemptId,
        user.id,
      );

      const submittedAttempt = await loadSingleScenarioAttempt(user.id, attemptId);
      response.json({ attempt: submittedAttempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to submit scenario attempt.' });
    }
  });

  app.post('/api/scenarios/:attemptId/save', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const saved = request.body?.saved === undefined ? true : Boolean(request.body.saved);
      await db.prepare(`
        UPDATE scenario_attempts
           SET saved_at = CASE WHEN ? THEN NOW() ELSE NULL END,
               last_saved_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(saved, attemptId, user.id);
      const attempt = await loadSingleScenarioAttempt(user.id, attemptId);
      if (!attempt) {
        response.status(404).json({ error: 'Scenario attempt not found.' });
        return;
      }
      response.json({ savedAt: saved ? new Date().toISOString() : null });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save scenario attempt.' });
    }
  });

  app.get('/api/coding/overview', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      if (!selectedDomain) {
        response.status(400).json({ error: 'Choose your interview domain in onboarding before opening the coding round.' });
        return;
      }
      const domain = normalizeDomain(request.query.domain, selectedDomain);
      if (!domain || domain !== selectedDomain) {
        response.status(400).json({ error: 'Coding rounds must use your selected domain. Change it in Settings first.' });
        return;
      }
      response.json(await buildCodingOverview(user.id, domain));
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load coding overview.' });
    }
  });

  app.post('/api/coding/generate', requireUser, async (request, response) => {
    const requestAbortHandle = createRequestAbortHandle(request, response);
    try {
      const routeTimeoutMs = CODING_PROBLEM_GENERATION_ROUTE_TIMEOUT_MS;
      request.setTimeout(routeTimeoutMs);
      response.setTimeout(routeTimeoutMs);

      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      if (!selectedDomain) {
        response.status(400).json({ error: 'Choose your interview domain in onboarding before starting the coding round.' });
        return;
      }

      const domain = normalizeDomain(request.body?.domain, selectedDomain);
      if (!domain || domain !== selectedDomain) {
        response.status(400).json({ error: 'Coding rounds must use your selected domain. Change it in Settings first.' });
        return;
      }

      const difficulty = normalizeCodingDifficulty(request.body?.difficulty);
      const entitlement = await getEntitlement(user.id, 'coding-round');
      if (!entitlement.hasAccess) {
        response.status(403).json({ error: entitlement.upgradeMessage ?? 'Upgrade required.', ...entitlement });
        return;
      }

      const activeAttempt = Boolean(request.body?.forceNew) ? null : await findActiveCodingAttempt(user.id, domain);
      if (activeAttempt) {
        response.json({ attempt: activeAttempt, resumed: true });
        return;
      }

      const attempt = await generateCodingAttemptForUser({
        userId: user.id,
        domain,
        difficulty,
        abortSignal: requestAbortHandle.signal,
      });
      if (requestAbortHandle.signal.aborted || request.aborted || response.destroyed) {
        return;
      }
      response.status(201).json({ attempt });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to generate coding problem.';
      if (message === 'request_aborted') {
        return;
      }
      if (message === 'analysis_timeout' || message.startsWith('aiUnavailable:')) {
        response.status(503).json({ error: message.replace(/^aiUnavailable:\s*/, 'Unable to generate a fresh coding problem right now.') });
        return;
      }
      response.status(500).json({ error: message });
    } finally {
      requestAbortHandle.cleanup();
    }
  });

  app.get('/api/coding/attempts/:attemptId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const attempt = await loadCodingAttempt(user.id, attemptId);
      if (!attempt) {
        response.status(404).json({ error: 'Coding attempt not found.' });
        return;
      }
      response.json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load coding attempt.' });
    }
  });

  app.post('/api/coding/:attemptId/submit', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const attempt = await loadCodingAttempt(user.id, attemptId);
      if (!attempt) {
        response.status(404).json({ error: 'Coding attempt not found.' });
        return;
      }

      const code = String(request.body?.code ?? attempt.code ?? '').trimEnd();
      const notes = String(request.body?.notes ?? '').trim();
      const language = normalizeCodingLanguage(request.body?.language, attempt.language);
      const timeSpentSeconds = Number.isFinite(Number(request.body?.timeSpentSeconds))
        ? Math.max(0, Math.round(Number(request.body?.timeSpentSeconds)))
        : null;

      let evaluation: CodingEvaluation | null = null;
      let aiUnavailable = false;
      let evaluationError: string | null = null;

      try {
        evaluation = await evaluateCodingSubmission({
          userId: user.id,
          problem: { ...attempt.problem, language },
          language,
          code,
          notes,
        });
      } catch (error) {
        if ((error as Error & { statusCode?: number }).statusCode === 429) {
          response.status(429).json({ error: error instanceof Error ? error.message : "You're moving fast - slow down a bit.", retryAfterSeconds: 3600 });
          return;
        }
        aiUnavailable = true;
        evaluationError = error instanceof Error
          ? error.message.replace(/^aiUnavailable:\s*/, '')
          : 'DeepSeek could not evaluate your submission right now.';
      }

      const meta = buildCodingResultMeta(attempt.problem, evaluation, aiUnavailable);
      const evaluationPayload = aiUnavailable
        ? buildCodingEvaluationUnavailablePayload(attempt.problem, evaluationError ?? 'DeepSeek could not evaluate your submission right now.')
        : {
            ...evaluation,
            summary: meta.summary,
            focusAreas: meta.focusAreas,
            nextSteps: meta.nextSteps,
          };

      await db.prepare(`
        UPDATE coding_attempts
           SET status = 'submitted',
               code_draft = ?,
               notes = ?,
               language = ?,
               score = ?,
               time_spent_seconds = ?,
               submitted_at = NOW(),
               last_saved_at = NOW(),
               evaluation_payload = ?::jsonb
         WHERE id = ? AND user_id = ?
      `).run(
        code,
        notes,
        language,
        evaluation?.score ?? 0,
        timeSpentSeconds,
        JSON.stringify(evaluationPayload),
        attemptId,
        user.id,
      );

      const submittedAttempt = await loadCodingAttempt(user.id, attemptId);
      if (aiUnavailable) {
        response.status(503).json({ error: evaluationError ?? 'DeepSeek could not evaluate your submission right now.', aiUnavailable: true, attemptId });
        return;
      }
      response.json({ attempt: submittedAttempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to submit coding attempt.' });
    }
  });

  app.get('/api/coding/history', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const domain = normalizeDomain(request.query.domain, selectedDomain);
      const difficulty = request.query.difficulty ? normalizeCodingDifficulty(request.query.difficulty) : null;
      const params: unknown[] = [user.id, domain];
      const difficultyClause = difficulty ? 'AND cp.difficulty = $3' : '';
      if (difficulty) params.push(difficulty);
      const rows = await db.query<{ attempt_id: string }>(`
        SELECT ca.id AS attempt_id
          FROM coding_attempts ca
          JOIN coding_problems cp ON cp.id = ca.problem_id
         WHERE ca.user_id = $1
           AND cp.domain = $2
           ${difficultyClause}
           AND (ca.status <> 'started' OR NOW() < (ca.started_at + (ca.duration_minutes * INTERVAL '1 minute')))
         ORDER BY ca.started_at DESC
         LIMIT 20
      `, params);
      const attempts = (await Promise.all(rows.map((row) => loadCodingAttempt(user.id, row.attempt_id)))).filter(Boolean);
      response.json({ attempts });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load coding history.' });
    }
  });

  app.post('/api/coding/:problemId/starter-code', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const problemId = String(request.params.problemId ?? '').trim();
      const language = normalizeCodingLanguage(request.body?.language, 'typescript');
      const domain = normalizeDomain(request.body?.domain, await getUserSelectedDomain(user.id));
      const rows = await db.query<{ title: string; description: string }>(
        `SELECT title, description FROM coding_problems WHERE id = $1 AND user_id = $2 LIMIT 1`,
        [problemId, user.id],
      );
      const problem = rows[0];
      if (!problem) {
        response.status(404).json({ error: 'Coding problem not found.' });
        return;
      }
      await checkAiRateLimit(user.id, 'coding-starter-code', 1);
      const domainLabel = PRACTICE_DOMAIN_LABELS[toPracticeDomain(domain) || 'frontend'] ?? domain;
      const ai = await callStructuredModel(
        'Return one JSON object only. No markdown fences. No explanation.',
        `Given this coding problem: ${problem.title}. ${problem.description}. Generate starter code in ${formatCodingLanguageLabel(language)} with TODO comments marking what to implement. 15-25 lines. Return only JSON: { "starterCode": string }. The starterCode value must contain only code, no markdown fences, no explanation. Domain: ${domainLabel}.`,
        (payload) => {
          const source = parseJsonRecord(payload);
          const starterCode = String(source.starterCode ?? source.code ?? '').trim();
          if (!starterCode) throw new Error('starter_code_empty');
          return starterCode.replace(/^```[a-z]*\s*/i, '').replace(/```$/i, '').trim();
        },
        { maxTokens: 600, timeoutMs: 20_000, model: CODING_PROBLEM_GENERATION_MODEL, temperature: 0.6 },
      );
      response.json({ starterCode: ai.result });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to generate starter code.' });
    }
  });

  app.post('/api/coding/:attemptId/save', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const saved = request.body?.saved === undefined ? true : Boolean(request.body.saved);
      const scratchNotes = request.body?.scratchNotes === undefined ? null : String(request.body.scratchNotes ?? '');
      await db.prepare(`
        UPDATE coding_attempts
           SET saved_at = CASE WHEN ? THEN NOW() ELSE NULL END,
               scratch_notes = COALESCE(?, scratch_notes),
               last_saved_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(saved, scratchNotes, attemptId, user.id);
      const attempt = await loadCodingAttempt(user.id, attemptId);
      if (!attempt) {
        response.status(404).json({ error: 'Coding attempt not found.' });
        return;
      }
      response.json({ savedAt: attempt.savedAt, scratchNotes: attempt.scratchNotes });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save coding attempt.' });
    }
  });

  app.get('/api/coding/problems', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const domain = normalizeDomain(request.query.domain, selectedDomain);
      const result = await listQuestions({ domain, type: 'coding', limit: 18, offset: 0 });
      response.json({
        problems: result.questions.map((question) => ({
          id: question.id,
          domain: question.domain,
          title: question.topic,
          description: question.questionText,
          context: question.explanation,
          starterCode: question.codeSnippet ?? question.correctAnswer,
          language: domain === 'data-science' || domain === 'ai-ml' ? 'python' : domain === 'data-analytics' ? 'sql' : 'typescript',
          difficulty: question.difficulty === 3 ? 'hard' : question.difficulty === 2 ? 'medium' : 'easy',
          category: question.topic,
          evaluationCriteria: ['Correctness', 'Code quality', 'Failure handling', 'Domain best practices'],
          hints: [question.explanation],
        })),
      });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load coding problems.' });
    }
  });

  app.get('/api/mock/overview', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const selectedDomain = await getUserSelectedDomain(user.id);
      const domain = normalizeDomain(request.query.domain, selectedDomain);
      const activeInterview = await findActiveMockInterview(user.id, domain);
      const rows = await db.query<{ id: string }>(`
        SELECT id
          FROM mock_interviews
         WHERE user_id = $1
           AND domain = $2
           AND (status <> 'started' OR NOW() < (started_at + (duration_minutes * INTERVAL '1 minute')))
         ORDER BY COALESCE(completed_at, started_at) DESC
         LIMIT 12
      `, [user.id, domain]);
      const interviews = await Promise.all(rows.map((row) => loadMockInterview(user.id, row.id)));
      const history = interviews.flatMap((item) => item ? [{
        id: item.id,
        domain: item.domain,
        domainLabel: item.domainLabel,
        level: item.level,
        interviewType: item.interviewType,
        persona: item.persona,
        interviewTitle: item.interviewTitle,
        status: item.status,
        startedAt: item.startedAt,
        completedAt: item.completedAt,
        savedAt: item.savedAt,
        score: item.report?.overallScore ?? null,
      }] : []);
      response.json({ activeInterviewId: activeInterview?.id ?? null, history });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load mock overview.' });
    }
  });

  app.post('/api/mock/start', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    try {
      const selectedDomain = await getUserSelectedDomain(user.id);
      const requestedDomain = normalizeOptionalDomain(request.body?.domain);
      if (!selectedDomain || !requestedDomain || requestedDomain !== selectedDomain) {
        response.status(400).json({ error: 'Choose a valid mock interview domain before starting.', retryable: true });
        return;
      }
      const domain = requestedDomain;
      const existing = Boolean(request.body?.forceNew) ? null : await findActiveMockInterview(user.id, domain);
      if (existing) {
        response.json({ interview: existing, resumed: true });
        return;
      }

      const entitlement = await getEntitlement(user.id, 'mock-interview');
      if (!entitlement.hasAccess) {
        response.status(403).json({ error: entitlement.upgradeMessage ?? 'Upgrade required.', ...entitlement });
        return;
      }
      const interview = await generateMockInterviewForUser({
        userId: user.id,
        domain,
        level: normalizeMockLevel(request.body?.level),
        interviewType: normalizeMockInterviewType(request.body?.interviewType),
        persona: normalizeMockPersona(request.body?.persona),
      });
      response.status(201).json({ interview });
    } catch (error) {
      if ((error as Error & { statusCode?: number }).statusCode === 429) {
        response.status(429).json({ error: error instanceof Error ? error.message : "You're moving fast - slow down a bit.", retryable: true });
        return;
      }
      response.status(503).json({ error: "We couldn't prepare your interview - would you like to try again?", retryable: true });
    }
  });

  app.get('/api/mock/:interviewId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const interview = await loadMockInterview(user.id, String(request.params.interviewId ?? ''));
      if (!interview) {
        response.status(404).json({ error: 'Mock interview not found.' });
        return;
      }
      response.json({ interview });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load mock interview.' });
    }
  });

  app.post('/api/mock/:interviewId/respond', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const interviewId = String(request.params.interviewId ?? '').trim();
      const interview = await loadMockInterview(user.id, interviewId);
      if (!interview) {
        response.status(404).json({ error: 'Mock interview not found.' });
        return;
      }
      const questionId = String(request.body?.questionId ?? '').trim();
      const answer = String(request.body?.answer ?? '').trim();
      const followUpAnswer = String(request.body?.followUpAnswer ?? '').trim();
      const question = interview.questions.find((item) => item.id === questionId);
      if (!question || !answer) {
        response.status(400).json({ error: 'questionId and answer are required.' });
        return;
      }

      let responsePayload: Omit<MockResponseRecord, 'questionId' | 'answer' | 'followUpAnswer' | 'answeredAt'>;
      try {
        await checkAiRateLimit(user.id, 'mock-persona-response', 1);
        const ai = await callStructuredModel(
          mockPersonaSystemPrompt(interview.persona),
          `Domain: ${interview.domainLabel}. Level: ${mockLevelLabel(interview.level)}. Question: ${question.question}. Looking for: ${question.whatWeAreLookingFor}. Answer: ${answer}. Follow-up answer: ${followUpAnswer || 'none'}. Return JSON: { spokenResponse: string (1-2 sentences in persona voice), followUpQuestion: string | null, internalScore: number (1-10), internalFlags: string[] (what they missed) }`,
          normalizeMockResponsePayload,
          { maxTokens: 250, timeoutMs: 15_000, model: 'deepseek/deepseek-chat', temperature: 0.75 },
        );
        responsePayload = ai.result;
      } catch {
        responsePayload = {
          spokenResponse: 'Take a moment, then continue to the next question.',
          followUpQuestion: null,
          internalScore: null,
          internalFlags: ['evaluation unavailable for this question'],
          aiUnavailable: true,
        };
      }

      const responses = interview.responses.filter((item) => item.questionId !== questionId);
      const storedResponse: MockResponseRecord = {
        questionId,
        answer,
        ...(followUpAnswer ? { followUpAnswer } : {}),
        ...responsePayload,
        answeredAt: new Date().toISOString(),
      };
      responses.push(storedResponse);
      const answeredIndexes = responses
        .map((item) => interview.questions.findIndex((questionItem) => questionItem.id === item.questionId))
        .filter((index) => index >= 0);
      const nextIndex = Math.min(interview.questions.length - 1, Math.max(0, Math.max(...answeredIndexes, -1) + 1));
      await db.prepare(`
        UPDATE mock_interviews
           SET responses = ?::jsonb,
               current_question_index = ?,
               last_saved_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(JSON.stringify(responses), nextIndex, interviewId, user.id);
      const updated = await loadMockInterview(user.id, interviewId);
      response.json({ response: storedResponse, interview: updated });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to record mock response.' });
    }
  });

  app.post('/api/mock/:interviewId/finish', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const interviewId = String(request.params.interviewId ?? '').trim();
      const interview = await loadMockInterview(user.id, interviewId);
      if (!interview) {
        response.status(404).json({ error: 'Mock interview not found.' });
        return;
      }
      let report = buildFallbackMockReport(interview);
      try {
        await checkAiRateLimit(user.id, 'mock-final-report', 1);
        const ai = await callStructuredModel(
          'You are a hiring panel lead writing a final interview assessment. Be honest, specific, constructive. No generic praise. Return only valid JSON.',
          `Domain: ${interview.domainLabel}. Level: ${mockLevelLabel(interview.level)}. Persona: ${mockPersonaName(interview.persona)}. Full interview record: ${JSON.stringify({ questions: interview.questions, responses: interview.responses.map((item) => ({ ...item, scoreNote: item.internalScore === null ? 'evaluation unavailable for this question' : item.internalScore })) })}. Generate final report. Return JSON: { overallScore: number (1-10), readinessVerdict: 'not-ready'|'borderline'|'ready'|'strong-yes', technicalDepth: string, communicationClarity: string, designThinking: string, behavioralMaturity: string, topThreeStrengths: string[], topThreeWeaknesses: string[], criticalGaps: string[], studyPlan: [ { area: string, action: string, estimatedDays: number } ], hiringPanelSummary: string (2-3 sentences as if written for a real hiring committee) }`,
          normalizeMockReportPayload,
          { maxTokens: 900, timeoutMs: 25_000, model: 'deepseek/deepseek-chat', temperature: 0.5 },
        );
        report = ai.result;
      } catch {
        report = buildFallbackMockReport(interview);
      }
      await db.prepare(`
        UPDATE mock_interviews
           SET status = 'completed',
               completed_at = NOW(),
               current_question_index = ?,
               last_saved_at = NOW(),
               report_payload = ?::jsonb
         WHERE id = ? AND user_id = ?
      `).run(interview.questions.length, JSON.stringify(report), interviewId, user.id);
      const updated = await loadMockInterview(user.id, interviewId);
      response.json({ interview: updated });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to finish mock interview.' });
    }
  });

  app.post('/api/mock/:interviewId/save', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const interviewId = String(request.params.interviewId ?? '').trim();
      const saved = request.body?.saved === undefined ? true : Boolean(request.body.saved);
      await db.prepare(`
        UPDATE mock_interviews
           SET saved_at = CASE WHEN ? THEN NOW() ELSE NULL END,
               last_saved_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(saved, interviewId, user.id);
      const interview = await loadMockInterview(user.id, interviewId);
      if (!interview) {
        response.status(404).json({ error: 'Mock interview not found.' });
        return;
      }
      response.json({ savedAt: interview.savedAt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to save mock interview.' });
    }
  });

  app.get('/api/rounds/:attemptId/focus-summary', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      const rows = await db.query<{ event_type: string; total: number }>(`
        SELECT event_type, COUNT(*)::int AS total
          FROM round_focus_events
         WHERE user_id = $1 AND attempt_id = $2
         GROUP BY event_type
      `, [user.id, attemptId]);
      response.json({ events: rows.map((row) => ({ type: row.event_type, total: Number(row.total) })) });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load focus summary.' });
    }
  });

  app.get('/api/internal/failed-ai-jobs', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const plan = await getEffectivePlan(user.id);
      if (plan !== 'team' && process.env.NODE_ENV === 'production') {
        response.status(403).json({ error: 'Team access is required.' });
        return;
      }
      const rows = await db.query<{
        id: string;
        user_id: string;
        feature: string;
        attempt_id: string;
        status: string;
        error_message: string | null;
        created_at: string;
        updated_at: string;
      }>(`
        SELECT id, user_id, feature, attempt_id, status, error_message, created_at, updated_at
          FROM ai_retry_jobs
         WHERE status = 'failed'
         ORDER BY updated_at DESC
         LIMIT 100
      `);
      response.json({ jobs: rows });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load failed jobs.' });
    }
  });

  app.post('/api/round-attempts/start', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const roundType = String(request.body?.roundType ?? '').trim();
    const questionType = String(request.body?.questionType ?? '').trim() as 'scenario' | 'coding' | 'mcq' | 'fill_blank' | 'system_design' | 'mock';
    const selectedDomain = await getUserSelectedDomain(user.id);
    if (!selectedDomain) {
      response.status(400).json({ error: 'Choose your interview domain in onboarding before starting a round.' });
      return;
    }
    const domain = normalizeDomain(request.body?.domain, selectedDomain);
    const limit = Math.min(10, Math.max(1, Number(request.body?.limit ?? 1)));
    const durationMinutes = Math.min(90, Math.max(5, Number(request.body?.durationMinutes ?? 15)));

    if (!roundType || !questionType || !domain) {
      response.status(400).json({ error: 'roundType, questionType, and domain are required.' });
      return;
    }
    if (domain !== selectedDomain) {
      response.status(400).json({ error: 'This round must use your selected domain. Change it in Settings first.' });
      return;
    }

    if (['coding-round', 'mock-interview'].includes(roundType)) {
      const existing = await db.prepare(`
        SELECT id
          FROM round_attempts
         WHERE user_id = ? AND round_type = ? AND domain = ? AND status = 'started'
         ORDER BY started_at DESC
         LIMIT 1
      `).get<{ id: string }>(user.id, roundType, domain);
      if (existing?.id) {
        const attempt = await getRoundAttemptById(user.id, existing.id);
        if (attempt) {
          response.json({ attempt });
          return;
        }
      }
    }

    if (['scenario-round', 'coding-round', 'mock-interview'].includes(roundType)) {
      const entitlement = await getEntitlement(user.id, roundType);
      if (!entitlement.hasAccess) {
        response.status(403).json({ error: entitlement.upgradeMessage ?? entitlement.reason ?? 'Upgrade required.', ...entitlement });
        return;
      }
    }

    try {
      const attempt = await createRoundAttempt({
        userId: user.id,
        roundType,
        questionType,
        domain,
        limit,
        durationMinutes,
      });
      response.status(201).json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to start the round attempt.' });
    }
  });

  app.post('/api/round-attempts/:attemptId/submit', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const attemptId = String(request.params.attemptId ?? '').trim();
    const answers = Array.isArray(request.body?.answers) ? request.body.answers : [];
    const timeSpentSeconds = Number.isFinite(Number(request.body?.timeSpentSeconds)) ? Number(request.body.timeSpentSeconds) : undefined;
    const autoSubmitted = Boolean(request.body?.autoSubmitted);

    if (!attemptId) {
      response.status(400).json({ error: 'attemptId is required.' });
      return;
    }

    try {
      const attempt = await submitRoundAttempt({ userId: user.id, attemptId, answers, timeSpentSeconds, autoSubmitted });
      response.json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to submit the round attempt.' });
    }
  });

  app.post('/api/round-attempts/:attemptId/feedback', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const attemptId = String(request.params.attemptId ?? '').trim();
    const questionId = String(request.body?.questionId ?? '').trim();
    const answer = String(request.body?.answer ?? '').trim();
    const mode = String(request.body?.mode ?? '') === 'mock' ? 'mock' : 'scenario';
    const persona = String(request.body?.persona ?? 'Supportive Mentor').trim() || 'Supportive Mentor';

    if (!attemptId || !questionId || !answer) {
      response.status(400).json({ error: 'attemptId, questionId, and answer are required.' });
      return;
    }

    try {
      const attempt = await db.prepare(`
        SELECT id, domain, round_type, question_ids, answer_payload
          FROM round_attempts
         WHERE id = ? AND user_id = ?
      `).get<{ id: string; domain: string; round_type: string; question_ids: unknown; answer_payload: unknown }>(attemptId, user.id);
      if (!attempt) {
        response.status(404).json({ error: 'Round attempt not found.' });
        return;
      }
      if (!parseJsonArray(attempt.question_ids).includes(questionId)) {
        response.status(400).json({ error: 'This question does not belong to the active attempt.' });
        return;
      }

      const question = await db.prepare(`
        SELECT id, domain, domain_label, topic, type, difficulty, question_text, options, correct_answer, explanation, code_snippet, tags, time_limit_minutes
          FROM questions
         WHERE id = ?
      `).get<TrackQuestionRow>(questionId);
      if (!question) {
        response.status(404).json({ error: 'Question not found.' });
        return;
      }

      let feedback = fallbackRoundFeedback(mode, answer);
      try {
        await checkAiRateLimit(user.id, mode === 'mock' ? 'persona-response' : 'answer-evaluation', 1);
        const repoContext = await getLatestRepoContext(user.id);
        const evaluationStartedAt = Date.now();
        const systemPrompt = mode === 'mock'
          ? 'Return one JSON object only.'
          : 'Evaluate one scenario answer. Return one JSON object only.';
        const userPrompt = mode === 'mock'
          ? `Interviewer persona: ${persona}. Domain: ${question.domain_label}. Topic: ${question.topic}. Repo context: ${repoContext}. Question: "${question.question_text}". What we are looking for: "${question.correct_answer}". Candidate answer: "${answer}". Return a single JSON object. Start with { and end with }. Do not use markdown fences. Do not add prose before or after the JSON. Schema: { "spokenResponse": string, "followUpQuestion": string|null, "internalScore": number, "internalFlags": string[], "strengthSignal": string|null, "feedback": string, "whatWorked": string, "whatWasMissed": string }.`
          : `Domain: ${question.domain_label}. Topic: ${question.topic}. Scenario context: "${question.question_text}". Expected answer shape: "${question.correct_answer}". Repo context: ${repoContext}. Candidate answer: "${answer}". If the answer is under 80 characters, penalize brevity. Return a single JSON object. Start with { and end with }. Do not use markdown fences. Do not add prose before or after the JSON. Schema: { "score": number, "feedback": string, "whatWorked": string, "whatWasMissed": string, "seniorEngineerWouldHaveSaid": string }.`;
        const ai = await callStructuredModel(
          systemPrompt,
          userPrompt,
          (payload) => normalizeRoundFeedbackPayload(mode, payload),
          {
            maxTokens: 400,
            timeoutMs: 20000,
            model: process.env.CODE_EVALUATION_MODEL?.trim() || 'deepseek/deepseek-chat',
            temperature: 0.2,
          },
        );
        console.log('[round-feedback] duration:', Date.now() - evaluationStartedAt, 'ms', {
          attemptId,
          questionId,
          mode,
        });
        feedback = ai.result;
      } catch (error) {
        if ((error as Error & { statusCode?: number }).statusCode === 429) {
          response.status(429).json({ error: error instanceof Error ? error.message : "You're moving fast - slow down a bit.", retryAfterSeconds: 3600 });
          return;
        }
        const rawText = typeof (error as { rawResponse?: unknown }).rawResponse === 'string'
          ? String((error as { rawResponse?: unknown }).rawResponse)
          : '';
        const message = error instanceof Error ? error.message : 'AI evaluation failed after fallback.';
        if (rawText) {
          console.error('[round-feedback] parse-failed', {
            attemptId,
            questionId,
            mode,
            rawLength: rawText.length,
            rawPreview: rawText.slice(0, 500),
            rawTail: rawText.slice(-200),
            error: message,
          });
        } else {
          console.warn('[round-feedback] failed', {
            attemptId,
            questionId,
            mode,
            error: message,
          });
        }
        feedback = fallbackRoundFeedback(mode, answer);
        await queueAiRetryJob(user.id, mode, attemptId, { questionId, answer, mode, persona });
        await markAiRetryJobsFailed(user.id, mode, attemptId, message);
      }

      const payload = parseJsonRecord(attempt.answer_payload);
      const feedbackMap = parseJsonRecord(payload.feedback);
      feedbackMap[questionId] = feedback;
      await db.prepare(`
        UPDATE round_attempts
           SET answer_payload = ?::jsonb, updated_at = NOW()
         WHERE id = ? AND user_id = ?
      `).run(JSON.stringify({ ...payload, feedback: feedbackMap }), attemptId, user.id);

      response.json({ feedback });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to generate feedback.' });
    }
  });

  app.get('/api/round-attempts/latest/:roundType', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const roundType = String(request.params.roundType ?? '').trim();
      if (!roundType) {
        response.status(400).json({ error: 'roundType is required.' });
        return;
      }

      if (roundType === 'scenario-round') {
        const domain = request.query.domain ? toScenarioDomain(String(request.query.domain)) || undefined : undefined;
        const scenarioAttempt = await getLatestSingleScenarioAttempt(user.id, domain);
        if (!scenarioAttempt) {
          response.status(404).json({ error: 'No round attempt found for this round type yet.' });
          return;
        }
        response.json({ attempt: toStoredRoundAttemptFromSingleScenarioAttempt(scenarioAttempt) });
        return;
      }

      if (roundType === 'coding-round') {
        const domain = request.query.domain ? normalizeDomain(request.query.domain) : undefined;
        const codingAttempt = await getLatestCodingAttempt(user.id, domain);
        if (!codingAttempt) {
          response.status(404).json({ error: 'No round attempt found for this round type yet.' });
          return;
        }
        response.json({ attempt: toStoredRoundAttemptFromCodingAttempt(codingAttempt) });
        return;
      }

      if (roundType === 'mock-interview') {
        const domain = request.query.domain ? normalizeDomain(request.query.domain) : undefined;
        const mockInterview = await getLatestMockInterview(user.id, domain);
        if (!mockInterview) {
          response.status(404).json({ error: 'No round attempt found for this round type yet.' });
          return;
        }
        response.json({ attempt: mockInterview });
        return;
      }

      const domain = request.query.domain ? normalizeDomain(request.query.domain) : undefined;
      const attempt = await getLatestRoundAttempt(user.id, roundType, domain);
      if (!attempt) {
        response.status(404).json({ error: 'No round attempt found for this round type yet.' });
        return;
      }
      response.json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load the latest round attempt.' });
    }
  });

  app.get('/api/round-attempts/latest-summary', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const normalizedDomain = request.query.domain ? normalizeDomain(request.query.domain) : undefined;
      const scenarioDomain = request.query.domain ? toScenarioDomain(String(request.query.domain)) || undefined : undefined;
      const attempts = await Promise.all([
        getLatestCodingAttempt(user.id, normalizedDomain).then((attempt) => (attempt ? toStoredRoundAttemptFromCodingAttempt(attempt) : null)),
        getLatestSingleScenarioAttempt(user.id, scenarioDomain).then((attempt) => (attempt ? toStoredRoundAttemptFromSingleScenarioAttempt(attempt) : null)),
        getLatestMockInterview(user.id, normalizedDomain),
      ]);
      response.json({ attempts: attempts.filter(Boolean) });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load round attempt summary.' });
    }
  });

  app.get('/api/round-attempts/by-id/:attemptId', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const attemptId = String(request.params.attemptId ?? '').trim();
      if (!attemptId) {
        response.status(400).json({ error: 'attemptId is required.' });
        return;
      }

      const storedAttempt = await getRoundAttemptById(user.id, attemptId);
      if (storedAttempt) {
        response.json({ attempt: storedAttempt });
        return;
      }

      const scenarioAttempt = await loadSingleScenarioAttempt(user.id, attemptId);
      if (scenarioAttempt) {
        response.json({ attempt: toScenarioResultAttemptPayload(scenarioAttempt) });
        return;
      }

      const codingAttempt = await loadCodingAttempt(user.id, attemptId);
      if (codingAttempt) {
        response.json({ attempt: toCodingResultAttemptPayload(codingAttempt) });
        return;
      }

      const mockInterview = await loadMockInterview(user.id, attemptId);
      if (mockInterview) {
        response.json({ attempt: mockInterview });
        return;
      }

      response.status(404).json({ error: 'Round attempt not found.' });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load this round attempt.' });
    }
  });

  app.post('/api/auth/request-email-otp', applyAuthRateLimit, requireUser, async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    const purpose = String(request.body?.purpose ?? '');

    if (!email || !email.includes('@')) {
      response.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (purpose !== 'email_change') {
      response.status(400).json({ error: 'OTP verification is only required for changing account email.' });
      return;
    }

    const existingUser = await db.prepare('SELECT id, email_verified FROM users WHERE email = ?').get<{ id: string; email_verified: boolean | null }>(email);
    if (existingUser) {
      response.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const code = createEmailOtp(email, purpose);
    let delivery: { sent: boolean; reason?: string };
    try {
      delivery = await sendEmailOtp(email, purpose, code);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send OTP email.';
      if (process.env.NODE_ENV === 'production' && process.env.EMAIL_DEBUG_OTP !== 'true') {
        response.status(502).json({ error: message });
        return;
      }
      delivery = {
        sent: false,
        reason: `Email delivery failed, so local OTP fallback is enabled for development. ${message}`,
      };
    }

    const includeDebugCode = process.env.NODE_ENV !== 'production' || process.env.EMAIL_DEBUG_OTP === 'true' || !delivery.sent;
    response.json({
      success: true,
      message: delivery.sent ? 'OTP sent. Check your email and enter the code to continue.' : delivery.reason,
      emailSent: delivery.sent,
      ...(includeDebugCode ? { debugOtp: code } : {}),
    });
  });

  app.post('/api/auth/signup', applyAuthRateLimit, async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    const name = String(request.body?.name ?? '').trim();
    const password = String(request.body?.password ?? '');

    if (!email || !email.includes('@')) {
      response.status(400).json({ error: 'A valid email address is required.' });
      return;
    }
    if (name.length < 2) {
      response.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }
    if (password.length < 8) {
      response.status(400).json({ error: 'Password must be at least 8 characters.' });
      return;
    }
    const existingUser = await db.prepare('SELECT id FROM users WHERE email = ?').get<{ id: string }>(email);
    if (existingUser) {
      response.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const userId = crypto.randomUUID();
    const passwordHash = hashPassword(password);

    await db.prepare('INSERT INTO users (id, email, name, password_hash, email_verified, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
      .run(userId, email, name, passwordHash, 1);
    await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
      .run(crypto.randomUUID(), userId, 0, 'light', '');

    const createdUser = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?')
      .get<DbUserRow>(userId);

    if (!createdUser) {
      response.status(500).json({ error: 'Unable to create the account.' });
      return;
    }

    setSessionCookie(response, createdUser.id);
    response.status(201).json({ user: toSessionUser(createdUser) });
  });

  app.post('/api/auth/signin', applyAuthRateLimit, async (request, response) => {
    const email = normalizeEmail(request.body?.email);
    const password = String(request.body?.password ?? '');
    if (!email || !password) {
      response.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE email = ?')
      .get<DbUserRow>(email);
    if (!user || !verifyPassword(password, user.password_hash)) {
      response.status(401).json({ error: 'Invalid credentials.' });
      return;
    }
    setSessionCookie(response, user.id);
    response.json({ user: toSessionUser(user) });
  });

  app.get('/api/auth/oauth/google', (request, response) => {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${getPublicBaseUrl(request)}/api/auth/oauth/google/callback`;
    if (!clientId) {
      response.redirect('/signin?error=oauth_google_not_configured');
      return;
    }
    const state = crypto.randomUUID();
    oauthStates.set(state, { provider: 'google', createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });
    response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  async function handleGoogleOAuthCallback(request: express.Request, response: express.Response) {
    if (!consumeOAuthState('google', request.query.state)) {
      response.redirect('/signin?error=oauth_state');
      return;
    }
    const code = String(request.query.code ?? '');
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `${getPublicBaseUrl(request)}/api/auth/oauth/google/callback`;
    if (!code || !clientId || !clientSecret) {
      response.redirect('/signin?error=oauth_config');
      return;
    }

    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResponse.json().catch(() => ({})) as { access_token?: string; error_description?: string };
      if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description ?? 'Google token exchange failed.');
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userInfoResponse.json().catch(() => ({})) as { email?: string; name?: string; sub?: string };
      if (!userInfoResponse.ok || !profile.email) throw new Error('Google did not return an email address.');
      if (!profile.sub) throw new Error('Google did not return a stable account id.');
      const user = await findOrCreateOAuthUser('google', profile.sub, profile.email, profile.name ?? '');
      setSessionCookie(response, user.id);
      response.redirect('/onboarding');
    } catch (error) {
      response.redirect(`/signin?error=${encodeURIComponent(error instanceof Error ? error.message : 'oauth_failed')}`);
    }
  }

  app.get('/api/auth/oauth/google/callback', handleGoogleOAuthCallback);
  app.get('/api/integrations/callback/google', handleGoogleOAuthCallback);

  app.get('/api/auth/oauth/github', (request, response) => {
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const nextPath = safeOAuthNextPath(request.query.next);
    if (!clientId) {
      response.redirect(`${nextPath || '/signin'}?error=oauth_github_not_configured`);
      return;
    }
    const state = crypto.randomUUID();
    oauthStates.set(state, { provider: 'github', createdAt: Date.now(), nextPath });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${getPublicBaseUrl(request)}/api/auth/oauth/github/callback`,
      scope: 'read:user user:email repo',
      state,
    });
    response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get('/api/auth/oauth/github/callback', async (request, response) => {
    const oauthState = consumeOAuthState('github', request.query.state);
    if (!oauthState) {
      response.redirect('/signin?error=oauth_state');
      return;
    }
    const code = String(request.query.code ?? '');
    const clientId = process.env.GITHUB_CLIENT_ID?.trim();
    const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
    if (!code || !clientId || !clientSecret) {
      response.redirect('/signin?error=oauth_config');
      return;
    }

    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: `${getPublicBaseUrl(request)}/api/auth/oauth/github/callback`,
        }),
      });
      const tokenData = await tokenResponse.json().catch(() => ({})) as { access_token?: string; error_description?: string };
      if (!tokenResponse.ok || !tokenData.access_token) throw new Error(tokenData.error_description ?? 'GitHub token exchange failed.');

      const [profileResponse, emailsResponse] = await Promise.all([
        fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } }),
        fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${tokenData.access_token}`, Accept: 'application/vnd.github+json' } }),
      ]);
      const profile = await profileResponse.json().catch(() => ({})) as { id?: number; email?: string; name?: string; login?: string };
      const emails = await emailsResponse.json().catch(() => []) as Array<{ email?: string; primary?: boolean; verified?: boolean }>;
      const email = profile.email || emails.find((item) => item.primary && item.verified)?.email || emails.find((item) => item.verified)?.email;
      if (!email) throw new Error('GitHub did not return a verified email address.');
      if (!profile.id) throw new Error('GitHub did not return a stable account id.');
      const user = await findOrCreateOAuthUser('github', String(profile.id), email, profile.name ?? profile.login ?? '');
      await saveGithubAccessToken(user.id, tokenData.access_token);
      setSessionCookie(response, user.id);
      response.redirect(oauthState.nextPath || '/onboarding');
    } catch (error) {
      response.redirect(`/signin?error=${encodeURIComponent(error instanceof Error ? error.message : 'oauth_failed')}`);
    }
  });

  app.get('/api/auth/session', async (request, response) => {
    const user = await getUserFromRequest(request);
    if (!user) {
      response.status(401).json({ error: 'No active session.' });
      return;
    }

    response.json({ user: toSessionUser(user) });
  });

  app.post('/api/auth/signout', (_request, response) => {
    clearSessionCookie(response);
    response.json({ success: true });
  });

  app.get('/api/users/me', requireUser, async (request, response) => {
    response.json({ user: toSessionUser((request as AuthedRequest).user!) });
  });

  app.patch('/api/users/me', requireUser, async (request, response) => {
    const name = String(request.body?.name ?? '').trim();
    const email = normalizeEmail(request.body?.email);
    const otp = String(request.body?.otp ?? '').trim();
    if (name.length < 2) {
      response.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }

    const user = (request as AuthedRequest).user!;
    if (email && email !== user.email) {
      if (!consumeEmailOtp(email, 'email_change', otp)) {
        response.status(400).json({ error: 'We could not verify that email. Request an OTP and enter the code before saving.' });
        return;
      }
      const existing = await db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get<{ id: string }>(email, user.id);
      if (existing) {
        response.status(409).json({ error: 'An account with this email already exists.' });
        return;
      }
      await db.prepare('UPDATE users SET name = ?, email = ?, email_verified = ?, updated_at = NOW() WHERE id = ?').run(name, email, 1, user.id);
    } else {
      await db.prepare('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?').run(name, user.id);
    }
    const updatedUser = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?').get<DbUserRow>(user.id);
    response.json({ user: updatedUser ? toSessionUser(updatedUser) : { ...toSessionUser(user), name, email: email || user.email } });
  });

  app.delete('/api/users/me', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const confirmation = normalizeEmail(request.body?.confirmation);
    if (confirmation !== user.email) {
      response.status(400).json({ error: 'Type your account email to confirm deletion.' });
      return;
    }
    await db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    clearSessionCookie(response);
    response.json({ success: true });
  });

  app.post('/api/auth/change-password', requireUser, async (request, response) => {
    const currentPassword = String(request.body?.currentPassword ?? '');
    const newPassword = String(request.body?.newPassword ?? '');
    const user = (request as AuthedRequest).user!;

    if (!currentPassword || !newPassword) {
      response.status(400).json({ error: 'Both passwords are required.' });
      return;
    }
    if (newPassword.length < 8) {
      response.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }
    if (!verifyPassword(currentPassword, user.password_hash)) {
      response.status(400).json({ error: 'Current password is incorrect.' });
      return;
    }

    await db.prepare('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?').run(hashPassword(newPassword), user.id);
    response.json({ success: true });
  });

  app.get('/api/users/preferences', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    let preferences = await db.prepare('SELECT sidebar_open, theme, domain FROM user_preferences WHERE user_id = ?').get<UserPreferencesRow>(user.id);
    if (!preferences) {
      await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
        .run(crypto.randomUUID(), user.id, 0, 'light', '');
      preferences = { sidebar_open: false, theme: 'light', domain: '' };
    }

    response.json({ sidebarOpen: Boolean(preferences.sidebar_open), theme: preferences.theme ?? 'light', domain: normalizeOptionalDomain(preferences.domain) });
  });

  app.patch('/api/users/preferences', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const sidebarOpen = typeof request.body?.sidebarOpen === 'boolean' ? request.body.sidebarOpen : null;
    const themeValue = typeof request.body?.theme === 'string' ? request.body.theme : null;
    const theme = themeValue && ['light', 'dark', 'system'].includes(themeValue) ? themeValue : null;
    const domain = request.body?.domain === undefined ? null : normalizeOptionalDomain(request.body.domain);
    const existing = await db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?').get<{ user_id: string }>(user.id);

    if (existing) {
      await db.prepare('UPDATE user_preferences SET sidebar_open = COALESCE(?, sidebar_open), theme = COALESCE(?, theme), domain = COALESCE(?, domain), updated_at = NOW() WHERE user_id = ?')
        .run(sidebarOpen === null ? null : (sidebarOpen ? 1 : 0), theme, domain, user.id);
    } else {
      await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, domain, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
        .run(crypto.randomUUID(), user.id, sidebarOpen === null ? 0 : (sidebarOpen ? 1 : 0), theme ?? 'light', domain ?? '');
    }

    response.json({ success: true, sidebarOpen, theme: theme ?? themeValue, domain });
  });

  app.get('/api/github-repos', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    await expireStaleGithubScanJobs(user.id);
    const githubConnected = Boolean(await getGithubAccessToken(user.id));
    const repos = await db.prepare(`
      SELECT id, repo_url, repo_name, detected_stack, scanned_at, status
      FROM github_repos
      WHERE user_id = ? AND status = 'complete'
      ORDER BY scanned_at DESC
    `).all<{ id: string; repo_url: string; repo_name: string; detected_stack: unknown; scanned_at: string; status: string }>(user.id);
    const pendingJobs = await db.prepare(`
      SELECT id, repo_url
      FROM repo_scan_jobs
      WHERE user_id = ? AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 3
    `).all<{ id: string; repo_url: string }>(user.id);
    response.json({
      githubConnected,
      repos: repos.map((repo) => ({
        id: repo.id,
        repoUrl: repo.repo_url,
        repoName: repo.repo_name,
        detectedStack: Array.isArray(repo.detected_stack) ? repo.detected_stack : [],
        scannedAt: repo.scanned_at,
        status: repo.status,
      })),
      pendingJobs: pendingJobs.map((job) => ({
        id: job.id,
        repoUrl: job.repo_url,
        repoName: parseGitHubRepository(job.repo_url)?.repo ?? job.repo_url,
      })),
    });
  });

  app.get('/api/github-repos/:repoId/questions', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const repoId = String(request.params.repoId ?? '');
    const row = await db.prepare(`
      SELECT gr.id, gr.repo_url, gr.repo_name, gr.detected_stack, gr.scanned_at, gr.status, gr.raw_analysis_json,
             rqs.project_summary, rqs.total_questions, rqs.sections_json
      FROM github_repos gr
      LEFT JOIN repo_question_sets rqs ON rqs.repo_id = gr.id
      WHERE gr.id = ? AND gr.user_id = ?
    `).get<{
      id: string; repo_url: string; repo_name: string; detected_stack: unknown; scanned_at: string; status: string;
      raw_analysis_json: unknown; project_summary: string | null; total_questions: number | null; sections_json: unknown;
    }>(repoId, user.id);
    if (!row) {
      response.status(404).json({ error: 'Repository scan not found.' });
      return;
    }
    if (row.status !== 'complete' || !row.project_summary || !Array.isArray(row.sections_json)) {
      response.status(409).json({ error: 'This repository analysis is not complete. Please re-scan the repo from GitHub Repos.' });
      return;
    }
    const sections = Array.isArray(row.sections_json) ? row.sections_json as GithubQuestionSection[] : [];
    const viewedQuestionIds = sections.flatMap((section) => section.questions.map((question) => question.id)).filter(Boolean);
    await Promise.all(viewedQuestionIds.map((questionId) => (
      db.prepare('INSERT INTO user_repo_interactions (id, user_id, repo_id, question_id, viewed_at) VALUES (?, ?, ?, ?, NOW())')
        .run(crypto.randomUUID(), user.id, row.id, questionId)
    )));
    response.json({
      repo: {
        id: row.id,
        repoUrl: row.repo_url,
        repoName: row.repo_name,
        detectedStack: Array.isArray(row.detected_stack) ? row.detected_stack : [],
        scannedAt: row.scanned_at,
        status: row.status,
      },
      projectSummary: row.project_summary ?? 'Analysis is still processing.',
      totalQuestions: row.total_questions ?? 0,
      sections,
      detectedDomains: row.raw_analysis_json && typeof row.raw_analysis_json === 'object' && Array.isArray((row.raw_analysis_json as { detectedDomains?: unknown }).detectedDomains)
        ? (row.raw_analysis_json as { detectedDomains: string[] }).detectedDomains.map(normalizeGithubDetectedDomain)
        : [],
      warnings: row.raw_analysis_json && typeof row.raw_analysis_json === 'object' && Array.isArray((row.raw_analysis_json as { warnings?: unknown }).warnings)
        ? (row.raw_analysis_json as { warnings: string[] }).warnings
        : [],
    });
  });

  app.get('/api/github-repos/jobs/:jobId', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const jobId = String(request.params.jobId ?? '');
    await expireStaleGithubScanJobs(user.id);
    const job = await db.prepare(`
      SELECT id, repo_url, status, error_message, created_at, completed_at
      FROM repo_scan_jobs
      WHERE id = ? AND user_id = ?
    `).get<{ id: string; repo_url: string; status: string; error_message: string | null; created_at: string; completed_at: string | null }>(jobId, user.id);

    if (!job) {
      response.status(404).json({ error: 'Repository scan job not found.' });
      return;
    }

    const repo = job.status === 'complete'
      ? await db.prepare('SELECT id, repo_name FROM github_repos WHERE user_id = ? AND repo_url = ? AND status = ?')
        .get<{ id: string; repo_name: string }>(user.id, job.repo_url, 'complete')
      : null;

    response.json({
      id: job.id,
      repoUrl: job.repo_url,
      repoName: repo?.repo_name ?? parseGitHubRepository(job.repo_url)?.repo ?? job.repo_url,
      repoId: repo?.id,
      status: job.status,
      message: job.error_message,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    });
  });

  app.delete('/api/github-repos/:repoId', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const repoId = String(request.params.repoId ?? '');
    const repo = await db.prepare('SELECT id, repo_url FROM github_repos WHERE id = ? AND user_id = ?')
      .get<{ id: string; repo_url: string }>(repoId, user.id);

    if (!repo) {
      response.status(404).json({ error: 'Repository scan not found.' });
      return;
    }

    await db.prepare(`
      UPDATE repo_scan_jobs
         SET status = 'failed',
             completed_at = NOW(),
             error_message = 'Repository scan deleted by user.'
       WHERE user_id = ? AND repo_url = ? AND status = 'pending'
    `).run(user.id, repo.repo_url);
    await db.prepare('DELETE FROM repo_scan_jobs WHERE user_id = ? AND repo_url = ? AND status <> ?').run(user.id, repo.repo_url, 'pending');
    await db.prepare('DELETE FROM github_repos WHERE id = ? AND user_id = ?').run(repoId, user.id);
    response.json({ success: true });
  });

  app.post('/api/github-repos/scan', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    await expireStaleGithubScanJobs(user.id);
    const repoUrl = normalizeGithubRepoUrl(String(request.body?.repoUrl ?? '').trim());
    const force = Boolean(request.body?.force);
    if (!repoUrl) {
      response.status(400).json({ status: 'failed', message: 'Please paste a valid GitHub repository URL.' });
      return;
    }
    const singleFlightKey = `${user.id}:${repoUrl}`;
    const activeRequestJobId = activeGithubScanRequests.get(singleFlightKey);
    if (activeRequestJobId) {
      response.status(202).json({
        status: 'pending',
        jobId: activeRequestJobId,
        message: 'This repository scan is already running. Please wait for it to finish before starting another scan.',
      });
      return;
    }
    const jobId = crypto.randomUUID();
    const releaseSingleFlight = () => {
      if (activeGithubScanRequests.get(singleFlightKey) === jobId) {
        activeGithubScanRequests.delete(singleFlightKey);
      }
    };
    activeGithubScanRequests.set(singleFlightKey, jobId);
    const existing = await db.prepare('SELECT id, repo_name, status FROM github_repos WHERE user_id = ? AND repo_url = ?')
      .get<{ id: string; repo_name: string; status: string }>(user.id, repoUrl);
    if (existing?.status === 'complete' && !force) {
      releaseSingleFlight();
      response.status(409).json({ status: 'duplicate', repoId: existing.id, repoName: existing.repo_name });
      return;
    }
    const pendingJob = await db.prepare(`
      SELECT id
      FROM repo_scan_jobs
      WHERE user_id = ? AND repo_url = ? AND status = 'pending' AND created_at > NOW() - INTERVAL '5 minutes'
      ORDER BY created_at DESC
      LIMIT 1
    `).get<{ id: string }>(user.id, repoUrl);
    if (pendingJob) {
      releaseSingleFlight();
      response.status(202).json({
        status: 'pending',
        jobId: pendingJob.id,
        message: 'This repository scan is already running. Please wait for it to finish before starting another scan.',
      });
      return;
    }
    if (force) {
      await db.prepare(`
        UPDATE repo_scan_jobs
           SET status = 'failed',
               completed_at = NOW(),
               error_message = 'Re-scan started; previous stale pending job was replaced.'
         WHERE user_id = ? AND repo_url = ? AND status = 'pending'
      `).run(user.id, repoUrl);
    }

    const entitlement = await getEntitlement(user.id, 'github-scan');
    if (!entitlement.hasAccess) {
      releaseSingleFlight();
      response.status(403).json({ status: 'upgrade_required', message: entitlement.upgradeMessage ?? entitlement.reason ?? 'Upgrade required.', error: entitlement.upgradeMessage ?? entitlement.reason ?? 'Upgrade required.', ...entitlement });
      return;
    }

    const accessToken = await getGithubAccessToken(user.id);
    await db.prepare('INSERT INTO repo_scan_jobs (id, user_id, repo_url, status, created_at, retry_count) VALUES (?, ?, ?, ?, NOW(), 0)')
      .run(jobId, user.id, repoUrl, 'pending');

    const scanPromise = completeGithubScanJob({
      jobId,
      userId: user.id,
      repoUrl,
      existingRepoId: existing?.id,
      accessToken,
    });
    scanPromise.catch((error) => {
      console.error('Background GitHub repo scan failed', {
        userId: user.id,
        repoUrl,
        jobId,
        error: error instanceof Error ? error.message : error,
      });
    }).finally(() => {
      releaseSingleFlight();
    });

    const scanOutcomePromise = scanPromise.then((result) => ({ status: 'complete' as const, repoId: result.repoId })).catch((error) => ({
        status: 'failed' as const,
        publicStatus: error && typeof error === 'object' && 'status' in error ? String((error as { status?: unknown }).status ?? 'failed') : 'failed',
        httpStatus: error && typeof error === 'object' && 'httpStatus' in error ? Number((error as { httpStatus?: unknown }).httpStatus ?? 502) : 502,
        message: error instanceof Error ? error.message : 'Unable to analyze this repository right now.',
      }));
    const outcome = await Promise.race([
      scanOutcomePromise,
      wait(GITHUB_SCAN_INITIAL_RESPONSE_TIMEOUT_MS).then(() => ({ status: 'pending' as const })),
    ]);

    if (outcome.status === 'complete') {
      response.json({ status: 'complete', repoId: outcome.repoId, jobId });
      return;
    }

    if (outcome.status === 'pending') {
      response.status(202).json({
        status: 'pending',
        jobId,
        message: 'This is taking longer than usual. We will notify you when ready.',
      });
      return;
    }

    response.status(outcome.httpStatus).json({ status: outcome.publicStatus, message: outcome.message, jobId });
  });

  app.post('/api/prep/plan', requireUser, async (request, response) => {
    const body = (request.body ?? {}) as PrepPlanRequestBody;
    const domain = String(body.domain ?? '').trim();
    const interviewType = String(body.interviewType ?? '').trim();
    const companyType = String(body.companyType ?? '').trim();
    const timeline = String(body.timeline ?? '').trim();

    if (!domain || !interviewType || !companyType || !timeline) {
      response.status(400).json({ error: 'Domain, interview type, company type, and timeline are required.' });
      return;
    }

    try {
      const analysis = await callStructuredModel<PrepPlanResponse>(
        [
          'You are a technical interview analyst.',
          'Return only valid JSON. Do not include markdown, comments, or explanatory text.',
          'The JSON shape must be:',
          JSON.stringify({
            focusAreas: ['string'],
            interviewPattern: ['string'],
            projectRelevance: 'string',
            codingExpectation: {
              language: 'string',
              difficulty: 'string',
              timePressure: 'string',
            },
            prepStrategy: {
              '3-day': ['string'],
              '7-day': ['string'],
              '30-day': ['string'],
            },
          }),
          'Be specific to the role. A startup frontend internship and a tier-1 frontend internship should produce very different outputs.',
        ].join('\n'),
        `The user has selected: Domain = ${domain}, Interview Type = ${interviewType}, Company Type = ${companyType}, Timeline = ${timeline}. Based on this, return a JSON object with: focusAreas (array of 5-7 technical topics ranked by importance for this exact role), interviewPattern (what rounds to expect and in what order), projectRelevance (how heavily projects are evaluated for this role), codingExpectation (language, difficulty level, time pressure), and prepStrategy (3-day / 7-day / 30-day plan outline).`,
        normalizePrepPlanResponse,
      );

      response.json({ analysis: analysis.result, meta: { provider: analysis.provider, model: analysis.model } });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to generate the prep plan.' });
    }
  });

  app.post('/api/prep/project/repository', requireUser, async (request, response) => {
    const projectInput = String(request.body?.projectInput ?? '').trim();
    if (!projectInput) {
      response.status(400).json({ error: 'A repository URL or project description is required.' });
      return;
    }

    try {
      const user = (request as AuthedRequest).user!;
      const repositoryContext = await fetchGitHubRepositoryContext(projectInput, await getGithubAccessToken(user.id));
      const analysis = await callStructuredModel<ProjectAnalysisResponse>(
        [
          'You are a senior engineer.',
          'Return only valid JSON with no markdown wrappers.',
          'The JSON shape must be:',
          JSON.stringify({
            projectSummary: 'string',
            techStack: ['string'],
            keyFeatures: ['string'],
            interviewableTopics: ['string'],
            commonFollowUps: ['string'],
            weakPoints: ['string'],
            improvementSuggestions: ['string'],
            projectSpecificQuestions: ['string'],
          }),
        ].join('\n'),
        `The user has submitted a GitHub repo. Analyze only the provided repository context and return JSON with: projectSummary (2 sentences), techStack (array), keyFeatures (array of what the app actually does), interviewableTopics (array of specific things an interviewer would ask about this project), commonFollowUps (questions that naturally follow "tell me about your project"), weakPoints (things the project likely doesn't handle that an interviewer might probe), improvementSuggestions (2-3 realistic things they could add before the interview to make it stronger), and projectSpecificQuestions (25 strict interview questions based only on this repository's files and stack).\n\n${repositoryContext}`,
        normalizeProjectAnalysisResponse,
      );

      response.json({ analysis: analysis.result, meta: { provider: analysis.provider, model: analysis.model } });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to analyze the repository.' });
    }
  });

  app.post('/api/prep/project/description', requireUser, async (request, response) => {
    const manualDescription = String(request.body?.manualDescription ?? '').trim();
    if (!manualDescription) {
      response.status(400).json({ error: 'A manual project description is required.' });
      return;
    }

    try {
      const analysis = await callStructuredModel<ManualProjectAnalysisResponse>(
        [
          'You are a senior engineer.',
          'Return only valid JSON with no markdown wrappers.',
          'The JSON shape must be:',
          JSON.stringify({
            techStack: ['string'],
            likelyArchitecture: ['string'],
            whatInterviewerWillFocus: ['string'],
            gapsThatMightExist: ['string'],
            projectSpecificQuestions: ['string'],
            assumptions: ['string'],
          }),
        ].join('\n'),
        `The user has described their project in their own words. They have not shared code. Based only on this description, infer: techStack (best guess), likelyArchitecture, whatInterviewerWillFocus, gapsThatMightExist, and generate 5 project-specific interview questions they should be ready for. Flag any assumptions you made.\n\nDescription:\n${manualDescription}`,
        normalizeManualProjectAnalysisResponse,
      );

      response.json({ analysis: analysis.result, meta: { provider: analysis.provider, model: analysis.model } });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to analyze the project description.' });
    }
  });

  app.post('/api/prep/diagnostic', requireUser, async (request, response) => {
    const domain = String(request.body?.domain ?? '').trim();
    const experienceLevel = String(request.body?.experienceLevel ?? '').trim();
    if (!domain || !experienceLevel) {
      response.status(400).json({ error: 'Domain and experience level are required.' });
      return;
    }

    try {
      const analysis = await callStructuredModel<DiagnosticQuestion[]>(
        [
          'You are running a pre-test diagnostic.',
          'Return only valid JSON with no markdown wrappers.',
          'The JSON must be an array of 8 objects shaped like:',
          JSON.stringify({
            question: 'string',
            type: 'mcq',
            options: ['string'],
            correctAnswer: 'string',
            topicTag: 'string',
          }),
          'Questions must mix MCQ and true_false, escalate in difficulty, and avoid basic definitions.',
        ].join('\n'),
        `The user's domain is ${domain} and their self-rated experience is ${experienceLevel}. Generate 8 rapid diagnostic questions that quickly reveal their actual level across fundamentals, framework knowledge, async/state/data handling, and one domain-specific area. Return a JSON array with: question, type, options (if MCQ), correctAnswer, and topicTag.`,
        normalizeDiagnosticQuestions,
      );

      response.json({ analysis: analysis.result.slice(0, 8), meta: { provider: analysis.provider, model: analysis.model } });
    } catch (error) {
      response.status(502).json({ error: error instanceof Error ? error.message : 'Unable to generate diagnostic questions.' });
    }
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (request, response) => {
      if (request.originalUrl.startsWith('/api')) {
        response.status(404).json({ error: 'Not found.' });
        return;
      }
      response.sendFile(path.join(distPath, 'index.html'));
    });
  } else if (EMBED_VITE_DEV_SERVER) {
    const requestedHmrPort = readPort('VITE_HMR_PORT', 24679);
    const hmrPort = process.env.DISABLE_HMR === 'true'
      ? requestedHmrPort
      : await findAvailablePort(requestedHmrPort);

    if (process.env.DISABLE_HMR !== 'true' && hmrPort !== requestedHmrPort) {
      console.warn(`HMR port ${requestedHmrPort} is in use. Falling back to ${hmrPort}.`);
    }

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR === 'true' ? false : { port: hmrPort },
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
    app.use('*', async (request, response, next) => {
      if (request.originalUrl.startsWith('/api')) {
        next();
        return;
      }

      try {
        const template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        const html = await vite.transformIndexHtml(request.originalUrl, template);
        response.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (error) {
        next(error);
      }
    });
  } else {
    app.get('*', (request, response) => {
      if (request.originalUrl.startsWith('/api')) {
        response.status(404).json({ error: 'Not found.' });
        return;
      }
      response.status(503).send('Frontend dev server is disabled for this process. Start the client with `npm run dev:client`.');
    });
  }

  app.use((error: unknown, request: express.Request, response: express.Response, next: express.NextFunction) => {
    if (isRequestAbortedError(error) || request.aborted || response.destroyed) {
      if (!response.headersSent && !response.writableEnded && !response.destroyed) {
        response.status(499).json({ error: 'Request aborted.' });
      }
      return;
    }

    if (response.headersSent) {
      next(error as Error);
      return;
    }

    const status = Number((error as { status?: unknown; statusCode?: unknown })?.status ?? (error as { statusCode?: unknown })?.statusCode ?? 500);
    const message = String((error as { message?: unknown })?.message ?? 'Internal server error.');
    if (status >= 500) {
      console.error('Unhandled request error', error);
    }
    response.status(Number.isFinite(status) ? status : 500).json({
      error: status >= 500 ? 'Internal server error.' : message,
    });
  });

  if (listen) {
    const requestedPort = readPort('PORT', 3000);
    const shouldAutoSelectPort = process.env.NODE_ENV === 'development' && EMBED_VITE_DEV_SERVER;
    const port = shouldAutoSelectPort
      ? await findAvailablePort(requestedPort)
      : requestedPort;

    if (shouldAutoSelectPort && port !== requestedPort) {
      console.warn(`Port ${requestedPort} is in use. Falling back to ${port}.`);
    }

    const server = app.listen(port, () => {
      console.log(`Repoid server listening on http://localhost:${port}`);
    });
    server.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EADDRINUSE') {
        const suggestedPort = port === 3000 ? 3001 : port + 1;
        console.error(`Port ${port} is already in use. Stop the process using it, or set a different PORT in .env, for example PORT=${suggestedPort}.`);
        process.exit(1);
      }
      throw error;
    });
  }

  return app;
}

if (!process.env.VERCEL) {
  createApp().catch((error) => {
    console.error('Failed to start Repoid server:', error);
    process.exit(1);
  });
}

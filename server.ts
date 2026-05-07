import cors from 'cors';
import crypto from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import db from './src/lib/db.js';
import {
  createRoundAttempt,
  getLatestRoundAttempt,
  listQuestions,
  listQuestionStats,
  submitRoundAttempt,
} from './src/lib/questionBankStore.js';

const envPath = path.resolve(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath, override: false });
}

const SESSION_COOKIE_NAME = 'promptly_session';
const AUTH_WINDOW_MS = 60_000;
const AUTH_MAX_REQUESTS = 20;
const oauthStates = new Map<string, { provider: 'google' | 'github'; createdAt: number }>();

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
};

type UserPreferencesRow = {
  sidebar_open: boolean | null;
  theme: string | null;
};

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
  correctAnswer?: string;
};

type GithubQuestionSection = {
  sectionId: string;
  sectionTitle: string;
  sectionDescription: string;
  questions: GithubQuestion[];
};

type GithubQuestionSet = {
  projectName: string;
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

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
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

function normalizeGithubQuestionSet(payload: unknown): GithubQuestionSet {
  const source = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const sections = Array.isArray(source.sections) ? source.sections : [];
  return {
    projectName: String(source.projectName ?? '').trim(),
    projectSummary: String(source.projectSummary ?? '').trim(),
    warnings: toStringArray(source.warnings),
    sections: sections.map((section) => {
      const sectionSource = section && typeof section === 'object' ? section as Record<string, unknown> : {};
      const questions = Array.isArray(sectionSource.questions) ? sectionSource.questions : [];
      return {
        sectionId: String(sectionSource.sectionId ?? '').trim(),
        sectionTitle: String(sectionSource.sectionTitle ?? '').trim(),
        sectionDescription: String(sectionSource.sectionDescription ?? '').trim(),
        questions: questions.map((question) => {
          const questionSource = question && typeof question === 'object' ? question as Record<string, unknown> : {};
          const type = String(questionSource.type ?? 'open') as GithubQuestion['type'];
          return {
            id: String(questionSource.id ?? '').trim(),
            questionText: String(questionSource.questionText ?? '').trim(),
            type,
            difficulty: String(questionSource.difficulty ?? 'medium') as GithubQuestion['difficulty'],
            fileReference: String(questionSource.fileReference ?? '').trim(),
            conceptTag: String(questionSource.conceptTag ?? '').trim(),
            options: type === 'mcq' ? toStringArray(questionSource.options).slice(0, 4) : undefined,
            correctAnswer: type === 'mcq' ? String(questionSource.correctAnswer ?? '').trim() : undefined,
          };
        }).filter((question) => question.id && question.questionText && question.fileReference && question.conceptTag),
      };
    }).filter((section) => section.sectionId && section.sectionTitle),
  };
}

function resolveModelConfig(modelOverride?: string): ModelConfig {
  const compatBaseUrl = process.env.OPENAI_COMPAT_BASE_URL?.trim();
  const compatApiKey = process.env.OPENAI_API_KEY?.trim() || process.env.ANTHROPIC_API_KEY?.trim();
  if (compatBaseUrl && compatApiKey) {
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

async function callStructuredModel<T>(
  systemPrompt: string,
  userPrompt: string,
  normalize: (payload: unknown) => T,
  options: { maxTokens?: number; timeoutMs?: number; model?: string } = {},
): Promise<{ result: T; provider: string; model: string }> {
  const config = resolveModelConfig(options.model);
  const abortController = new AbortController();
  const timeout = options.timeoutMs
    ? setTimeout(() => abortController.abort(new Error('analysis_timeout')), options.timeoutMs)
    : null;

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
        temperature: 0.2,
        max_tokens: options.maxTokens ?? 4000,
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
            temperature: 0.2,
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

    const parsed = JSON.parse(extractJsonPayload(rawText));
    return {
      result: normalize(parsed),
      provider: config.provider,
      model: config.model,
    };
  } catch (error) {
    if (abortController.signal.aborted) {
      throw new Error('analysis_timeout');
    }
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

async function fetchGitHubRepositoryContext(projectInput: string): Promise<string> {
  const parsed = parseGitHubRepository(projectInput);
  if (!parsed) return projectInput;

  const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const token = process.env.GITHUB_TOKEN?.trim();
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

async function fetchGithubRepoForQuestionSet(repoUrlInput: string): Promise<GithubRepoContext> {
  const parsed = parseGitHubRepository(repoUrlInput);
  if (!parsed) throw new Error('invalid_github_url');
  const repoUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`;
  const token = process.env.GITHUB_TOKEN?.trim();
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
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
  const languagesResponse = await fetch(`${repoUrl}/languages`, { headers }).catch(() => null);
  const languagesData = languagesResponse?.ok ? await languagesResponse.json().catch(() => ({})) as Record<string, number> : {};
  const treeResponse = await fetch(`${repoUrl}/git/trees/${encodeURIComponent(defaultBranch)}?recursive=1`, { headers }).catch(() => null);
  if (treeResponse?.status === 403) throw new Error('rate_limited');
  if (!treeResponse?.ok) throw new Error('private_repo');
  const treeData = await treeResponse.json().catch(() => ({})) as { tree?: RepoTreeItem[] };
  const codeExtensions = /\.(tsx?|jsx?|py|go|rs|java|cs|php|rb|sql|prisma|json|md|yml|yaml|toml|css)$/i;
  const ignored = /(^|\/)(node_modules|dist|build|coverage|\.git|vendor|__pycache__)\//i;
  const priorityScore = (filePath: string) => {
    const lower = filePath.toLowerCase();
    if (/(package\.json|requirements\.txt|pyproject\.toml|go\.mod|cargo\.toml|readme\.md)$/i.test(lower)) return 0;
    if (/(schema|model|migration|prisma|drizzle|database|auth|middleware|jwt|oauth)/i.test(lower)) return 1;
    if (/(route|routes|controller|api|handler|server|main|app)/i.test(lower)) return 2;
    if (/\.(tsx|jsx|ts|js|py)$/i.test(lower)) return 3;
    return 4;
  };
  const files = (treeData.tree ?? [])
    .filter((item) => item.type === 'blob' && item.path && codeExtensions.test(item.path) && !ignored.test(item.path))
    .sort((a, b) => {
      const aPath = a.path ?? '';
      const bPath = b.path ?? '';
      return priorityScore(aPath) - priorityScore(bPath) || aPath.length - bPath.length;
    })
    .slice(0, 18);
  const blocks: string[] = [];
  let readmeContent = '';
  let remainingBudget = Number(process.env.GITHUB_SCAN_INPUT_CHAR_BUDGET ?? 26000);
  for (const file of files) {
    if (!file.path || remainingBudget <= 0) break;
    const rawUrl = `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/${encodeURIComponent(defaultBranch)}/${file.path.split('/').map(encodeURIComponent).join('/')}`;
    const rawResponse = await fetch(rawUrl, { headers: rawHeaders }).catch(() => null);
    if (!rawResponse?.ok) continue;
    const text = (await rawResponse.text().catch(() => '')).slice(0, Math.min(remainingBudget, 2200));
    if (!text.trim()) continue;
    remainingBudget -= text.length;
    if (file.path.toLowerCase().endsWith('readme.md')) readmeContent = text;
    blocks.push(`FILE: ${file.path}\n${text}`);
  }
  const stack = Array.from(new Set([
    ...Object.keys(languagesData),
    String(repoData.language ?? ''),
    ...files.map((file) => {
      const ext = path.extname(file.path ?? '').replace('.', '');
      return ext ? ext.toUpperCase() : '';
    }),
  ].filter(Boolean))).slice(0, 12);
  return {
    repoName,
    repoUrl: `https://github.com/${parsed.owner}/${parsed.repo}`,
    detectedStack: stack,
    fileContents: blocks.join('\n\n---\n\n'),
    readmeContent,
    limited: blocks.filter((block) => !block.startsWith('FILE: README')).length < 4,
  };
}

const GITHUB_REPO_SCAN_PROMPT = `You are a senior software engineer with 10 years of experience conducting technical interviews at product companies. You have been given the complete file contents of a GitHub repository. Your only job is to generate interview questions that are strictly and exclusively derived from what exists in this specific codebase. You are not allowed to generate generic questions about the technologies used. Every single question must reference something that actually exists in this repo — a specific file, a specific function, a specific pattern, a specific architectural decision, or a specific piece of logic found in the code.

Here is the repository content:

REPO NAME: {repoName}

DETECTED FILES AND CONTENTS:
{fileContents}

README:
{readmeContent}

Generate exactly 45 interview questions divided into five sections. Return only a valid JSON object. Do not return any prose, explanation, markdown, or text outside the JSON. The JSON must have this exact structure:

projectName: the repository name as a string.

projectSummary: a single paragraph of 3 to 4 sentences describing what this application does, what stack it uses, and what the two or three most technically interesting aspects of the codebase are. Write this as if you are briefing an interviewer who has 30 seconds to understand the project before the interview starts. Be specific — name actual libraries, actual file names, actual patterns you found.

sections: an array of exactly five objects. Each object has a sectionId (string, one of project-overview, most-probable, scenario-based, coding-based, technical-deep-dive), a sectionTitle (string), a sectionDescription (one sentence describing what this section tests), and a questions array.

Each question object must have: id (string, sequential like q1 through q45), questionText (the full question as a string), type (one of mcq, open, coding, scenario), difficulty (one of easy, medium, hard), fileReference (the exact file name or file path from the repo that this question is based on — this field is mandatory and must never be null or generic — if you cannot reference a specific file for a question do not include that question), conceptTag (a short string like JWT auth or useEffect cleanup or SQL indexing that names the concept being tested), and for mcq type questions only include an options array of four strings and a correctAnswer string matching one of the options.

Section distribution rules you must follow without exception: project-overview must have exactly 8 questions of type open and difficulty easy to medium. most-probable must have exactly 9 questions mixing open and mcq types at medium difficulty. scenario-based must have exactly 9 questions of type scenario at medium to hard difficulty. coding-based must have exactly 10 questions of type coding at medium to hard difficulty. technical-deep-dive must have exactly 9 questions of type open at hard difficulty.

Rules you must never violate: Do not generate any question that could apply to any other project. If a question could appear in a generic React interview or a generic Node interview without referencing this specific repo, discard it and write a different one. Every question must be answerable by someone who has read this codebase but might not have deep general knowledge. The fileReference field is not optional — every question must cite a file. Questions about the database must reference the actual schema or model files found. Questions about auth must reference the actual auth implementation found. Questions about components must reference the actual component files found. If the repo has no auth, generate no auth questions. If the repo has no database, generate no database questions. Only generate questions about what actually exists. Do not pad sections with filler questions. If a section cannot be genuinely filled with repo-specific questions, reduce its count and note this in a warnings field at the root of the JSON. The coding-based questions must show a partial code snippet from the actual repo in the questionText and ask the candidate to complete, fix, optimize, or explain it.`;

function buildGithubQuestionPrompt(context: GithubRepoContext) {
  return GITHUB_REPO_SCAN_PROMPT
    .replace('{repoName}', context.repoName)
    .replace('{fileContents}', context.fileContents || 'No meaningful code files found.')
    .replace('{readmeContent}', context.readmeContent || 'No README found.');
}

function assertUsableGithubQuestionSet(result: GithubQuestionSet) {
  const totalQuestions = result.sections.reduce((sum, section) => sum + section.questions.length, 0);
  const expectedSections = new Set(['project-overview', 'most-probable', 'scenario-based', 'coding-based', 'technical-deep-dive']);
  const returnedSections = new Set(result.sections.map((section) => section.sectionId));
  const missingSection = [...expectedSections].find((sectionId) => !returnedSections.has(sectionId));
  if (!result.projectName || !result.projectSummary || missingSection || totalQuestions < 35) {
    throw new Error('model_invalid_repo_question_json');
  }
  const hasMissingReferences = result.sections.some((section) => (
    section.questions.some((question) => !question.fileReference || !question.questionText)
  ));
  if (hasMissingReferences) {
    throw new Error('model_missing_repo_references');
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
  await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())')
    .run(crypto.randomUUID(), userId, 0, 'light');
  await db.prepare('INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())')
    .run(crypto.randomUUID(), userId, provider, providerAccountId, normalizedEmail);
  user = await db.prepare('SELECT id, email, name, password_hash, auth_provider, email_verified, created_at, updated_at FROM users WHERE id = ?')
    .get<DbUserRow>(userId);
  if (!user) throw new Error('Unable to create OAuth user.');
  return user;
}

function consumeOAuthState(provider: 'google' | 'github', state: unknown) {
  const stateValue = String(state ?? '');
  const stored = oauthStates.get(stateValue);
  oauthStates.delete(stateValue);
  return Boolean(stored && stored.provider === provider && Date.now() - stored.createdAt < 10 * 60_000);
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

  const user = await db.prepare('SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = ?')
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

async function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json());

  app.get('/api/health', async (_request, response) => {
    await db.query('SELECT 1');
    response.json({ status: 'ok' });
  });

  app.get('/api/questions/stats', requireUser, async (_request, response) => {
    try {
      const stats = await listQuestionStats();
      response.json({ stats });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load question stats.' });
    }
  });

  app.get('/api/questions', requireUser, async (request, response) => {
    try {
      const domain = String(request.query.domain ?? 'all');
      const type = String(request.query.type ?? 'all') as 'all' | 'mcq' | 'fill_blank' | 'scenario' | 'system_design' | 'coding' | 'mock';
      const search = String(request.query.search ?? '');
      const limit = Math.min(300, Math.max(1, Number(request.query.limit ?? 50)));
      const faangOnly = String(request.query.faangOnly ?? 'false') === 'true';
      const questions = await listQuestions({ domain, type, search, faangOnly, limit });
      response.json({ questions, totalReturned: questions.length });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load questions.' });
    }
  });

  app.post('/api/round-attempts/start', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const roundType = String(request.body?.roundType ?? '').trim();
    const questionType = String(request.body?.questionType ?? '').trim() as 'scenario' | 'coding' | 'mcq' | 'fill_blank' | 'system_design' | 'mock';
    const domain = String(request.body?.domain ?? '').trim();
    const limit = Math.min(10, Math.max(1, Number(request.body?.limit ?? 1)));
    const durationMinutes = Math.min(90, Math.max(5, Number(request.body?.durationMinutes ?? 15)));

    if (!roundType || !questionType || !domain) {
      response.status(400).json({ error: 'roundType, questionType, and domain are required.' });
      return;
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

  app.get('/api/round-attempts/latest/:roundType', requireUser, async (request, response) => {
    try {
      const user = (request as AuthedRequest).user!;
      const roundType = String(request.params.roundType ?? '').trim();
      if (!roundType) {
        response.status(400).json({ error: 'roundType is required.' });
        return;
      }

      const attempt = await getLatestRoundAttempt(user.id, roundType);
      if (!attempt) {
        response.status(404).json({ error: 'No round attempt found for this round type yet.' });
        return;
      }
      response.json({ attempt });
    } catch (error) {
      response.status(500).json({ error: error instanceof Error ? error.message : 'Unable to load the latest round attempt.' });
    }
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

    await db.prepare('INSERT INTO users (id, email, name, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())')
      .run(userId, email, name, passwordHash);
    await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())')
      .run(crypto.randomUUID(), userId, 0, 'light');

    const createdUser = await db.prepare('SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = ?')
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

    const user = await db.prepare('SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE email = ?')
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
    if (!clientId) {
      response.redirect('/signin?error=oauth_github_not_configured');
      return;
    }
    const state = crypto.randomUUID();
    oauthStates.set(state, { provider: 'github', createdAt: Date.now() });
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${getPublicBaseUrl(request)}/api/auth/oauth/github/callback`,
      scope: 'read:user user:email',
      state,
    });
    response.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  });

  app.get('/api/auth/oauth/github/callback', async (request, response) => {
    if (!consumeOAuthState('github', request.query.state)) {
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
      setSessionCookie(response, user.id);
      response.redirect('/onboarding');
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
    if (name.length < 2) {
      response.status(400).json({ error: 'Name must be at least 2 characters.' });
      return;
    }

    const user = (request as AuthedRequest).user!;
    await db.prepare('UPDATE users SET name = ?, updated_at = NOW() WHERE id = ?').run(name, user.id);
    const updatedUser = await db.prepare('SELECT id, email, name, password_hash, created_at, updated_at FROM users WHERE id = ?').get<DbUserRow>(user.id);
    response.json({ user: updatedUser ? toSessionUser(updatedUser) : { ...toSessionUser(user), name } });
  });

  app.delete('/api/users/me', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
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
    let preferences = await db.prepare('SELECT sidebar_open, theme FROM user_preferences WHERE user_id = ?').get<UserPreferencesRow>(user.id);
    if (!preferences) {
      await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())')
        .run(crypto.randomUUID(), user.id, 0, 'light');
      preferences = { sidebar_open: false, theme: 'light' };
    }

    response.json({ sidebarOpen: Boolean(preferences.sidebar_open), theme: preferences.theme ?? 'light' });
  });

  app.patch('/api/users/preferences', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const sidebarOpen = typeof request.body?.sidebarOpen === 'boolean' ? request.body.sidebarOpen : null;
    const theme = typeof request.body?.theme === 'string' ? request.body.theme : null;
    const existing = await db.prepare('SELECT user_id FROM user_preferences WHERE user_id = ?').get<{ user_id: string }>(user.id);

    if (existing) {
      await db.prepare('UPDATE user_preferences SET sidebar_open = COALESCE(?, sidebar_open), theme = COALESCE(?, theme), updated_at = NOW() WHERE user_id = ?')
        .run(sidebarOpen === null ? null : (sidebarOpen ? 1 : 0), theme, user.id);
    } else {
      await db.prepare('INSERT INTO user_preferences (id, user_id, sidebar_open, theme, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())')
        .run(crypto.randomUUID(), user.id, sidebarOpen === null ? 0 : (sidebarOpen ? 1 : 0), theme ?? 'light');
    }

    response.json({ success: true });
  });

  app.get('/api/github-repos', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
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
      sections: Array.isArray(row.sections_json) ? row.sections_json : [],
      warnings: row.raw_analysis_json && typeof row.raw_analysis_json === 'object' && Array.isArray((row.raw_analysis_json as { warnings?: unknown }).warnings)
        ? (row.raw_analysis_json as { warnings: string[] }).warnings
        : [],
    });
  });

  app.post('/api/github-repos/scan', requireUser, async (request, response) => {
    const user = (request as AuthedRequest).user!;
    const repoUrl = normalizeGithubRepoUrl(String(request.body?.repoUrl ?? '').trim());
    const force = Boolean(request.body?.force);
    if (!repoUrl) {
      response.status(400).json({ status: 'failed', message: 'Please paste a valid GitHub repository URL.' });
      return;
    }
    const existing = await db.prepare('SELECT id, repo_name, status FROM github_repos WHERE user_id = ? AND repo_url = ?')
      .get<{ id: string; repo_name: string; status: string }>(user.id, repoUrl);
    if (existing?.status === 'complete' && !force) {
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
    if (pendingJob && !force) {
      response.status(202).json({
        status: 'pending',
        message: 'This repository scan is already running. Please wait for it to finish before starting another scan.',
      });
      return;
    }

    const jobId = crypto.randomUUID();
    await db.prepare('INSERT INTO repo_scan_jobs (id, user_id, repo_url, status, created_at, retry_count) VALUES (?, ?, ?, ?, NOW(), 0)')
      .run(jobId, user.id, repoUrl, 'pending');

    const fail = async (status: string, message: string, httpStatus = 502) => {
      await db.prepare('UPDATE repo_scan_jobs SET status = ?, completed_at = NOW(), error_message = ? WHERE id = ?').run(status, message, jobId);
      response.status(httpStatus).json({ status, message });
    };

    try {
      const context = await fetchGithubRepoForQuestionSet(repoUrl);
      const repoId = existing?.id ?? crypto.randomUUID();
      const analysis = await callStructuredModel<GithubQuestionSet>(
        'Return only valid JSON.',
        buildGithubQuestionPrompt(context),
        normalizeGithubQuestionSet,
        {
          model: process.env.GITHUB_SCAN_MODEL?.trim() || 'google/gemini-2.0-flash-001',
          maxTokens: Number(process.env.GITHUB_SCAN_MAX_TOKENS ?? 9000),
          timeoutMs: Number(process.env.GITHUB_SCAN_TIMEOUT_MS ?? 120000),
        },
      );
      const result = analysis.result;
      if (context.limited) {
        result.warnings = Array.from(new Set([...(result.warnings ?? []), 'limited_code_files']));
      }
      const totalQuestions = result.sections.reduce((sum, section) => sum + section.questions.length, 0);
      assertUsableGithubQuestionSet(result);
      if (existing?.id) {
        await db.prepare('UPDATE github_repos SET repo_name = ?, detected_stack = ?::jsonb, scanned_at = NOW(), status = ?, raw_analysis_json = ?::jsonb, updated_at = NOW() WHERE id = ?')
          .run(result.projectName || context.repoName, JSON.stringify(context.detectedStack), 'complete', JSON.stringify(result), repoId);
      } else {
        await db.prepare('INSERT INTO github_repos (id, user_id, repo_url, repo_name, detected_stack, scanned_at, status, raw_analysis_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?::jsonb, NOW(), ?, ?::jsonb, NOW(), NOW())')
          .run(repoId, user.id, context.repoUrl, result.projectName || context.repoName, JSON.stringify(context.detectedStack), 'complete', JSON.stringify(result));
      }
      await db.prepare('DELETE FROM repo_question_sets WHERE repo_id = ?').run(repoId);
      await db.prepare('INSERT INTO repo_question_sets (id, repo_id, generated_at, project_summary, total_questions, sections_json) VALUES (?, ?, NOW(), ?, ?, ?::jsonb)')
        .run(crypto.randomUUID(), repoId, result.projectSummary, totalQuestions, JSON.stringify(result.sections));
      await db.prepare('UPDATE repo_scan_jobs SET status = ?, completed_at = NOW(), error_message = NULL WHERE id = ?').run('complete', jobId);
      response.json({ status: 'complete', repoId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'scan_failed';
      if (message === 'private_repo') {
        await fail('private', 'This repository is private. Please make sure it is public or connect your GitHub account.', 403);
        return;
      }
      if (message === 'rate_limited') {
        console.error('GitHub rate limit reached while scanning repo', { userId: user.id, repoUrl });
        await fail('rate_limited', 'GitHub rate limit reached. Please try again in a few minutes.', 429);
        return;
      }
      if (message === 'analysis_timeout') {
        await db.prepare('UPDATE repo_scan_jobs SET status = ?, completed_at = NOW(), error_message = ?, retry_count = retry_count + 1 WHERE id = ?')
          .run('failed', 'Analysis is taking longer than expected. Please try again with a smaller public repo.', jobId);
        response.status(202).json({ status: 'timeout', message: 'Analysis is taking longer than expected. We will notify you when it is ready.' });
        return;
      }
      if (/model_http_402|budget exceeded|payment required/i.test(message)) {
        await fail('failed', 'The AI provider rejected this DeepSeek request because the API key budget is unavailable. Please check the new key and try again.', 402);
        return;
      }
      if (/model_http_4\d\d/i.test(message)) {
        await fail('failed', `The AI provider rejected the repo scan model request: ${message.replace(/^model_http_\d+:\s*/, '')}`, 502);
        return;
      }
      if (message === 'model_invalid_repo_question_json' || message === 'model_missing_repo_references') {
        await fail('failed', 'The model response was not a complete repo-specific question set. No questions were saved and no fallback was used. Please try again.', 502);
        return;
      }
      await fail('failed', 'Unable to analyze this repository right now.');
    }
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
      const repositoryContext = await fetchGitHubRepositoryContext(projectInput);
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
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
  }

  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => {
    console.log(`Promptly server listening on http://localhost:${port}`);
  });
}

createApp().catch((error) => {
  console.error('Failed to start Promptly server:', error);
  process.exit(1);
});

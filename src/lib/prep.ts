export const DOMAIN_LABELS: Record<string, string> = {
  frontend: 'Frontend',
  backend: 'Backend',
  'full-stack': 'Full Stack',
  'ai-ml': 'AI / ML',
};

export const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  internship: 'Internship',
  'new-grad': 'New Grad',
  experienced: 'Experienced',
};

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  startup: 'Startup',
  product: 'Product Company',
  'tier-1': 'Tier-1',
};

export const TIMELINE_LABELS: Record<string, string> = {
  '3-day': '3 Days',
  '7-day': '7 Days',
  '30-day': '30 Days',
};

export const EXPERIENCE_LABELS: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

export interface PrepSelections {
  domain: string;
  interviewType: string;
  companyType: string;
  timeline: string;
  experienceLevel: string;
  repositoryUrl: string;
  manualDescription: string;
}

export interface ModelMeta {
  provider: string;
  model: string;
}

export interface PrepPlan {
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
}

export interface ProjectAnalysis {
  projectSummary: string;
  techStack: string[];
  keyFeatures: string[];
  interviewableTopics: string[];
  commonFollowUps: string[];
  weakPoints: string[];
  improvementSuggestions: string[];
}

export interface ManualProjectAnalysis {
  techStack: string[];
  likelyArchitecture: string[];
  whatInterviewerWillFocus: string[];
  gapsThatMightExist: string[];
  projectSpecificQuestions: string[];
  assumptions: string[];
}

export interface DiagnosticQuestion {
  question: string;
  type: 'mcq' | 'true_false';
  options?: string[];
  correctAnswer: string;
  topicTag: string;
}

export interface PrepWorkspaceState {
  selections: PrepSelections;
  prepPlan: PrepPlan | null;
  repoAnalysis: ProjectAnalysis | null;
  manualAnalysis: ManualProjectAnalysis | null;
  diagnosticQuestions: DiagnosticQuestion[];
  meta: {
    plan?: ModelMeta;
    repo?: ModelMeta;
    manual?: ModelMeta;
    diagnostic?: ModelMeta;
  };
  updatedAt?: string;
}

type ApiResult<T> =
  | { ok: true; data: T; meta: ModelMeta }
  | { ok: false; error: string };

const STORAGE_KEY = 'promptly_prep_workspace';

export const DEFAULT_PREP_SELECTIONS: PrepSelections = {
  domain: 'frontend',
  interviewType: 'internship',
  companyType: 'startup',
  timeline: '7-day',
  experienceLevel: 'intermediate',
  repositoryUrl: '',
  manualDescription: '',
};

const DEFAULT_STATE: PrepWorkspaceState = {
  selections: DEFAULT_PREP_SELECTIONS,
  prepPlan: null,
  repoAnalysis: null,
  manualAnalysis: null,
  diagnosticQuestions: [],
  meta: {},
};

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<ApiResult<T>> {
  try {
    const response = await fetch(path, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; analysis?: T; meta?: ModelMeta };
    if (!response.ok || !data.analysis) {
      return { ok: false, error: String(data.error ?? 'Request failed.') };
    }
    return {
      ok: true,
      data: data.analysis,
      meta: data.meta ?? { provider: 'unknown', model: 'unknown' },
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Network request failed.',
    };
  }
}

export function getStoredPrepWorkspace(): PrepWorkspaceState {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Partial<PrepWorkspaceState> | null;
    if (!parsed) return DEFAULT_STATE;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      selections: {
        ...DEFAULT_PREP_SELECTIONS,
        ...(parsed.selections ?? {}),
      },
      meta: {
        ...(parsed.meta ?? {}),
      },
      prepPlan: parsed.prepPlan ?? null,
      repoAnalysis: parsed.repoAnalysis ?? null,
      manualAnalysis: parsed.manualAnalysis ?? null,
      diagnosticQuestions: parsed.diagnosticQuestions ?? [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function persistPrepWorkspace(state: PrepWorkspaceState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...state, updatedAt: new Date().toISOString() }));
}

export function updatePrepWorkspace(update: Partial<PrepWorkspaceState> & { selections?: Partial<PrepSelections> }) {
  const current = getStoredPrepWorkspace();
  const next: PrepWorkspaceState = {
    ...current,
    ...update,
    selections: {
      ...current.selections,
      ...(update.selections ?? {}),
    },
    meta: {
      ...current.meta,
      ...(update.meta ?? {}),
    },
    updatedAt: new Date().toISOString(),
  };
  persistPrepWorkspace(next);
  return next;
}

export async function generatePrepPlan(payload: Pick<PrepSelections, 'domain' | 'interviewType' | 'companyType' | 'timeline'>) {
  return postJson<PrepPlan>('/api/prep/plan', payload);
}

export async function analyzeRepository(projectInput: string) {
  return postJson<ProjectAnalysis>('/api/prep/project/repository', { projectInput });
}

export async function analyzeManualDescription(manualDescription: string) {
  return postJson<ManualProjectAnalysis>('/api/prep/project/description', { manualDescription });
}

export async function generateDiagnosticQuestions(payload: Pick<PrepSelections, 'domain' | 'experienceLevel'>) {
  return postJson<DiagnosticQuestion[]>('/api/prep/diagnostic', payload);
}
export type DomainFamily = 'frontend' | 'backend' | 'full-stack' | 'ai-ml' | 'devops' | 'data' | 'security' | 'system-design' | 'mobile' | 'cloud' | 'blockchain' | 'cs-fundamentals';

export type DomainOption = {
  id: string;
  label: string;
  description: string;
  family: DomainFamily;
  hidden?: boolean;
};

export const DOMAIN_OPTIONS: DomainOption[] = [
  { id: 'frontend', label: 'Frontend', description: 'Components, state, browser APIs, accessibility, and rendering performance.', family: 'frontend' },
  { id: 'backend', label: 'Backend', description: 'APIs, services, data access, queues, reliability, and production debugging.', family: 'backend' },
  { id: 'ai-ml', label: 'AI / ML', description: 'Pipelines, RAG, evaluation, model choice, and production ML failure modes.', family: 'ai-ml' },
  { id: 'cybersecurity', label: 'Cybersecurity', description: 'AppSec, auth, threat modeling, secure architecture, and incident response.', family: 'security' },
  { id: 'data-analytics', label: 'Data Analytics', description: 'Metrics, dashboards, business analysis, experimentation, and insight quality.', family: 'data' },
  { id: 'data-science', label: 'Data Science', description: 'Statistics, feature work, modeling choices, evaluation, and interpretation.', family: 'data' },
  { id: 'react', label: 'React', description: 'Legacy React selection retained for existing saved workspaces.', family: 'frontend', hidden: true },
  { id: 'next-js', label: 'Next.js', description: 'Legacy Next.js selection retained for existing saved workspaces.', family: 'frontend', hidden: true },
  { id: 'typescript', label: 'TypeScript', description: 'Legacy TypeScript selection retained for existing saved workspaces.', family: 'frontend', hidden: true },
  { id: 'backend-nodejs', label: 'Backend Node.js', description: 'Legacy Node.js selection retained for existing saved workspaces.', family: 'backend', hidden: true },
  { id: 'backend-python', label: 'Backend Python', description: 'Legacy Python selection retained for existing saved workspaces.', family: 'backend', hidden: true },
  { id: 'full-stack', label: 'Full Stack', description: 'Legacy full-stack selection retained for existing saved workspaces.', family: 'full-stack', hidden: true },
  { id: 'system-design', label: 'System Design', description: 'Legacy system design selection retained for existing saved workspaces.', family: 'system-design', hidden: true },
  { id: 'sql-databases', label: 'SQL and Databases', description: 'Legacy database selection retained for existing saved workspaces.', family: 'data', hidden: true },
  { id: 'devops', label: 'DevOps', description: 'Legacy DevOps selection retained for existing saved workspaces.', family: 'devops', hidden: true },
  { id: 'cloud-aws', label: 'Cloud AWS', description: 'Legacy AWS selection retained for existing saved workspaces.', family: 'cloud', hidden: true },
  { id: 'cloud-gcp', label: 'Cloud GCP', description: 'Legacy GCP selection retained for existing saved workspaces.', family: 'cloud', hidden: true },
  { id: 'data-engineering', label: 'Data Engineering', description: 'Legacy data engineering selection retained for existing saved workspaces.', family: 'data', hidden: true },
  { id: 'blockchain', label: 'Blockchain', description: 'Legacy blockchain selection retained for existing saved workspaces.', family: 'blockchain', hidden: true },
  { id: 'mobile-react-native', label: 'Mobile React Native', description: 'Legacy React Native selection retained for existing saved workspaces.', family: 'mobile', hidden: true },
  { id: 'mobile-flutter', label: 'Mobile Flutter', description: 'Legacy Flutter selection retained for existing saved workspaces.', family: 'mobile', hidden: true },
  { id: 'dsa', label: 'DSA', description: 'Legacy DSA selection retained for existing saved workspaces.', family: 'cs-fundamentals', hidden: true },
  { id: 'cs-fundamentals', label: 'Computer Science Fundamentals', description: 'Legacy CS selection retained for existing saved workspaces.', family: 'cs-fundamentals', hidden: true },
  { id: 'data', label: 'Data Engineering', description: 'Legacy data selection retained for existing saved workspaces.', family: 'data', hidden: true },
  { id: 'security', label: 'Cybersecurity', description: 'Legacy security selection retained for existing saved workspaces.', family: 'security', hidden: true },
  { id: 'mobile', label: 'Mobile', description: 'Legacy mobile selection retained for existing saved workspaces.', family: 'mobile', hidden: true },
  { id: 'cloud-platform', label: 'Cloud Native and Platform Engineering', description: 'Legacy cloud selection retained for existing saved workspaces.', family: 'cloud', hidden: true },
  { id: 'web3', label: 'Blockchain', description: 'Legacy web3 selection retained for existing saved workspaces.', family: 'blockchain', hidden: true },
  { id: 'languages', label: 'Languages', description: 'Legacy languages selection retained for existing saved workspaces.', family: 'frontend', hidden: true },
];

export const DOMAIN_LABELS: Record<string, string> = Object.fromEntries(DOMAIN_OPTIONS.map((option) => [option.id, option.label]));
export const DOMAIN_FAMILIES: Record<string, DomainFamily> = Object.fromEntries(DOMAIN_OPTIONS.map((option) => [option.id, option.family]));

export const INTERVIEW_TYPE_LABELS: Record<string, string> = {
  internship: 'Internship',
  'full-time': 'Full-time',
  faang: 'FAANG style',
  startup: 'Product startup',
  service: 'Service company',
  general: 'General prep',
};

export const COMPANY_TYPE_LABELS: Record<string, string> = {
  startup: 'Product Startup',
  product: 'Product Company',
  'tier-1': 'Tier-1',
  faang: 'FAANG Style',
  service: 'Service Company',
  general: 'General Prep',
};

export const TIMELINE_LABELS: Record<string, string> = {
  today: 'Today',
  '3-day': '3 days',
  '7-day': '1 week',
  '30-day': '1 month',
  exploring: 'Just exploring',
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
  projectSpecificQuestions?: string[];
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
const ONBOARDING_COMPLETE_KEY = 'promptly_onboarding_complete';
const PREP_WORKSPACE_EVENT = 'promptly-prep-workspace-change';

export const DEFAULT_PREP_SELECTIONS: PrepSelections = {
  domain: '',
  interviewType: 'internship',
  companyType: 'general',
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
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREP_WORKSPACE_EVENT));
  }
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

export function subscribePrepWorkspace(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined;

  const handleStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener();
  };

  window.addEventListener(PREP_WORKSPACE_EVENT, listener);
  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener(PREP_WORKSPACE_EVENT, listener);
    window.removeEventListener('storage', handleStorage);
  };
}

export function getVisibleDomainOptions() {
  return DOMAIN_OPTIONS.filter((option) => !option.hidden);
}

export function getDomainFamily(domain: string) {
  return DOMAIN_FAMILIES[domain] ?? 'frontend';
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

export function isOnboardingComplete() {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function markOnboardingComplete() {
  localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
}

export function resetPrepWorkspaceForOnboarding() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(ONBOARDING_COMPLETE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PREP_WORKSPACE_EVENT));
  }
}

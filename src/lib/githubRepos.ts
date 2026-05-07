export type RepoQuestion = {
  id: string;
  questionText: string;
  type: 'mcq' | 'open' | 'coding' | 'scenario';
  difficulty: 'easy' | 'medium' | 'hard';
  fileReference: string;
  conceptTag: string;
  options?: string[];
  correctAnswer?: string;
};

export type RepoQuestionSection = {
  sectionId: 'project-overview' | 'most-probable' | 'scenario-based' | 'coding-based' | 'technical-deep-dive';
  sectionTitle: string;
  sectionDescription: string;
  questions: RepoQuestion[];
};

export type GithubRepo = {
  id: string;
  repoUrl: string;
  repoName: string;
  detectedStack: string[];
  scannedAt: string;
  status: 'pending' | 'complete' | 'failed';
};

export type RepoQuestionSet = {
  repo: GithubRepo;
  projectSummary: string;
  totalQuestions: number;
  sections: RepoQuestionSection[];
  warnings?: string[];
};

export const GITHUB_SCAN_LINES = [
  'Connecting to GitHub...',
  'Fetching repository tree...',
  'Reading package.json...',
  'Scanning route files...',
  'Reading auth layer...',
  'Reading database schema...',
  'Reading components...',
  'Reading README...',
  'Sending to AI model...',
  'Building your question set...',
  'Almost done...',
];

export function isValidGithubRepoUrl(value: string) {
  return /^https:\/\/github\.com\/[^/\s]+\/[^/\s#?]+\/?$/i.test(value.trim().replace(/\.git$/i, ''));
}

async function readJson<T>(response: Response): Promise<T & { error?: string }> {
  return (await response.json().catch(() => ({}))) as T & { error?: string };
}

export async function listGithubRepos(): Promise<{ repos: GithubRepo[]; pendingJobs: Array<{ id: string; repoUrl: string; repoName: string }> }> {
  const response = await fetch('/api/github-repos', { credentials: 'include' });
  const data = await readJson<{ repos: GithubRepo[]; pendingJobs: Array<{ id: string; repoUrl: string; repoName: string }> }>(response);
  if (!response.ok) throw new Error(data.error ?? 'Unable to load GitHub repos.');
  return data;
}

export async function getGithubQuestionSet(repoId: string): Promise<RepoQuestionSet> {
  const response = await fetch(`/api/github-repos/${encodeURIComponent(repoId)}/questions`, { credentials: 'include' });
  const data = await readJson<RepoQuestionSet>(response);
  if (!response.ok) throw new Error(data.error ?? 'Unable to load repo questions.');
  return data;
}

export async function scanGithubRepo(repoUrl: string, force = false): Promise<
  | { status: 'complete'; repoId: string }
  | { status: 'duplicate'; repoId: string; repoName: string }
  | { status: 'private' | 'rate_limited' | 'timeout' | 'pending' | 'failed'; message: string }
> {
  const response = await fetch('/api/github-repos/scan', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, force }),
  });
  const data = await readJson<{ status?: string; repoId?: string; repoName?: string; message?: string }>(response);
  if (data.status === 'complete' && data.repoId) return { status: 'complete', repoId: data.repoId };
  if (data.status === 'duplicate' && data.repoId) return { status: 'duplicate', repoId: data.repoId, repoName: data.repoName ?? 'this repo' };
  return {
    status: (data.status as 'private' | 'rate_limited' | 'timeout' | 'pending' | 'failed') ?? 'failed',
    message: data.message ?? data.error ?? 'Unable to scan this repository.',
  };
}

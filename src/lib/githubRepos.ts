export type RepoQuestion = {
  id: string;
  questionText: string;
  type: 'mcq' | 'open' | 'coding' | 'scenario';
  difficulty: 'easy' | 'medium' | 'hard';
  fileReference: string;
  conceptTag: string;
  options?: string[];
  correctAnswer: string;
};

export type RepoQuestionSection = {
  sectionId: string;
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
  detectedDomains?: string[];
  sections: RepoQuestionSection[];
  warnings?: string[];
};

export type GithubScanJob = {
  id: string;
  repoUrl: string;
  repoName: string;
  repoId?: string;
  status: 'pending' | 'complete' | 'failed';
  message?: string | null;
  createdAt?: string;
  completedAt?: string | null;
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
  return /^https?:\/\/(?:www\.)?github\.com\/[^/\s]+\/[^/\s#?]+\/?$/i.test(value.trim().replace(/\.git$/i, ''));
}

export function normalizeGithubRepoInput(value: string) {
  return value.trim().replace(/^http:\/\//i, 'https://').replace(/^https:\/\/www\./i, 'https://').replace(/\.git$/i, '').replace(/\/$/, '');
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

export async function getGithubScanJob(jobId: string): Promise<GithubScanJob> {
  const response = await fetch(`/api/github-repos/jobs/${encodeURIComponent(jobId)}`, { credentials: 'include' });
  const data = await readJson<GithubScanJob>(response);
  if (!response.ok) throw new Error(data.error ?? 'Unable to load scan job.');
  return data;
}

export async function deleteGithubRepo(repoId: string): Promise<void> {
  const response = await fetch(`/api/github-repos/${encodeURIComponent(repoId)}`, {
    method: 'DELETE',
    credentials: 'include',
  });
  const data = await readJson<{ success?: boolean }>(response);
  if (!response.ok || !data.success) throw new Error(data.error ?? 'Unable to delete this repository scan.');
}

export async function scanGithubRepo(repoUrl: string, force = false): Promise<
  | { status: 'complete'; repoId: string; jobId?: string }
  | { status: 'duplicate'; repoId: string; repoName: string }
  | { status: 'private' | 'rate_limited' | 'timeout' | 'pending' | 'failed'; message: string; jobId?: string }
> {
  const response = await fetch('/api/github-repos/scan', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repoUrl, force }),
  });
  const data = await readJson<{ status?: string; repoId?: string; repoName?: string; message?: string; jobId?: string }>(response);
  if (data.status === 'complete' && data.repoId) return { status: 'complete', repoId: data.repoId, jobId: data.jobId };
  if (data.status === 'duplicate' && data.repoId) return { status: 'duplicate', repoId: data.repoId, repoName: data.repoName ?? 'this repo' };
  return {
    status: (data.status as 'private' | 'rate_limited' | 'timeout' | 'pending' | 'failed') ?? 'failed',
    message: data.message ?? data.error ?? 'Unable to scan this repository.',
    jobId: data.jobId,
  };
}

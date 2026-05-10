import React, { useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GithubScanOverlay } from '../components/GithubRepoScanner';
import { deleteGithubRepo, GithubRepo, isValidGithubRepoUrl, listGithubRepos, normalizeGithubRepoInput } from '../lib/githubRepos';

export default function GithubRepos() {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<GithubRepo | null>(null);
  const [scanRequest, setScanRequest] = useState<{ repoUrl: string; force: boolean; nonce: number } | null>(null);
  const [deletingRepoId, setDeletingRepoId] = useState<string | null>(null);

  const refreshRepos = () => {
    void listGithubRepos().then((data) => setRepos(data.repos)).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load repos.'));
  };

  useEffect(() => {
    refreshRepos();
  }, []);

  const submit = (force = false) => {
    setError(null);
    setDuplicate(null);
    const trimmed = repoUrl.trim();
    if (!isValidGithubRepoUrl(trimmed)) {
      setError('Please paste a valid GitHub repository URL.');
      return;
    }
    const existing = repos.find((repo) => normalizeGithubRepoInput(repo.repoUrl).toLowerCase() === normalizeGithubRepoInput(trimmed).toLowerCase());
    if (existing && !force) {
      setDuplicate(existing);
      return;
    }
    setModalOpen(false);
    setScanRequest({ repoUrl: trimmed, force, nonce: Date.now() });
  };

  const rescanRepo = (repo: GithubRepo) => {
    setError(null);
    setRepoUrl(repo.repoUrl);
    setScanRequest({ repoUrl: repo.repoUrl, force: true, nonce: Date.now() });
  };

  const removeRepo = async (repo: GithubRepo) => {
    const confirmed = window.confirm(`Delete the saved scan for ${repo.repoName}? This removes its generated questions.`);
    if (!confirmed) return;
    setDeletingRepoId(repo.id);
    setError(null);
    try {
      await deleteGithubRepo(repo.id);
      setRepos((current) => current.filter((item) => item.id !== repo.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete this repository scan.');
    } finally {
      setDeletingRepoId(null);
    }
  };

  return (
    <div className="min-h-full bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-[1180px] px-4 pb-16 pt-8 sm:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-blueprint-line pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-display-xl text-primary">GitHub Repos</h1>
            <p className="mt-3 text-body-lg text-blueprint-muted">Every scanned repository and its code-specific interview question set.</p>
          </div>
          <button type="button" onClick={() => setModalOpen(true)} className="flex items-center justify-center gap-2 rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
            <Plus size={16} /> Add GitHub Repo
          </button>
        </header>

        {error ? <p className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-body-md text-red-700">{error}</p> : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {repos.map((repo) => (
            <article key={repo.id} className="surface-card">
              <p className="text-headline-sm text-primary">{repo.repoName}</p>
              <p className="mt-2 text-body-md text-blueprint-muted">Scanned {new Date(repo.scannedAt).toLocaleDateString()}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {repo.detectedStack.slice(0, 6).map((item) => (
                  <span key={item} className="rounded-full border border-blueprint-line bg-[#f5f3f3] px-3 py-1 text-ui-label text-blueprint-muted">{item}</span>
                ))}
              </div>
              <div className="mt-6 grid gap-2 sm:grid-cols-2">
                <Link to={`/github-project-qs/${repo.id}`} className="inline-flex justify-center rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] sm:col-span-2">
                  View Questions
                </Link>
                <button type="button" onClick={() => rescanRepo(repo)} className="inline-flex items-center justify-center gap-2 rounded-full border border-blueprint-line bg-white px-4 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                  <RefreshCw size={14} /> Re-scan
                </button>
                <button type="button" disabled={deletingRepoId === repo.id} onClick={() => void removeRepo(repo)} className="inline-flex items-center justify-center gap-2 rounded-full border border-red-100 bg-red-50 px-4 py-3 text-ui-label text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60">
                  <Trash2 size={14} /> Delete
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-headline-sm text-primary">Scan a new repository</h2>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className="text-blueprint-muted hover:text-primary"><X size={18} /></button>
            </div>
            <input value={repoUrl} onChange={(event) => { setRepoUrl(event.target.value); setError(null); setDuplicate(null); }} placeholder="Paste your GitHub repo URL" className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {duplicate ? (
              <div className="mt-4 rounded-lg bg-[#f5f3f3] p-4 text-body-md text-primary">
                <p>You have already scanned this repository.</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <Link className="rounded-full bg-primary px-4 py-2 text-ui-label text-white transition-colors hover:bg-[#303031]" to={`/github-project-qs/${duplicate.id}`}>
                    View Existing Questions
                  </Link>
                  <button type="button" onClick={() => submit(true)} className="rounded-full border border-blueprint-line bg-white px-4 py-2 text-ui-label text-primary transition-colors hover:bg-[#fbfafa]">
                    Re-scan
                  </button>
                </div>
              </div>
            ) : null}
            <button type="button" onClick={() => submit()} className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">Submit</button>
          </div>
        </div>
      ) : null}

      {scanRequest ? (
        <GithubScanOverlay
          key={scanRequest.nonce}
          repoUrl={scanRequest.repoUrl}
          force={scanRequest.force}
          onClose={() => setScanRequest(null)}
          onError={setError}
          onComplete={refreshRepos}
        />
      ) : null}
    </div>
  );
}

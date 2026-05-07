import React, { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GithubScanOverlay } from '../components/GithubRepoScanner';
import { GithubRepo, isValidGithubRepoUrl, listGithubRepos } from '../lib/githubRepos';

export default function GithubRepos() {
  const [repos, setRepos] = useState<GithubRepo[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [repoUrl, setRepoUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<GithubRepo | null>(null);
  const [scanningUrl, setScanningUrl] = useState<string | null>(null);
  const [forceScan, setForceScan] = useState(false);

  useEffect(() => {
    void listGithubRepos().then((data) => setRepos(data.repos)).catch((err) => setError(err instanceof Error ? err.message : 'Unable to load repos.'));
  }, []);

  const submit = (force = false) => {
    setError(null);
    setDuplicate(null);
    const trimmed = repoUrl.trim();
    if (!isValidGithubRepoUrl(trimmed)) {
      setError('Please paste a valid GitHub repository URL.');
      return;
    }
    const existing = repos.find((repo) => repo.repoUrl.toLowerCase().replace(/\.git$/i, '') === trimmed.toLowerCase().replace(/\.git$/i, ''));
    if (existing && !force) {
      setDuplicate(existing);
      return;
    }
    setForceScan(force);
    setModalOpen(false);
    setScanningUrl(trimmed);
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
              <Link to={`/github-project-qs/${repo.id}`} className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
                View Questions
              </Link>
            </article>
          ))}
        </section>
      </main>

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-headline-sm text-primary">Add GitHub Repo</h2>
              <button type="button" onClick={() => setModalOpen(false)} aria-label="Close" className="text-blueprint-muted hover:text-primary"><X size={18} /></button>
            </div>
            <input value={repoUrl} onChange={(event) => setRepoUrl(event.target.value)} placeholder="Paste your GitHub repo URL" className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
            {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
            {duplicate ? (
              <div className="mt-4 rounded-lg bg-[#f5f3f3] p-4 text-body-md text-primary">
                You have already scanned this repo. <Link className="underline underline-offset-4" to={`/github-project-qs/${duplicate.id}`}>View existing questions?</Link>
                <button type="button" onClick={() => submit(true)} className="mt-3 block text-ui-label text-primary underline underline-offset-4">Re-scan</button>
              </div>
            ) : null}
            <button type="button" onClick={() => submit()} className="mt-6 w-full rounded-full bg-primary px-5 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">Submit</button>
          </div>
        </div>
      ) : null}

      {scanningUrl ? <GithubScanOverlay repoUrl={scanningUrl} force={forceScan} onClose={() => setScanningUrl(null)} onError={setError} /> : null}
    </div>
  );
}

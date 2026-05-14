import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View } from '../App';
import { GithubScanOverlay } from '../components/GithubRepoScanner';
import { isValidGithubRepoUrl } from '../lib/githubRepos';
import {
  DEFAULT_PREP_SELECTIONS,
  DOMAIN_LABELS,
  INTERVIEW_TYPE_LABELS,
  getVisibleDomainOptions,
  getStoredPrepWorkspace,
  markOnboardingComplete,
  updatePrepWorkspace,
} from '../lib/prep';

interface BuilderProps {
  onViewChange: (view: View) => void;
}

const DOMAIN_OPTIONS = getVisibleDomainOptions();

const COMPANY_BY_INTERVIEW: Record<string, string> = {
  faang: 'faang',
  startup: 'startup',
  service: 'service',
  general: 'general',
  internship: 'general',
  'full-time': 'product',
};

export default function Builder(_props: BuilderProps) {
  const navigate = useNavigate();
  const storedWorkspace = useMemo(() => getStoredPrepWorkspace(), []);
  const [step, setStep] = useState(0);
  const [domain, setDomain] = useState(storedWorkspace.selections.domain || DEFAULT_PREP_SELECTIONS.domain);
  const [interviewType, setInterviewType] = useState(storedWorkspace.selections.interviewType || DEFAULT_PREP_SELECTIONS.interviewType);
  const timeline = storedWorkspace.selections.timeline || DEFAULT_PREP_SELECTIONS.timeline;
  const [repositoryUrl, setRepositoryUrl] = useState(storedWorkspace.selections.repositoryUrl || '');
  const [error, setError] = useState<string | null>(null);
  const [scanningUrl, setScanningUrl] = useState<string | null>(null);

  const companyType = COMPANY_BY_INTERVIEW[interviewType] ?? 'general';
  const progress = [0, 1, 2];

  const finishOnboarding = async () => {
    setError(null);
    if (!domain) {
      setError('Choose your interview domain before continuing.');
      return;
    }

    const baseUpdate = {
      selections: {
        domain,
        interviewType,
        companyType,
        timeline,
        experienceLevel: storedWorkspace.selections.experienceLevel,
        repositoryUrl,
        manualDescription: '',
      },
    };

    updatePrepWorkspace(baseUpdate);
    void fetch('/api/users/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    }).catch(() => undefined);

    if (!repositoryUrl.trim()) {
      setError('Paste a GitHub repository URL or choose skip.');
      return;
    }
    if (!isValidGithubRepoUrl(repositoryUrl)) {
      setError('Please paste a valid GitHub repository URL.');
      return;
    }

    setScanningUrl(repositoryUrl.trim());
  };

  const skipProject = () => {
    updatePrepWorkspace({
      selections: {
        domain,
        interviewType,
        companyType,
        timeline,
        experienceLevel: storedWorkspace.selections.experienceLevel,
        repositoryUrl: '',
        manualDescription: '',
      },
    });
    void fetch('/api/users/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain }),
    }).catch(() => undefined);
    markOnboardingComplete();
    navigate('/dashboard');
  };

  const canGoNext = (
    (step === 0 && domain)
    || (step === 1 && interviewType)
    || step === 2
  );

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[980px] flex-col justify-center">
        <div className="rounded-2xl border border-blueprint-line bg-card p-6 shadow-[0_20px_48px_rgba(0,0,0,0.05)] dark:shadow-[0_20px_48px_rgba(0,0,0,0.24)] sm:p-10">
          <div className="mb-10 flex items-center justify-between gap-4">
            <button type="button" onClick={() => navigate('/dashboard')} className="font-serif text-3xl leading-none text-primary">
              Repoid
            </button>
            <div className="flex gap-2">
              {progress.map((item) => (
                <span key={item} className={`h-2.5 w-2.5 rounded-full ${item <= step ? 'bg-primary' : 'bg-blueprint-line'}`} />
              ))}
            </div>
          </div>

          <>
              {step === 0 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 1 of 3</p>
                  <h1 className="mt-3 text-headline-lg text-primary">What domain are you in?</h1>
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {DOMAIN_OPTIONS.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setDomain(option.id)}
                        className={`min-h-[150px] rounded-xl border p-5 text-left transition-all ${domain === option.id ? 'border-primary bg-card shadow-[0_8px_28px_rgba(0,0,0,0.05)] dark:shadow-[0_8px_28px_rgba(0,0,0,0.2)]' : 'border-blueprint-line bg-card hover:border-[#747878] hover:bg-[#f5f3f3] dark:hover:bg-white/5'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-body-lg font-semibold text-primary">{option.label}</span>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${domain === option.id ? 'border-primary bg-primary/10' : 'border-blueprint-line bg-transparent'}`}>
                            {domain === option.id ? <span className="h-2.5 w-2.5 rounded-full bg-primary" /> : null}
                          </span>
                        </div>
                        <p className="mt-4 text-body-md text-blueprint-muted">{option.description}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 1 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 2 of 3</p>
                  <h1 className="mt-3 text-headline-lg text-primary">What interview are you preparing for?</h1>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {Object.entries(INTERVIEW_TYPE_LABELS).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setInterviewType(id)}
                        className={`rounded-xl border p-5 text-left text-body-lg font-semibold transition-colors ${interviewType === id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-card text-primary hover:bg-[#f5f3f3] dark:hover:bg-white/5'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 3 of 3</p>
                  <h1 className="mt-3 text-headline-lg text-primary">Add your project.</h1>
                  <p className="mt-3 max-w-2xl text-body-lg text-blueprint-muted">
                    Paste a GitHub repository to build code-specific interview questions, or skip and continue without a project attached.
                  </p>
                  <div className="mt-8 grid gap-4">
                    <div className="rounded-xl border border-primary bg-card p-5">
                      <label className="text-body-lg font-semibold text-primary" htmlFor="repository-url">GitHub repo URL</label>
                      <input
                        id="repository-url"
                        type="url"
                        value={repositoryUrl}
                        onChange={(event) => {
                          setError(null);
                          setRepositoryUrl(event.target.value);
                        }}
                        placeholder="https://github.com/owner/repo"
                        className="mt-4 w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none placeholder:text-blueprint-muted focus:border-primary"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={skipProject}
                      className="rounded-xl border border-blueprint-line bg-card p-5 text-left transition-colors hover:border-primary hover:bg-[#f5f3f3] dark:hover:bg-white/5"
                    >
                      <p className="text-body-lg font-semibold text-primary">Skip for now</p>
                      <p className="mt-2 text-body-md text-blueprint-muted">Go straight to {DOMAIN_LABELS[domain]?.toLowerCase() ?? 'domain'} prep.</p>
                    </button>
                  </div>
                </section>
              ) : null}

              {error ? <p className="mt-6 text-body-md text-red-600">{error}</p> : null}

              <footer className="mt-10 flex items-center justify-between border-t border-blueprint-line pt-6">
                <button type="button" onClick={() => setStep((value) => Math.max(0, value - 1))} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary" disabled={step === 0}>
                  {step === 0 ? '' : 'Back'}
                </button>
                {step < 2 ? (
                  <button type="button" disabled={!canGoNext} onClick={() => setStep((value) => value + 1)} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-50">
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={finishOnboarding} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
                    Submit
                  </button>
                )}
              </footer>
            </>
        </div>
      </main>
      {scanningUrl ? <GithubScanOverlay repoUrl={scanningUrl} onClose={() => setScanningUrl(null)} onError={setError} onComplete={markOnboardingComplete} /> : null}
    </div>
  );
}

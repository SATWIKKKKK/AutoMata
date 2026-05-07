import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { View } from '../App';
import { GithubScanOverlay } from '../components/GithubRepoScanner';
import { isValidGithubRepoUrl } from '../lib/githubRepos';
import {
  DEFAULT_PREP_SELECTIONS,
  DOMAIN_LABELS,
  INTERVIEW_TYPE_LABELS,
  TIMELINE_LABELS,
  getStoredPrepWorkspace,
  markOnboardingComplete,
  updatePrepWorkspace,
} from '../lib/prep';

interface BuilderProps {
  onViewChange: (view: View) => void;
}

const DOMAIN_OPTIONS = [
  ['full-stack', 'Full Stack'],
  ['frontend', 'Frontend'],
  ['backend', 'Backend'],
  ['ai-ml', 'AI / ML'],
  ['devops', 'DevOps'],
  ['data', 'Data Engineering'],
] as const;

const COMPANY_BY_INTERVIEW: Record<string, string> = {
  faang: 'faang',
  startup: 'startup',
  service: 'service',
  general: 'general',
  internship: 'general',
  'full-time': 'product',
};

function optionBody(id: string) {
  const bodies: Record<string, string> = {
    'full-stack': 'UI, API, data flow, auth, database choices.',
    frontend: 'Components, state, browser APIs, performance.',
    backend: 'APIs, persistence, concurrency, production failures.',
    'ai-ml': 'Pipelines, RAG, evaluation, model tradeoffs.',
    devops: 'CI/CD, cloud, observability, reliability.',
    data: 'Pipelines, warehouses, streaming, data quality.',
  };
  return bodies[id] ?? 'Focused technical interview prep.';
}

export default function Builder(_props: BuilderProps) {
  const navigate = useNavigate();
  const storedWorkspace = useMemo(() => getStoredPrepWorkspace(), []);
  const [step, setStep] = useState(0);
  const [domain, setDomain] = useState(storedWorkspace.selections.domain || DEFAULT_PREP_SELECTIONS.domain);
  const [interviewType, setInterviewType] = useState(storedWorkspace.selections.interviewType || DEFAULT_PREP_SELECTIONS.interviewType);
  const [timeline, setTimeline] = useState(storedWorkspace.selections.timeline || DEFAULT_PREP_SELECTIONS.timeline);
  const [repositoryUrl, setRepositoryUrl] = useState(storedWorkspace.selections.repositoryUrl || '');
  const [projectMode, setProjectMode] = useState<'repo' | 'skip'>('repo');
  const [error, setError] = useState<string | null>(null);
  const [scanningUrl, setScanningUrl] = useState<string | null>(null);

  const companyType = COMPANY_BY_INTERVIEW[interviewType] ?? 'general';
  const progress = [0, 1, 2, 3];

  const finishOnboarding = async () => {
    setError(null);
    const baseUpdate = {
      selections: {
        domain,
        interviewType,
        companyType,
        timeline,
        experienceLevel: storedWorkspace.selections.experienceLevel,
        repositoryUrl: projectMode === 'repo' ? repositoryUrl : '',
        manualDescription: '',
      },
    };

    updatePrepWorkspace(baseUpdate);

    if (projectMode === 'repo' && !repositoryUrl.trim()) {
      setError('Paste a GitHub repository URL or choose skip.');
      return;
    }
    if (projectMode === 'repo' && !isValidGithubRepoUrl(repositoryUrl)) {
      setError('Please paste a valid GitHub repository URL.');
      return;
    }

    if (projectMode === 'skip') {
      markOnboardingComplete();
      navigate('/dashboard');
      return;
    }

    setScanningUrl(repositoryUrl.trim());
  };

  const canGoNext = (
    (step === 0 && domain)
    || (step === 1 && interviewType)
    || (step === 2 && timeline)
    || step === 3
  );

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-[980px] flex-col justify-center">
        <div className="rounded-2xl border border-blueprint-line bg-white/92 p-6 shadow-[0_20px_48px_rgba(0,0,0,0.05)] sm:p-10">
          <div className="mb-10 flex items-center justify-between gap-4">
            <button type="button" onClick={() => navigate('/dashboard')} className="font-serif text-3xl leading-none text-primary">
              Promptly
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
                  <p className="text-ui-label text-blueprint-muted">Step 1 of 4</p>
                  <h1 className="mt-3 text-headline-lg text-primary">What domain are you in?</h1>
                  <div className="mt-8 grid gap-4 md:grid-cols-2">
                    {DOMAIN_OPTIONS.map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setDomain(id)}
                        className={`min-h-[150px] rounded-xl border p-5 text-left transition-all ${domain === id ? 'border-primary bg-white shadow-[0_8px_28px_rgba(0,0,0,0.05)]' : 'border-blueprint-line bg-[#fbf9f9] hover:border-[#747878]'}`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <span className="text-body-lg font-semibold text-primary">{label}</span>
                          <span className={`h-4 w-4 shrink-0 rounded-full border ${domain === id ? 'border-[5px] border-primary' : 'border-blueprint-line'}`} />
                        </div>
                        <p className="mt-4 text-body-md text-blueprint-muted">{optionBody(id)}</p>
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 1 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 2 of 4</p>
                  <h1 className="mt-3 text-headline-lg text-primary">What interview are you preparing for?</h1>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2">
                    {Object.entries(INTERVIEW_TYPE_LABELS).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setInterviewType(id)}
                        className={`rounded-xl border p-5 text-left text-body-lg font-semibold transition-colors ${interviewType === id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-white text-primary hover:bg-[#f5f3f3]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 2 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 3 of 4</p>
                  <h1 className="mt-3 text-headline-lg text-primary">How much time do you have?</h1>
                  <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(TIMELINE_LABELS).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setTimeline(id)}
                        className={`rounded-xl border p-5 text-left text-body-lg font-semibold transition-colors ${timeline === id ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-white text-primary hover:bg-[#f5f3f3]'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>
              ) : null}

              {step === 3 ? (
                <section>
                  <p className="text-ui-label text-blueprint-muted">Step 4 of 4</p>
                  <h1 className="mt-3 text-headline-lg text-primary">Add your project.</h1>
                  <p className="mt-3 max-w-2xl text-body-lg text-blueprint-muted">
                    Paste a public GitHub repository to build code-specific interview questions, or skip and continue without a project attached.
                  </p>
                  <div className="mt-8 grid gap-4">
                    <button
                      type="button"
                      onClick={() => setProjectMode('repo')}
                      className={`rounded-xl border p-5 text-left transition-colors ${projectMode === 'repo' ? 'border-primary bg-white' : 'border-blueprint-line bg-[#fbf9f9]'}`}
                    >
                      <p className="text-body-lg font-semibold text-primary">Paste a GitHub repo URL</p>
                      <input
                        type="url"
                        value={repositoryUrl}
                        onChange={(event) => {
                          setProjectMode('repo');
                          setRepositoryUrl(event.target.value);
                        }}
                        placeholder="https://github.com/owner/repo"
                        className="mt-4 w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none placeholder:text-blueprint-muted focus:border-primary"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectMode('skip')}
                      className={`rounded-xl border p-5 text-left transition-colors ${projectMode === 'skip' ? 'border-primary bg-white' : 'border-blueprint-line bg-[#fbf9f9]'}`}
                    >
                      <p className="text-body-lg font-semibold text-primary">Skip project for now</p>
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
                {step < 3 ? (
                  <button type="button" disabled={!canGoNext} onClick={() => setStep((value) => value + 1)} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-50">
                    Next
                  </button>
                ) : (
                  <button type="button" onClick={finishOnboarding} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
                    {projectMode === 'repo' ? 'Submit' : 'Skip for Now'}
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

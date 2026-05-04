import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProjectScanner } from '../components/ModulePlaceholders';
import { View } from '../App';
import {
  analyzeManualDescription,
  analyzeRepository,
  COMPANY_TYPE_LABELS,
  DEFAULT_PREP_SELECTIONS,
  DOMAIN_LABELS,
  EXPERIENCE_LABELS,
  generateDiagnosticQuestions,
  generatePrepPlan,
  getStoredPrepWorkspace,
  INTERVIEW_TYPE_LABELS,
  PrepWorkspaceState,
  TIMELINE_LABELS,
  updatePrepWorkspace,
} from '../lib/prep';

interface BuilderProps {
  onViewChange: (view: View) => void;
}

export default function Builder(_props: BuilderProps) {
  const navigate = useNavigate();
  const storedWorkspace = useMemo(() => getStoredPrepWorkspace(), []);
  const [domain, setDomain] = useState(storedWorkspace.selections.domain || DEFAULT_PREP_SELECTIONS.domain);
  const [interviewType, setInterviewType] = useState(storedWorkspace.selections.interviewType || DEFAULT_PREP_SELECTIONS.interviewType);
  const [companyType, setCompanyType] = useState(storedWorkspace.selections.companyType || DEFAULT_PREP_SELECTIONS.companyType);
  const [timeline, setTimeline] = useState(storedWorkspace.selections.timeline || DEFAULT_PREP_SELECTIONS.timeline);
  const [experienceLevel, setExperienceLevel] = useState(storedWorkspace.selections.experienceLevel || DEFAULT_PREP_SELECTIONS.experienceLevel);
  const [repositoryUrl, setRepositoryUrl] = useState(storedWorkspace.selections.repositoryUrl || '');
  const [context, setContext] = useState(storedWorkspace.selections.manualDescription || '');
  const [workspaceState, setWorkspaceState] = useState<PrepWorkspaceState>(storedWorkspace);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeRequest, setActiveRequest] = useState<'plan' | 'repo' | 'manual' | 'diagnostic' | null>(null);

  useEffect(() => {
    setWorkspaceState((current) => {
      const next = updatePrepWorkspace({
        selections: {
          domain,
          interviewType,
          companyType,
          timeline,
          experienceLevel,
          repositoryUrl,
          manualDescription: context,
        },
      });
      if (JSON.stringify(current.selections) === JSON.stringify(next.selections)) {
        return current;
      }
      return next;
    });
  }, [companyType, context, domain, experienceLevel, interviewType, repositoryUrl, timeline]);

  const projectInsight = workspaceState.repoAnalysis ?? workspaceState.manualAnalysis;

  const handleGeneratePlan = async () => {
    setActiveRequest('plan');
    setErrorMessage(null);
    setStatusMessage(null);

    const result = await generatePrepPlan({ domain, interviewType, companyType, timeline });
    if ('error' in result) {
      setErrorMessage(result.error);
      setActiveRequest(null);
      return;
    }

    const next = updatePrepWorkspace({
      prepPlan: result.data,
      meta: { plan: result.meta },
    });
    setWorkspaceState(next);
    setStatusMessage('Your prep plan is ready.');
    setActiveRequest(null);
  };

  const handleRepositoryAnalysis = async () => {
    if (!repositoryUrl.trim()) {
      setErrorMessage('Add a GitHub repository URL first.');
      return;
    }

    setActiveRequest('repo');
    setErrorMessage(null);
    setStatusMessage(null);

    const result = await analyzeRepository(repositoryUrl);
    if ('error' in result) {
      setErrorMessage(result.error);
      setActiveRequest(null);
      return;
    }

    const next = updatePrepWorkspace({
      repoAnalysis: result.data,
      meta: { repo: result.meta },
    });
    setWorkspaceState(next);
    setStatusMessage('Your project talking points are ready.');
    setActiveRequest(null);
  };

  const handleManualAnalysis = async () => {
    if (!context.trim()) {
      setErrorMessage('Describe the project before running a project review.');
      return;
    }

    setActiveRequest('manual');
    setErrorMessage(null);
    setStatusMessage(null);

    const result = await analyzeManualDescription(context);
    if ('error' in result) {
      setErrorMessage(result.error);
      setActiveRequest(null);
      return;
    }

    const next = updatePrepWorkspace({
      manualAnalysis: result.data,
      meta: { manual: result.meta },
    });
    setWorkspaceState(next);
    setStatusMessage('The manual project review is ready.');
    setActiveRequest(null);
  };

  const handleGenerateDiagnostic = async () => {
    setActiveRequest('diagnostic');
    setErrorMessage(null);
    setStatusMessage(null);

    const result = await generateDiagnosticQuestions({ domain, experienceLevel });
    if ('error' in result) {
      setErrorMessage(result.error);
      setActiveRequest(null);
      return;
    }

    const next = updatePrepWorkspace({
      diagnosticQuestions: result.data,
      meta: { diagnostic: result.meta },
    });
    setWorkspaceState(next);
    setStatusMessage('Diagnostic questions generated.');
    setActiveRequest(null);
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto my-6 w-full max-w-[980px] rounded-[24px] border border-blueprint-line bg-white/90 px-8 py-10 shadow-[0_20px_40px_rgba(0,0,0,0.03)] sm:px-16 sm:py-16">
        <header className="mb-14">
          <p className="text-ui-label text-blueprint-muted">Prep Setup</p>
          <h1 className="mt-4 text-headline-lg text-primary">Set up your next interview block</h1>
          <p className="mt-4 max-w-2xl text-body-lg text-blueprint-muted">
            Choose the role you are aiming for, add your project context, and generate a focused plan before you start practicing.
          </p>
        </header>

        <section className="mb-12">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blueprint-line bg-[#efeded] text-ui-label text-primary">1</span>
            <h2 className="text-ui-label text-primary">Domain</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['frontend', 'Frontend', 'React, Vue, Component Architecture'],
              ['backend', 'Backend', 'Node, Python, Distributed Systems'],
              ['full-stack', 'Full Stack', 'UI, API, data flow, tradeoffs'],
              ['ai-ml', 'AI / ML', 'Models, pipelines, evaluation, serving'],
            ].map(([id, label, body]) => {
              const checked = domain === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setDomain(id)}
                  className={`rounded-xl border p-6 text-left transition-all ${checked ? 'border-primary bg-white shadow-[0_4px_24px_rgba(0,0,0,0.04)]' : 'border-blueprint-line bg-[#fbf9f9] hover:border-[#747878]'}`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <span className="text-ui-label text-primary">{label}</span>
                    <span className={`h-4 w-4 rounded-full border ${checked ? 'border-[5px] border-primary' : 'border-blueprint-line'}`} />
                  </div>
                  <p className="text-body-md text-blueprint-muted">{body}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blueprint-line bg-[#efeded] text-ui-label text-primary">2</span>
            <h2 className="text-ui-label text-primary">Target Role</h2>
          </div>
          <div className="grid gap-6 rounded-xl border border-blueprint-line bg-[#fbf9f9] p-6 lg:grid-cols-3">
            <div>
              <p className="text-ui-label text-blueprint-muted">Interview Type</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(INTERVIEW_TYPE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setInterviewType(id)}
                    className={`rounded-full px-5 py-2 text-ui-label transition-colors ${interviewType === id ? 'bg-primary text-white' : 'border border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-ui-label text-blueprint-muted">Company Type</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(COMPANY_TYPE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setCompanyType(id)}
                    className={`rounded-full px-5 py-2 text-ui-label transition-colors ${companyType === id ? 'bg-primary text-white' : 'border border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-ui-label text-blueprint-muted">Timeline</p>
              <div className="mt-3 flex flex-wrap gap-3">
                {Object.entries(TIMELINE_LABELS).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setTimeline(id)}
                    className={`rounded-full px-5 py-2 text-ui-label transition-colors ${timeline === id ? 'bg-primary text-white' : 'border border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-blueprint-line bg-white/80 p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h3 className="text-headline-md text-primary not-italic">Prep plan</h3>
                <p className="mt-2 max-w-2xl text-body-md text-blueprint-muted">
                  Build a role-specific plan for your {DOMAIN_LABELS[domain] ?? domain.toUpperCase()} track before you enter a timed round.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGeneratePlan}
                disabled={activeRequest === 'plan'}
                className="rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-60"
              >
                {activeRequest === 'plan' ? 'Building Plan...' : 'Build My Plan'}
              </button>
            </div>

            {workspaceState.prepPlan ? (
              <div className="mt-8 space-y-8 border-t border-blueprint-line pt-6">
                <div>
                  <p className="text-ui-label text-blueprint-muted">Top Focus Areas</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {workspaceState.prepPlan.focusAreas.map((item) => (
                      <span key={item} className="rounded-full bg-[#efeded] px-3 py-2 text-ui-label text-primary">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Expected Round Order</p>
                    <div className="mt-3 space-y-3">
                      {workspaceState.prepPlan.interviewPattern.map((step, index) => (
                        <div key={step} className="flex gap-3">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#efeded] text-ui-label text-primary">{index + 1}</span>
                          <p className="text-body-md text-primary">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 rounded-xl border border-blueprint-line bg-[#fbf9f9] p-5">
                    <div>
                      <p className="text-ui-label text-blueprint-muted">Projects Matter This Much</p>
                      <p className="mt-2 text-body-md text-primary">{workspaceState.prepPlan.projectRelevance}</p>
                    </div>
                    <div className="grid gap-4 sm:grid-cols-3">
                      {[
                        ['Language', workspaceState.prepPlan.codingExpectation.language],
                        ['Difficulty', workspaceState.prepPlan.codingExpectation.difficulty],
                        ['Time Pressure', workspaceState.prepPlan.codingExpectation.timePressure],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <p className="text-ui-label text-blueprint-muted">{label}</p>
                          <p className="mt-1 text-body-md text-primary">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-ui-label text-blueprint-muted">Prep Strategy</p>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {([
                      ['3-day', '3-Day Plan'],
                      ['7-day', '7-Day Plan'],
                      ['30-day', '30-Day Plan'],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="rounded-xl border border-blueprint-line bg-[#fbf9f9] p-5">
                        <h4 className="text-body-lg font-semibold text-primary">{label}</h4>
                        <div className="mt-4 space-y-3">
                          {workspaceState.prepPlan?.prepStrategy[key].map((item) => (
                            <div key={item} className="flex items-start gap-2">
                              <span className="material-symbols-outlined text-[18px] text-primary">arrow_right_alt</span>
                              <span className="text-body-md text-blueprint-muted">{item}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mb-12">
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blueprint-line bg-[#efeded] text-ui-label text-primary">3</span>
            <h2 className="text-ui-label text-primary">Project Context</h2>
          </div>
          <div className="rounded-xl border border-blueprint-line bg-[#fbf9f9] p-8">
            <label className="mb-2 block text-ui-label text-blueprint-muted">GitHub Repository</label>
            <input
              type="url"
              value={repositoryUrl}
              onChange={(event) => setRepositoryUrl(event.target.value)}
              placeholder="https://github.com/..."
              className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors placeholder:text-[#747878] focus:border-primary"
            />

            <div className="my-8 flex items-center gap-4">
              <div className="h-px flex-1 bg-blueprint-line" />
              <span className="text-ui-label text-blueprint-muted">Or describe it yourself</span>
              <div className="h-px flex-1 bg-blueprint-line" />
            </div>

            <label className="mb-2 block text-ui-label text-blueprint-muted">Manual Project Description</label>
            <textarea
              rows={4}
              value={context}
              onChange={(event) => setContext(event.target.value)}
              placeholder="Describe what the project does, the stack you used, and the tradeoffs you made..."
              className="w-full resize-none border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors placeholder:text-[#747878] focus:border-primary"
            />

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleRepositoryAnalysis}
                disabled={activeRequest === 'repo'}
                className="rounded-full border border-blueprint-line bg-white px-6 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3] disabled:opacity-60"
              >
                {activeRequest === 'repo' ? 'Analyzing Repo...' : 'Analyze Repo'}
              </button>
              <button
                type="button"
                onClick={handleManualAnalysis}
                disabled={activeRequest === 'manual'}
                className="rounded-full border border-blueprint-line bg-white px-6 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3] disabled:opacity-60"
              >
                {activeRequest === 'manual' ? 'Analyzing Description...' : 'Analyze Description'}
              </button>
            </div>

            {projectInsight ? (
              <div className="mt-8 space-y-8 rounded-xl border border-blueprint-line bg-white/80 p-6">
                {'projectSummary' in projectInsight ? (
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Project Summary</p>
                    <p className="mt-2 text-body-md text-primary">{projectInsight.projectSummary}</p>
                  </div>
                ) : null}

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Tech Stack</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {projectInsight.techStack.map((item) => (
                        <span key={item} className="rounded-full bg-[#efeded] px-3 py-2 text-ui-label text-primary">{item}</span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-ui-label text-blueprint-muted">What Interviewers Will Ask About</p>
                    <div className="mt-3 space-y-3">
                      {('interviewableTopics' in projectInsight ? projectInsight.interviewableTopics : projectInsight.whatInterviewerWillFocus).map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-primary">arrow_right_alt</span>
                          <span className="text-body-md text-blueprint-muted">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-2">
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Likely Weak Points</p>
                    <div className="mt-3 space-y-3">
                      {('weakPoints' in projectInsight ? projectInsight.weakPoints : projectInsight.gapsThatMightExist).map((item) => (
                        <p key={item} className="rounded-lg border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary">{item}</p>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-ui-label text-blueprint-muted">Next Talking Points</p>
                    <div className="mt-3 space-y-3">
                      {('commonFollowUps' in projectInsight ? projectInsight.commonFollowUps : projectInsight.projectSpecificQuestions).map((item) => (
                        <p key={item} className="rounded-lg border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary">{item}</p>
                      ))}
                    </div>
                  </div>
                </div>

                {'improvementSuggestions' in projectInsight ? (
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Small Improvements Before Interviews</p>
                    <div className="mt-3 space-y-3">
                      {projectInsight.improvementSuggestions.map((item) => (
                        <div key={item} className="flex items-start gap-2">
                          <span className="material-symbols-outlined text-[18px] text-primary">check_circle</span>
                          <span className="text-body-md text-blueprint-muted">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-ui-label text-blueprint-muted">Assumptions Used</p>
                    <div className="mt-3 space-y-3">
                      {workspaceState.manualAnalysis?.assumptions.map((item) => (
                        <p key={item} className="rounded-lg border border-blueprint-line bg-[#fbf9f9] p-4 text-body-md text-primary">{item}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <ProjectScanner className="mt-8" />
            )}
          </div>
        </section>

        <section>
          <div className="mb-6 flex items-center gap-4">
            <span className="flex h-6 w-6 items-center justify-center rounded-full border border-blueprint-line bg-[#efeded] text-ui-label text-primary">4</span>
            <h2 className="text-ui-label text-primary">Quick Level Check</h2>
          </div>

          <div className="rounded-xl border border-blueprint-line bg-[#fbf9f9] p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-ui-label text-blueprint-muted">Your self-rating</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {Object.entries(EXPERIENCE_LABELS).map(([id, label]) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setExperienceLevel(id)}
                      className={`rounded-full px-5 py-2 text-ui-label transition-colors ${experienceLevel === id ? 'bg-primary text-white' : 'border border-blueprint-line bg-white text-blueprint-muted hover:text-primary'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleGenerateDiagnostic}
                disabled={activeRequest === 'diagnostic'}
                className="rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-60"
              >
                {activeRequest === 'diagnostic' ? 'Generating Questions...' : 'Generate Diagnostic'}
              </button>
            </div>

            {workspaceState.diagnosticQuestions.length ? (
              <div className="mt-8 space-y-4 border-t border-blueprint-line pt-6">
                {workspaceState.diagnosticQuestions.map((question, index) => (
                  <div key={`${question.question}-${index}`} className="rounded-xl border border-blueprint-line bg-white/80 p-5">
                    <div className="mb-3 flex flex-wrap items-center gap-3">
                      <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-primary">Question {index + 1}</span>
                      <span className="rounded-full border border-blueprint-line px-3 py-1 text-ui-label text-blueprint-muted">{question.topicTag}</span>
                      <span className="rounded-full border border-blueprint-line px-3 py-1 text-ui-label text-blueprint-muted">{question.type === 'mcq' ? 'MCQ' : 'True / False'}</span>
                    </div>
                    <p className="text-body-md text-primary">{question.question}</p>
                    {question.options?.length ? (
                      <div className="mt-4 grid gap-2">
                        {question.options.map((option) => (
                          <div key={option} className="rounded-lg border border-blueprint-line bg-[#fbf9f9] px-4 py-3 text-body-md text-blueprint-muted">
                            {option}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {errorMessage ? <p className="mt-8 text-body-md text-red-600">{errorMessage}</p> : null}
        {statusMessage ? <p className="mt-4 text-body-md text-blueprint-muted">{statusMessage}</p> : null}

        <footer className="mt-10 flex flex-col gap-4 border-t border-blueprint-line pt-8 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => navigate('/signin')} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">
            Back
          </button>
          <button type="button" onClick={() => navigate('/dashboard')} className="rounded-full bg-primary px-8 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
            Continue to Overview
          </button>
        </footer>
      </main>
    </div>
  );
}
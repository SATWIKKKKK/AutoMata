import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ScenarioMCQ } from '../components/ModulePlaceholders';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';

const SCENARIOS: Record<string, { track: string; topic: string; title: string; body: string; filename: string; snippet: string }> = {
  frontend: {
    track: 'Frontend Machine Coding Session',
    topic: 'Async State',
    title: 'Prevent stale results in a live search screen',
    body: 'Pick the change that keeps the UI in sync when requests return out of order after the user types quickly.',
    filename: 'SearchResults.tsx',
    snippet: `function SearchResults() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  useEffect(() => {
    fetch('/api/search?q=' + query)
      .then((response) => response.json())
      .then((data) => setResults(data.items));
  }, [query]);

  return <ResultsList items={results} />;
}`,
  },
  backend: {
    track: 'Scenario-Based Backend Test',
    topic: 'Idempotency',
    title: 'Handle duplicate webhook deliveries safely',
    body: 'Choose the change that prevents duplicate state updates when the payment provider retries the same webhook.',
    filename: 'paymentWebhook.ts',
    snippet: `app.post('/webhooks/payment', async (req, res) => {
  const event = req.body;
  await markInvoicePaid(event.invoiceId);
  await sendReceipt(event.invoiceId);
  res.sendStatus(200);
});`,
  },
  'full-stack': {
    track: 'Full Stack Build Round',
    topic: 'State Sync',
    title: 'Keep optimistic UI and server state from drifting apart',
    body: 'Choose the change that avoids showing a successful save in the UI when the server write eventually fails.',
    filename: 'CheckoutFlow.ts',
    snippet: `async function saveCart(nextCart) {
  setCart(nextCart);
  setStatus('saved');
  await api.updateCart(nextCart);
}`,
  },
  'ai-ml': {
    track: 'Retrieval Scenario Test',
    topic: 'Retrieval Quality',
    title: 'Stop weak context from reaching the answer stage',
    body: 'Pick the change that improves answer quality when the retriever returns low-signal chunks.',
    filename: 'retrievalPipeline.py',
    snippet: `docs = retriever.search(query)
prompt = build_prompt(query, docs)
answer = llm.generate(prompt)
return answer`,
  },
};

export default function Registry() {
  const navigate = useNavigate();
  const workspace = getStoredPrepWorkspace();
  const scenario = SCENARIOS[workspace.selections.domain] ?? SCENARIOS.frontend;

  return (
    <div className="min-h-full bg-background px-4 py-6 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto flex w-full max-w-256 flex-col gap-8">
        <header className="flex flex-col gap-4 border-b border-blueprint-line pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4 text-ui-label text-primary">
            <button type="button" onClick={() => navigate('/workflows')} className="transition-colors hover:text-blueprint-muted">
              Exit Round
            </button>
            <div className="h-4 w-px bg-blueprint-line" />
            <span className="text-blueprint-muted">{DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend'} Practice</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-3 py-1.5 text-ui-label text-primary">
              <span className="material-symbols-outlined text-[16px] text-[#5d5f5d]">timer</span>
              14:59
            </div>
            <div className="flex gap-1">
              <div className="h-1 w-8 rounded-full bg-primary" />
              <div className="h-1 w-8 rounded-full bg-primary" />
              <div className="h-1 w-8 rounded-full bg-blueprint-line" />
              <div className="h-1 w-8 rounded-full bg-blueprint-line" />
              <div className="h-1 w-8 rounded-full bg-blueprint-line" />
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <article className="space-y-6 lg:col-span-7">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-[#e4e2e2] px-2 py-1 text-ui-label text-blueprint-muted">Question 2 of 5</span>
              <span className="rounded-full border border-blueprint-line bg-[#efeded] px-2 py-1 text-ui-label text-blueprint-muted">{scenario.topic}</span>
            </div>
            <div className="max-w-2xl space-y-4">
              <p className="text-ui-label text-blueprint-muted">{scenario.track}</p>
              <h1 className="text-headline-lg text-primary">{scenario.title}</h1>
              <p className="text-body-lg text-blueprint-muted">
                {scenario.body}
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-blueprint-line bg-white/85 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)]">
              <div className="flex items-center gap-2 border-b border-blueprint-line bg-white px-4 py-2">
                <div className="flex gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                  <div className="h-2.5 w-2.5 rounded-full bg-blueprint-line" />
                </div>
                <span className="ml-4 text-ui-label text-blueprint-muted normal-case">{scenario.filename}</span>
              </div>
              <pre className="overflow-x-auto p-6 text-[13px] leading-7 text-blueprint-muted"><code>{scenario.snippet}</code></pre>
            </div>
          </article>

          <ScenarioMCQ className="lg:col-span-5" />
        </section>

        <footer className="flex flex-col gap-4 border-t border-blueprint-line pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => navigate('/workflows')} className="rounded-full border border-blueprint-line px-6 py-2.5 text-ui-label text-primary transition-colors hover:bg-white">
            Previous
          </button>
          <button type="button" onClick={() => navigate('/editor')} className="rounded-full bg-primary px-8 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031]">
            Continue to Coding Round
          </button>
        </footer>
      </main>
    </div>
  );
}
import React from 'react';
import { useNavigate } from 'react-router-dom';

const ARCHIVE_ENTRIES = [
  { id: 'fe-react-902', title: 'React Hooks Intensive', status: 'Archived', date: 'Apr 28, 2026', type: 'Frontend' },
  { id: 'sysdesign-118', title: 'Scalable APIs Review', status: 'Archived', date: 'Apr 23, 2026', type: 'Backend' },
  { id: 'algo-331', title: 'Graph Search Marathon', status: 'Archived', date: 'Apr 17, 2026', type: 'Algorithms' },
];

export default function Templates() {
  const navigate = useNavigate();

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-7xl space-y-10">
        <header className="border-b border-blueprint-line pb-6">
          <h1 className="text-headline-lg text-primary">Archive</h1>
          <p className="mt-3 max-w-3xl text-body-lg text-blueprint-muted">
            Revisit earlier rounds, interview notes, and the practice plans you may want to repeat before the next interview.
          </p>
        </header>

        <section className="grid gap-6">
          {ARCHIVE_ENTRIES.map((entry) => (
            <article key={entry.id} className="rounded-xl border border-blueprint-line bg-white/85 p-6 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-[#efeded] px-3 py-1 text-ui-label text-blueprint-muted">{entry.status}</span>
                    <span className="text-ui-label text-blueprint-muted">{entry.type}</span>
                  </div>
                  <h2 className="text-body-lg font-semibold text-primary">{entry.title}</h2>
                  <p className="mt-1 text-body-md text-blueprint-muted">Completed on {entry.date}</p>
                </div>
                <button type="button" onClick={() => navigate(`/workflows/${entry.id}`)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary transition-colors hover:bg-white">
                  Open Summary
                </button>
              </div>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
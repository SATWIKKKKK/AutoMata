import React from 'react';
import {
  ArrowRight, BarChart3, BrainCircuit, CheckCircle2, Github, Layers3,
} from 'lucide-react';
import { getStoredUser } from '../lib/session';
import { View } from '../App';
import { BackgroundRippleEffect } from '../components/ui/background-ripple-effect';
import GlobalSearch from '../components/GlobalSearch';

interface LandingProps {
  onStart: () => void;
  onViewDocs: () => void;
  onViewChange: (view: View) => void;
}

export default function Landing({ onViewChange }: LandingProps) {
  const user = getStoredUser();
  const isAuthed = Boolean(user?.loggedIn);
  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <div className="pointer-events-none fixed inset-0 opacity-30">
        <BackgroundRippleEffect rows={11} cols={32} cellSize={68} />
      </div>

      <nav className="sticky top-3 z-40 mx-3 rounded-xl border border-blueprint-line bg-white/85 backdrop-blur-md sm:top-4 sm:mx-4">
        <div className="mx-auto flex h-12 w-full max-w-360 items-center justify-between px-4 sm:h-14 sm:px-8 lg:px-12">
          <button type="button" onClick={() => onViewChange('dashboard')} className="font-serif text-[clamp(1.75rem,3vw,34px)] leading-none text-primary">
            Repoid
          </button>
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => onViewChange('auth')} className="text-ui-label text-primary transition-colors hover:text-blueprint-muted">
              Sign In
            </button>
            <button
              type="button"
              onClick={() => onViewChange('signup')}
              className="rounded-full bg-[#1a1a1a] px-5 py-1.5 text-ui-label text-white shadow-[0_8px_24px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
            >
              Sign Up
            </button>
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-360 flex-col px-4 pb-20 sm:px-8 lg:px-12">
        <section className="flex min-h-[calc(100vh-3rem)] flex-col items-start justify-center text-left sm:min-h-[calc(100vh-3.5rem)]">
          <h1 className="max-w-3xl text-left font-serif leading-[1.08] text-[clamp(2.5rem,6.8vw,72px)] text-primary">
            Practice the rounds you are actually going to face.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-blueprint-muted">
            AI interview prep that adapts to your role, your timeline, and your own project.
          </p>
          <div className="mt-8 w-full max-w-2xl">
            <GlobalSearch />
          </div>
          <div className="mt-7 flex flex-wrap justify-start gap-4">
            <button
              type="button"
              onClick={() => onViewChange(isAuthed ? 'dashboard' : 'signup')}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-3 text-ui-label text-white shadow-[0_10px_28px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
            >
              Get Started <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={() => onViewChange('dashboard')}
              className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-8 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]"
            >
              Go to Dashboard
            </button>
          </div>
        </section>

        <section className="border-y border-blueprint-line py-16">
          <div className="mb-10">
            <p className="text-ui-label text-blueprint-muted">How it works</p>
            <h2 className="mt-2 max-w-2xl text-headline-lg text-primary">A cleaner path from profile to practice.</h2>
          </div>
          <div className="grid gap-5 lg:grid-cols-4">
            {[
              { icon: BrainCircuit, title: 'Pick your track', body: 'Choose the role domain and round style you are preparing for.' },
              { icon: Github, title: 'Add your project', body: 'Paste a GitHub repo or connect private access for repo-specific prompts.' },
              { icon: Layers3, title: 'Practice by round', body: 'Filter by topic and round type, then open only the answers you need.' },
              { icon: BarChart3, title: 'Track progress', body: 'Use saved attempts and scans to keep prep focused across sessions.' },
            ].map((item, index) => {
              const Icon = item.icon;
              return (
                <article key={item.title} className="relative border-l border-blueprint-line pl-5">
                  <span className="mb-6 flex h-10 w-10 items-center justify-center rounded-full border border-blueprint-line bg-card text-primary">
                    <Icon size={18} />
                  </span>
                  <span className="text-ui-label text-blueprint-muted">Step {index + 1}</span>
                  <h3 className="mt-2 text-headline-sm text-primary">{item.title}</h3>
                  <p className="mt-3 text-body-md text-blueprint-muted">{item.body}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="py-16">
          <div className="mb-10">
            <p className="text-ui-label text-blueprint-muted">Benefits</p>
            <h2 className="mt-2 max-w-2xl text-headline-lg text-primary">Prep that stays specific instead of becoming generic grind.</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              'Domain-wise question banks with topic and round filters.',
              'Repo-grounded questions from the code you actually built.',
              'Fast answer review with clean collapsed states and saved scans.',
            ].map((benefit) => (
              <div key={benefit} className="surface-card-compact flex gap-3">
                <CheckCircle2 className="mt-1 shrink-0 text-primary" size={18} />
                <p className="text-body-md text-primary">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="border-t border-blueprint-line py-8">
          <div className="flex flex-col gap-3 text-body-md text-blueprint-muted sm:flex-row sm:items-center sm:justify-between">
            <p className="font-serif text-2xl text-primary">Repoid</p>
            <p>Interview prep for domain tracks, project scans, and serious practice.</p>
          </div>
        </footer>
      </main>
    </div>
  );
}

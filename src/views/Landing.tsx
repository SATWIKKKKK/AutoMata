import React from 'react';
import {
  ArrowRight,
  Users,
  Code2,
  FolderOpen,
  Github,
  Cpu,
  BarChart2,
  MessageSquare,
  PenLine,
  Building2,
  Compass,
  Activity,
  CheckSquare,
} from 'lucide-react';
import { getStoredUser } from '../lib/session';
import { View } from '../App';

interface LandingProps {
  onStart: () => void;
  onViewDocs: () => void;
  onViewChange: (view: View) => void;
}

const FEATURES = [
  { label: 'Role-Based Interview Simulation', Icon: Users },
  { label: 'Live Coding Environment', Icon: Code2 },
  { label: 'Project-Based Questioning', Icon: FolderOpen },
  { label: 'GitHub Repository Analysis', Icon: Github },
  { label: 'Code Evaluation Engine', Icon: Cpu },
  { label: 'Gap Analysis System', Icon: BarChart2 },
  { label: 'Scenario-Based Questions', Icon: MessageSquare },
  { label: 'Fill in the Blanks', Icon: PenLine },
  { label: 'Company-Style Patterns', Icon: Building2 },
  { label: 'Domain-Specific Playgrounds', Icon: Compass },
  { label: 'Progress Tracking', Icon: Activity },
] as const;

export default function Landing({ onViewDocs, onViewChange }: LandingProps) {
  const user = getStoredUser();
  const isAuthed = Boolean(user?.loggedIn);

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />

      <nav className="sticky top-0 z-40 border-b border-blueprint-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between px-4 sm:px-8 lg:px-12">
          <button type="button" onClick={() => onViewChange('landing')} className="text-2xl font-black tracking-tight text-primary">
            PROMPTLY
          </button>
          <div className="flex items-center gap-3">
            {isAuthed ? (
              <button
                type="button"
                onClick={() => onViewChange('dashboard')}
                className="rounded-full border border-[#3d2b1f] bg-white px-6 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]"
              >
                Dashboard
              </button>
            ) : (
              <>
                <button type="button" onClick={() => onViewChange('auth')} className="text-ui-label text-primary transition-colors hover:text-blueprint-muted">
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => onViewChange('signup')}
                  className="rounded-full bg-[#1a1a1a] px-6 py-2 text-ui-label text-white shadow-[0_8px_24px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-360 flex-col px-4 pb-24 sm:px-8 lg:px-12">
        {/* Hero — fills the viewport so features section is below fold */}
        <section className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
          <h1 className="max-w-4xl font-serif leading-[1.05] tracking-[-0.02em] text-[clamp(3rem,9vw,96px)] text-primary">
            Practice the rounds you are actually going to face.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-blueprint-muted">
            Define your interview. We simulate every round that follows.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => onViewChange(isAuthed ? 'dashboard' : 'signup')}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-3 text-ui-label text-white shadow-[0_10px_28px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
            >
              Dashboard <ArrowRight size={14} />
            </button>
            <button
              type="button"
              onClick={onViewDocs}
              className="inline-flex items-center gap-2 rounded-full border border-blueprint-line bg-white px-8 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]"
            >
              Explore Flow
            </button>
          </div>
        </section>

        {/* What you'll experience — intentionally below the fold */}
        <section className="flex flex-col items-center gap-10 pt-8 pb-24">
          <h2 className="text-center text-headline-lg text-primary">What you'll experience</h2>
          <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ label, Icon }) => (
              <div
                key={label}
                className="flex items-center gap-4 rounded-2xl border border-blueprint-line bg-white/85 px-5 py-4 shadow-[0_4px_16px_rgba(0,0,0,0.03)]"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#efeded] text-primary">
                  <Icon size={18} />
                </div>
                <span className="flex-1 text-body-md text-primary">{label}</span>
                <CheckSquare size={18} className="flex-shrink-0 text-blueprint-muted" />
              </div>
            ))}
          </div>
          <div className="flex flex-col items-center gap-3 pt-2">
            <p className="text-body-md text-blueprint-muted">Want to experience all of these?</p>
            <button
              type="button"
              onClick={() => onViewChange(isAuthed ? 'dashboard' : 'signup')}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-3 text-ui-label text-white shadow-[0_10px_28px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
            >
              {isAuthed ? 'Go to Dashboard' : 'Click here to get started'} <ArrowRight size={14} />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
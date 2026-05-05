import React from 'react';
import {
  ArrowRight,
} from 'lucide-react';
import { getStoredUser } from '../lib/session';
import { View } from '../App';
import { BackgroundRippleEffect } from '../components/ui/background-ripple-effect';
import { PlaceholdersAndVanishInput } from '../components/ui/placeholders-and-vanish-input';

interface LandingProps {
  onStart: () => void;
  onViewDocs: () => void;
  onViewChange: (view: View) => void;
}

export default function Landing({ onViewChange }: LandingProps) {
  const user = getStoredUser();
  const isAuthed = Boolean(user?.loggedIn);
  const placeholders = [
    'Paste a GitHub repo to prep from your own project',
    'React interview in 7 days',
    'Backend system design for a startup round',
    'AI/ML internship prep with project questions',
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <div className="pointer-events-none fixed inset-0 opacity-25">
        <BackgroundRippleEffect rows={10} cols={30} cellSize={56} />
      </div>

      <nav className="sticky top-0 z-40 border-b border-blueprint-line bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 w-full max-w-360 items-center justify-between px-4 sm:px-8 lg:px-12">
          <button type="button" onClick={() => onViewChange('dashboard')} className="font-serif text-[clamp(2rem,4vw,42px)] leading-none text-primary">
            Promptly
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

      <main className="relative z-10 mx-auto flex w-full max-w-360 flex-col px-4 pb-20 sm:px-8 lg:px-12">
        <section className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center text-center">
          <h1 className="mx-auto max-w-3xl text-center font-serif leading-[1.08] text-[clamp(2.5rem,6.8vw,72px)] text-primary">
            Practice the rounds you are actually going to face.
          </h1>
          <p className="mt-6 max-w-xl text-body-lg text-blueprint-muted">
            AI interview prep that adapts to your role, your timeline, and your own project.
          </p>
          <div className="mt-8 w-full max-w-xl">
            <PlaceholdersAndVanishInput
              placeholders={placeholders}
              onChange={() => undefined}
              onSubmit={(event) => {
                event.preventDefault();
                onViewChange(isAuthed ? 'dashboard' : 'signup');
              }}
            />
          </div>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <button
              type="button"
              onClick={() => onViewChange(isAuthed ? 'dashboard' : 'signup')}
              className="inline-flex items-center gap-2 rounded-full bg-[#1a1a1a] px-8 py-3 text-ui-label text-white shadow-[0_10px_28px_rgba(26,26,26,0.16)] transition-colors hover:bg-[#303031]"
            >
              {isAuthed ? 'Dashboard' : 'Sign Up'} <ArrowRight size={14} />
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
      </main>
    </div>
  );
}

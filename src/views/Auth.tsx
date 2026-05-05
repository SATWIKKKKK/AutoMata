import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Github } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authenticateLocalAccount, persistSessionUser, registerLocalAccount } from '../lib/session';
import { BackgroundRippleEffect } from '../components/ui/background-ripple-effect';

interface AuthProps {
  onAuthSuccess: () => void;
  onBackToLanding: () => void;
  initialMode?: 'login' | 'signup';
}

export default function Auth({ onAuthSuccess, onBackToLanding, initialMode = 'login' }: AuthProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const oauthError = useMemo(() => {
    const value = new URLSearchParams(location.search).get('error');
    if (!value) return null;
    const messages: Record<string, string> = {
      oauth_google_not_configured: 'Google OAuth is not configured on the server yet.',
      oauth_github_not_configured: 'GitHub OAuth is not configured on the server yet.',
      oauth_state: 'OAuth session expired. Start the provider sign-in again.',
      oauth_config: 'OAuth configuration is incomplete. Check the redirect URI and client secrets.',
    };
    return messages[value] ?? value.replace(/_/g, ' ');
  }, [location.search]);

  const handleSocialClick = (provider: 'GitHub' | 'Google') => {
    window.location.assign(`/api/auth/oauth/${provider.toLowerCase()}`);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setAuthError(null);
    setStatusMessage(null);

    try {
      if (mode === 'signup') {
        if (password !== confirmPassword) {
          setAuthError('Password and confirm password must match.');
          return;
        }

        const result = await registerLocalAccount({ email, name: fullName, password });
        if (!('error' in result)) {
          persistSessionUser(result.user);
          onAuthSuccess();
          return;
        }
        setAuthError(result.error);
        return;
      }

      const result = await authenticateLocalAccount({ email, password });
      if (!('error' in result)) {
        persistSessionUser(result.user);
        onAuthSuccess();
        return;
      }
      setAuthError(result.error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <div className="pointer-events-none fixed inset-0 opacity-25">
        <BackgroundRippleEffect rows={9} cols={28} cellSize={54} />
      </div>
      <button type="button" onClick={onBackToLanding} className="absolute left-6 top-6 z-20 flex items-center gap-2 text-sm text-blueprint-muted transition-colors hover:text-primary">
        <ArrowLeft size={16} /> Back to Home
      </button>

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6">
        <div className="w-full max-w-[480px] rounded-3xl border border-blueprint-line bg-white/90 p-6 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.04)] sm:p-8">
          <div className="mb-5">
            <button type="button" onClick={() => navigate('/dashboard')} className="text-ui-label text-blueprint-muted transition-colors hover:text-primary">
              Promptly
            </button>
            <h1 className="mt-4 text-headline-lg text-primary">
              {mode === 'signup' ? 'Create your account.' : 'Welcome back.'}
            </h1>
            <p className="mt-2 text-body-md text-blueprint-muted">
              {mode === 'signup'
                ? 'Name, email, password. Then your focused interview setup begins.'
                : 'Sign in to continue your dashboard, prep loop, and next session.'}
            </p>
          </div>

          <div className="mb-5 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => handleSocialClick('GitHub')}
              aria-label="Continue with GitHub"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-blueprint-line bg-white text-primary transition-colors hover:bg-[#f5f3f3]"
            >
              <Github size={20} />
            </button>
            <button
              type="button"
              onClick={() => handleSocialClick('Google')}
              aria-label="Continue with Google"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-blueprint-line bg-white transition-colors hover:bg-[#f5f3f3]"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </button>
          </div>

          <div className="mb-5 flex items-center gap-4">
            <div className="h-px flex-1 bg-blueprint-line" />
            <span className="text-ui-label text-blueprint-muted">Or use email</span>
            <div className="h-px flex-1 bg-blueprint-line" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' ? (
              <div>
                <label className="mb-2 block text-ui-label text-blueprint-muted">Full Name</label>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} required className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors focus:border-primary" placeholder="Jane Doe" />
              </div>
            ) : null}

            <div>
              <label className="mb-2 block text-ui-label text-blueprint-muted">Work Email</label>
              <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors focus:border-primary" placeholder="you@company.com" />
            </div>

            <div>
              <label className="mb-2 block text-ui-label text-blueprint-muted">Password</label>
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors focus:border-primary" placeholder="••••••••" />
            </div>

            {mode === 'signup' ? (
              <div>
                <label className="mb-2 block text-ui-label text-blueprint-muted">Confirm Password</label>
                <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none transition-colors focus:border-primary" placeholder="••••••••" />
              </div>
            ) : null}

            {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
            {oauthError ? <p className="text-sm text-red-600">{oauthError}</p> : null}
            {statusMessage ? <p className="text-sm text-blueprint-muted">{statusMessage}</p> : null}

            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-60">
              {mode === 'signup' ? 'Create Account' : 'Sign In'} <ArrowRight size={16} />
            </button>
          </form>

          <div className="mt-5 text-body-md text-blueprint-muted">
            {mode === 'signup' ? (
              <p>
                Already have an account?{' '}
                <button type="button" onClick={() => navigate('/signin')} className="font-medium text-primary underline underline-offset-4">
                  Sign In
                </button>
              </p>
            ) : (
              <p>
                New here?{' '}
                <button type="button" onClick={() => navigate('/signup')} className="font-medium text-primary underline underline-offset-4">
                  Create an account
                </button>
              </p>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import { clearSessionState, getStoredUser, persistSessionUser, requestEmailOtp } from '../lib/session';
import { DOMAIN_LABELS, getStoredPrepWorkspace, updatePrepWorkspace } from '../lib/prep';
import { View } from '../App';

interface SettingsProps {
  onViewChange?: (view: View) => void;
  initialTab?: string;
}

const DOMAIN_OPTIONS = ['frontend', 'backend', 'full-stack', 'ai-ml', 'devops', 'data'];
const THEME_OPTIONS = ['light', 'dark', 'system'];

export default function Settings({ onViewChange, initialTab = 'profile' }: SettingsProps) {
  const storedUser = getStoredUser();
  const workspace = useMemo(() => getStoredPrepWorkspace(), []);
  const [activeTab, setActiveTab] = useState(initialTab === 'preferences' ? 'preferences' : 'profile');
  const [name, setName] = useState(storedUser?.name ?? '');
  const [email, setEmail] = useState(storedUser?.email ?? '');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailDebugOtp, setEmailDebugOtp] = useState<string | null>(null);
  const [otpModalOpen, setOtpModalOpen] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [theme, setTheme] = useState('light');
  const [domain, setDomain] = useState(workspace.selections.domain || 'frontend');
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);

  const emailChanged = email.trim().toLowerCase() !== String(storedUser?.email ?? '').toLowerCase();

  useEffect(() => {
    let ignore = false;
    void fetch('/api/users/preferences', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ sidebarOpen?: boolean; theme?: string; domain?: string }>;
      })
      .then((data) => {
        if (!data || ignore) return;
        if (typeof data.sidebarOpen === 'boolean') setSidebarExpanded(data.sidebarOpen);
        if (typeof data.theme === 'string') setTheme(data.theme);
        if (typeof data.domain === 'string') setDomain(data.domain);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const requestEmailChangeOtp = async () => {
    setProfileMessage(null);
    if (!emailChanged) {
      setProfileMessage('Change the email before requesting an OTP.');
      return;
    }
    const result = await requestEmailOtp({ email, purpose: 'email_change' });
    if ('error' in result) {
      setProfileMessage(result.error);
      return;
    }
    setEmailDebugOtp(result.debugOtp ?? null);
    setOtpModalOpen(true);
    setProfileMessage(result.message);
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    if (emailChanged && emailOtp.length !== 6) {
      setOtpModalOpen(true);
      setProfileMessage('Verify the new email with OTP before saving.');
      return;
    }

    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email: emailChanged ? email : undefined, otp: emailChanged ? emailOtp : undefined }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setProfileMessage(String(data?.error ?? 'Unable to update your profile.'));
      return;
    }

    const nextUser = data?.user ?? { ...storedUser, name, email, loggedIn: true };
    persistSessionUser(nextUser);
    setEmailOtp('');
    setEmailDebugOtp(null);
    setProfileMessage('Profile updated successfully.');
  };

  const handlePasswordChange = async (event: React.FormEvent) => {
    event.preventDefault();
    setPasswordMessage(null);

    if (passwords.newPassword !== passwords.confirmPassword) {
      setPasswordMessage('New password and confirmation must match.');
      return;
    }

    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPasswordMessage(String(data?.error ?? 'Password update failed.'));
      return;
    }

    setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordMessage('Password updated successfully.');
  };

  const handlePreferenceSave = async () => {
    setPreferenceMessage(null);
    const response = await fetch('/api/users/preferences', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sidebarOpen: sidebarExpanded, theme, domain }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPreferenceMessage(String(data?.error ?? 'Unable to save preferences.'));
      return;
    }

    updatePrepWorkspace({ selections: { ...getStoredPrepWorkspace().selections, domain } });
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false;
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && prefersDark));
    setPreferenceMessage('Preferences saved.');
  };

  const handleDelete = async () => {
    setDeleteMessage(null);
    const response = await fetch('/api/users/me', {
      method: 'DELETE',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmation: deleteConfirmation }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setDeleteMessage(String(data?.error ?? 'Unable to delete your account.'));
      return;
    }
    await clearSessionState();
    onViewChange?.('landing');
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-12">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-6xl space-y-6">
        <header className="border-b border-blueprint-line pb-6">
          <h1 className="text-display-xl text-primary">Settings</h1>
          <p className="mt-2 max-w-2xl text-body-lg text-blueprint-muted">
            Manage your account, security, domain, and device preferences.
          </p>
        </header>

        <div className="inline-flex rounded-full border border-blueprint-line bg-white/85 p-1">
          {[
            ['profile', 'Profile'],
            ['preferences', 'Preferences'],
          ].map(([id, label]) => (
            <button key={id} type="button" onClick={() => setActiveTab(id)} className={`rounded-full px-5 py-2 text-ui-label transition-colors ${activeTab === id ? 'bg-primary text-white' : 'text-blueprint-muted hover:text-primary'}`}>
              {label}
            </button>
          ))}
        </div>

        {activeTab === 'profile' ? (
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="surface-card">
              <h2 className="text-headline-md text-primary not-italic">Profile</h2>
              <form onSubmit={handleProfileSave} className="mt-5 space-y-5">
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">Full Name</label>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-ui-label text-blueprint-muted">Email</label>
                    {emailChanged ? (
                      <button type="button" onClick={requestEmailChangeOtp} className="text-ui-label text-primary underline underline-offset-4">
                        Send OTP
                      </button>
                    ) : null}
                  </div>
                  <input value={email} onChange={(event) => { setEmail(event.target.value); setEmailOtp(''); }} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                  {emailChanged ? <p className="mt-2 text-sm text-blueprint-muted">Email changes require OTP verification.</p> : null}
                </div>
                {profileMessage ? <p className="text-sm text-blueprint-muted">{profileMessage}</p> : null}
                <button type="submit" className="rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
                  Save Profile
                </button>
              </form>
            </section>

            <section className="surface-card">
              <h2 className="text-headline-md text-primary not-italic">Security</h2>
              <form onSubmit={handlePasswordChange} className="mt-5 space-y-5">
                {[
                  ['currentPassword', 'Current Password'],
                  ['newPassword', 'New Password'],
                  ['confirmPassword', 'Confirm New Password'],
                ].map(([key, label]) => (
                  <div key={key}>
                    <label className="mb-2 block text-ui-label text-blueprint-muted">{label}</label>
                    <input
                      type="password"
                      value={passwords[key as keyof typeof passwords]}
                      onChange={(event) => setPasswords((current) => ({ ...current, [key]: event.target.value }))}
                      className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary"
                    />
                  </div>
                ))}
                {passwordMessage ? <p className="text-sm text-blueprint-muted">{passwordMessage}</p> : null}
                <button type="submit" className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                  Update Password
                </button>
              </form>
            </section>

            <section className="surface-card border-red-300 lg:col-span-2">
              <h2 className="text-headline-md text-red-600 not-italic">Delete Account</h2>
              <p className="mt-2 max-w-2xl text-body-md text-blueprint-muted">
                This removes your account, preferences, round attempts, and saved repository scans.
              </p>
              <button type="button" onClick={() => setDeleteOpen(true)} className="mt-5 rounded-full border border-red-300 px-6 py-3 text-ui-label text-red-600 transition-colors hover:bg-red-50">
                Delete Account
              </button>
            </section>
          </div>
        ) : (
          <section className="surface-card">
            <h2 className="text-headline-md text-primary not-italic">Preferences</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-ui-label text-blueprint-muted">Sidebar State</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {[
                    [true, 'Expanded'],
                    [false, 'Collapsed'],
                  ].map(([value, label]) => (
                    <button key={label as string} type="button" onClick={() => setSidebarExpanded(Boolean(value))} className={`rounded-full px-5 py-2 text-ui-label ${sidebarExpanded === value ? 'bg-primary text-white' : 'border border-blueprint-line text-blueprint-muted'}`}>
                      {label as string}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-ui-label text-blueprint-muted">Theme Preference</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {THEME_OPTIONS.map((option) => (
                    <button key={option} type="button" onClick={() => setTheme(option)} className={`rounded-full px-5 py-2 text-ui-label ${theme === option ? 'bg-primary text-white' : 'border border-blueprint-line text-blueprint-muted'}`}>
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <p className="text-ui-label text-blueprint-muted">Current Domain</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {DOMAIN_OPTIONS.map((option) => (
                    <button key={option} type="button" onClick={() => setDomain(option)} className={`rounded-xl border p-4 text-left transition-colors ${domain === option ? 'border-primary bg-primary text-white' : 'border-blueprint-line bg-white text-primary hover:bg-[#f5f3f3]'}`}>
                      <span className="text-body-md font-semibold">{DOMAIN_LABELS[option] ?? option}</span>
                      <span className={`mt-1 block text-sm ${domain === option ? 'text-white/70' : 'text-blueprint-muted'}`}>Questions, rounds, and recommendations will use this domain.</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {preferenceMessage ? <p className="mt-6 text-sm text-blueprint-muted">{preferenceMessage}</p> : null}

            <button type="button" onClick={handlePreferenceSave} className="mt-6 rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
              Save Preferences
            </button>
          </section>
        )}
      </main>

      {otpModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-blueprint-line bg-white p-6 shadow-2xl">
            <p className="text-ui-label text-blueprint-muted">Email Verification</p>
            <h2 className="mt-2 text-headline-md text-primary not-italic">Enter the OTP</h2>
            {emailDebugOtp ? <p className="mt-4 rounded-lg border border-blueprint-line bg-[#f5f3f3] px-4 py-3 font-mono text-body-md text-primary">{emailDebugOtp}</p> : null}
            <input value={emailOtp} onChange={(event) => setEmailOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" placeholder="6-digit OTP" className="mt-5 w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setOtpModalOpen(false)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">Close</button>
              <button type="button" onClick={() => setOtpModalOpen(false)} disabled={emailOtp.length !== 6} className="rounded-full bg-primary px-5 py-2.5 text-ui-label text-white transition-colors hover:bg-[#303031] disabled:opacity-60">Use OTP</button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 shadow-2xl">
            <p className="text-ui-label text-red-600">Danger Zone</p>
            <h2 className="mt-2 text-headline-md text-primary not-italic">Confirm account deletion</h2>
            <p className="mt-2 text-body-md text-blueprint-muted">
              Type your account email to confirm. This is intentionally strict so deletion cannot happen by accident.
            </p>
            <p className="mt-4 rounded-lg border border-blueprint-line bg-[#f5f3f3] px-4 py-3 font-mono text-body-md text-primary">{storedUser?.email}</p>
            <input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} className="mt-5 w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-red-500" placeholder="Type email to delete" />
            {deleteMessage ? <p className="mt-3 text-sm text-red-600">{deleteMessage}</p> : null}
            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDeleteOpen(false)} className="rounded-full border border-blueprint-line px-5 py-2.5 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">Cancel</button>
              <button type="button" onClick={handleDelete} disabled={deleteConfirmation.toLowerCase() !== String(storedUser?.email ?? '').toLowerCase()} className="rounded-full bg-red-600 px-5 py-2.5 text-ui-label text-white transition-colors hover:bg-red-700 disabled:opacity-50">Delete Permanently</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { clearSessionState, getStoredUser, persistSessionUser } from '../lib/session';
import { View } from '../App';

interface SettingsProps {
  onViewChange?: (view: View) => void;
  initialTab?: string;
}

export default function Settings({ onViewChange, initialTab = 'profile' }: SettingsProps) {
  const user = getStoredUser();
  const [activeTab, setActiveTab] = useState(initialTab === 'preferences' ? 'preferences' : 'profile');
  const [name, setName] = useState(user?.name ?? '');
  const [profileMessage, setProfileMessage] = useState<string | null>(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [theme, setTheme] = useState('light');
  const [preferenceMessage, setPreferenceMessage] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    void fetch('/api/users/preferences', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ sidebarOpen?: boolean; theme?: string }>;
      })
      .then((data) => {
        if (!data || ignore) return;
        if (typeof data.sidebarOpen === 'boolean') setSidebarExpanded(data.sidebarOpen);
        if (typeof data.theme === 'string') setTheme(data.theme);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, []);

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setProfileMessage(null);
    const response = await fetch('/api/users/me', {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setProfileMessage(String(data?.error ?? 'Unable to update your profile.'));
      return;
    }

    persistSessionUser({ ...user, name, loggedIn: true });
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
      body: JSON.stringify({ sidebarOpen: sidebarExpanded, theme }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setPreferenceMessage(String(data?.error ?? 'Unable to save preferences.'));
      return;
    }

    setPreferenceMessage('Preferences saved.');
  };

  const handleDelete = async () => {
    await fetch('/api/users/me', { method: 'DELETE', credentials: 'include' }).catch(() => undefined);
    await clearSessionState();
    onViewChange?.('landing');
  };

  return (
    <div className="min-h-full bg-background px-4 py-8 sm:px-8 lg:px-16">
      <div className="pointer-events-none fixed inset-0 blueprint-grid opacity-30" />
      <main className="relative z-10 mx-auto w-full max-w-6xl space-y-8">
        <header className="border-b border-blueprint-line pb-6">
          <h1 className="text-headline-lg text-primary">Settings</h1>
          <p className="mt-3 max-w-2xl text-body-lg text-blueprint-muted">
            Manage your account, password, and the small preferences that affect how you move through practice.
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
          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <h2 className="text-headline-md text-primary not-italic">Profile</h2>
              <form onSubmit={handleProfileSave} className="mt-6 space-y-6">
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">Full Name</label>
                  <input value={name} onChange={(event) => setName(event.target.value)} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">Email</label>
                  <input value={user?.email ?? ''} disabled className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-blueprint-muted outline-none" />
                </div>
                {profileMessage ? <p className="text-sm text-blueprint-muted">{profileMessage}</p> : null}
                <button type="submit" className="rounded-full bg-primary px-6 py-3 text-ui-label text-white transition-colors hover:bg-[#303031]">
                  Save Profile
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
              <h2 className="text-headline-md text-primary not-italic">Security</h2>
              <form onSubmit={handlePasswordChange} className="mt-6 space-y-6">
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">Current Password</label>
                  <input type="password" value={passwords.currentPassword} onChange={(event) => setPasswords((current) => ({ ...current, currentPassword: event.target.value }))} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">New Password</label>
                  <input type="password" value={passwords.newPassword} onChange={(event) => setPasswords((current) => ({ ...current, newPassword: event.target.value }))} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="mb-2 block text-ui-label text-blueprint-muted">Confirm New Password</label>
                  <input type="password" value={passwords.confirmPassword} onChange={(event) => setPasswords((current) => ({ ...current, confirmPassword: event.target.value }))} className="w-full border-0 border-b border-blueprint-line bg-transparent px-0 py-3 text-body-md text-primary outline-none focus:border-primary" />
                </div>
                {passwordMessage ? <p className="text-sm text-blueprint-muted">{passwordMessage}</p> : null}
                <button type="submit" className="rounded-full border border-blueprint-line px-6 py-3 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3]">
                  Update Password
                </button>
              </form>
            </section>

            <section className="rounded-3xl border border-red-200 bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)] lg:col-span-2">
              <h2 className="text-headline-md text-red-600 not-italic">Danger Zone</h2>
              <p className="mt-3 max-w-2xl text-body-md text-blueprint-muted">
                Delete your account and clear the saved prep state tied to it. This action is permanent.
              </p>
              <button type="button" onClick={handleDelete} className="mt-6 rounded-full border border-red-300 px-6 py-3 text-ui-label text-red-600 transition-colors hover:bg-red-50">
                Delete Account
              </button>
            </section>
          </div>
        ) : (
          <section className="rounded-3xl border border-blueprint-line bg-white/85 p-8 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <h2 className="text-headline-md text-primary not-italic">Preferences</h2>
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <div>
                <p className="text-ui-label text-blueprint-muted">Sidebar State</p>
                <div className="mt-3 flex items-center gap-3">
                  <button type="button" onClick={() => setSidebarExpanded(true)} className={`rounded-full px-5 py-2 text-ui-label ${sidebarExpanded ? 'bg-primary text-white' : 'border border-blueprint-line text-blueprint-muted'}`}>
                    Expanded
                  </button>
                  <button type="button" onClick={() => setSidebarExpanded(false)} className={`rounded-full px-5 py-2 text-ui-label ${!sidebarExpanded ? 'bg-primary text-white' : 'border border-blueprint-line text-blueprint-muted'}`}>
                    Collapsed
                  </button>
                </div>
              </div>

              <div>
                <p className="text-ui-label text-blueprint-muted">Theme Preference</p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {['light', 'system'].map((option) => (
                    <button key={option} type="button" onClick={() => setTheme(option)} className={`rounded-full px-5 py-2 text-ui-label ${theme === option ? 'bg-primary text-white' : 'border border-blueprint-line text-blueprint-muted'}`}>
                      {option}
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
    </div>
  );
}

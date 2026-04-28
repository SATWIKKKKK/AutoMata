import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Plug, CreditCard, CheckCircle2, XCircle, Clock,
  ExternalLink, AlertTriangle, X,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { clearSessionState, getStoredUser, persistSessionUser } from '../lib/session';
import { useSearchParams } from 'react-router-dom';

// ─── helpers ──────────────────────────────────────────────────────────────────

function getUser() {
  return getStoredUser();
}
function saveUser(data: any) {
  persistSessionUser(data);
}

type SettingsTab = 'profile' | 'integrations' | 'billing';

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'integrations', label: 'Integrations', icon: Plug },
  { id: 'billing', label: 'Billing', icon: CreditCard },
];

// ─── Profile Tab ──────────────────────────────────────────────────────────────

function ProfileTab({ onSignOut }: { onSignOut: () => void }) {
  const user = getUser();
  const [name, setName] = useState(user?.name ?? '');
  const [profileMsg, setProfileMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) {
      setProfileMsg({ ok: false, text: 'Name must be at least 2 characters.' });
      return;
    }
    try {
      await fetch('/api/users/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
    } catch { /* ignore */ }
    saveUser({ ...getUser(), name: name.trim() });
    setProfileMsg({ ok: true, text: 'Profile updated successfully.' });
    setTimeout(() => setProfileMsg(null), 3000);
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' }); return; }
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: 'Passwords do not match.' }); return; }
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const data = await res.json();
      if (!res.ok) { setPwMsg({ ok: false, text: data.error ?? 'Failed to update password.' }); return; }
    } catch { /* localStorage auth — no real backend */ }
    setPwMsg({ ok: true, text: 'Password updated.' });
    setCurrentPw(''); setNewPw(''); setConfirmPw('');
    setTimeout(() => setPwMsg(null), 3000);
  };

  const handleDeleteConfirm = async () => {
    if (deleteConfirmEmail !== user?.email) { setDeleteError('Email address does not match.'); return; }
    try { await fetch('/api/users/me', { method: 'DELETE' }); } catch { /* ignore */ }
    clearSessionState();
    onSignOut();
  };

  return (
    <div className="space-y-12">
      {/* Personal Information */}
      <section>
        <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-1">Personal Information</h3>
        <p className="font-body-md text-body-md text-blueprint-muted mb-6">Update your display name. Email cannot be changed here.</p>
        <form onSubmit={handleProfileSave} className="space-y-6 max-w-md">
          <div>
            <label className="block font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-wider text-[10px] mb-2">Full Name</label>
            <input value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-transparent border-0 border-b border-outline-variant pb-2 font-body-lg text-body-lg text-on-surface focus:border-primary focus:outline-none transition-colors"
              placeholder="Jane Doe" required />
          </div>
          <div>
            <label className="block font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-wider text-[10px] mb-2">Email</label>
            <input value={user?.email ?? ''} disabled
              className="w-full bg-transparent border-0 border-b border-outline-variant/50 pb-2 font-body-lg text-body-lg text-blueprint-muted cursor-not-allowed opacity-60" />
            <p className="text-[10px] text-blueprint-muted mt-1 font-technical-mono">Email cannot be changed.</p>
          </div>
          {profileMsg && (
            <div className={cn('flex items-center gap-2 font-ui-label text-ui-label', profileMsg.ok ? 'text-green-600' : 'text-red-500')}>
              {profileMsg.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {profileMsg.text}
            </div>
          )}
          <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors">
            Save Changes
          </button>
        </form>
      </section>

      {/* Change Password */}
      <section className="border-t border-blueprint-line pt-12">
        <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-1">Change Password</h3>
        <p className="font-body-md text-body-md text-blueprint-muted mb-6">Use a strong password with at least 8 characters.</p>
        <form onSubmit={handlePasswordChange} className="space-y-6 max-w-md">
          {[
            { id: 'cur', label: 'Current Password', val: currentPw, set: setCurrentPw },
            { id: 'new', label: 'New Password', val: newPw, set: setNewPw },
            { id: 'con', label: 'Confirm New Password', val: confirmPw, set: setConfirmPw },
          ].map(f => (
            <div key={f.id}>
              <label className="block font-technical-mono text-technical-mono text-on-surface-variant uppercase tracking-wider text-[10px] mb-2">{f.label}</label>
              <input type={showPw ? 'text' : 'password'} value={f.val} onChange={e => f.set(e.target.value)}
                className="w-full bg-transparent border-0 border-b border-outline-variant pb-2 font-body-lg text-body-lg text-on-surface focus:border-primary focus:outline-none transition-colors"
                placeholder="••••••••" required />
            </div>
          ))}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={showPw} onChange={e => setShowPw(e.target.checked)} className="rounded" />
            <span className="font-ui-label text-ui-label text-blueprint-muted">Show passwords</span>
          </label>
          {pwMsg && (
            <div className={cn('flex items-center gap-2 font-ui-label text-ui-label', pwMsg.ok ? 'text-green-600' : 'text-red-500')}>
              {pwMsg.ok ? <CheckCircle2 size={14} /> : <XCircle size={14} />} {pwMsg.text}
            </div>
          )}
          <button type="submit" className="bg-primary text-on-primary px-6 py-2.5 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors">
            Update Password
          </button>
        </form>
      </section>

      {/* Danger Zone */}
      <section className="border-t border-blueprint-line pt-12">
        <h3 className="font-headline-md text-headline-md text-red-600 mb-1">Danger Zone</h3>
        <p className="font-body-md text-body-md text-blueprint-muted mb-6 max-w-lg">
          Permanently delete your account and all workflows. This cannot be undone.
        </p>
        <button onClick={() => setShowDeleteModal(true)}
          className="border border-red-300 text-red-600 px-6 py-2.5 rounded-full font-ui-label text-ui-label hover:bg-red-50 transition-colors">
          Delete my account
        </button>
      </section>

      {/* Delete modal */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setShowDeleteModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 max-w-md w-full shadow-2xl"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-start gap-3 mb-6">
                <AlertTriangle size={20} className="text-red-600 mt-0.5 shrink-0" />
                <div>
                  <h4 className="font-headline-md text-headline-md text-primary">Delete Account</h4>
                  <p className="font-body-md text-body-md text-blueprint-muted mt-1">
                    Type your email <strong>{user?.email}</strong> to confirm.
                  </p>
                </div>
                <button onClick={() => setShowDeleteModal(false)} className="ml-auto text-blueprint-muted hover:text-primary"><X size={18} /></button>
              </div>
              <input value={deleteConfirmEmail} onChange={e => { setDeleteConfirmEmail(e.target.value); setDeleteError(''); }}
                placeholder={user?.email ?? ''}
                className="w-full border border-outline-variant rounded-lg px-4 py-3 font-body-md text-body-md text-on-surface focus:border-red-400 focus:outline-none transition-colors mb-3" />
              {deleteError && <p className="text-xs text-red-500 mb-3 font-ui-label">{deleteError}</p>}
              <div className="flex gap-3">
                <button onClick={() => setShowDeleteModal(false)}
                  className="flex-1 border border-outline-variant rounded-full py-2.5 font-ui-label text-ui-label text-on-surface hover:bg-surface-container transition-colors">Cancel</button>
                <button onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-600 text-white rounded-full py-2.5 font-ui-label text-ui-label hover:bg-red-700 transition-colors">Delete Forever</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Integrations Tab ─────────────────────────────────────────────────────────

type IntStatus = 'connected' | 'disconnected';
type IntMode = 'oauth' | 'env';
type IntSource = 'oauth' | 'env';

interface Integration {
  id: string; label: string; description: string; icon: string;
  mode: IntMode; envVar?: string;
  status: IntStatus; account?: string; connectedAt?: string; source?: IntSource;
}

const BASE_INTEGRATIONS: Integration[] = [
  { id: 'gmail', label: 'Gmail', description: 'Send emails and read your inbox via OAuth.', icon: '📧', mode: 'oauth', status: 'disconnected' },
  { id: 'google_sheets', label: 'Google Sheets', description: 'Read and write spreadsheet data.', icon: '📊', mode: 'oauth', status: 'disconnected' },
  { id: 'slack', label: 'Slack', description: 'Post messages to channels and DMs.', icon: '💬', mode: 'env', envVar: 'SLACK_BOT_TOKEN', status: 'disconnected' },
  { id: 'notion', label: 'Notion', description: 'Create and update pages in your workspace.', icon: '📝', mode: 'env', envVar: 'NOTION_TOKEN', status: 'disconnected' },
];

function IntegrationsTab() {
  const [searchParams] = useSearchParams();
  const [integrations, setIntegrations] = useState<Integration[]>(BASE_INTEGRATIONS);
  const [disconnecting, setDisconnecting] = useState<string | null>(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState<Integration | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const refreshIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations');
      const data = await response.json();
      if (!Array.isArray(data)) {
        setIntegrations(BASE_INTEGRATIONS);
        return;
      }

      setIntegrations(BASE_INTEGRATIONS.map((intg) => {
        const found = data.find((entry: any) => entry.provider === intg.id);
        if (found) {
          return {
            ...intg,
            status: 'connected' as IntStatus,
            account: found.account,
            connectedAt: found.connected_at,
            source: found.source === 'env' ? 'env' : 'oauth',
          };
        }
        return {
          ...intg,
          status: 'disconnected' as IntStatus,
          account: undefined,
          connectedAt: undefined,
          source: undefined,
        };
      }));
    } catch {
      setIntegrations(BASE_INTEGRATIONS);
    }
  };

  useEffect(() => {
    void refreshIntegrations();
  }, []);

  useEffect(() => {
    const connectedProvider = searchParams.get('connected');
    if (connectedProvider) {
      const matched = BASE_INTEGRATIONS.find((integration) => integration.id === connectedProvider);
      if (matched) {
        setStatusMessage(`${matched.label} integration connected successfully.`);
      } else if (connectedProvider === 'google') {
        setStatusMessage('Google integrations connected successfully.');
      }
      void refreshIntegrations();
    }
  }, [searchParams]);

  const handleDisconnect = async (intg: Integration) => {
    setDisconnecting(intg.id);
    const response = await fetch(`/api/integrations/${intg.id}`, { method: 'DELETE' }).catch(() => null);
    if (response && !response.ok) {
      const payload = await response.json().catch(() => ({}));
      setStatusMessage(payload?.error || `${intg.label} cannot be disconnected from UI.`);
      setDisconnecting(null);
      setConfirmDisconnect(null);
      return;
    }
    await refreshIntegrations();
    setDisconnecting(null); setConfirmDisconnect(null);
  };

  return (
    <div>
      <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-1">Connected Integrations</h3>
      <p className="font-body-md text-body-md text-blueprint-muted mb-8">Connect external services to enable automated workflows.</p>
      {statusMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          <CheckCircle2 size={16} />
          {statusMessage}
        </div>
      )}
      <div className="space-y-4">
        {integrations.map(intg => (
          <div key={intg.id} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 bg-surface-container-lowest border border-blueprint-line rounded-xl hover:shadow-sm transition-shadow">
            <div className="flex items-start sm:items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-xl bg-blueprint-bg border border-blueprint-line flex items-center justify-center text-2xl">{intg.icon}</div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-ui-label text-ui-label text-primary">{intg.label}</span>
                  {intg.status === 'connected' && <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[10px] font-technical-mono rounded-full border border-green-200 uppercase">Connected</span>}
                  {intg.status === 'connected' && intg.source === 'env' && (
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-technical-mono rounded-full border border-blue-200 uppercase">Env Managed</span>
                  )}
                </div>
                <p className="font-body-md text-body-md text-blueprint-muted text-xs">{intg.description}</p>
                {intg.account && <p className="text-[10px] font-technical-mono text-blueprint-muted mt-0.5">{intg.account}</p>}
                {intg.status === 'disconnected' && intg.mode === 'env' && intg.envVar && (
                  <p className="text-[10px] font-technical-mono text-blueprint-muted mt-0.5">Set {intg.envVar} in .env and restart the server.</p>
                )}
              </div>
            </div>
            <div className="shrink-0 sm:text-right">
              {intg.status === 'connected' && intg.source !== 'env' && (
                <button onClick={() => setConfirmDisconnect(intg)} disabled={disconnecting === intg.id}
                  className="text-xs border border-red-200 text-red-600 px-4 py-2 rounded-full font-ui-label hover:bg-red-50 transition-colors disabled:opacity-50">
                  {disconnecting === intg.id ? 'Disconnecting…' : 'Disconnect'}
                </button>
              )}
              {intg.status === 'connected' && intg.source === 'env' && (
                <span className="inline-block text-xs border border-blue-200 text-blue-700 px-4 py-2 rounded-full font-ui-label bg-blue-50">Managed in .env</span>
              )}
              {intg.status === 'disconnected' && (
                intg.mode === 'oauth' ? (
                  <button onClick={() => { window.location.href = `/api/integrations/connect/${intg.id}`; }}
                    className="text-xs border border-outline-variant text-primary px-4 py-2 rounded-full font-ui-label hover:bg-surface-container transition-colors flex items-center gap-1.5">
                    Connect <ExternalLink size={11} />
                  </button>
                ) : (
                  <button disabled className="text-xs border border-blueprint-line text-blueprint-muted px-4 py-2 rounded-full font-ui-label cursor-not-allowed">Configure in .env</button>
                )
              )}
            </div>
          </div>
        ))}
      </div>
      <AnimatePresence>
        {confirmDisconnect && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setConfirmDisconnect(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 max-w-sm w-full" onClick={e => e.stopPropagation()}>
              <h4 className="font-headline-md text-headline-md text-primary mb-2">Disconnect {confirmDisconnect.label}?</h4>
              <p className="font-body-md text-body-md text-blueprint-muted mb-6">Workflows using this integration will stop working until reconnected.</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDisconnect(null)} className="flex-1 border border-outline-variant rounded-full py-2.5 font-ui-label text-ui-label hover:bg-surface-container transition-colors">Cancel</button>
                <button onClick={() => handleDisconnect(confirmDisconnect)} className="flex-1 bg-red-600 text-white rounded-full py-2.5 font-ui-label text-ui-label hover:bg-red-700 transition-colors">Disconnect</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Billing Tab ──────────────────────────────────────────────────────────────

function BillingTab() {
  const user = getUser();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const runsUsed = 47; const runsLimit = 50;
  const usagePct = Math.min((runsUsed / runsLimit) * 100, 100);

  return (
    <div className="space-y-12">
      {/* Current Plan */}
      <section>
        <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-6">Current Plan</h3>
        <div className="bg-surface-container-lowest border border-blueprint-line rounded-xl p-8 max-w-lg space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-display-xl text-display-xl text-primary leading-none">Starter</span>
              <span className="ml-3 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-technical-mono rounded-full border border-green-200 uppercase">Active</span>
            </div>
            <span className="font-body-md text-body-md text-blueprint-muted">Free tier</span>
          </div>
          <div>
            <div className="flex justify-between items-center mb-2">
              <span className="font-ui-label text-ui-label text-on-surface-variant">Runs this month</span>
              <span className="font-technical-mono text-technical-mono text-primary">{runsUsed} / {runsLimit}</span>
            </div>
            <div className="h-2 bg-blueprint-line rounded-full overflow-hidden">
              <div className={cn('h-full rounded-full transition-all', usagePct > 85 ? 'bg-red-500' : 'bg-blueprint-accent')} style={{ width: `${usagePct}%` }} />
            </div>
            {usagePct > 85 && <p className="text-xs text-red-500 mt-1 font-ui-label">Approaching limit — upgrade to avoid disruption.</p>}
          </div>
          <div className="flex items-center justify-between border-t border-blueprint-line pt-4">
            <span className="font-ui-label text-ui-label text-blueprint-muted">Next billing date</span>
            <span className="font-technical-mono text-technical-mono text-blueprint-muted">N/A (free plan)</span>
          </div>
        </div>
      </section>

      {/* Upgrade */}
      <section className="border-t border-blueprint-line pt-12">
        <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-6">Upgrade Plan</h3>
        <div className="bg-surface-container-lowest border border-primary rounded-xl p-8 max-w-lg relative">
          <div className="absolute -top-3 left-6 bg-primary text-on-primary px-4 py-1 rounded-full font-technical-mono text-technical-mono uppercase text-[10px]">Most Popular</div>
          <h4 className="font-headline-md text-headline-md text-primary mt-2 mb-1">Professional</h4>
          <p className="font-body-md text-body-md text-blueprint-muted mb-4">Unlimited workflows, 50K runs/month, Claude + Gemini, priority support.</p>
          <div className="mb-6">
            <span className="font-display-xl text-display-xl text-primary">₹999</span>
            <span className="font-body-md text-body-md text-blueprint-muted">/month</span>
          </div>
          <button onClick={() => setShowUpgradeModal(true)} className="w-full bg-primary text-on-primary py-3 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors">
            Upgrade to Pro
          </button>
        </div>
      </section>

      {/* Invoice history */}
      <section className="border-t border-blueprint-line pt-12">
        <h3 className="font-headline-md text-headline-md text-blueprint-accent mb-6">Invoice History</h3>
        <div className="text-center py-12 border border-dashed border-blueprint-line rounded-xl">
          <Clock size={32} className="mx-auto text-blueprint-muted mb-3 opacity-40" />
          <p className="font-body-md text-body-md text-blueprint-muted">No invoices yet.</p>
          <p className="font-technical-mono text-technical-mono text-blueprint-muted mt-1 text-xs opacity-60">Payment via Razorpay coming soon.</p>
        </div>
      </section>

      {/* Upgrade modal */}
      <AnimatePresence>
        {showUpgradeModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowUpgradeModal(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl" onClick={e => e.stopPropagation()}>
              <div className="text-4xl mb-4">🚀</div>
              <h4 className="font-headline-md text-headline-md text-primary mb-3">Payment Coming Soon</h4>
              <p className="font-body-md text-body-md text-blueprint-muted mb-6">
                Razorpay payment integration coming soon.<br />
                We'll notify you at <strong>{user?.email ?? 'your email'}</strong> when billing goes live.
              </p>
              <button onClick={() => setShowUpgradeModal(false)} className="w-full bg-primary text-on-primary py-3 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors">
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main Settings ────────────────────────────────────────────────────────────

export default function Settings({ onViewChange, initialTab = 'profile' }: { onViewChange?: (v: any) => void; initialTab?: SettingsTab }) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  return (
    <div className="flex flex-col h-full bg-blueprint-bg overflow-hidden">
      {/* Horizontal tab bar */}
      <div className="flex items-end gap-1 border-b border-blueprint-line bg-surface-container-lowest px-4 sm:px-6 lg:px-8 pt-6 sm:pt-8 shrink-0 overflow-x-auto">
        <div className="mr-4 sm:mr-8 pb-3 shrink-0">
          <h2 className="font-display-xl text-display-xl text-blueprint-accent leading-tight">Settings</h2>
        </div>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 sm:px-5 py-3 font-ui-label text-ui-label border-b-2 transition-all rounded-t-md shrink-0',
              activeTab === tab.id
                ? 'border-blueprint-accent text-blueprint-accent bg-blueprint-line/20'
                : 'border-transparent text-blueprint-muted hover:text-primary hover:bg-blueprint-line/10',
            )}
          >
            <tab.icon size={16} className="shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-12 py-6 sm:py-10">
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.18 }}>
              {activeTab === 'profile' && <ProfileTab onSignOut={() => onViewChange?.('landing')} />}
              {activeTab === 'integrations' && <IntegrationsTab />}
              {activeTab === 'billing' && <BillingTab />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Search, X, Send, Plus, MoreHorizontal, Play, Pause,
  Trash2, Edit3, ChevronDown, Clock, DollarSign, Zap,
  FileText, AlertCircle,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../App';

// ─── Types ─────────────────────────────────────────────────────────────────

interface Workflow {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'paused' | 'draft' | 'generating' | 'ready' | 'failed';
  generationError?: string | null;
  prompt?: string;
  created_at: string;
  last_run?: string;
  cost_last_run?: number;
  next_run?: string;
  cron_schedule?: string;
}

type FilterTab = 'All' | 'Active' | 'Paused' | 'Draft';

interface BuilderProps {
  onViewChange: (view: View) => void;
}

// ─── Chip prompts ───────────────────────────────────────────────────────────

const CHIPS: { label: string; prompt: string }[] = [
  {
    label: 'Weekly Sales Report',
    prompt:
      "Every Monday at 9AM, read my Google Sheet 'Weekly Sales Tracker', summarize last 7 days revenue and product performance, write a clean business email under 150 words, and send it to team@company.com",
  },
  {
    label: 'Lead Auto-Enrich',
    prompt:
      "When a new row appears in my Google Sheet 'New Leads', look up the company using the domain column, add employee count and industry to the sheet, then create a HubSpot contact and send a welcome email via Gmail",
  },
  {
    label: 'Client Follow-up',
    prompt:
      "Every Friday at 5PM, check HubSpot for deals with no activity in the last 7 days, write a personalized follow-up email for each, and send them via Gmail",
  },
  {
    label: 'Monthly Board Summary',
    prompt:
      "On the 1st of every month at 8AM, pull last month's revenue data from my Google Sheet, write a 300-word executive summary, create a page in Notion, and send the link to ceo@company.com",
  },
  {
    label: 'Invoice Reminder',
    prompt:
      "Every Monday, check my Google Sheet 'Invoices' for rows where Status is 'Unpaid' and Due Date is past, and send a polite reminder email to the client email column for each row",
  },
  {
    label: 'Slack Digest',
    prompt:
      "Every weekday at 9AM, summarize the top 5 action items from yesterday's activity across my workflows and post a digest message to my #team-updates Slack channel",
  },
];

// ─── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Workflow['status'] }) {
  const map = {
    active: 'bg-green-100 text-green-800 border border-green-200',
    paused: 'bg-yellow-100 text-yellow-800 border border-yellow-200',
    draft: 'bg-gray-100 text-gray-600 border border-gray-200',
    ready: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    generating: 'bg-blue-100 text-blue-800 border border-blue-200',
    failed: 'bg-red-100 text-red-700 border border-red-200',
  };
  return (
    <span className={cn('text-xs px-2 py-0.5 rounded-full font-medium capitalize', map[status])}>
      {status}
    </span>
  );
}

// ─── Workflow card ────────────────────────────────────────────────────────────

function WorkflowCard({
  workflow,
  onNavigate,
  onStatusToggle,
  onDelete,
}: {
  workflow: Workflow;
  onNavigate: () => void;
  onStatusToggle: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96 }}
      className="bg-surface-container-lowest border border-outline-variant rounded-xl p-6 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onNavigate}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h3 className="font-semibold text-primary text-base truncate">{workflow.name}</h3>
            <StatusBadge status={workflow.status} />
          </div>
          <p className={cn('text-sm line-clamp-2 mb-4', workflow.status === 'failed' ? 'text-red-600' : 'text-on-surface-variant')}>
            {workflow.description || workflow.generationError || 'No description'}
          </p>

          <div className="flex flex-wrap gap-4 text-xs text-on-surface-variant">
            <span className="flex items-center gap-1">
              <Clock size={12} />
              Last run: {workflow.last_run ?? 'Never'}
            </span>
            {workflow.cost_last_run != null && (
              <span className="flex items-center gap-1">
                <DollarSign size={12} />
                ₹{workflow.cost_last_run.toFixed(2)}
              </span>
            )}
            <span className="flex items-center gap-1">
              <Zap size={12} />
              Next: {workflow.next_run ?? 'Manual only'}
            </span>
          </div>
        </div>

        {/* Three-dot menu */}
        <div className="relative shrink-0" ref={menuRef} onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={16} />
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                className="absolute right-0 top-8 w-40 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-lg py-1 z-20"
              >
                <button
                  onClick={onNavigate}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-surface-container text-on-surface"
                >
                  <Edit3 size={13} /> Edit
                </button>
                <button
                  onClick={onStatusToggle}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-surface-container text-on-surface"
                >
                  {workflow.status === 'active' ? <Pause size={13} /> : <Play size={13} />}
                  {workflow.status === 'active' ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={onDelete}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm hover:bg-red-50 text-red-600"
                >
                  <Trash2 size={13} /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function Builder({ onViewChange }: BuilderProps) {
  const navigate = useNavigate();
  // Terminal input
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const MAX_CHARS = 500;
  const chipsRef = useRef<HTMLDivElement>(null);

  // Workflow list
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loadingWorkflows, setLoadingWorkflows] = useState(true);

  // Search + filter
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('All');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Load workflows on mount ─────────────────────────────────────────────
  useEffect(() => {
    setLoadingWorkflows(true);
    fetch('/api/workflows')
      .then(r => r.json())
      .then((data: { workflows?: Workflow[] }) => setWorkflows(Array.isArray(data?.workflows) ? data.workflows : []))
      .catch(() => setWorkflows([]))
      .finally(() => setLoadingWorkflows(false));
  }, []);

  // ── Keyboard shortcut: Escape clears search ─────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') setSearch('');
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Filtered + searched workflows ───────────────────────────────────────
  const displayedWorkflows = useMemo(() => {
    let list = workflows;
    if (activeTab !== 'All') list = list.filter(w => w.status === activeTab.toLowerCase());
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        w =>
          w.name.toLowerCase().includes(q) ||
          (w.description ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [workflows, search, activeTab]);

  // ── Generate workflow via API ────────────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    const safePrompt = prompt.trim();
    if (isGenerating) return;
    if (safePrompt.length < 20) {
      setGenError('Please describe your workflow in more detail (at least 20 characters)');
      return;
    }

    setIsGenerating(true);
    setGenError(null);

    try {
      const res = await fetch('/api/workflows/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: safePrompt }),
      });
      const raw = await res.text();
      let data: any = null;
      if (raw) {
        try {
          data = JSON.parse(raw);
        } catch {
          throw new Error(`Workflow generation endpoint returned a non-JSON response (HTTP ${res.status}). Make sure you are on the current dev server.`);
        }
      }
      if (!res.ok) {
        setGenError(data?.error ?? `Failed to start generation (HTTP ${res.status})`);
        setIsGenerating(false);
        return;
      }

      if (!data?.workflowId) {
        throw new Error('Workflow generation endpoint returned an empty response. Refresh the app and try again.');
      }

      sessionStorage.setItem('orren-generating-prompt', safePrompt);

      const goToWorkflow = () => navigate(`/workflows/${data.workflowId}?status=generating`);
      const transitionDoc = document as Document & { startViewTransition?: (callback: () => void) => void };

      if (transitionDoc.startViewTransition) {
        transitionDoc.startViewTransition(goToWorkflow);
      } else {
        setIsTransitioning(true);
        window.setTimeout(goToWorkflow, 400);
      }
    } catch (err: any) {
      setIsGenerating(false);
      setIsTransitioning(false);
      setGenError(err.message ?? 'Network error. Please try again.');
    }
  }, [isGenerating, navigate, prompt]);

  // ── Status toggle ───────────────────────────────────────────────────────
  const toggleStatus = useCallback(async (wf: Workflow) => {
    const newStatus = wf.status === 'active' ? 'paused' : 'active';
    setWorkflows(prev => prev.map(w => (w.id === wf.id ? { ...w, status: newStatus } : w)));
    await fetch(`/api/workflows/${wf.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    }).catch(() => {});
  }, []);

  // ── Delete ──────────────────────────────────────────────────────────────
  const deleteWorkflow = useCallback(async (id: string) => {
    setWorkflows(prev => prev.filter(w => w.id !== id));
    await fetch(`/api/workflows/${id}`, { method: 'DELETE' }).catch(() => {});
  }, []);

  const TABS: FilterTab[] = ['All', 'Active', 'Paused', 'Draft'];

  return (
    <div className="min-h-full bg-background overflow-y-auto">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-8">

        {/* ── Part 1: Top Bar ─────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <span className="font-technical-mono text-technical-mono text-blueprint-muted uppercase tracking-widest">
              Workflow Builder
            </span>
            <h1 className="font-display-xl text-display-xl text-primary leading-tight mt-1">
              Build anything.<br />
              <span className="italic text-blueprint-muted">Autonomously.</span>
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-2">Describe your workflow in plain English and let AI do the rest</p>
          </div>
          <button
            onClick={() => { setPrompt(''); setCharCount(0); setTimeout(() => document.getElementById('builder-prompt')?.focus(), 100); }}
            className="flex items-center gap-2 bg-primary text-on-primary px-5 py-2.5 rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors shrink-0 mt-2"
          >
            <Plus size={16} /> New Workflow
          </button>
        </div>

        {/* ── Part 2: Search Bar ──────────────────────────────────────────── */}
        <div className="w-full">
          <div className="flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-full px-5 py-3 shadow-sm focus-within:border-primary transition-colors">
            <Search size={16} className="text-on-surface-variant shrink-0" />
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search workflows by name or description..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-on-surface-variant outline-none"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-on-surface-variant hover:text-primary transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          {search && (
            <p className="text-xs text-on-surface-variant mt-2 pl-2">
              Showing {displayedWorkflows.length} of {workflows.length} workflow{workflows.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {/* ── Part 3: Terminal Input ──────────────────────────────────────── */}
        <div>
          <div
            className={cn(
              'bg-[#111] rounded-2xl overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.15)] border border-transparent transition-all duration-300',
              isGenerating && 'animate-[workflowPulse_1.5s_ease-in-out_infinite]',
              isTransitioning && 'workflow-card-expand fixed inset-0 z-50 rounded-none',
            )}
            style={{ viewTransitionName: 'workflow-card' }}
          >
            {/* Terminal header bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
              <div className="w-3 h-3 rounded-full bg-red-500/60" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
              <div className="w-3 h-3 rounded-full bg-green-500/60" />
              <span className="ml-3 text-xs text-white/30 font-mono">automata — workflow generator</span>
            </div>

            {/* Input area */}
            <div className="p-5 sm:p-6">
              <div className="relative">
                <textarea
                  id="builder-prompt"
                  value={prompt}
                  onChange={e => {
                    if (e.target.value.length <= MAX_CHARS) {
                      setPrompt(e.target.value);
                      setCharCount(e.target.value.length);
                    }
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleGenerate(); }
                  }}
                  disabled={isGenerating}
                  rows={4}
                  placeholder={`Describe your workflow in plain English...\ne.g. Every Monday 9AM, read my Google Sheet and email a summary to my team.`}
                  className="w-full bg-transparent text-[#d4d4d4] font-mono text-sm placeholder:text-white/20 resize-none border-none focus:ring-0 outline-none leading-relaxed"
                />
              </div>

              {/* Bottom bar */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/5">
                <div className="flex items-center gap-3 text-white/30">
                  <button className="hover:text-white/60 transition-colors p-1 rounded" title="Attach file">
                    <FileText size={16} />
                  </button>
                  <button className="hover:text-white/60 transition-colors p-1 rounded" title="AI suggestions">
                    <Zap size={16} />
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <span className={cn('text-xs font-mono', charCount > 400 ? 'text-red-400' : 'text-white/30')}>
                    {charCount} / {MAX_CHARS}
                  </span>
                  <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim()}
                    className="flex items-center gap-2 bg-white text-black px-5 py-2 rounded-full text-sm font-semibold hover:bg-gray-100 transition-colors disabled:opacity-40"
                  >
                    {isGenerating ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                        Generating…
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Generate Workflow
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {genError && (
              <div className="px-6 pb-4 flex items-center gap-2 text-red-400 text-sm font-mono">
                <AlertCircle size={14} />
                {genError}
              </div>
            )}
          </div>

          {isGenerating && (
            <p className="mt-3 text-center text-sm text-blueprint-muted">Taking you to your workflow...</p>
          )}

          {/* ── Chip suggestions ── */}
          <div ref={chipsRef} className="mt-4 space-y-2">
            <div className="flex flex-wrap gap-2">
              {CHIPS.map(chip => (
                <button
                  key={chip.label}
                  onClick={() => { setPrompt(chip.prompt); setCharCount(chip.prompt.length); }}
                  disabled={isGenerating}
                  className="bg-surface-container border border-outline-variant rounded-full px-4 py-1.5 text-xs text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {chip.label}
                </button>
              ))}
            </div>
            <p className="font-body-md text-body-md text-on-surface-variant pl-1">
              Click a template to prefill the prompt above, then customise and generate.
            </p>
          </div>
        </div>

        {/* ── Part 4 + 5: Workflow List with Filter Tabs ─────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
            <h2 className="font-headline-md text-headline-md text-primary">Your Workflows</h2>

            {/* Filter tabs */}
            <div className="flex items-center bg-surface-container rounded-full p-1 gap-0.5">
              {TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'px-4 py-1.5 rounded-full font-ui-label text-ui-label transition-all',
                    activeTab === tab
                      ? 'bg-surface-container-lowest text-primary shadow-sm border border-outline-variant'
                      : 'text-on-surface-variant hover:text-primary',
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {loadingWorkflows ? (
            <div className="flex items-center justify-center py-20 text-on-surface-variant">
              <div className="w-5 h-5 border-2 border-outline-variant border-t-primary rounded-full animate-spin mr-3" />
              Loading workflows…
            </div>
          ) : displayedWorkflows.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-20 text-center"
            >
              <div className="text-5xl mb-4">🤖</div>
              <h3 className="text-base font-semibold text-primary mb-2">
                {search || activeTab !== 'All' ? 'No workflows match your filters' : 'No workflows yet'}
              </h3>
              <p className="text-sm text-on-surface-variant mb-6 max-w-xs">
                {search || activeTab !== 'All'
                  ? 'Try adjusting your search or filter.'
                  : 'Describe your first workflow above to get started.'}
              </p>
              {!search && activeTab === 'All' && (
                <button
                  onClick={() => chipsRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-sm text-primary border border-primary px-4 py-2 rounded-full hover:bg-surface-container transition-colors"
                >
                  See example workflows
                </button>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="grid grid-cols-1 gap-4">
                {displayedWorkflows.map(wf => (
                  <WorkflowCard
                    key={wf.id}
                    workflow={wf}
                    onNavigate={() => navigate(`/workflows/${wf.id}`)}
                    onStatusToggle={() => toggleStatus(wf)}
                    onDelete={() => deleteWorkflow(wf.id)}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}
        </div>

      </div>
    </div>
  );
}

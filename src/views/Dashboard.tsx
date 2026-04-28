import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Send, Terminal, Search } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorkflowDAG, generateWorkflowFromPrompt } from '../services/geminiService';

const ALL_SUGGESTIONS = [
  "Customer Outreach",
  "Internal Workflows",
  "Knowledge Hub",
  "Deal Tracker",
  "Growth Agent",
  "CRM Assistant",
  "Lead Enrichment",
  "Weekly Sales Report",
  "Client Follow-up",
  "Slack Daily Digest",
  "Email Automation",
  "Invoice Tracker",
];

interface DashboardProps {
  onWorkflowCreated: (dag: WorkflowDAG) => void;
  onViewChange: (view: any) => void;
}

export default function Dashboard({ onWorkflowCreated, onViewChange }: DashboardProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const filteredSuggestions = useMemo(
    () => ALL_SUGGESTIONS.filter(s => s.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    setIsGenerating(true);
    setError(null);
    try {
      const dag = await generateWorkflowFromPrompt(prompt);
      onWorkflowCreated(dag);
    } catch (err: any) {
      setError(err?.message ?? 'Generation failed. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-full bg-background blueprint-grid overflow-y-auto pb-16">
      <main className="pt-10 pb-24 px-4 sm:px-8 max-w-[1440px] mx-auto flex flex-col justify-center items-center relative z-10">

        {/* Hero */}
        <div className="text-center max-w-4xl mx-auto mb-10">
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl italic font-bold text-primary mb-4">
            Meet your first autonomous builder.
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Describe what you want to automate and Automata will build the workflow for you.
          </p>
        </div>

        {/* Search Bar */}
        <div className="w-full max-w-3xl mx-auto mb-5">
          <div className="flex items-center gap-3 bg-white border border-blueprint-line rounded-full px-5 py-3 shadow-sm">
            <Search size={18} className="text-blueprint-muted shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workflow templates..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm text-on-surface placeholder:text-blueprint-muted outline-none"
            />
          </div>
        </div>

        {/* Terminal Input */}
        <div className="w-full max-w-3xl mx-auto bg-surface-container-lowest rounded-xl p-2 shadow-[0_8px_30px_rgba(0,0,0,0.03)] mb-10 hover:-translate-y-1 transition-transform duration-300 border border-outline-variant">
          <div className="bg-surface-container-lowest rounded-lg p-5 sm:p-6 flex items-center gap-4 border border-outline-variant">
            <Terminal size={24} className="text-blueprint-muted shrink-0" />
            <div className="flex-1 relative">
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface font-mono text-sm placeholder:text-transparent outline-none"
                placeholder="Automate my client onboarding flow..."
              />
              {prompt === '' && (
                <>
                  <span className="absolute left-0 inline-block w-2 h-4 bg-[#3B82F6] ml-1 animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />
                  <span className="absolute left-0 text-blueprint-muted font-mono pointer-events-none opacity-60 text-sm truncate pr-8">
                    Automate my client onboarding flow and send progress reports weekly.
                  </span>
                </>
              )}
            </div>
            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="bg-primary text-on-primary p-2 rounded-lg hover:bg-inverse-surface transition-colors disabled:opacity-40 shrink-0"
            >
              <Send size={20} className={cn(isGenerating && 'animate-spin')} />
            </button>
          </div>
          {error && (
            <p className="mt-3 px-4 pb-3 text-red-400 font-mono text-sm">{error}</p>
          )}
        </div>

        {/* Suggestion Pills */}
        <div className="w-full max-w-4xl mx-auto flex flex-wrap justify-center gap-3">
          {filteredSuggestions.length === 0 ? (
            <p className="text-blueprint-muted text-sm py-4">No templates match "{search}".</p>
          ) : filteredSuggestions.map(s => (
            <button
              key={s}
              onClick={() => { setPrompt(s); setSearch(''); }}
              className="bg-surface-container rounded-full px-4 py-2 text-ui-label text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors border border-outline-variant text-sm"
            >
              {s}
            </button>
          ))}
        </div>

      </main>
    </div>
  );
}


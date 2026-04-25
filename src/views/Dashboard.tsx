import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, Sparkles, Terminal } from 'lucide-react';
import { cn } from '../lib/utils';
import { WorkflowDAG, generateWorkflowFromPrompt } from '../services/geminiService';

const suggestions = [
  "Customer Outreach",
  "Internal Workflows",
  "Knowledge Hub",
  "Deal Tracker",
  "Growth Agent",
  "CRM Assistant"
];

interface DashboardProps {
  onWorkflowCreated: (dag: WorkflowDAG) => void;
  onViewChange: (view: any) => void;
}

export default function Dashboard({ onWorkflowCreated, onViewChange }: DashboardProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    try {
      const dag = await generateWorkflowFromPrompt(prompt);
      onWorkflowCreated(dag);
    } catch (err) {
      console.error('Generation failed:', err);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-background relative blueprint-grid overflow-y-auto">
      {/* Top Navigation */}
      <nav className="fixed top-0 w-full z-50 border-b border-blueprint-line bg-white/90 backdrop-blur-sm">
        <div className="max-w-[1440px] mx-auto flex justify-between items-center px-8 h-16">
          <button 
            onClick={() => onViewChange('landing')}
            className="font-serif italic text-3xl text-primary tracking-tight"
          >
            Automata
          </button>
          
          <div className="hidden md:flex items-center space-x-8">
            <button onClick={() => onViewChange('landing')} className="text-ui-label text-on-surface-variant hover:text-primary transition-colors">Solutions</button>
            <button onClick={() => onViewChange('workflows')} className="text-ui-label text-on-surface-variant hover:text-primary transition-colors">Use Cases</button>
            <button onClick={() => onViewChange('docs')} className="text-ui-label text-on-surface-variant hover:text-primary transition-colors">Developers</button>
            <button onClick={() => onViewChange('analytics')} className="text-ui-label text-on-surface-variant hover:text-primary transition-colors">Resources</button>
            <button onClick={() => onViewChange('settings')} className="text-ui-label text-on-surface-variant hover:text-primary transition-colors">Pricing</button>
          </div>

          <div className="flex items-center space-x-4">
            <button 
              onClick={() => onViewChange('auth')}
              className="text-ui-label text-on-surface hover:text-primary transition-colors"
            >
              Login
            </button>
            <button onClick={() => onViewChange('signup')} className="bg-primary text-white font-ui-label text-ui-label px-6 py-2.5 rounded-full hover:bg-surface-tint transition-all active:scale-95">Get Started</button>
          </div>
        </div>
      </nav>

      <main className="pt-32 pb-24 px-8 max-w-[1440px] mx-auto min-h-screen flex flex-col justify-center items-center relative z-10">
        {/* Hero Section */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <h1 className="font-serif text-6xl italic font-bold text-primary mb-6">
            Meet your first autonomous builder.
          </h1>
          <p className="text-body-lg text-on-surface-variant max-w-2xl mx-auto">
            Automata translates your intent into complex, functional systems without writing a single line of code. Designed for operators, engineered for scale.
          </p>
        </div>

        {/* Terminal Input Area */}
        <div className="w-full max-w-3xl mx-auto bg-[#1c1b1b] rounded-xl p-2 shadow-[0_24px_60px_rgba(0,0,0,0.1)] relative group mb-12 transform hover:-translate-y-1 transition-transform duration-300">
          <div className="bg-[#1a1c1a] rounded-lg p-6 flex items-center space-x-4 border border-white/5">
            <Terminal size={24} className="text-[#858383]" />
            <div className="flex-1 relative">
              <input 
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
                className="w-full bg-transparent border-none focus:ring-0 text-[#858383] font-mono text-body-md placeholder:text-transparent"
                placeholder="Automate my client onboarding flow..."
              />
              {prompt === '' && (
                <span className="absolute left-0 inline-block w-2 h-4 bg-[#3B82F6] ml-1 animate-pulse top-1/2 -translate-y-1/2"></span>
              )}
              {prompt === '' && (
                <span className="absolute left-0 text-[#858383] font-mono pointer-events-none opacity-40">
                  Automate my client onboarding flow and send progress reports weekly.
                </span>
              )}
            </div>
            <button 
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="bg-white text-primary p-2 rounded-lg hover:bg-surface-container-low transition-colors"
            >
              <Send size={20} className={cn(isGenerating && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Suggestion Pills */}
        <div className="max-w-4xl mx-auto flex flex-col items-center gap-4">
          <div className="flex flex-wrap justify-center gap-3">
            {suggestions.slice(0, 3).map(s => (
              <button key={s} onClick={() => setPrompt(s)} className="bg-surface-container rounded-full px-4 py-2 text-ui-label text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors border border-outline-variant">
                {s}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {suggestions.slice(3).map(s => (
              <button key={s} onClick={() => setPrompt(s)} className="bg-surface-container rounded-full px-4 py-2 text-ui-label text-on-surface-variant hover:bg-surface-variant hover:text-primary transition-colors border border-outline-variant">
                {s}
              </button>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-surface-variant py-12 bg-white">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center px-8">
          <div className="mb-4 md:mb-0">
            <span className="font-serif text-3xl italic font-bold text-primary mr-4">Automata</span>
            <span className="text-technical-mono text-on-surface-variant uppercase tracking-widest text-[10px]">
              © 2026 Automata. Built for the autonomous age.
            </span>
          </div>
          <div className="flex space-x-6">
            {['Privacy Policy', 'Terms of Service', 'Security', 'Status'].map(item => (
              <button key={item} className="text-technical-mono text-on-surface-variant uppercase tracking-widest hover:text-primary transition-colors text-[10px]">{item}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}


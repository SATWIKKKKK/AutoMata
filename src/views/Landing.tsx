import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Layers,
  Zap,
  Repeat,
  Shield,
  Terminal,
  ChevronRight,
  Search,
  Maximize2,
  LogOut,
  Settings,
  ChevronDown,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { clearSessionState, getStoredUser } from '../lib/session';

function getInitials(name?: string, email?: string) {
  if (name) return name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return 'U';
}

interface LandingProps {
  onStart: () => void;
  onViewDocs: () => void;
  onViewChange: (view: any) => void;
}

export default function Landing({ onStart, onViewDocs, onViewChange }: LandingProps) {
  const user = getStoredUser();

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSignOut = () => {
    clearSessionState();
    setDropdownOpen(false);
    onViewChange('landing');
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Blueprint Grid Background */}
      <div className="fixed inset-0 blueprint-grid opacity-30 pointer-events-none"></div>

      {/* Top Navigation */}
      <nav className="sticky top-0 w-full z-50 border-b border-blueprint-line bg-white/80 backdrop-blur-md">
        <div className="max-w-[1440px] mx-auto flex items-center px-4 md:px-8 h-16 w-full relative">

          {/* Logo */}
          <div className="flex-shrink-0 z-10">
            <button
              onClick={() => onViewChange('landing')}
              className="font-serif italic text-2xl md:text-3xl text-primary tracking-tight"
            >
              AUTOMATA
            </button>
          </div>

          {/* Centre nav */}
          <div className="hidden lg:flex items-center gap-6 absolute left-1/2 -translate-x-1/2 z-0">
            <button onClick={() => onViewChange('workflows')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Solutions</button>
            <button onClick={() => onViewChange('docs')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Use Cases</button>
            <button onClick={() => onViewChange('docs')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Developers</button>
            <button onClick={() => onViewChange('pricing')} className="text-ui-label text-blueprint-muted hover:text-primary transition-colors whitespace-nowrap">Pricing</button>
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2 md:gap-4 ml-auto z-10">
            {user?.loggedIn ? (
              <>
                <button
                  onClick={() => onViewChange('builder')}
                  className="bg-black text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full text-ui-label hover:opacity-90 transition-all font-medium whitespace-nowrap"
                >
                  Dashboard
                </button>
                {/* Profile dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button
                    onClick={() => setDropdownOpen((o) => !o)}
                    className="flex items-center gap-1.5 focus:outline-none"
                  >
                    <div className="w-8 h-8 rounded-full border border-gray-200 bg-black flex items-center justify-center text-white font-bold text-xs select-none">
                      {getInitials(user?.name, user?.email)}
                    </div>
                    <ChevronDown size={14} className={cn('text-gray-500 transition-transform', dropdownOpen && 'rotate-180')} />
                  </button>
                  {dropdownOpen && (
                    <div className="absolute right-0 top-10 min-w-[180px] bg-white border border-gray-200 rounded-xl shadow-xl py-2 z-50">
                      {user?.name && <p className="px-4 py-1 text-sm font-semibold text-primary truncate">{user.name}</p>}
                      {user?.email && <p className="px-4 pb-2 text-xs text-gray-400 truncate border-b border-gray-100">{user.email}</p>}
                      <button
                        onClick={() => { setDropdownOpen(false); onViewChange('settings'); }}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings size={14} className="text-gray-400" />
                        Settings
                      </button>
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <LogOut size={14} className="text-gray-400" />
                        Sign out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button
                  onClick={() => onViewChange('auth')}
                  className="text-ui-label font-medium text-on-background px-2 md:px-4 hover:text-primary transition-colors"
                >
                  Login
                </button>
                <button
                  onClick={() => onViewChange('signup')}
                  className="bg-black text-white px-4 md:px-6 py-2 md:py-2.5 rounded-full text-ui-label hover:opacity-90 transition-all font-medium whitespace-nowrap"
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-24 px-8 max-w-[1440px] mx-auto text-center relative z-10">
        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           className="space-y-8"
        >
          <div className="inline-flex items-center gap-2 bg-blueprint-line/30 rounded-full px-4 py-1 border border-blueprint-line/50">
             <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
             <span className="text-technical-mono text-blueprint-muted uppercase font-bold">Platform Overview</span>
          </div>
          
          <h1 className="text-display-xl text-primary max-w-5xl mx-auto">
             Engineered for Precision.<br />
             <span className="italic text-blueprint-muted">Architected for Scale.</span>
          </h1>

          <p className="text-body-lg text-blueprint-muted max-w-2xl mx-auto leading-relaxed">
            The Automata Platform unifies multi-agent orchestration via LangGraph with the bulletproof durability of Temporal.io. 
            Build self-correcting AI loops that never drop state.
          </p>

          <div className="flex flex-col items-center gap-4 pt-4">
            <button 
              onClick={onStart}
              className="bg-primary text-white px-8 py-3.5 rounded-full text-ui-label flex items-center gap-2 hover:opacity-90 transition-all font-semibold uppercase tracking-widest"
            >
              Deploy Agents <ArrowRight size={18} />
            </button>
            <button 
              onClick={onViewDocs}
              className="border border-blueprint-line bg-white px-8 py-3.5 rounded-full text-ui-label hover:bg-blueprint-bg transition-all font-semibold uppercase tracking-widest"
            >
              Read the Docs
            </button>
          </div>
        </motion.div>
      </section>

      {/* Feature Blocks */}
      <section className="max-w-[1440px] mx-auto px-8 space-y-32 pb-32">
        {/* Orchestration */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <div className="text-technical-mono text-blueprint-muted opacity-60">01 / ORCHESTRATION</div>
            <h2 className="text-display-xl text-4xl font-serif">Graph-Based Intelligence</h2>
            <p className="text-body-md text-blueprint-muted text-lg leading-relaxed">
              Model complex cognitive architectures as directed cyclic graphs. LangGraph integration allows Automata to coordinate specialized agents, managing control flow and state transitions with mathematical precision.
            </p>
            <ul className="space-y-4">
              {[
                { icon: Layers, label: 'Cyclic State Management' },
                { icon: Terminal, label: 'Multi-Agent Collaboration' },
                { icon: Zap, label: 'Predictable Execution Paths' }
              ].map((li, i) => (
                <li key={i} className="flex items-center gap-3 text-technical-mono text-blueprint-muted">
                  <li.icon size={18} /> {li.label}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-blueprint-bg border border-blueprint-line rounded-2xl p-8 aspect-square flex items-center justify-center relative overflow-hidden group">
             <div className="absolute inset-0 blueprint-grid opacity-20"></div>
             <div className="relative z-10 w-full h-full border border-blueprint-line bg-white rounded-xl shadow-2xl flex items-center justify-center">
                <div className="space-y-8 flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full border border-blueprint-line flex items-center justify-center bg-white"><Layers size={20} /></div>
                  <div className="w-px h-16 bg-blueprint-line"></div>
                  <div className="flex gap-12">
                    <div className="w-10 h-10 rounded-full border border-blueprint-line flex items-center justify-center bg-white"><Search size={16} /></div>
                    <div className="w-10 h-10 rounded-full border border-blueprint-line flex items-center justify-center bg-white"><Zap size={16} /></div>
                    <div className="w-10 h-10 rounded-full border border-blueprint-line flex items-center justify-center bg-white"><Maximize2 size={16} /></div>
                  </div>
                </div>
             </div>
          </div>
        </div>

        {/* Durability */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
          <div className="order-2 md:order-1 bg-blueprint-bg border border-blueprint-line rounded-2xl p-12 aspect-square flex flex-col gap-4">
             <div className="bg-white border border-blueprint-line p-4 rounded-xl flex justify-between items-center text-technical-mono">
               <div className="flex items-center gap-2"><Repeat size={14} /> Workflow Initiated</div>
               <span className="opacity-40">00:00:00</span>
             </div>
             <div className="bg-white border border-blueprint-line p-6 rounded-xl space-y-4 shadow-sm translate-x-12">
               <div className="flex items-center gap-2 text-red-600 text-technical-mono"><Shield size={14} /> API TIMEOUT DETECTED</div>
               <div className="flex items-center justify-between text-technical-mono p-3 bg-blueprint-bg rounded-lg">
                 <div className="flex items-center gap-2"><Repeat size={14} className="animate-spin" /> Temporal Auto-Retry</div>
                 <span className="text-[10px] opacity-60 uppercase">State Restored</span>
               </div>
             </div>
             <div className="bg-primary text-white p-4 rounded-xl flex items-center justify-between text-technical-mono mt-auto">
               <div className="flex items-center gap-2"><Repeat size={14} /> Execution Complete</div>
             </div>
          </div>
          <div className="order-1 md:order-2 space-y-6">
            <div className="text-technical-mono text-blueprint-muted opacity-60">02 / DURABILITY</div>
            <h2 className="text-display-xl text-4xl font-serif">Invincible Execution</h2>
            <p className="text-body-md text-blueprint-muted text-lg leading-relaxed">
              Powered by Temporal.io, Automata ensures that long-running AI workflows survive infrastructure failures, network partitions, and API rate limits. State is inherently durable.
            </p>
            <div className="space-y-6 pt-4">
               <div>
                 <h4 className="text-ui-label text-primary uppercase font-bold">Guaranteed Completion</h4>
                 <p className="text-xs text-blueprint-muted mt-1 underline decoration-blueprint-line underline-offset-4">Workflows execute exactly once, resuming from the exact point of failure.</p>
               </div>
               <div>
                  <h4 className="text-ui-label text-primary uppercase font-bold">Event Sourcing</h4>
                  <p className="text-xs text-blueprint-muted mt-1 underline decoration-blueprint-line underline-offset-4">Complete audit trails of every state transition and agent decision.</p>
               </div>
            </div>
          </div>
        </div>

        {/* Refinement */}
        <div className="text-center space-y-12">
          <div className="space-y-4">
            <div className="text-technical-mono text-blueprint-muted opacity-60">03 / REFINEMENT</div>
            <h2 className="text-headline-lg font-serif italic text-6xl">Self-Correcting Loops</h2>
            <p className="text-body-lg text-blueprint-muted max-w-3xl mx-auto">
              Automata doesn't just execute; it evaluates. Built-in critic agents review outputs against defined constraints, feeding errors back into the reasoning loop until perfection is achieved.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { id: '1', title: 'Generate', icon: Zap, desc: 'Primary agents synthesize data and draft initial structural responses based on context.' },
              { id: '2', title: 'Critique', icon: Layers, desc: 'Secondary critic agents evaluate the output against strict logical and factual constraints.' },
              { id: '3', title: 'Refine', icon: Repeat, desc: 'Errors trigger a localized retry loop, adjusting parameters until the constraint is met.' }
            ].map(step => (
              <div key={step.id} className="p-10 border border-blueprint-line bg-surface-container-low/20 rounded-2xl space-y-6 text-left">
                <div className="w-12 h-12 rounded-full bg-white border border-blueprint-line flex items-center justify-center"><step.icon size={20} /></div>
                <h3 className="text-ui-label uppercase font-bold tracking-widest">{step.id}. {step.title}</h3>
                <p className="text-body-md text-blueprint-muted leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-blueprint-line py-12 px-8 bg-white relative z-10">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div>
            <h1 className="font-serif italic text-3xl text-primary tracking-tight mb-2">AUTOMATA</h1>
            <p className="text-technical-mono text-blueprint-muted mt-1">© 2026 AUTOMATA PLATFORM. ENGINEERED FOR PRECISION.</p>
          </div>
          <div className="flex flex-wrap gap-4 md:gap-8 text-technical-mono text-blueprint-muted text-xs">
            {(
              [['Privacy Policy', 'privacy'], ['Terms of Service', 'terms'], ['Security', 'security']] as [string, any][]
            ).map(([label, view]) => (
              <button key={label} onClick={() => onViewChange(view)} className="hover:text-primary transition-colors uppercase font-semibold">{label}</button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Search, 
  ChevronRight, 
  Book, 
  Terminal, 
  Zap, 
  Database, 
  Shield, 
  Cpu,
  ArrowUpRight,
  ArrowLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../App';

const sections = [
  {
    title: 'Getting Started',
    items: [
      { id: 'intro', label: 'Introduction', icon: Book },
      { id: 'quickstart', label: 'Quickstart Guide', icon: Zap },
      { id: 'architecture', label: 'Platform Architecture', icon: Cpu },
    ]
  },
  {
    title: 'Core Concepts',
    items: [
      { id: 'workflows', label: 'Orchestration Graphs', icon: Terminal },
      { id: 'operators', label: 'Autonomous Operators', icon: Shield },
      { id: 'mcp', label: 'MCP Protocol', icon: Database },
    ]
  },
  {
    title: 'Advanced',
    items: [
      { id: 'durable', label: 'Durable Execution', icon: Zap },
      { id: 'evaluators', label: 'LLM-as-a-Judge', icon: Book },
    ]
  }
];

export default function Docs({ onViewChange }: { onViewChange?: (view: View) => void }) {
  const [activeSection, setActiveSection] = useState('intro');

  return (
    <div className="flex flex-col lg:flex-row min-h-full bg-blueprint-bg relative">
      {/* Docs Sidebar */}
      <aside className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-blueprint-line bg-surface-container-lowest/50 backdrop-blur-sm lg:sticky top-0 lg:h-full overflow-x-auto lg:overflow-y-auto pt-6 lg:pt-12 pb-6 lg:pb-24 px-4 sm:px-6 space-y-6 lg:space-y-10">
        {/* Back to landing */}
        {onViewChange && (
          <button
            onClick={() => onViewChange('landing')}
            className="flex items-center gap-1.5 text-blueprint-muted hover:text-on-surface-variant text-xs mb-2 transition-colors"
          >
            <ArrowLeft size={13} /> Back to home
          </button>
        )}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-blueprint-muted" />
          <input 
            type="text" 
            placeholder="Search docs..."
            className="w-full bg-blueprint-bg border border-blueprint-line rounded-lg py-2 pl-9 pr-4 text-xs focus:outline-none focus:border-blueprint-muted transition-all"
          />
        </div>

        <nav className="space-y-6 lg:space-y-8">
          {sections.map((section) => (
            <div key={section.title} className="space-y-4">
              <h3 className="text-ui-label text-blueprint-muted text-[10px] tracking-[0.2em]">{section.title}</h3>
              <div className="space-y-1">
                {section.items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSection(item.id)}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all group",
                      activeSection === item.id 
                        ? "bg-blueprint-accent text-white shadow-lg" 
                        : "text-blueprint-muted hover:bg-blueprint-line/40"
                    )}
                  >
                    <item.icon size={16} className={cn(activeSection === item.id ? "text-white" : "text-blueprint-muted opacity-60")} />
                    <span className="flex-1 text-left">{item.label}</span>
                    {activeSection !== item.id && <ChevronRight size={14} className="opacity-0 group-hover:opacity-40 transition-opacity" />}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[800px] mx-auto px-4 sm:px-6 lg:px-12 py-10 sm:py-16 lg:py-24 space-y-12 sm:space-y-16">
          <motion.div 
            key={activeSection}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-12"
          >
            <div className="space-y-4 border-b border-blueprint-line pb-12">
               <div className="flex items-center gap-2 text-technical-mono text-blueprint-muted">
                 <span>Documentation</span>
                 <ChevronRight size={10} />
                 <span className="text-blueprint-accent">Platform Architecture</span>
               </div>
               <h1 className="text-display-xl text-blueprint-accent">
                 Engineering at the Edge of <span className="italic text-blueprint-muted">Autonomy.</span>
               </h1>
               <p className="text-body-lg text-blueprint-muted max-w-2xl leading-relaxed">
                 The Automata Platform is built on three pillars: Graph Orchestration, Durable Execution, and Self-Refining State. 
                 By combining LangGraph's precision with Temporal's reliability, we enable cognitive tasks that never fail.
               </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-12 pt-8">
               <div className="space-y-6 p-6 sm:p-8 border border-blueprint-line rounded-2xl bg-surface-container-low/20">
                  <div className="w-12 h-12 rounded-full bg-blueprint-line/40 flex items-center justify-center">
                    <Terminal size={24} className="text-blueprint-accent" />
                  </div>
                  <h3 className="text-headline-md text-blueprint-accent text-2xl">Graph Engine</h3>
                  <p className="text-body-md text-blueprint-muted">
                    Workflows are modeled as Directed Cyclic Graphs. Unlike linear chains, graphs allow for complex retry logic, conditional branching, and iterative reflection loops.
                  </p>
                  <button className="flex items-center gap-2 text-ui-label text-blueprint-accent hover:underline">
                    View Specs <ArrowUpRight size={14} />
                  </button>
               </div>

               <div className="space-y-6 p-6 sm:p-8 border border-blueprint-line rounded-2xl bg-surface-container-low/20">
                  <div className="w-12 h-12 rounded-full bg-blueprint-line/40 flex items-center justify-center">
                    <Zap size={24} className="text-blueprint-accent" />
                  </div>
                  <h3 className="text-headline-md text-blueprint-accent text-2xl">Durable State</h3>
                  <p className="text-body-md text-blueprint-muted">
                    Execution state is persisted at every node transition. If an external API fails, the workflow pauses, waits for the underlying system to recover, and resumes exactly where it left off.
                  </p>
                  <button className="flex items-center gap-2 text-ui-label text-blueprint-accent hover:underline">
                    Durable SDK <ArrowUpRight size={14} />
                  </button>
               </div>
            </div>

            <section className="space-y-8 pt-12">
               <h2 className="text-headline-md text-blueprint-accent">Sample Workflow Definition</h2>
               <div className="rounded-xl overflow-hidden border border-blueprint-line shadow-2xl">
                 <div className="bg-blueprint-accent text-white px-4 py-2 flex items-center justify-between">
                    <span className="text-technical-mono text-[10px]">manifest.yml</span>
                    <div className="flex gap-2">
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                      <div className="w-2 h-2 rounded-full bg-white/20" />
                    </div>
                 </div>
                 <pre className="p-4 sm:p-8 bg-surface-container-lowest font-mono text-[12px] sm:text-[13px] leading-relaxed text-blueprint-accent overflow-x-auto">
{`name: autonomous_lead_enrichment
type: graph
nodes:
  - id: fetch_search_results
    type: tool_call
    mcp: google_search
    params:
      query: "Top 10 AI startups in London"
  - id: analyze_impact
    type: llm_call
    model: claude-3-5-sonnet
    system: "You are a VC analyst..."
    input: "{{ fetch_search_results.output }}"
edges:
  - source: fetch_search_results
    target: analyze_impact`}
                 </pre>
               </div>
            </section>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

import React from 'react';
import WorkflowTerminal from '../components/WorkflowTerminal';
import { WorkflowDAG } from '../services/geminiService';
import { motion } from 'framer-motion';

interface DashboardProps {
  onWorkflowCreated: (dag: WorkflowDAG) => void;
}

export default function Dashboard({ onWorkflowCreated }: DashboardProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-full px-8 py-20 pb-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-8 mb-16"
      >
        <div className="inline-flex items-center space-x-2 bg-blueprint-line/30 rounded-full px-4 py-1.5 border border-blueprint-line/50">
          <span className="w-2 h-2 rounded-full bg-blueprint-accent animate-pulse"></span>
          <span className="text-technical-mono text-blueprint-muted uppercase font-semibold">Orren Platform Overview</span>
        </div>

        <h1 className="text-display-xl text-blueprint-accent max-w-4xl">
          Engineered for Precision.<br />
          <span className="text-blueprint-muted italic">Architected for Scale.</span>
        </h1>

        <p className="text-body-lg text-blueprint-muted max-w-2xl mx-auto">
          The Orren Platform unifies multi-agent orchestration with autonomous state refinement. 
          Build self-correcting AI loops that plan, execute, and scale with a single prompt.
        </p>
      </motion.div>

      <WorkflowTerminal onSuccess={onWorkflowCreated} />

      <div className="mt-32 grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-5xl">
        <div className="p-8 border border-blueprint-line bg-surface-container-low/20 rounded-xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-blueprint-line/40 flex items-center justify-center italic font-serif">01</div>
          <h3 className="text-ui-label text-blueprint-accent">Graph Orchestration</h3>
          <p className="text-technical-mono text-blueprint-muted normal-case text-[13px]">
            Model complex cognitive tasks as directed cyclic graphs using LangGraph principles.
          </p>
        </div>
        <div className="p-8 border border-blueprint-line bg-surface-container-low/20 rounded-xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-blueprint-line/40 flex items-center justify-center italic font-serif">02</div>
          <h3 className="text-ui-label text-blueprint-accent">Durable Execution</h3>
          <p className="text-technical-mono text-blueprint-muted normal-case text-[13px]">
            State is inherently durable, surviving infrastructure failures and API rate limits.
          </p>
        </div>
        <div className="p-8 border border-blueprint-line bg-surface-container-low/20 rounded-xl space-y-4">
          <div className="w-10 h-10 rounded-full bg-blueprint-line/40 flex items-center justify-center italic font-serif">03</div>
          <h3 className="text-ui-label text-blueprint-accent">Self-Correction</h3>
          <p className="text-technical-mono text-blueprint-muted normal-case text-[13px]">
            Built-in critic agents evaluate outputs and trigger localized refinement loops.
          </p>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Paperclip, Mic, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateWorkflowFromPrompt, WorkflowDAG } from '../services/geminiService';
import { cn } from '../lib/utils';

interface WorkflowTerminalProps {
  onSuccess: (dag: WorkflowDAG) => void;
}

export default function WorkflowTerminal({ onSuccess }: WorkflowTerminalProps) {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success'>('idle');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLDivElement>(null);

  const examples = [
    "Every Monday 9AM, read my Google Sheet 'Sales Tracker', summarize revenue, and email it to team@company.com",
    "When a new row is added to my Leads Sheet, draft a personalized outreach email and send it via Gmail",
    "Check my Gmail for unread client emails, draft reply suggestions, and post them to #support Slack channel",
    "On the 1st of every month, pull revenue data from Sheets and write a board summary in Notion",
    "Every weekday at 9AM, summarize yesterday's customer updates and post them to Slack"
  ];

  const handleCycleExample = () => {
    const randomExample = examples[Math.floor(Math.random() * examples.length)];
    setPrompt(randomExample);
    if (inputRef.current) {
      inputRef.current.innerText = randomExample;
    }
  };

  const handleSubmit = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    setError(null);
    try {
      const dag = await generateWorkflowFromPrompt(prompt);
      setStatus('success');
      setTimeout(() => {
        onSuccess(dag);
      }, 1500);
    } catch (err: any) {
      console.error('Generation failed:', err);
      setError(err?.message ?? 'Generation failed. Please try again.');
      setIsGenerating(false);
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <motion.div 
        animate={{ 
          backgroundColor: status === 'success' ? '#0d1f0d' : '#111111',
          borderColor: status === 'success' ? '#4ade80' : '#222'
        }}
        className="rounded-2xl border p-6 shadow-2xl relative overflow-hidden transition-colors duration-500"
      >
        <div className="relative z-10 flex flex-col space-y-4">
          <div 
            ref={inputRef}
            contentEditable={!isGenerating}
            onInput={(e) => setPrompt(e.currentTarget.innerText)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            data-placeholder="Describe your workflow in plain English..."
            className={cn(
              "min-h-[100px] max-h-[300px] overflow-y-auto font-mono text-[15px] focus:outline-none caret-blue-500 empty:before:content-[attr(data-placeholder)] empty:before:text-blueprint-muted/50",
              status === 'success' ? "text-green-400" : "text-gray-300"
            )}
          />

          <div className="flex justify-between items-center pt-4 border-t border-white/5">
            <div className="flex items-center gap-2">
              <button 
                onClick={handleCycleExample}
                className="p-2 text-blueprint-muted hover:text-white transition-colors"
                title="Insert example"
              >
                <Sparkles size={18} />
              </button>
              <button className="p-2 text-blueprint-muted hover:text-white transition-colors">
                <Paperclip size={18} />
              </button>
            </div>

            <div className="flex items-center gap-4">
              <button className="p-2 text-blueprint-muted hover:text-white transition-colors">
                <Mic size={18} />
              </button>
              <button 
                onClick={handleSubmit}
                disabled={isGenerating || !prompt.trim()}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center transition-all",
                  isGenerating ? "bg-white/10 animate-pulse" : "bg-blue-600 hover:bg-blue-500 text-white"
                )}
              >
                {status === 'success' ? (
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                    <ArrowRight size={20} />
                  </motion.div>
                ) : (
                  <ArrowRight size={20} />
                )}
              </button>
            </div>
          </div>
        </div>

        {isGenerating && status === 'idle' && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
             <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
             <span className="text-blue-500 text-technical-mono ml-2">Architecting...</span>
          </div>
        )}

        <AnimatePresence>
          {status === 'success' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-green-950/20 backdrop-blur-sm z-20"
            >
               <span className="text-green-400 font-mono text-sm">Workflow created — opening editor...</span>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex items-center justify-center bg-red-950/30 backdrop-blur-sm z-20 p-6"
            >
              <span className="text-red-400 font-mono text-sm text-center">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <div className="flex flex-wrap gap-2 justify-center">
        {["Weekly Sales Report", "Lead Auto-Enrich", "Client Follow-up", "Monthly Board Summary", "Slack Daily Digest"].map(chip => (
          <button 
            key={chip}
            onClick={() => {
              setPrompt(`Generate a workflow for: ${chip}`);
              if (inputRef.current) inputRef.current.innerText = chip;
            }}
            className="px-4 py-2 bg-surface-container-low/40 border border-blueprint-line rounded-lg text-technical-mono text-blueprint-muted hover:border-blueprint-muted transition-all"
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

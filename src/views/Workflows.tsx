import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MoreHorizontal, Play, Clock, Edit2, Trash2, Shield, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { WorkflowMetadata } from '../types';
import { WorkflowDAG } from '../services/geminiService';

interface WorkflowsProps {
  onViewWorkflow?: (dag: WorkflowDAG) => void;
}

export default function Workflows({ onViewWorkflow }: WorkflowsProps) {
  const navigate = useNavigate();
  const [workflows, setWorkflows] = useState<WorkflowMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchWorkflows = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      setWorkflows(Array.isArray(data?.workflows) ? data.workflows : []);
    } catch (err) {
      console.error('Failed to fetch workflows:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkflows();
  }, []);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full space-y-8 sm:space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-blueprint-line pb-6 sm:pb-8 gap-4">
        <div className="space-y-2">
          <h2 className="text-headline-lg text-blueprint-accent">Workflows</h2>
          <p className="text-body-md text-blueprint-muted max-w-2xl">
            Manage your autonomous operators. Monitor execution status, update logic, and scale deployment.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 sm:gap-4">
          <button 
            onClick={fetchWorkflows}
            className="p-2 border border-blueprint-line rounded-full hover:bg-blueprint-line/20 transition-all"
          >
            <RefreshCw size={18} className={cn(isLoading && "animate-spin")} />
          </button>
          <div className="flex bg-blueprint-line/20 rounded-full p-1 border border-blueprint-line/40">
            {['All', 'Active', 'Drafts'].map((tab) => (
              <button 
                key={tab}
                className={cn(
                  "px-4 py-1.5 rounded-full text-technical-mono transition-all",
                  tab === 'All' ? "bg-white text-blueprint-accent shadow-sm" : "text-blueprint-muted hover:text-blueprint-accent"
                )}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {workflows.length === 0 && !isLoading && (
          <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl">
            <p className="text-blueprint-muted font-mono">No active deployments found.</p>
          </div>
        )}
        {workflows.map((workflow, idx) => (
          <motion.div
            key={workflow.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.05 }}
            className="group flex flex-col xl:flex-row xl:items-center justify-between border border-blueprint-line bg-surface-container-lowest p-4 sm:p-6 rounded-2xl hover:border-blueprint-accent transition-all shadow-sm hover:shadow-md gap-4 sm:gap-6 cursor-pointer"
            onClick={() => navigate(`/workflows/${workflow.id}`)}
          >
            <div className="flex items-start sm:items-center gap-4 sm:gap-6 flex-1 min-w-0">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border border-blueprint-line/50",
                workflow.status === 'active' ? "bg-green-50 text-green-600" :
                workflow.status === 'ready' ? "bg-emerald-50 text-emerald-600" :
                workflow.status === 'generating' ? "bg-blue-50 text-blue-600" : "bg-blueprint-bg text-blueprint-muted"
              )}>
                <Shield size={24} />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-1">
                  <h3 className="text-ui-label text-blueprint-accent text-base sm:text-lg leading-none">{workflow.name}</h3>
                  <span className={cn(
                    "px-2 py-0.5 rounded-full text-technical-mono text-[9px] uppercase font-bold",
                    workflow.status === 'active' ? "bg-green-100 text-green-700" : 
                    workflow.status === 'ready' ? "bg-emerald-100 text-emerald-700" :
                    workflow.status === 'generating' ? "bg-blue-100 text-blue-700" :
                    workflow.status === 'paused' ? "bg-yellow-100 text-yellow-700" : "bg-blueprint-line text-blueprint-muted"
                  )}>
                    {workflow.status}
                  </span>
                </div>
                <p className="text-body-md text-blueprint-muted text-sm line-clamp-1">{workflow.description || "No description provided."}</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8 md:gap-12">
              <div className="hidden xl:flex flex-col items-end">
                <span className="text-technical-mono text-[10px] text-blueprint-muted opacity-60 flex items-center gap-1 uppercase">
                  <Clock size={12} /> Last Run
                </span>
                <span className="text-technical-mono text-blueprint-accent mt-0.5">2 hours ago</span>
              </div>
              
              <div className="flex items-center gap-2" onClick={(event) => event.stopPropagation()}>
                <button 
                  className="p-2.5 rounded-full border border-blueprint-line text-blueprint-accent hover:bg-blueprint-accent hover:text-white transition-all"
                  title="Run now"
                >
                  <Play size={16} fill="currentColor" />
                </button>
                <button 
                  className="p-2.5 rounded-full border border-blueprint-line text-blueprint-accent hover:bg-blueprint-accent hover:text-white transition-all"
                  title="Edit workflow"
                  onClick={() => navigate(`/workflows/${workflow.id}`)}
                >
                  <Edit2 size={16} />
                </button>
                <button className="p-2.5 rounded-full border border-blueprint-line text-blueprint-accent hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all">
                  <Trash2 size={16} />
                </button>
                <button className="p-2.5 text-blueprint-muted hover:text-blueprint-accent">
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="border border-dashed border-blueprint-line rounded-2xl p-12 flex flex-col items-center justify-center text-center bg-blueprint-bg/20">
         <h4 className="text-ui-label text-blueprint-muted uppercase tracking-widest mb-4">Autonomous Fleet Status</h4>
         <div className="flex flex-col sm:flex-row gap-8 sm:gap-12">
           <div className="text-center">
             <div className="text-headline-md text-blueprint-accent">{workflows.length}</div>
             <div className="text-technical-mono text-blueprint-muted opacity-60">Deployments</div>
           </div>
           <div className="text-center sm:border-x border-blueprint-line sm:px-12 sm:py-0 py-4">
             <div className="text-headline-md text-blueprint-accent">99.9%</div>
             <div className="text-technical-mono text-blueprint-muted opacity-60">SLA Met</div>
           </div>
           <div className="text-center">
             <div className="text-headline-md text-blueprint-accent">2.4k</div>
             <div className="text-technical-mono text-blueprint-muted opacity-60">Runs/Day</div>
           </div>
         </div>
      </div>
    </div>
  );
}

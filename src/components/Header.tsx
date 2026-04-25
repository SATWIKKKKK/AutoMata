import React from 'react';
import { 
  Bell, 
  HelpCircle, 
  Search, 
  Undo, 
  Redo, 
  ZoomIn, 
  ZoomOut,
  Play
} from 'lucide-react';
import { View } from '../App';
import { cn } from '../lib/utils';

interface HeaderProps {
  view: View;
  workflowName?: string;
}

export default function Header({ view, workflowName }: HeaderProps) {
  const isEditor = view === 'editor';

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-8 h-20 bg-surface-container-lowest/80 backdrop-blur-md border-b border-blueprint-line">
      <div className="flex items-center gap-6 h-full">
        <h2 className={cn(
          "text-ui-label text-blueprint-accent uppercase tracking-[0.1em]",
          isEditor ? "normal-case tracking-normal" : ""
        )}>
          {isEditor ? (workflowName || 'Untitled Workflow') : view.toUpperCase()}
        </h2>
        {isEditor && (
          <span className="px-2 py-1 rounded-full bg-blueprint-line/50 text-blueprint-muted text-technical-mono">Draft</span>
        )}
      </div>

      <div className="flex items-center gap-6">
        {isEditor ? (
          <div className="flex items-center gap-4 border-r border-blueprint-line pr-6 mr-6">
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><Undo size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><Redo size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><ZoomIn size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><ZoomOut size={18} /></button>
          </div>
        ) : (
          <div className="relative hidden md:block">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-blueprint-muted" />
            <input 
              type="text" 
              placeholder="Search workflows..."
              className="bg-blueprint-bg/50 border border-blueprint-line rounded-full py-1.5 pl-9 pr-4 text-sm w-48 focus:w-64 transition-all focus:outline-none focus:border-blueprint-muted"
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <button className="text-blueprint-muted hover:text-blueprint-accent"><Bell size={20} /></button>
          <button className="text-blueprint-muted hover:text-blueprint-accent"><HelpCircle size={20} /></button>
          
          <button className="bg-blueprint-accent text-white px-6 py-2 rounded-full text-ui-label hover:opacity-90 transition-opacity flex items-center gap-2">
            <Play size={14} fill="currentColor" />
            Deploy
          </button>

          <div className="w-10 h-10 rounded-full border border-blueprint-line overflow-hidden bg-white">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
              alt="User" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}

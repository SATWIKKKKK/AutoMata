import React from 'react';
import { 
  BarChart2, 
  Layers, 
  Terminal, 
  Workflow, 
  Settings, 
  BookOpen, 
  PlusCircle,
  ChevronLeft,
  ChevronRight,
  Menu
} from 'lucide-react';
import { cn } from '../lib/utils';
import { View } from '../App';
import { motion } from 'framer-motion';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function Sidebar({ currentView, onViewChange, isCollapsed, onToggle }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: 'Terminal', icon: Terminal },
    { id: 'workflows', label: 'Workflows', icon: Workflow },
    { id: 'registry', label: 'Integrations', icon: Layers },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
  ] as const;

  return (
    <motion.nav 
      animate={{ width: isCollapsed ? '80px' : '260px' }}
      className="flex flex-col border-r border-blueprint-line bg-surface-container-lowest h-full py-8 px-4 relative z-50 overflow-hidden"
    >
      <div className={cn("mb-12 px-4 flex items-center", isCollapsed ? "justify-center" : "justify-between")}>
        {!isCollapsed && (
          <div className="overflow-hidden whitespace-nowrap">
            <h1 className="font-serif italic text-3xl text-blueprint-accent tracking-tight">AUTOMATA</h1>
            <p className="text-technical-mono text-blueprint-muted mt-1">v2.4.0-stable</p>
          </div>
        )}
        <button 
          onClick={onToggle}
          className="p-1.5 hover:bg-blueprint-line/40 rounded-lg text-blueprint-muted transition-colors shrink-0"
        >
          {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <div className="px-2 mb-8">
        <button 
          onClick={() => onViewChange('dashboard')}
          className={cn(
            "w-full bg-blueprint-accent text-white py-3 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all text-ui-label",
            isCollapsed && "rounded-xl px-0"
          )}
          title="New Deployment"
        >
          <PlusCircle size={18} />
          {!isCollapsed && <span>New Deployment</span>}
        </button>
      </div>

      <div className="flex-1 flex flex-col gap-1 px-2">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-lg text-ui-label transition-all duration-200 overflow-hidden",
              currentView === item.id 
                ? "bg-blueprint-line/40 text-blueprint-accent font-semibold" 
                : "text-blueprint-muted hover:bg-blueprint-line/20",
              isCollapsed && "justify-center px-0"
            )}
            title={item.label}
          >
            <item.icon size={20} className={cn("shrink-0", currentView === item.id ? "text-blueprint-accent" : "text-blueprint-muted")} />
            {!isCollapsed && <span className="whitespace-nowrap">{item.label}</span>}
          </button>
        ))}
      </div>

      <div className="mt-auto border-t border-blueprint-line pt-4 flex flex-col gap-1 px-2">
        <button 
          onClick={() => onViewChange('docs')}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-ui-label transition-all overflow-hidden",
            currentView === 'docs' ? "bg-blueprint-line/40 text-blueprint-accent font-semibold" : "text-blueprint-muted hover:bg-blueprint-line/20",
            isCollapsed && "justify-center px-0"
          )}
          title="Documentation"
        >
          <BookOpen size={20} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Docs</span>}
        </button>
        <button 
          onClick={() => onViewChange('settings')}
          className={cn(
            "flex items-center gap-3 px-4 py-3 rounded-lg text-ui-label transition-all overflow-hidden",
            currentView === 'settings' ? "bg-blueprint-line/40 text-blueprint-accent font-semibold" : "text-blueprint-muted hover:bg-blueprint-line/20",
            isCollapsed && "justify-center px-0"
          )}
          title="Settings"
        >
          <Settings size={20} className="shrink-0" />
          {!isCollapsed && <span className="whitespace-nowrap">Settings</span>}
        </button>
      </div>
    </motion.nav>
  );
}

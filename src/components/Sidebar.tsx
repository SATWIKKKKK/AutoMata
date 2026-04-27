import React from 'react';
import {
  BarChart2,
  Layers,
  Terminal,
  Workflow,
  Settings,
  BookOpen,
  ChevronLeft,
  Menu,
  Home,
  Cpu,
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

const navItem = (
  id: View,
  label: string,
  Icon: React.ElementType,
  currentView: View,
  onViewChange: (v: View) => void,
  isCollapsed: boolean,
  extra?: string,
) => (
  <button
    key={id}
    onClick={() => onViewChange(id)}
    title={label}
    className={cn(
      'flex items-center gap-3 px-4 py-3 rounded-lg text-ui-label transition-all duration-200 overflow-hidden',
      currentView === id
        ? 'bg-blueprint-line/40 text-blueprint-accent font-semibold'
        : `text-blueprint-muted hover:bg-blueprint-line/20 ${extra ?? ''}`,
      isCollapsed && 'justify-center px-0',
    )}
  >
    <Icon size={20} className={cn('shrink-0', currentView === id ? 'text-blueprint-accent' : 'text-blueprint-muted')} />
    {!isCollapsed && <span className="whitespace-nowrap">{label}</span>}
  </button>
);

export default function Sidebar({ currentView, onViewChange, isCollapsed, onToggle }: SidebarProps) {
  return (
    <motion.nav
      animate={{ width: isCollapsed ? '80px' : '260px' }}
      className="flex flex-col border-r border-blueprint-line bg-surface-container-lowest h-full py-8 px-4 relative z-50 overflow-hidden"
    >
      {/* Logo + toggle */}
      <div className={cn('mb-8 px-4 flex items-center', isCollapsed ? 'justify-center' : 'justify-between')}>
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

      {/* Main nav — Home first */}
      <div className="flex-1 flex flex-col gap-1 px-2">
        {navItem('landing', 'Home', Home, currentView, onViewChange, isCollapsed, 'hover:text-primary')}

        <div className="my-2 border-t border-blueprint-line/50" />

        {navItem('builder', 'Builder', Cpu, currentView, onViewChange, isCollapsed)}
        {navItem('terminal', 'Terminal', Terminal, currentView, onViewChange, isCollapsed)}
        {navItem('workflows', 'Workflows', Workflow, currentView, onViewChange, isCollapsed)}
        {navItem('registry', 'Integrations', Layers, currentView, onViewChange, isCollapsed)}
        {navItem('analytics', 'Analytics', BarChart2, currentView, onViewChange, isCollapsed)}
      </div>

      {/* Bottom: Docs + Settings */}
      <div className="mt-auto border-t border-blueprint-line pt-4 flex flex-col gap-1 px-2">
        {navItem('docs', 'Docs', BookOpen, currentView, onViewChange, isCollapsed)}
        {navItem('settings', 'Settings', Settings, currentView, onViewChange, isCollapsed)}
      </div>
    </motion.nav>
  );
}

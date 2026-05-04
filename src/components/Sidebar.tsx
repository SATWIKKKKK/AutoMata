import React from 'react';
import {
  Activity,
  BarChart2,
  ChevronLeft,
  Cpu,
  FileText,
  Home,
  Layers,
  Menu,
  Settings,
  Terminal,
  Workflow,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../lib/utils';
import { View } from '../App';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
  isCollapsed: boolean;
  onToggle: () => void;
}

const NAV_ITEMS: Array<{ id: View; label: string; icon: React.ElementType }> = [
  { id: 'dashboard', label: 'Prep Overview', icon: Home },
  { id: 'builder', label: 'Prep Setup', icon: Cpu },
  { id: 'workflows', label: 'Practice Tracks', icon: Workflow },
  { id: 'registry', label: 'Scenario Round', icon: FileText },
  { id: 'editor', label: 'Coding Round', icon: Terminal },
  { id: 'terminal', label: 'Mock Interview', icon: Activity },
  { id: 'analytics', label: 'Gap Review', icon: BarChart2 },
  { id: 'templates', label: 'Archive', icon: Layers },
];

function NavButton({
  id,
  label,
  Icon,
  currentView,
  onViewChange,
  isCollapsed,
}: {
  id: View;
  label: string;
  Icon: React.ElementType;
  currentView: View;
  onViewChange: (view: View) => void;
  isCollapsed: boolean;
}) {
  const isActive = currentView === id;
  return (
    <button
      type="button"
      onClick={() => onViewChange(id)}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3 text-ui-label transition-all duration-200',
        isActive ? 'border-l-2 border-primary bg-blueprint-line/30 text-primary font-semibold' : 'text-blueprint-muted hover:bg-blueprint-line/20',
        isCollapsed && 'justify-center px-0',
      )}
      title={label}
    >
      <Icon size={18} className={cn(isActive ? 'text-primary' : 'text-blueprint-muted')} />
      {!isCollapsed ? <span className="whitespace-nowrap text-left">{label}</span> : null}
    </button>
  );
}

export default function Sidebar({ currentView, onViewChange, isCollapsed, onToggle }: SidebarProps) {
  return (
    <motion.nav
      animate={{ width: isCollapsed ? '84px' : '280px' }}
      className="flex h-full flex-col overflow-hidden border-r border-blueprint-line bg-white/90 px-4 py-8 backdrop-blur-sm"
    >
      <div className={cn('mb-8 flex items-center', isCollapsed ? 'justify-center' : 'justify-between')}>
        {!isCollapsed ? (
          <button type="button" onClick={() => onViewChange('dashboard')} className="text-left">
            <div className="text-2xl font-black tracking-tight text-primary">PROMPTLY</div>
            <p className="mt-1 text-ui-label text-blueprint-muted">Interview Prep</p>
          </button>
        ) : null}

        <button type="button" onClick={onToggle} className="rounded-lg p-2 text-blueprint-muted transition-colors hover:bg-blueprint-line/30 hover:text-primary">
          {isCollapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <NavButton key={item.id} id={item.id} label={item.label} Icon={item.icon} currentView={currentView} onViewChange={onViewChange} isCollapsed={isCollapsed} />
        ))}
      </div>

      <div className="mt-6 border-t border-blueprint-line pt-4 px-2">
        <NavButton id="settings" label="Settings" Icon={Settings} currentView={currentView} onViewChange={onViewChange} isCollapsed={isCollapsed} />
      </div>
    </motion.nav>
  );
}
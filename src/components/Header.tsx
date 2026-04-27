import React, { useState, useRef, useEffect } from 'react';
import {
  Bell,
  HelpCircle,
  Undo,
  Redo,
  ZoomIn,
  ZoomOut,
  Play,
  LogOut,
  Settings,
  ChevronDown,
  Menu,
} from 'lucide-react';
import { View } from '../App';
import { cn } from '../lib/utils';
import { clearSessionState, getStoredUser } from '../lib/session';

interface HeaderProps {
  view: View;
  workflowName?: string;
  onViewChange?: (view: View) => void;
  onMenuToggle?: () => void;
}

function getInitials(name?: string, email?: string): string {
  if (name) return name.split(' ').map((p) => p[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0].toUpperCase();
  return 'U';
}

export default function Header({ view, workflowName, onViewChange, onMenuToggle }: HeaderProps) {
  const isEditor = view === 'editor';
  const isSettings = view === 'settings';
  const user = getStoredUser();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = () => {
    clearSessionState();
    setDropdownOpen(false);
    onViewChange?.('landing');
  };

  return (
    <header className="sticky top-0 z-40 flex justify-between items-center px-4 sm:px-6 lg:px-8 h-16 sm:h-20 bg-surface-container-lowest/80 backdrop-blur-md border-b border-blueprint-line gap-3">
      {/* Left: view title */}
      <div className="flex items-center gap-3 sm:gap-6 h-full min-w-0">
        <button onClick={onMenuToggle} className="md:hidden rounded-full border border-blueprint-line p-2 text-blueprint-muted hover:text-primary">
          <Menu size={16} />
        </button>
        <h2
          className={cn(
            'text-ui-label text-blueprint-accent uppercase tracking-widest truncate',
            isEditor ? 'normal-case tracking-normal' : '',
          )}
        >
          {isEditor ? (workflowName || 'Untitled Workflow') : view.toUpperCase()}
        </h2>
        {isEditor && (
          <span className="px-2 py-1 rounded-full bg-blueprint-line/50 text-blueprint-muted text-technical-mono">
            Draft
          </span>
        )}
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
        {/* Editor toolbar */}
        {isEditor && (
          <div className="hidden lg:flex items-center gap-4 border-r border-blueprint-line pr-6 mr-2">
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><Undo size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><Redo size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><ZoomIn size={18} /></button>
            <button className="text-blueprint-muted hover:text-blueprint-accent transition-colors"><ZoomOut size={18} /></button>
          </div>
        )}

        {/* Notification / Help */}
        <button className="hidden sm:inline-flex text-blueprint-muted hover:text-blueprint-accent transition-colors"><Bell size={20} /></button>
        <button className="hidden sm:inline-flex text-blueprint-muted hover:text-blueprint-accent transition-colors"><HelpCircle size={20} /></button>

        {/* Dashboard shortcut (not shown on builder or settings) */}
        {!isSettings && view !== 'builder' && (
          <button
            onClick={() => onViewChange?.('builder')}
            className="hidden md:inline-flex font-ui-label text-ui-label font-medium text-blueprint-muted hover:text-primary transition-colors"
          >
            Dashboard
          </button>
        )}

        {/* Deploy button — hidden on settings */}
        {!isSettings && (
          <button className="hidden sm:inline-flex bg-blueprint-accent text-white px-4 lg:px-6 py-2 rounded-full text-ui-label hover:opacity-90 transition-opacity items-center gap-2">
            <Play size={14} fill="currentColor" />
            Deploy
          </button>
        )}

        {/* Profile dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen((o) => !o)}
            className="flex items-center gap-1.5 focus:outline-none"
            aria-label="Profile menu"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border border-blueprint-line bg-primary flex items-center justify-center text-white font-bold text-sm select-none">
              {getInitials(user?.name, user?.email)}
            </div>
            <ChevronDown size={14} className={cn('text-blueprint-muted transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 top-12 min-w-[180px] bg-white border border-blueprint-line rounded-xl shadow-xl py-2 z-50">
              {user?.name && (
                <p className="px-4 py-1 text-sm font-semibold text-primary truncate">{user.name}</p>
              )}
              {user?.email && (
                <p className="px-4 pb-2 text-xs text-blueprint-muted truncate border-b border-blueprint-line">
                  {user.email}
                </p>
              )}
              <button
                onClick={() => { setDropdownOpen(false); onViewChange?.('settings'); }}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <Settings size={14} className="text-blueprint-muted" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-on-surface hover:bg-surface-container-low transition-colors"
              >
                <LogOut size={14} className="text-blueprint-muted" />
                Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

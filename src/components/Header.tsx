import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Menu, Settings as SettingsIcon, LogOut } from 'lucide-react';
import { clearSessionState, getStoredUser } from '../lib/session';
import { View } from '../App';
import { cn } from '../lib/utils';
import { DOMAIN_LABELS, getStoredPrepWorkspace } from '../lib/prep';

interface HeaderProps {
  view: View;
  title: string;
  onViewChange?: (view: View) => void;
  onMenuToggle?: () => void;
}

function getInitials(name?: string, email?: string) {
  if (name) return name.split(' ').map((part) => part[0]).join('').toUpperCase().slice(0, 2);
  if (email) return email[0]?.toUpperCase() ?? 'U';
  return 'U';
}

export default function Header({ view, title, onViewChange, onMenuToggle }: HeaderProps) {
  const user = getStoredUser();
  const workspace = getStoredPrepWorkspace();
  const roleLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Frontend';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleLogout = async () => {
    await clearSessionState();
    setDropdownOpen(false);
    window.location.assign('/');
  };

  return (
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-blueprint-line bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onMenuToggle} className="rounded-full border border-blueprint-line p-2 text-blueprint-muted transition-colors hover:text-primary md:hidden">
          <Menu size={16} />
        </button>
      </div>

      <div className="min-w-0 flex-1 text-center">
        <h1 className={cn('truncate text-headline-md text-primary not-italic', view === 'dashboard' && 'md:text-center')}>{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative" ref={dropdownRef}>
          <button type="button" onClick={() => setDropdownOpen((open) => !open)} className="flex items-center gap-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blueprint-line bg-primary text-sm font-semibold text-white">
              {getInitials(user?.name, user?.email)}
            </div>
            <ChevronDown size={14} className={cn('text-blueprint-muted transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen ? (
            <div className="absolute right-0 top-12 min-w-[180px] rounded-xl border border-blueprint-line bg-white py-2 shadow-xl">
              {user?.name ? <p className="px-4 py-1 text-sm font-semibold text-primary">{user.name}</p> : null}
              {user?.email ? <p className="px-4 pb-1 text-xs text-blueprint-muted">{user.email}</p> : null}
              <p className="border-b border-blueprint-line px-4 pb-2 text-xs font-medium text-primary">{roleLabel}</p>
              <button type="button" onClick={() => { setDropdownOpen(false); onViewChange?.('settings'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-[#f5f3f3]">
                <SettingsIcon size={14} className="text-blueprint-muted" /> Settings
              </button>
              <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-[#f5f3f3]">
                <LogOut size={14} className="text-blueprint-muted" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

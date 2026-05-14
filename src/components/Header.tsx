import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, Layers3, LogOut, Menu, MoonStar, Settings as SettingsIcon, SunMedium } from 'lucide-react';
import { clearSessionState, getStoredUser } from '../lib/session';
import { View } from '../App';
import { cn } from '../lib/utils';
import DomainPickerDialog from './DomainPickerDialog';
import GlobalSearch from './GlobalSearch';
import { DOMAIN_LABELS, updatePrepWorkspace } from '../lib/prep';
import { usePrepWorkspace } from '../hooks/usePrepWorkspace';
import { useThemePreference } from '../hooks/useThemePreference';
import { applyThemePreference, shouldUseDarkTheme } from '../lib/theme';
import { updateUserPreferences } from '../lib/userPreferences';

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
  const workspace = usePrepWorkspace();
  const themePreference = useThemePreference();
  const roleLabel = DOMAIN_LABELS[workspace.selections.domain] ?? 'Choose domain';
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [domainDialogOpen, setDomainDialogOpen] = useState(false);
  const [domainError, setDomainError] = useState<string | null>(null);
  const [savingDomain, setSavingDomain] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isDarkMode = shouldUseDarkTheme(themePreference);

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

  const handleThemeToggle = async () => {
    const nextTheme = isDarkMode ? 'light' : 'dark';
    applyThemePreference(nextTheme);
    const result = await updateUserPreferences({ theme: nextTheme });
    if (!result.ok) {
      applyThemePreference(themePreference);
    }
  };

  const handleDomainSave = async (domain: string) => {
    setDomainError(null);
    setSavingDomain(true);
    const result = await updateUserPreferences({ domain });
    setSavingDomain(false);
    if ('error' in result) {
      setDomainError(result.error);
      return;
    }

    updatePrepWorkspace({ selections: { ...workspace.selections, domain: result.data.domain } });
    setDomainDialogOpen(false);
  };

  return (
    <>
    <header className="sticky top-0 z-40 flex h-16 items-center justify-between gap-4 border-b border-blueprint-line bg-background px-4 sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-4">
        <button type="button" onClick={onMenuToggle} className="rounded-full border border-blueprint-line p-2 text-blueprint-muted transition-colors hover:text-primary md:hidden">
          <Menu size={16} />
        </button>
      </div>

      <div className="hidden min-w-0 flex-1 items-center justify-center px-4 lg:flex">
        <GlobalSearch compact />
      </div>

      <div className="min-w-0 flex-1 text-center lg:hidden">
        <h1 className={cn('truncate text-headline-md text-primary not-italic', view === 'dashboard' && 'md:text-center')}>{title}</h1>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void handleThemeToggle()}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-blueprint-line bg-card text-blueprint-muted transition-colors hover:bg-[#f5f3f3] hover:text-primary dark:hover:bg-white/5"
          aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {isDarkMode ? <SunMedium size={16} /> : <MoonStar size={16} />}
        </button>

        <button
          type="button"
          onClick={() => setDomainDialogOpen(true)}
          className="hidden items-center gap-2 rounded-full border border-blueprint-line bg-card px-4 py-2 text-ui-label text-primary transition-colors hover:bg-[#f5f3f3] dark:hover:bg-white/5 sm:flex"
        >
          <Layers3 size={15} className="text-blueprint-muted" />
          {roleLabel}
        </button>

        <div className="relative" ref={dropdownRef}>
          <button type="button" onClick={() => setDropdownOpen((open) => !open)} className="flex items-center gap-1.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full border border-blueprint-line bg-card text-sm font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(0,0,0,0.03)] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]">
              {getInitials(user?.name, user?.email)}
            </div>
            <ChevronDown size={14} className={cn('text-blueprint-muted transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {dropdownOpen ? (
            <div className="absolute right-0 top-12 min-w-[220px] rounded-2xl border border-blueprint-line bg-card py-2 shadow-[0_18px_40px_rgba(0,0,0,0.14)] dark:shadow-[0_18px_40px_rgba(0,0,0,0.32)]">
              {user?.name ? <p className="px-4 py-1 text-sm font-semibold text-primary">{user.name}</p> : null}
              {user?.email ? <p className="px-4 pb-1 text-xs text-blueprint-muted">{user.email}</p> : null}
              <p className="border-b border-blueprint-line px-4 pb-2 text-xs font-medium text-primary">{roleLabel}</p>
              <button type="button" onClick={() => { setDropdownOpen(false); setDomainDialogOpen(true); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-[#f5f3f3] dark:hover:bg-white/5 sm:hidden">
                <Layers3 size={14} className="text-blueprint-muted" /> Change domain
              </button>
              <button type="button" onClick={() => { setDropdownOpen(false); onViewChange?.('settings'); }} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-[#f5f3f3] dark:hover:bg-white/5">
                <SettingsIcon size={14} className="text-blueprint-muted" /> Settings
              </button>
              <button type="button" onClick={handleLogout} className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-primary transition-colors hover:bg-[#f5f3f3] dark:hover:bg-white/5">
                <LogOut size={14} className="text-blueprint-muted" /> Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
    <div className="border-b border-blueprint-line bg-background px-4 py-3 lg:hidden">
      <GlobalSearch />
    </div>
    <DomainPickerDialog
      open={domainDialogOpen}
      value={workspace.selections.domain}
      saving={savingDomain}
      error={domainError}
      onClose={() => {
        setDomainDialogOpen(false);
        setDomainError(null);
      }}
      onSave={handleDomainSave}
    />
    </>
  );
}

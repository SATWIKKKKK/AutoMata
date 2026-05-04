import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Routes, Route, Navigate, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import PageProgress from './components/PageProgress';
import Dashboard from './views/Dashboard';
import Builder from './views/Builder';
import TerminalPage from './views/TerminalPage';
import Editor from './views/Editor';
import Registry from './views/Registry';
import Analytics from './views/Analytics';
import Workflows from './views/Workflows';
import Templates from './views/Templates';
import Pulse from './views/Pulse';
import Landing from './views/Landing';
import Auth from './views/Auth';
import WorkflowDetail from './views/WorkflowDetail';
import Settings from './views/Settings';
import { getStoredUser } from './lib/session';

export type View =
  | 'landing' | 'dashboard' | 'builder' | 'terminal' | 'editor' | 'registry' | 'analytics'
  | 'workflows' | 'templates' | 'pulse' | 'docs' | 'settings' | 'auth' | 'signup'
  | 'pricing' | 'privacy' | 'terms' | 'security';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getStoredUser()?.loggedIn ? <>{children}</> : <Navigate to="/signin" replace />;
}

function SettingsRoute({ onViewChange }: { onViewChange: (view: View) => void }) {
  const params = useParams<{ tab?: string }>();
  const normalizedTab = params.tab === 'preferences' ? 'preferences' : 'profile';
  return <Settings onViewChange={onViewChange} initialTab={normalizedTab} />;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const user = getStoredUser();

  const isWorkflowDetailPath = Boolean(matchPath('/workflows/:id', location.pathname));
  const isSettingsPath = location.pathname === '/settings' || location.pathname.startsWith('/settings/');
  const showAppChrome = Boolean(user?.loggedIn) && (
    ['/dashboard', '/workflows', '/analytics', '/templates'].includes(location.pathname)
    || isWorkflowDetailPath
    || isSettingsPath
  );

  const pathToView: Record<string, View> = {
    '/': 'landing',
    '/signin': 'auth',
    '/login': 'auth',
    '/signup': 'signup',
    '/dashboard': 'dashboard',
    '/builder': 'builder',
    '/workflows': 'workflows',
    '/registry': 'registry',
    '/editor': 'editor',
    '/terminal': 'terminal',
    '/analytics': 'analytics',
    '/templates': 'templates',
    '/pulse': 'pulse',
    '/settings': 'settings',
  };

  const currentView: View = isWorkflowDetailPath
    ? 'workflows'
    : (isSettingsPath ? 'settings' : (pathToView[location.pathname] ?? 'landing'));

  const headerTitle = isWorkflowDetailPath
    ? 'Session Feedback'
    : ({
        dashboard: 'Prep Overview',
        builder: 'Prep Setup',
        workflows: 'Practice Tracks',
        registry: 'Scenario Round',
        editor: 'Coding Round',
        terminal: 'Mock Interview',
        analytics: 'Gap Review',
        templates: 'Archive',
        pulse: 'Session Feedback',
        settings: 'Settings',
      } as Record<View, string | undefined>)[currentView] ?? 'Promptly';

  const handleViewChange = (view: View) => {
    const destination = ({
      landing: '/',
      auth: '/signin',
      signup: '/signup',
      dashboard: '/dashboard',
      builder: '/builder',
      workflows: '/workflows',
      registry: '/registry',
      editor: '/editor',
      terminal: '/terminal',
      analytics: '/analytics',
      templates: '/templates',
      pulse: '/pulse',
      settings: '/settings/profile',
      docs: '/',
      pricing: '/',
      privacy: '/',
      terms: '/',
      security: '/',
    } as Record<View, string>)[view];

    setIsMobileSidebarOpen(false);
    navigate(destination);
  };

  useEffect(() => {
    if (!user?.loggedIn) return;
    let ignore = false;

    void fetch('/api/users/preferences', { credentials: 'include' })
      .then(async (response) => {
        if (!response.ok) return null;
        return response.json() as Promise<{ sidebarOpen?: boolean }>;
      })
      .then((data) => {
        if (!data || ignore || typeof data.sidebarOpen !== 'boolean') return;
        setIsSidebarCollapsed(!data.sidebarOpen);
      })
      .catch(() => undefined);

    return () => {
      ignore = true;
    };
  }, [user?.loggedIn]);

  const handleSidebarToggle = () => {
    const nextCollapsed = !isSidebarCollapsed;
    setIsSidebarCollapsed(nextCollapsed);
    if (user?.loggedIn) {
      void fetch('/api/users/preferences', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sidebarOpen: !nextCollapsed }),
      }).catch(() => undefined);
    }
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background">
      <PageProgress />

      {showAppChrome ? (
        <>
          <div className="hidden md:block">
            <Sidebar currentView={currentView} onViewChange={handleViewChange} isCollapsed={isSidebarCollapsed} onToggle={handleSidebarToggle} />
          </div>

          <AnimatePresence>
            {isMobileSidebarOpen ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 md:hidden">
                <div className="absolute inset-0 bg-black/40" onClick={() => setIsMobileSidebarOpen(false)} />
                <motion.div initial={{ x: -320 }} animate={{ x: 0 }} exit={{ x: -320 }} transition={{ duration: 0.24, ease: 'easeOut' }} className="absolute inset-y-0 left-0 w-[280px]">
                  <Sidebar currentView={currentView} onViewChange={handleViewChange} isCollapsed={false} onToggle={() => setIsMobileSidebarOpen(false)} />
                </motion.div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {showAppChrome ? <Header view={currentView} title={headerTitle} onViewChange={handleViewChange} onMenuToggle={() => setIsMobileSidebarOpen(true)} /> : null}
        <main className="flex-1 overflow-y-auto overflow-x-hidden">
          <Routes>
            <Route path="/" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Landing onStart={() => navigate('/signup')} onViewDocs={() => navigate('/builder')} onViewChange={handleViewChange} />} />
            <Route path="/signin" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Auth initialMode="login" onAuthSuccess={() => navigate('/builder')} onBackToLanding={() => navigate('/')} />} />
            <Route path="/login" element={<Navigate to="/signin" replace />} />
            <Route path="/signup" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Auth initialMode="signup" onAuthSuccess={() => navigate('/builder')} onBackToLanding={() => navigate('/')} />} />

            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/builder" element={<ProtectedRoute><Builder onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/workflows" element={<ProtectedRoute><Workflows /></ProtectedRoute>} />
            <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowDetail /></ProtectedRoute>} />
            <Route path="/registry" element={<ProtectedRoute><Registry /></ProtectedRoute>} />
            <Route path="/editor" element={<ProtectedRoute><Editor workflow={null} onSave={() => undefined} /></ProtectedRoute>} />
            <Route path="/terminal" element={<ProtectedRoute><TerminalPage onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/pulse" element={<ProtectedRoute><Pulse /></ProtectedRoute>} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/:tab" element={<ProtectedRoute><SettingsRoute onViewChange={handleViewChange} /></ProtectedRoute>} />

            <Route path="/docs" element={<Navigate to="/builder" replace />} />
            <Route path="/pricing" element={<Navigate to="/" replace />} />
            <Route path="/privacy" element={<Navigate to="/" replace />} />
            <Route path="/terms" element={<Navigate to="/" replace />} />
            <Route path="/security" element={<Navigate to="/" replace />} />
            <Route path="/legal/privacy" element={<Navigate to="/" replace />} />
            <Route path="/legal/terms" element={<Navigate to="/" replace />} />
            <Route path="/legal/security" element={<Navigate to="/" replace />} />
            <Route path="/w/:token" element={<Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to={user?.loggedIn ? '/dashboard' : '/'} replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
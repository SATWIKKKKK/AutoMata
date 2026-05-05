import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BrowserRouter, Navigate, Route, Routes, matchPath, useLocation, useNavigate, useParams } from 'react-router-dom';
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
import Pulse from './views/Pulse';
import Landing from './views/Landing';
import Auth from './views/Auth';
import WorkflowDetail from './views/WorkflowDetail';
import Settings from './views/Settings';
import QuestionBank from './views/QuestionBank';
import ResultsPage from './views/ResultsPage';
import { Privacy, SecurityPage, Terms } from './views/Legal';
import { fetchCurrentUser, getStoredUser, persistSessionUser, SessionUser } from './lib/session';
import { isOnboardingComplete } from './lib/prep';

export type View =
  | 'landing' | 'dashboard' | 'builder' | 'terminal' | 'editor' | 'registry' | 'analytics'
  | 'workflows' | 'questionBank' | 'pulse' | 'docs' | 'settings' | 'auth' | 'signup'
  | 'pricing' | 'privacy' | 'terms' | 'security';

function ProtectedRoute({
  children,
  allowIncomplete = false,
  sessionChecked,
  user,
}: {
  children: React.ReactNode;
  allowIncomplete?: boolean;
  sessionChecked: boolean;
  user: SessionUser | null;
}) {
  if (!sessionChecked) {
    return <div className="min-h-screen bg-background" />;
  }
  if (!user?.loggedIn) return <Navigate to="/signin" replace />;
  if (!allowIncomplete && !isOnboardingComplete()) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function SettingsRoute({ onViewChange }: { onViewChange: (view: View) => void }) {
  const params = useParams<{ tab?: string }>();
  const normalizedTab = params.tab === 'preferences' ? 'preferences' : 'profile';
  return <Settings onViewChange={onViewChange} initialTab={normalizedTab} />;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(() => getStoredUser());
  const [sessionChecked, setSessionChecked] = useState(Boolean(getStoredUser()));

  useEffect(() => {
    if (user?.loggedIn) {
      setSessionChecked(true);
      return;
    }

    let ignore = false;
    void fetchCurrentUser()
      .then((sessionUser) => {
        if (ignore) return;
        if (sessionUser) {
          persistSessionUser(sessionUser);
          setUser(sessionUser);
        }
        setSessionChecked(true);
      })
      .catch(() => {
        if (!ignore) setSessionChecked(true);
      });

    return () => {
      ignore = true;
    };
  }, [user?.loggedIn]);

  const isResultsPath = Boolean(matchPath('/results/:roundType', location.pathname));
  const isSettingsPath = location.pathname === '/settings' || location.pathname.startsWith('/settings/');
  const isAuthShellPath = ['/', '/signin', '/login', '/signup', '/onboarding'].includes(location.pathname);
  const showAppChrome = Boolean(user?.loggedIn) && !isAuthShellPath;

  const pathToView: Record<string, View> = {
    '/': 'landing',
    '/signin': 'auth',
    '/login': 'auth',
    '/signup': 'signup',
    '/dashboard': 'dashboard',
    '/onboarding': 'builder',
    '/builder': 'builder',
    '/practice-tracks': 'workflows',
    '/workflows': 'workflows',
    '/scenario-round': 'registry',
    '/registry': 'registry',
    '/coding-round': 'editor',
    '/editor': 'editor',
    '/mock-interview': 'terminal',
    '/terminal': 'terminal',
    '/gap-review': 'analytics',
    '/analytics': 'analytics',
    '/question-bank': 'questionBank',
    '/results': 'pulse',
    '/pulse': 'pulse',
    '/settings': 'settings',
    '/privacy': 'privacy',
    '/terms': 'terms',
    '/security': 'security',
  };

  const currentView: View = isResultsPath
    ? 'pulse'
    : (isSettingsPath ? 'settings' : (pathToView[location.pathname] ?? 'landing'));

  const headerTitle = ({
    dashboard: 'Prep Overview',
    builder: 'Onboarding',
    workflows: 'Practice Tracks',
    registry: 'Scenario Round',
    editor: 'Coding Round',
    terminal: 'Mock Interview',
    analytics: 'Gap Review',
    questionBank: 'Question Bank',
    pulse: 'Session Feedback',
    settings: 'Settings',
    privacy: 'Privacy',
    terms: 'Terms',
    security: 'Security',
  } as Record<View, string | undefined>)[currentView] ?? 'Promptly';

  const handleViewChange = (view: View) => {
    const destination = ({
      landing: '/',
      auth: '/signin',
      signup: '/signup',
      dashboard: '/dashboard',
      builder: '/onboarding',
      workflows: '/practice-tracks',
      registry: '/scenario-round',
      editor: '/coding-round',
      terminal: '/mock-interview',
      analytics: '/gap-review',
      questionBank: '/question-bank',
      pulse: '/results/practice-tracks',
      settings: '/settings/profile',
      docs: '/',
      pricing: '/',
      privacy: '/privacy',
      terms: '/terms',
      security: '/security',
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
            <Route path="/" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Landing onStart={() => navigate('/signup')} onViewDocs={() => navigate('/dashboard')} onViewChange={handleViewChange} />} />
            <Route path="/signin" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Auth initialMode="login" onAuthSuccess={() => { setUser(getStoredUser()); navigate('/onboarding'); }} onBackToLanding={() => navigate('/')} />} />
            <Route path="/login" element={<Navigate to="/signin" replace />} />
            <Route path="/signup" element={user?.loggedIn ? <Navigate to="/dashboard" replace /> : <Auth initialMode="signup" onAuthSuccess={() => { setUser(getStoredUser()); navigate('/onboarding'); }} onBackToLanding={() => navigate('/')} />} />

            <Route path="/dashboard" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Dashboard /></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute user={user} sessionChecked={sessionChecked} allowIncomplete><Builder onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/builder" element={<Navigate to="/onboarding" replace />} />
            <Route path="/practice-tracks" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Workflows /></ProtectedRoute>} />
            <Route path="/workflows" element={<Navigate to="/practice-tracks" replace />} />
            <Route path="/workflows/:id" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><WorkflowDetail /></ProtectedRoute>} />
            <Route path="/scenario-round" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Registry /></ProtectedRoute>} />
            <Route path="/registry" element={<Navigate to="/scenario-round" replace />} />
            <Route path="/coding-round" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Editor workflow={null} onSave={() => undefined} /></ProtectedRoute>} />
            <Route path="/editor" element={<Navigate to="/coding-round" replace />} />
            <Route path="/mock-interview" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><TerminalPage onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/terminal" element={<Navigate to="/mock-interview" replace />} />
            <Route path="/gap-review" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Analytics /></ProtectedRoute>} />
            <Route path="/analytics" element={<Navigate to="/gap-review" replace />} />
            <Route path="/question-bank" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><QuestionBank /></ProtectedRoute>} />
            <Route path="/templates" element={<Navigate to="/question-bank" replace />} />
            <Route path="/pulse" element={<Navigate to="/results/practice-tracks" replace />} />
            <Route path="/results" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><ResultsPage /></ProtectedRoute>} />
            <Route path="/results/:roundType" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><ResultsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/:tab" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><SettingsRoute onViewChange={handleViewChange} /></ProtectedRoute>} />

            <Route path="/docs" element={<Navigate to="/onboarding" replace />} />
            <Route path="/pricing" element={<Navigate to="/" replace />} />
            <Route path="/privacy" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Privacy onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/terms" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><Terms onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute user={user} sessionChecked={sessionChecked}><SecurityPage onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="/legal/privacy" element={<Navigate to="/privacy" replace />} />
            <Route path="/legal/terms" element={<Navigate to="/terms" replace />} />
            <Route path="/legal/security" element={<Navigate to="/security" replace />} />
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

import React, { useLayoutEffect, useState } from 'react';
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
import Docs from './views/Docs';
import Settings from './views/Settings';
import Landing from './views/Landing';
import Auth from './views/Auth';
import Pricing from './views/Pricing';
import WorkflowDetail from './views/WorkflowDetail';
import SharedWorkflow from './views/SharedWorkflow';
import { Privacy, Terms, SecurityPage as Security } from './views/Legal';
import { WorkflowDAG } from './services/geminiService';
import { getStoredUser, setSessionCookie } from './lib/session';

export type View =
  | 'landing' | 'dashboard' | 'builder' | 'terminal' | 'editor' | 'registry' | 'analytics'
  | 'workflows' | 'templates' | 'pulse' | 'docs' | 'settings' | 'auth' | 'signup'
  | 'pricing' | 'privacy' | 'terms' | 'security';

function getUser() {
  try { return JSON.parse(localStorage.getItem('automata_user') || 'null'); } catch { return null; }
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return getUser()?.loggedIn ? <>{children}</> : <Navigate to="/signin" replace />;
}

const PUBLIC_PATHS = ['/', '/login', '/signin', '/signup', '/pricing', '/privacy', '/terms', '/security', '/legal/privacy', '/legal/terms', '/legal/security', '/docs'];
const APP_PATHS = ['/builder', '/terminal', '/dashboard', '/editor', '/workflows', '/templates', '/pulse', '/registry', '/analytics', '/settings'];

function SettingsRoute({ onViewChange }: { onViewChange: (view: View) => void }) {
  const params = useParams<{ tab?: string }>();
  const tab = params.tab;
  const normalizedTab = tab === 'integrations' || tab === 'billing' || tab === 'profile' ? tab : 'profile';
  return <Settings onViewChange={onViewChange} initialTab={normalizedTab} />;
}

function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDAG | null>(() => {
    try { return JSON.parse(localStorage.getItem('automata_active_workflow') || 'null'); } catch { return null; }
  });

  const isWorkflowDetailPath = Boolean(matchPath('/workflows/:id', location.pathname));
  const isSharedWorkflowPath = Boolean(matchPath('/w/:token', location.pathname));
  const isSettingsPath = location.pathname === '/settings' || location.pathname.startsWith('/settings/');
  const isPublicPath = PUBLIC_PATHS.includes(location.pathname);
  const isAppPath = APP_PATHS.includes(location.pathname) || isSettingsPath;
  const showAppChrome = (isAppPath || isWorkflowDetailPath) && !isSharedWorkflowPath;

  const pathToView: Record<string, View> = {
    '/': 'landing', '/login': 'auth', '/signin': 'auth', '/signup': 'signup',
    '/dashboard': 'dashboard', '/builder': 'builder', '/terminal': 'terminal',
    '/editor': 'editor', '/registry': 'registry',
    '/analytics': 'analytics', '/workflows': 'workflows', '/docs': 'docs',
    '/templates': 'templates',
    '/pulse': 'pulse',
    '/settings': 'settings', '/pricing': 'pricing', '/privacy': 'privacy',
    '/terms': 'terms', '/security': 'security', '/legal/privacy': 'privacy',
    '/legal/terms': 'terms', '/legal/security': 'security',
  };
  const currentView: View = isWorkflowDetailPath
    ? 'workflows'
    : (isSettingsPath ? 'settings' : (pathToView[location.pathname] ?? 'landing'));

  const handleViewChange = (view: View) => {
    const viewToPath: Partial<Record<View, string>> = {
      landing: '/',
      auth: '/signin',
      privacy: '/legal/privacy',
      terms: '/legal/terms',
      security: '/legal/security',
      settings: '/settings/profile',
    };
    setIsMobileSidebarOpen(false);
    navigate(viewToPath[view] ?? `/${view}`);
  };

  const handleWorkflowCreated = (dag: WorkflowDAG) => {
    setActiveWorkflow(dag);
    localStorage.setItem('automata_active_workflow', JSON.stringify(dag));
    navigate('/editor');
  };

  const handleWorkflowSave = (dag: WorkflowDAG) => {
    setActiveWorkflow(dag);
    localStorage.setItem('automata_active_workflow', JSON.stringify(dag));
  };

  useLayoutEffect(() => {
    const user = getStoredUser();
    if (user?.email) {
      setSessionCookie(user.email);
    }
  }, []);

  return (
    <div className="flex h-screen w-full bg-blueprint-bg overflow-hidden relative">
      <PageProgress />
      {!isWorkflowDetailPath && <div className="fixed inset-0 pointer-events-none blueprint-grid opacity-30 z-0"></div>}

      {showAppChrome && (
        <>
          <div className="hidden md:block relative z-20">
            <Sidebar
              currentView={currentView}
              onViewChange={handleViewChange}
              isCollapsed={isSidebarCollapsed}
              onToggle={() => setIsSidebarCollapsed((current) => !current)}
            />
          </div>

          <AnimatePresence>
            {isMobileSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 md:hidden"
              >
                <div className="absolute inset-0 bg-black/45" onClick={() => setIsMobileSidebarOpen(false)} />
                <motion.div
                  initial={{ x: -280 }}
                  animate={{ x: 0 }}
                  exit={{ x: -280 }}
                  transition={{ duration: 0.24, ease: 'easeOut' }}
                  className="absolute inset-y-0 left-0 w-[260px]"
                >
                  <Sidebar
                    currentView={currentView}
                    onViewChange={handleViewChange}
                    isCollapsed={false}
                    onToggle={() => setIsMobileSidebarOpen(false)}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0 relative z-10 w-full overflow-hidden">
        {showAppChrome && (
          <Header
            view={currentView}
            workflowName={activeWorkflow?.workflow_name}
            onViewChange={handleViewChange}
            onMenuToggle={() => setIsMobileSidebarOpen(true)}
          />
        )}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <Routes>
            <Route path="/" element={
              <Landing onStart={() => navigate('/signup')} onViewDocs={() => navigate('/docs')} onViewChange={handleViewChange} />
            } />
            <Route path="/signin" element={
              getUser()?.loggedIn ? <Navigate to="/builder" replace /> :
              <Auth initialMode="login" onAuthSuccess={() => navigate('/builder')} onBackToLanding={() => navigate('/')} />
            } />
            <Route path="/login" element={<Navigate to="/signin" replace />} />
            <Route path="/signup" element={
              getUser()?.loggedIn ? <Navigate to="/builder" replace /> :
              <Auth initialMode="signup" onAuthSuccess={() => navigate('/builder')} onBackToLanding={() => navigate('/')} />
            } />
            <Route path="/pricing" element={<Pricing onViewChange={handleViewChange} />} />
            <Route path="/legal/privacy" element={<Privacy onViewChange={handleViewChange} />} />
            <Route path="/legal/terms" element={<Terms onViewChange={handleViewChange} />} />
            <Route path="/legal/security" element={<Security onViewChange={handleViewChange} />} />
            <Route path="/privacy" element={<Privacy onViewChange={handleViewChange} />} />
            <Route path="/terms" element={<Terms onViewChange={handleViewChange} />} />
            <Route path="/security" element={<Security onViewChange={handleViewChange} />} />
            <Route path="/docs" element={<Docs onViewChange={handleViewChange} />} />
            <Route path="/dashboard" element={<Navigate to="/builder" replace />} />
            <Route path="/builder" element={
              <ProtectedRoute><Builder onViewChange={handleViewChange} /></ProtectedRoute>
            } />
            <Route path="/terminal" element={
              <ProtectedRoute><TerminalPage onViewChange={handleViewChange} /></ProtectedRoute>
            } />
            <Route path="/editor" element={
              <ProtectedRoute><Editor workflow={activeWorkflow} onSave={handleWorkflowSave} /></ProtectedRoute>
            } />
            <Route path="/workflows" element={
              <ProtectedRoute><Workflows onViewWorkflow={(dag) => { handleWorkflowSave(dag); navigate('/editor'); }} /></ProtectedRoute>
            } />
            <Route path="/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
            <Route path="/workflows/:id" element={<ProtectedRoute><WorkflowDetail /></ProtectedRoute>} />
            <Route path="/w/:token" element={<SharedWorkflow />} />
            <Route path="/registry" element={<ProtectedRoute><Registry /></ProtectedRoute>} />
            <Route path="/analytics" element={<ProtectedRoute><Analytics /></ProtectedRoute>} />
            <Route path="/pulse" element={<ProtectedRoute><Pulse /></ProtectedRoute>} />
            <Route path="/settings" element={<Navigate to="/settings/profile" replace />} />
            <Route path="/settings/:tab" element={<ProtectedRoute><SettingsRoute onViewChange={handleViewChange} /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
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


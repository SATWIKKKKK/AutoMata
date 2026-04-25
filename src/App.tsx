import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Editor from './views/Editor';
import Registry from './views/Registry';
import Analytics from './views/Analytics';
import Workflows from './views/Workflows';
import Docs from './views/Docs';
import Settings from './views/Settings';
import Landing from './views/Landing';
import Auth from './views/Auth';
import { WorkflowDAG } from './services/geminiService';

export type View = 'landing' | 'dashboard' | 'editor' | 'registry' | 'analytics' | 'workflows' | 'docs' | 'settings' | 'auth' | 'signup';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('landing');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDAG | null>(null);

  const renderView = () => {
    switch (currentView) {
      case 'landing':
        return <Landing 
          onStart={() => setCurrentView('signup')} 
          onViewDocs={() => setCurrentView('docs')} 
          onViewChange={setCurrentView}
        />;
      case 'auth':
        return <Auth 
          initialMode="login"
          onAuthSuccess={() => setCurrentView('dashboard')}
          onBackToLanding={() => setCurrentView('landing')}
        />;
      case 'signup':
        return <Auth 
          initialMode="signup"
          onAuthSuccess={() => setCurrentView('dashboard')}
          onBackToLanding={() => setCurrentView('landing')}
        />;
      case 'dashboard':
        return <Dashboard 
          onWorkflowCreated={(dag) => {
            setActiveWorkflow(dag);
            setCurrentView('editor');
          }} 
          onViewChange={setCurrentView}
        />;
      case 'editor':
        return <Editor workflow={activeWorkflow} onSave={(dag) => setActiveWorkflow(dag)} />;
      case 'registry':
        return <Registry />;
      case 'analytics':
        return <Analytics />;
      case 'workflows':
        return <Workflows onViewWorkflow={(dag) => {
          setActiveWorkflow(dag);
          setCurrentView('editor');
        }} />;
      case 'docs':
        return <Docs />;
      case 'settings':
        return <Settings />;
      default:
        return <Landing 
          onStart={() => setCurrentView('dashboard')} 
          onViewDocs={() => setCurrentView('docs')} 
          onViewChange={setCurrentView}
        />;
    }
  };

  const isPublicView = currentView === 'landing' || currentView === 'auth' || currentView === 'signup';

  return (
    <div className="flex h-screen w-full bg-blueprint-bg overflow-hidden relative">
      {/* Ambient Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none blueprint-grid opacity-30 z-0"></div>
      
      {!isPublicView && (
        <Sidebar 
          currentView={currentView} 
          onViewChange={setCurrentView} 
          isCollapsed={isSidebarCollapsed}
          onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      )}
      
      <div className="flex-1 flex flex-col min-w-0 relative z-10 w-full overflow-hidden">
        {!isPublicView && (
          <Header 
            view={currentView} 
            workflowName={activeWorkflow?.workflow_name} 
          />
        )}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}


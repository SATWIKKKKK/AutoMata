import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Dashboard from './views/Dashboard';
import Editor from './views/Editor';
import Registry from './views/Registry';
import Analytics from './views/Analytics';
import Workflows from './views/Workflows';
import { WorkflowDAG } from './services/geminiService';

export type View = 'dashboard' | 'editor' | 'registry' | 'analytics' | 'workflows';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowDAG | null>(null);

  // Smooth view transition
  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onWorkflowCreated={(dag) => {
          setActiveWorkflow(dag);
          setCurrentView('editor');
        }} />;
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
      default:
        return <Dashboard onWorkflowCreated={(dag) => setActiveWorkflow(dag)} />;
    }
  };

  return (
    <div className="flex h-screen w-full bg-blueprint-bg overflow-hidden relative">
      {/* Ambient Grid Overlay */}
      <div className="fixed inset-0 pointer-events-none blueprint-grid opacity-30 z-0"></div>
      
      <Sidebar 
        currentView={currentView} 
        onViewChange={setCurrentView} 
        isCollapsed={isSidebarCollapsed}
        onToggle={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 relative z-10 w-full overflow-hidden">
        <Header 
          view={currentView} 
          workflowName={activeWorkflow?.workflow_name} 
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          {renderView()}
        </main>
      </div>
    </div>
  );
}

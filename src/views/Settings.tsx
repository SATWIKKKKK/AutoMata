import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  Users, 
  Key, 
  CreditCard, 
  ShieldCheck, 
  Smartphone,
  Save,
  Trash2,
  Plus
} from 'lucide-react';
import { cn } from '../lib/utils';

const tabs = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'team', label: 'Team', icon: Users },
  { id: 'billing', label: 'Billing', icon: CreditCard },
  { id: 'security', label: 'Security', icon: ShieldCheck },
  { id: 'api', label: 'API Keys', icon: Key },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => setIsSaving(false), 800);
  };

  return (
    <div className="p-12 md:p-16 max-w-[1440px] mx-auto w-full space-y-12 h-full flex flex-col">
      <div className="space-y-4">
        <h2 className="text-display-xl text-blueprint-accent">Settings</h2>
        <p className="text-body-lg text-blueprint-muted max-w-2xl">
          Configure your autonomous infrastructure. Manage workspace environments, access controls, and fiscal guardrails.
        </p>
      </div>

      <div className="flex bg-blueprint-line/20 rounded-2xl p-1.5 border border-blueprint-line/40 self-start">
        {tabs.map((tab) => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-ui-label transition-all",
              activeTab === tab.id 
                ? "bg-white text-blueprint-accent shadow-lg" 
                : "text-blueprint-muted hover:text-blueprint-accent"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 bg-surface-container-lowest border border-blueprint-line rounded-2xl overflow-hidden flex shadow-sm">
         {/* Settings Header/Navigation Side */}
         <div className="hidden lg:flex w-80 border-r border-blueprint-line bg-blueprint-bg/20 p-8 flex-col justify-between">
            <div className="space-y-8">
               <div className="space-y-2">
                  <h4 className="text-ui-label text-blueprint-accent">Active Context</h4>
                  <p className="text-technical-mono opacity-50 text-[10px]">PRODUCTION ENVIRONMENT</p>
               </div>
               <div className="p-4 bg-white border border-blueprint-line rounded-lg shadow-sm space-y-3">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded bg-blueprint-accent flex items-center justify-center text-white font-serif italic">OP</div>
                     <div>
                        <p className="text-sm font-semibold text-blueprint-accent">Automata Product</p>
                        <p className="text-[10px] text-blueprint-muted">Personal Workspace</p>
                     </div>
                  </div>
               </div>
            </div>

            <div className="space-y-4">
               <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-yellow-800 text-[10px] font-bold uppercase tracking-tighter">
                     <Smartphone size={12} />
                     Maintenance Mode
                  </div>
                  <p className="text-[11px] text-yellow-700 leading-relaxed">Enabling maintenance mode will pause all active autonomous cycles.</p>
               </div>
            </div>
         </div>

         {/* Content Area */}
         <div className="flex-1 p-12 overflow-y-auto">
            <motion.div 
               key={activeTab}
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               className="max-w-3xl space-y-12"
            >
               {activeTab === 'general' && (
                  <div className="space-y-10">
                     <div className="space-y-2">
                        <h3 className="text-headline-md text-blueprint-accent text-3xl">General Workspace</h3>
                        <p className="text-body-md text-blueprint-muted">Primary identification for your platform instance.</p>
                     </div>

                     <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                           <div className="space-y-2">
                              <label className="text-technical-mono text-blueprint-muted opacity-60">Workspace Name</label>
                              <input 
                                 type="text" 
                                 defaultValue="Automata Platform"
                                 className="w-full bg-surface-container-low border border-blueprint-line rounded-lg p-3 text-body-md focus:outline-none focus:border-blueprint-accent transition-all"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-technical-mono text-blueprint-muted opacity-60">Custom Domain</label>
                              <input 
                                 type="text" 
                                 defaultValue="orchestrator.domain.ext"
                                 className="w-full bg-surface-container-low border border-blueprint-line rounded-lg p-3 text-body-md focus:outline-none focus:border-blueprint-accent transition-all"
                              />
                           </div>
                        </div>

                        <div className="space-y-2">
                           <label className="text-technical-mono text-blueprint-muted opacity-60">Workspace Description</label>
                           <textarea 
                              rows={4}
                              defaultValue="Multi-agent orchestration platform integrating LangGraph precision with Temporal.io durability for complex AI workflows."
                              className="w-full bg-surface-container-low border border-blueprint-line rounded-lg p-4 text-body-md focus:outline-none focus:border-blueprint-accent transition-all resize-none"
                           />
                        </div>
                     </div>

                     <div className="pt-8 border-t border-blueprint-line">
                        <div className="flex justify-between items-center mb-6">
                           <div>
                              <h4 className="text-ui-label text-blueprint-accent">Budget Guardrail</h4>
                              <p className="text-sm text-blueprint-muted">Automatic pause when monthly Claude/Gemini usage hits limit.</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <input type="range" className="flex-1 accent-blueprint-accent" />
                           <span className="font-mono text-xl text-blueprint-accent font-bold">₹42,500</span>
                        </div>
                     </div>
                  </div>
               )}

               {activeTab === 'api' && (
                  <div className="space-y-10">
                     <div className="space-y-2">
                        <h3 className="text-headline-md text-blueprint-accent text-3xl">Platform Access Keys</h3>
                        <p className="text-body-md text-blueprint-muted">API credentials for interacting with the Automata CLI and external services.</p>
                     </div>

                     <div className="space-y-4">
                        {[
                           { name: "Production CLI Token", key: "automata_sk_live_*********************", lastUsed: "2 mins ago" },
                           { name: "Dev Staging Webhook", key: "automata_sk_test_*********************", lastUsed: "Never" }
                        ].map((key, i) => (
                           <div key={i} className="p-6 border border-blueprint-line rounded-xl bg-surface-container-low/20 flex justify-between items-center group">
                              <div className="space-y-1">
                                 <p className="text-ui-label text-blueprint-accent">{key.name}</p>
                                 <code className="text-technical-mono opacity-50 text-[11px]">{key.key}</code>
                              </div>
                              <div className="flex items-center gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <span className="text-[10px] text-blueprint-muted italic">Last used {key.lastUsed}</span>
                                 <button className="p-2 text-blueprint-muted hover:text-red-600 transition-colors">
                                    <Trash2 size={16} />
                                 </button>
                              </div>
                           </div>
                        ))}
                     </div>

                     <button className="w-full py-4 border border-dashed border-blueprint-line rounded-xl text-ui-label text-blueprint-muted hover:border-blueprint-accent hover:text-blueprint-accent transition-all flex items-center justify-center gap-2">
                        <Plus size={16} />
                        Generate New Infrastructure Token
                     </button>
                  </div>
               )}

               <div className="pt-10 border-t border-blueprint-line flex justify-end gap-4">
                  <button className="px-8 py-3 rounded-full text-ui-label text-blueprint-muted hover:bg-blueprint-line/40 transition-all">Cancel</button>
                  <button 
                     onClick={handleSave}
                     disabled={isSaving}
                     className={cn(
                        "px-10 py-3 rounded-full text-ui-label text-white transition-all flex items-center gap-2",
                        isSaving ? "bg-blueprint-muted animate-pulse" : "bg-blueprint-accent hover:opacity-90"
                     )}
                  >
                     <Save size={16} />
                     {isSaving ? "Persisting..." : "Save Configuration"}
                  </button>
               </div>
            </motion.div>
         </div>
      </div>
    </div>
  );
}

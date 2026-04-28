import React from 'react';
import { 
  Mail, 
  MessageSquare, 
  FileText, 
  Table,
  RefreshCw,
  Plus,
  ShieldCheck,
  Zap,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { motion } from 'framer-motion';

const integrations = [
  { id: 'gm', provider: 'Gmail', mcp: 'mcp.google.mail', icon: Mail, status: 'expired', health: 'Auth Token Expired', desc: 'Read, draft, and send emails on behalf of authenticated users.', enabled: false },
  { id: 'sl', provider: 'Slack', mcp: 'mcp.slack.v1', icon: MessageSquare, status: 'connected', health: '99.8% uptime (60ms)', desc: 'Channel messaging, thread management, and user lookups.', enabled: false },
  { id: 'nt', provider: 'Notion', mcp: 'mcp.notion.v1', icon: FileText, status: 'connected', health: '99.9% uptime (85ms)', desc: 'Database querying, page creation, and block-level editing.', enabled: true },
  { id: 'gs', provider: 'Google Sheets', mcp: 'mcp.google.sheets', icon: Table, status: 'warning', health: 'Rate Limit Approaching', desc: 'Row manipulation, formula injection, and worksheet management.', enabled: false },
];

export default function Registry() {
  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full space-y-10 sm:space-y-16">
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between lg:items-end border-b border-blueprint-line pb-6 sm:pb-8">
        <div className="space-y-2">
          <h2 className="text-headline-lg text-blueprint-accent">Tool Registry</h2>
          <p className="text-body-md text-blueprint-muted max-w-2xl">
            Connect and manage Model Context Protocol (MCP) servers. Enabled integrations are exposed to your active Operator Builder environments.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 w-full lg:w-auto">
          <button className="border border-blueprint-line text-blueprint-accent font-ui-label py-2 px-6 rounded-full flex items-center justify-center gap-2 hover:bg-blueprint-line/20 transition-all">
            <RefreshCw size={16} />
            Refresh
          </button>
          <button className="bg-blueprint-accent text-white font-ui-label py-2 px-6 rounded-full flex items-center justify-center gap-2 hover:opacity-90 transition-all">
            <Zap size={16} />
            Add Custom Server
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
        {integrations.map((item, idx) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
            className={cn(
              "bg-surface-container-lowest rounded-2xl p-6 sm:p-8 border border-blueprint-line flex flex-col justify-between shadow-sm hover:shadow-xl transition-all duration-300 group",
              item.status === 'expired' && "opacity-60"
            )}
          >
             <div className="space-y-6">
                <div className="flex justify-between items-start">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-blueprint-line/40 flex items-center justify-center border border-blueprint-line/50">
                         <item.icon size={24} className="text-blueprint-accent" />
                      </div>
                      <div>
                         <h3 className="text-ui-label text-blueprint-accent text-lg">{item.provider}</h3>
                         <p className="text-technical-mono opacity-50">{item.mcp}</p>
                      </div>
                   </div>
                   <span className={cn(
                     "px-2 py-1 rounded-full text-technical-mono text-[10px] flex items-center gap-1.5",
                     item.status === 'connected' ? "bg-green-100 text-green-700" : 
                     item.status === 'warning' ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                   )}>
                     <span className={cn("w-1.5 h-1.5 rounded-full", 
                        item.status === 'connected' ? "bg-green-600" : 
                        item.status === 'warning' ? "bg-yellow-600" : "bg-red-600")} 
                      />
                     {item.status.toUpperCase()}
                   </span>
                </div>

                <p className="text-body-md text-blueprint-muted text-sm leading-relaxed">{item.desc}</p>
                
                <div className="flex items-center gap-2 text-technical-mono text-blueprint-muted normal-case opacity-60">
                   {item.status === 'connected' ? <ShieldCheck size={14} /> : <Info size={14} />}
                   {item.health}
                </div>
             </div>

             <div className="pt-6 mt-8 border-t border-blueprint-line flex justify-between items-center">
                <span className="text-technical-mono text-[10px] text-blueprint-muted font-semibold">Enable in Builder</span>
                <button 
                  className={cn(
                    "w-12 h-6 rounded-full relative transition-colors duration-300 focus:outline-none",
                    item.enabled ? "bg-blueprint-accent" : "bg-blueprint-line"
                  )}
                >
                  <motion.div 
                    animate={{ x: item.enabled ? 24 : 4 }}
                    className="absolute top-1 w-4 h-4 rounded-full bg-white shadow-sm"
                  />
                </button>
             </div>
          </motion.div>
        ))}
      </div>

      <div className="border border-dashed border-blueprint-line rounded-2xl p-8 sm:p-16 flex flex-col items-center text-center bg-blueprint-bg/20">
         <div className="w-16 h-16 rounded-full bg-blueprint-line/40 flex items-center justify-center mb-6">
            <Plus size={32} className="text-blueprint-muted" />
         </div>
         <h4 className="text-headline-md text-blueprint-accent mb-4">Extend Your Workflow</h4>
         <p className="text-body-md text-blueprint-muted max-w-xl">
           Connect to proprietary internal APIs or third-party services via the Model Context Protocol. 
           Securely expose local tools and models to your autonomous operators.
         </p>
         <button className="mt-8 text-ui-label text-blueprint-accent hover:underline decoration-blueprint-line underline-offset-8">Read Security Docs</button>
      </div>
    </div>
  );
}

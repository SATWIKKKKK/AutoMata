import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';
import { 
  Brain, 
  Clock, 
  Database,
  User,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface NodeHeaderProps {
  icon: React.ReactNode;
  label: string;
  type: string;
  colorClass: string;
}

const NodeHeader = ({ icon, label, type, colorClass }: NodeHeaderProps) => (
  <div className={cn("flex items-center gap-3 p-3 border-b border-blueprint-line", colorClass)}>
    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
      {icon}
    </div>
    <div>
      <h3 className="text-ui-label text-blueprint-accent text-[12px]">{label}</h3>
      <p className="text-technical-mono opacity-60 text-[10px]">{type}</p>
    </div>
  </div>
);

function runtimeStateClass(status?: string) {
  switch (status) {
    case 'running':
      return 'border-blue-500 shadow-[0_0_0_1px_rgba(59,130,246,0.28),0_0_24px_rgba(59,130,246,0.18)] animate-pulse';
    case 'passed':
      return 'border-green-500 shadow-[0_0_0_1px_rgba(34,197,94,0.22)]';
    case 'failed':
      return 'border-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.22)]';
    case 'skipped':
      return 'border-yellow-500 opacity-75';
    default:
      return 'border-blueprint-line hover:border-blueprint-accent';
  }
}

export const CronTriggerNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border rounded-xl shadow-lg w-64 overflow-hidden group transition-colors', runtimeStateClass(data?.status))}>
    <NodeHeader 
      icon={<Clock size={16} />} 
      label={data.label || 'Schedule'} 
      type="CRON_TRIGGER"
      colorClass="bg-green-50"
    />
    <div className="p-4">
      <p className="text-technical-mono text-blueprint-muted normal-case">{data.config?.cron || 'Not set'}</p>
    </div>
    <Handle type="source" position={Position.Bottom} />
  </div>
));

export const LLMCallNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border rounded-xl shadow-lg w-64 overflow-hidden group transition-colors', runtimeStateClass(data?.status))}>
    <NodeHeader 
      icon={<Brain size={16} />} 
      label={data.label || 'GenAI'} 
      type="LLM_CALL"
      colorClass="bg-blue-50"
    />
    <div className="p-4 space-y-2">
      <div className="flex gap-2">
        <span className="px-2 py-1 rounded bg-blueprint-line/40 text-technical-mono text-[10px]">{data.config?.model || 'CLAUDE-HAIKU'}</span>
      </div>
      <p className="text-technical-mono text-blueprint-muted normal-case line-clamp-2 text-[11px]">
        {data.config?.system_prompt || 'No instruction set'}
      </p>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
  </div>
));

export const ToolCallNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border rounded-xl shadow-lg w-64 overflow-hidden group transition-colors', runtimeStateClass(data?.status))}>
    <NodeHeader 
      icon={<Zap size={16} />} 
      label={data.label || 'Action'} 
      type="TOOL_CALL"
      colorClass="bg-purple-50"
    />
    <div className="p-4">
      <div className="flex items-center gap-2 mb-2 font-mono text-[11px] uppercase opacity-70">
        <Database size={12} />
        {data.config?.mcp_server || 'Generic'}
      </div>
      <p className="text-technical-mono text-blueprint-muted normal-case text-[11px]">{data.config?.tool_name || 'Select Tool'}</p>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
  </div>
));

export const EvaluatorNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border rounded-xl shadow-lg w-64 overflow-hidden group transition-colors', runtimeStateClass(data?.status))}>
    <NodeHeader
      icon={<CheckCircle2 size={16} />}
      label={data.label || 'Evaluator'}
      type="EVALUATOR"
      colorClass="bg-teal-50"
    />
    <div className="p-4 space-y-2">
      <div className="flex gap-2">
        <span className="px-2 py-1 rounded bg-blueprint-line/40 text-technical-mono text-[10px]">{data.config?.model || 'CLAUDE-HAIKU'}</span>
      </div>
      <p className="text-technical-mono text-blueprint-muted normal-case text-[11px] line-clamp-2">
        Score {data.config?.pass_threshold ? `>= ${data.config.pass_threshold}` : 'thresholded'} to pass
      </p>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
  </div>
));

export const ConditionNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border-2 rounded-xl p-6 w-48 shadow-lg transition-colors', runtimeStateClass(data?.status))}>
    <div className="flex flex-col items-center gap-4">
       <div className="w-10 h-10 rounded-full bg-yellow-50 flex items-center justify-center">
         <div className="rotate-45 w-4 h-4 border-2 border-yellow-600" />
       </div>
       <div className="text-center">
         <h3 className="text-ui-label text-blueprint-accent text-[11px]">Condition</h3>
         <p className="text-technical-mono text-blueprint-muted normal-case text-[10px] mt-1 line-clamp-2">{data.config?.expression || 'Evaluate condition'}</p>
       </div>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} id="true" style={{ left: '30%' }} />
    <Handle type="source" position={Position.Bottom} id="false" style={{ left: '70%' }} />
  </div>
));

export const HumanGateNode = memo(({ data }: any) => (
  <div className={cn('bg-surface-container-lowest border rounded-xl shadow-lg w-64 overflow-hidden group transition-colors', runtimeStateClass(data?.status))}>
    <NodeHeader 
      icon={<User size={16} />} 
      label={data.label || 'Approval'} 
      type="HUMAN_GATE"
      colorClass="bg-orange-50"
    />
    <div className="p-4">
       <p className="text-technical-mono text-blueprint-muted normal-case text-[11px]">Assigned to Admin</p>
    </div>
    <Handle type="target" position={Position.Top} />
    <Handle type="source" position={Position.Bottom} />
  </div>
));

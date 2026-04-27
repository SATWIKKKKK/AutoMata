export type WorkflowStatus = 'draft' | 'generating' | 'ready' | 'active' | 'paused' | 'archived' | 'failed';
export type RunStatus = 'running' | 'passed' | 'failed' | 'waiting' | 'completed';

export interface WorkflowMetadata {
  id: string;
  name: string;
  description: string;
  status: WorkflowStatus;
  createdAt: string;
  updatedAt: string;
}

export interface NodeExecutionUpdate {
  type: 'node_update';
  node_id: string;
  status: RunStatus;
  output?: string;
  tokens_used?: number;
  cost_inr?: number;
  duration_ms?: number;
  timestamp: string;
}

export interface Integration {
  id: string;
  provider: string;
  label: string;
  description: string;
  mcp_server: string;
  connected: boolean;
  health: string;
  latency?: string;
  enabled: boolean;
}

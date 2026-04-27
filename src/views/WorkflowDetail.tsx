import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Copy,
  Loader2,
  MoreHorizontal,
  Play,
  Power,
  StopCircle,
  Trash2,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { cn } from '../lib/utils';
import {
  ConditionNode,
  CronTriggerNode,
  EvaluatorNode,
  HumanGateNode,
  LLMCallNode,
  ToolCallNode,
} from '../components/workflow/Nodes';

type WorkflowStatus = 'draft' | 'generating' | 'ready' | 'active' | 'paused' | 'archived' | 'failed';
type PagePhase = 'loading' | 'generating' | 'ready' | 'running' | 'error';
type RunNodeStatus = 'running' | 'passed' | 'failed' | 'skipped';

interface WorkflowNode {
  id: string;
  type: 'cron_trigger' | 'tool_call' | 'llm_call' | 'evaluator' | 'condition' | 'human_gate';
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

interface WorkflowDag {
  workflow_name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

interface WorkflowRecord {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: WorkflowStatus;
  dag: WorkflowDag | null;
  estimatedCostPerRunInr: number;
  generationError: string | null;
  createdAt: string;
  updatedAt: string;
}

interface RunLog {
  id: string;
  nodeId: string;
  nodeLabel: string;
  status: RunNodeStatus;
  outputPreview?: string;
  tokensUsed: number;
  costInr: number;
  durationMs: number;
  evaluatorScore: number | null;
  runningTotalCostInr: number;
  timestamp: string;
}

interface ActiveRunState {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  totalCostInr: number;
  durationMs?: number;
  error?: string | null;
}

const nodeTypes = {
  cron_trigger: CronTriggerNode,
  tool_call: ToolCallNode,
  llm_call: LLMCallNode,
  evaluator: EvaluatorNode,
  condition: ConditionNode,
  human_gate: HumanGateNode,
};

const GENERATION_STEPS = [
  { key: 'understanding', label: 'Understanding your workflow' },
  { key: 'building', label: 'Building your workflow graph' },
  { key: 'validated', label: 'Validating connections' },
  { key: 'costed', label: 'Calculating run cost' },
  { key: 'finalizing', label: 'Finalizing your workflow' },
] as const;

function formatCurrency(value: number) {
  return `₹${value.toFixed(value >= 1 ? 2 : 3)}`;
}

function humanizeCron(cron: string | undefined | null) {
  if (!cron) return 'Manual trigger';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;
  const weekdays: Record<string, string> = {
    '0': 'Sunday',
    '1': 'Monday',
    '2': 'Tuesday',
    '3': 'Wednesday',
    '4': 'Thursday',
    '5': 'Friday',
    '6': 'Saturday',
  };

  if (dayOfWeek !== '*' && hour !== '*' && minute !== '*') {
    const normalizedHour = Number(hour);
    const normalizedMinute = String(minute).padStart(2, '0');
    const suffix = normalizedHour >= 12 ? 'PM' : 'AM';
    const twelveHour = normalizedHour % 12 || 12;
    return `Every ${weekdays[dayOfWeek] ?? 'week'} at ${twelveHour}:${normalizedMinute} ${suffix}`;
  }

  if (dayOfMonth !== '*' && hour !== '*' && minute !== '*') {
    return `Day ${dayOfMonth} of every month at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return cron;
}

function buildCostBreakdown(dag: WorkflowDag | null) {
  const breakdown = (dag?.nodes ?? [])
    .filter((node) => node.type === 'llm_call' || node.type === 'evaluator')
    .map((node) => {
      const model = String(node.config?.model ?? 'claude-haiku-4-5').toLowerCase();
      const inputRate = model.includes('sonnet') ? 3.0 : 0.8;
      const outputRate = model.includes('sonnet') ? 15.0 : 4.0;
      const estimatedInputTokens = 1500;
      const estimatedOutputTokens = Number(node.config?.max_tokens ?? 400);
      const estimatedCostInr = (
        (estimatedInputTokens / 1_000_000) * inputRate +
        (estimatedOutputTokens / 1_000_000) * outputRate
      ) * 84;

      return {
        nodeId: node.id,
        nodeLabel: node.label,
        model,
        estimatedTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedCostInr,
      };
    });

  return {
    breakdown,
    total: breakdown.reduce((sum, item) => sum + item.estimatedCostInr, 0),
  };
}

function stepState(
  stepKey: (typeof GENERATION_STEPS)[number]['key'],
  generatingPhase: string,
  streamedTokens: string,
  estimatedCost: number | null,
  isCompleting: boolean,
) {
  if (isCompleting) return 'complete';
  if (stepKey === 'understanding') {
    if (generatingPhase === 'named' || streamedTokens || generatingPhase === 'validated' || generatingPhase === 'costed') return 'complete';
    return generatingPhase ? 'active' : 'active';
  }
  if (stepKey === 'building') {
    if (generatingPhase === 'validated' || generatingPhase === 'costed') return 'complete';
    if (streamedTokens.length > 0 || generatingPhase === 'named') return 'active';
    return 'inactive';
  }
  if (stepKey === 'validated') {
    if (generatingPhase === 'costed') return 'complete';
    if (generatingPhase === 'validated') return 'active';
    return 'inactive';
  }
  if (stepKey === 'costed') {
    if (estimatedCost != null && generatingPhase === 'costed') return 'active';
    if (estimatedCost != null && generatingPhase !== 'costed') return 'complete';
    return 'inactive';
  }
  if (stepKey === 'finalizing') {
    return estimatedCost != null ? 'active' : 'inactive';
  }
  return 'inactive';
}

function WorkflowDetailInner() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const workflowId = id ?? '';
  const isJustGenerated = searchParams.get('generating') === 'true' || searchParams.get('status') === 'generating';

  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [generatingPhase, setGeneratingPhase] = useState('');
  const [streamedTokens, setStreamedTokens] = useState('');
  const [dag, setDag] = useState<WorkflowDag | null>(null);
  const [estimatedCost, setEstimatedCost] = useState<number | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [activeRun, setActiveRun] = useState<ActiveRunState | null>(null);
  const [runLogs, setRunLogs] = useState<RunLog[]>([]);
  const [runCostSoFar, setRunCostSoFar] = useState(0);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [isCompleting, setIsCompleting] = useState(false);
  const [renameDraft, setRenameDraft] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [connectedIntegrations, setConnectedIntegrations] = useState<Array<{ provider: string; account?: string }>>([]);

  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);

  const tokenBoxRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const runStreamRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (tokenBoxRef.current) {
      tokenBoxRef.current.scrollTop = tokenBoxRef.current.scrollHeight;
    }
  }, [streamedTokens]);

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [runLogs]);

  useEffect(() => {
    const fetchWorkflow = async () => {
      try {
        const response = await fetch(`/api/workflows/${workflowId}`);
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Failed to load workflow');

        const nextWorkflow = data.workflow as WorkflowRecord;
        setWorkflow(nextWorkflow);
        setRenameDraft(nextWorkflow.name);
        setEstimatedCost(nextWorkflow.estimatedCostPerRunInr ?? null);
        setGenerationError(nextWorkflow.generationError ?? null);

        if (nextWorkflow.status === 'failed') {
          setPhase('error');
          return;
        }
        if (nextWorkflow.status === 'generating' || isJustGenerated) {
          setPhase('generating');
          return;
        }

        setDag(nextWorkflow.dag);
        setPhase('ready');
      } catch {
        setGenerationError('Failed to load workflow. Please try again.');
        setPhase('error');
      }
    };

    if (workflowId) {
      void fetchWorkflow();
    }
  }, [workflowId, isJustGenerated]);

  useEffect(() => {
    if (!dag) return;
    setNodes(
      dag.nodes.map((node) => ({
        id: node.id,
        type: node.type,
        position: node.position,
        data: {
          label: node.label,
          config: node.config,
          status: undefined,
        },
      })),
    );
    setEdges(
      dag.edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        target: edge.target,
        label: edge.label,
        animated: phase === 'running',
        type: 'smoothstep',
        style: { stroke: '#94a3b8', strokeWidth: 2 },
      })),
    );
  }, [dag, phase, setEdges, setNodes]);

  useEffect(() => {
    if (phase !== 'generating') return;

    const source = new EventSource(`/api/workflows/${workflowId}/stream`);

    source.addEventListener('phase', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setGeneratingPhase(data.phase);
      if (data.phase === 'named') {
        setWorkflow((current) => (current ? { ...current, name: data.name, description: data.description ?? current.description } : current));
        setRenameDraft(data.name);
      }
      if (data.phase === 'costed') {
        setEstimatedCost(data.estimatedCostPerRunInr);
      }
    });

    source.addEventListener('token', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setStreamedTokens((current) => current + data.token);
    });

    source.addEventListener('complete', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as { name: string; dag: WorkflowDag; estimatedCostPerRunInr: number };
      setDag(data.dag);
      setEstimatedCost(data.estimatedCostPerRunInr);
      setGenerationError(null);
      setWorkflow((current) => current ? {
        ...current,
        name: data.name,
        dag: data.dag,
        status: 'ready',
        estimatedCostPerRunInr: data.estimatedCostPerRunInr,
      } : current);
      setIsCompleting(true);
      window.setTimeout(() => {
        setPhase('ready');
        setIsCompleting(false);
      }, 800);
      source.close();
    });

    source.addEventListener('error', (event) => {
      let message = 'Workflow generation failed.';
      const rawData = (event as MessageEvent).data;
      if (typeof rawData === 'string' && rawData.trim()) {
        try {
          const payload = JSON.parse(rawData) as { message?: string };
          if (payload.message?.trim()) {
            message = payload.message.trim();
          }
        } catch {
          // Ignore parse failures for native EventSource error events.
        }
      }

      setGenerationError(message);
      setPhase('error');
      source.close();
    });

    return () => source.close();
  }, [phase, workflowId]);

  useEffect(() => {
    if (!dag) return;
    fetch('/api/integrations')
      .then((response) => response.json())
      .then((data) => {
        if (Array.isArray(data)) setConnectedIntegrations(data);
      })
      .catch(() => setConnectedIntegrations([]));
  }, [dag]);

  const promptContext = sessionStorage.getItem('orren-generating-prompt') || workflow?.prompt || '';
  const scheduleNode = dag?.nodes.find((node) => node.type === 'cron_trigger');
  const integrationsNeeded = useMemo(
    () => Array.from(new Set((dag?.nodes ?? []).filter((node) => node.type === 'tool_call').map((node) => String(node.config?.mcp_server ?? '')))).filter(Boolean),
    [dag],
  );
  const costSummary = useMemo(() => buildCostBreakdown(dag), [dag]);
  const completedNodeCount = runLogs.filter((log) => ['passed', 'failed', 'skipped'].includes(log.status)).length;
  const progressPercent = dag?.nodes?.length ? Math.round((completedNodeCount / dag.nodes.length) * 100) : 0;

  const handleRenameSave = async () => {
    if (!workflow || !renameDraft.trim()) return;
    const response = await fetch(`/api/workflows/${workflow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: renameDraft.trim() }),
    });
    const data = await response.json();
    if (response.ok) {
      setWorkflow(data.workflow as WorkflowRecord);
      setRenameDraft((data.workflow as WorkflowRecord).name);
      setIsRenaming(false);
    }
  };

  const handleActivate = async () => {
    if (!workflow) return;
    const response = await fetch(`/api/workflows/${workflow.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active' }),
    });
    const data = await response.json();
    if (response.ok) setWorkflow(data.workflow as WorkflowRecord);
  };

  const handleRunNow = async () => {
    if (!workflow || isStartingRun) return;
    setIsStartingRun(true);

    try {
      const response = await fetch(`/api/workflows/${workflow.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to start run');

      setRunLogs([]);
      setRunCostSoFar(0);
      setActiveRun({
        id: data.runId,
        status: 'running',
        startedAt: Date.now(),
        totalCostInr: 0,
      });
      setPhase('running');

      const source = new EventSource(`/api/runs/${data.runId}/stream`);
      runStreamRef.current = source;

      source.addEventListener('node_update', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as Omit<RunLog, 'id'>;
        const log: RunLog = {
          ...payload,
          id: `${payload.nodeId}-${payload.status}-${payload.timestamp}`,
        };
        setRunLogs((current) => [...current, log]);
        setRunCostSoFar(payload.runningTotalCostInr);
        setNodes((current) => current.map((node) => (
          node.id === payload.nodeId
            ? { ...node, data: { ...node.data, status: payload.status } }
            : node
        )));
      });

      source.addEventListener('run_complete', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as { status: 'completed' | 'failed'; totalCostInr: number; durationMs: number; error?: string | null };
        setRunCostSoFar(payload.totalCostInr);
        setActiveRun((current) => current ? {
          ...current,
          status: payload.status === 'completed' ? 'completed' : 'failed',
          totalCostInr: payload.totalCostInr,
          durationMs: payload.durationMs,
          error: payload.error,
        } : current);
        source.close();
      });

      source.addEventListener('error', () => {
        source.close();
      });
    } catch {
      setPhase('ready');
    } finally {
      setIsStartingRun(false);
    }
  };

  const handleStopRun = async () => {
    if (!activeRun) return;
    await fetch(`/api/runs/${activeRun.id}`, { method: 'DELETE' }).catch(() => {});
  };

  const handleDeleteWorkflow = async () => {
    if (!workflow) return;
    await fetch(`/api/workflows/${workflow.id}`, { method: 'DELETE' }).catch(() => {});
    navigate('/workflows');
  };

  const handleDuplicateWorkflow = async () => {
    if (!workflow) return;
    const response = await fetch('/api/workflows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `${workflow.name} Copy`,
        description: workflow.description,
        status: 'draft',
        dag: workflow.dag,
        prompt: workflow.prompt,
        estimatedCostPerRunInr: workflow.estimatedCostPerRunInr,
      }),
    });
    const data = await response.json();
    if (response.ok && data.workflow?.id) {
      navigate(`/workflows/${data.workflow.id}`);
    }
  };

  const stepDelayStyle = (index: number) => ({ transitionDelay: `${index * 150}ms` });

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-white/70 font-mono text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading workflow...
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-[#0d0f12] text-white flex items-center justify-center px-4">
        <div className="max-w-lg rounded-3xl border border-white/10 bg-white/5 p-8 text-center space-y-4">
          <AlertTriangle size={28} className="mx-auto text-red-400" />
          <h1 className="font-serif text-4xl">Workflow unavailable</h1>
          <p className="text-white/60">{generationError || 'The workflow could not be loaded or generation failed. You can return to the workflow list and try again.'}</p>
          <button onClick={() => navigate('/workflows')} className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-black">
            <ArrowLeft size={14} /> Back to workflows
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0d0f12] text-white">
      <AnimatePresence mode="wait">
        {phase === 'generating' ? (
          <motion.section
            key="generating"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: isCompleting ? 0 : 1, y: isCompleting ? -20 : 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.35 }}
            className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8"
            style={{ viewTransitionName: 'workflow-card' }}
          >
            <div className="w-full max-w-3xl rounded-[32px] border border-white/10 bg-[#111318] shadow-[0_30px_80px_rgba(0,0,0,0.45)] p-6 sm:p-8 lg:p-10">
              <button onClick={() => navigate('/workflows')} className="mb-8 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white transition-colors">
                <ArrowLeft size={14} /> Back to workflows
              </button>

              <div className="space-y-2 text-center sm:text-left mb-10">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-white/35">Workflow Generation</p>
                <h1 className="font-serif text-4xl sm:text-5xl leading-tight">{workflow?.name || 'Generating...'}</h1>
                <p className="text-white/50 max-w-2xl">We are translating your plain-English request into a production-ready workflow graph.</p>
              </div>

              <div className="space-y-4">
                {GENERATION_STEPS.map((step, index) => {
                  const state = stepState(step.key, generatingPhase, streamedTokens, estimatedCost, isCompleting);
                  return (
                    <motion.div
                      key={step.key}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: index * 0.15 }}
                      className={cn(
                        'rounded-2xl border px-4 sm:px-5 py-4 transition-all',
                        state === 'complete' && 'border-green-500/40 bg-green-500/8',
                        state === 'active' && 'border-blue-500/50 bg-blue-500/10',
                        state === 'inactive' && 'border-white/10 bg-white/[0.03] text-white/50',
                      )}
                      style={stepDelayStyle(index)}
                    >
                      <div className="flex items-start gap-4">
                        <div className="mt-0.5">
                          {state === 'complete' ? (
                            <CheckCircle2 size={18} className="text-green-400" />
                          ) : state === 'active' ? (
                            <Loader2 size={18} className="text-blue-400 animate-spin" />
                          ) : (
                            <span className="block h-4 w-4 rounded-full border border-white/20 bg-white/5" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-3">
                            <p className={cn('font-medium', state === 'complete' && 'text-green-300', state === 'active' && 'text-white', state === 'inactive' && 'text-white/55')}>
                              {step.label}
                            </p>
                            {step.key === 'costed' && estimatedCost != null && (
                              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-xs text-green-300">
                                ~{formatCurrency(estimatedCost)} per run
                              </span>
                            )}
                          </div>
                          {step.key === 'building' && streamedTokens.length > 0 && (
                            <div ref={tokenBoxRef} className="mt-3 max-h-28 overflow-y-auto rounded-xl border border-white/8 bg-black/30 p-3 font-mono text-[11px] leading-5 text-blue-100/75">
                              {streamedTokens}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              <div className="mt-8 space-y-2 text-center sm:text-left">
                <p className="text-sm text-white/55">This usually takes 10-15 seconds</p>
                <p className="text-xs text-white/35 font-mono break-words">{promptContext}</p>
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="ready"
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="min-h-screen bg-blueprint-bg text-blueprint-accent"
            style={{ viewTransitionName: 'workflow-card' }}
          >
            <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 space-y-6 sm:space-y-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3 min-w-0">
                  <button onClick={() => navigate('/workflows')} className="inline-flex items-center gap-2 text-sm text-blueprint-muted hover:text-primary transition-colors">
                    <ArrowLeft size={14} /> Back to workflows
                  </button>
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:flex-wrap">
                    {isRenaming ? (
                      <div className="flex items-center gap-2">
                        <input
                          value={renameDraft}
                          onChange={(event) => setRenameDraft(event.target.value)}
                          className="min-w-0 rounded-2xl border border-blueprint-line bg-white px-4 py-2 text-2xl sm:text-3xl lg:text-4xl font-semibold outline-none focus:border-black"
                        />
                        <button onClick={handleRenameSave} className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white">Save</button>
                      </div>
                    ) : (
                      <button onClick={() => setIsRenaming(true)} className="text-left min-w-0">
                        <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl leading-tight break-words">{workflow?.name}</h1>
                      </button>
                    )}
                    <span className={cn(
                      'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]',
                      workflow?.status === 'active'
                        ? 'border-green-200 bg-green-50 text-green-700'
                        : 'border-green-200 bg-green-50 text-green-700',
                    )}>
                      <CheckCircle2 size={12} /> {workflow?.status === 'active' ? 'Active' : 'Ready'}
                    </span>
                    {estimatedCost != null && (
                      <span className="inline-flex items-center rounded-full border border-blueprint-line bg-white px-3 py-1 text-xs text-blueprint-muted">
                        ~{formatCurrency(estimatedCost)} / run
                      </span>
                    )}
                  </div>
                  <p className="max-w-3xl text-sm sm:text-base text-blueprint-muted">{workflow?.description}</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={handleActivate}
                    className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white hover:opacity-90"
                  >
                    <Power size={14} className="inline mr-2" /> Activate
                  </button>
                  <button
                    onClick={handleRunNow}
                    disabled={isStartingRun || phase === 'running'}
                    className="rounded-full border border-blueprint-line bg-white px-5 py-3 text-sm font-semibold text-blueprint-accent hover:bg-surface-container disabled:opacity-50"
                  >
                    <Play size={14} className="inline mr-2" /> {isStartingRun ? 'Starting...' : 'Run Now'}
                  </button>
                  <div className="relative">
                    <button onClick={() => setMenuOpen((current) => !current)} className="rounded-full border border-blueprint-line bg-white p-3 text-blueprint-muted hover:text-primary">
                      <MoreHorizontal size={16} />
                    </button>
                    {menuOpen && (
                      <div className="absolute right-0 top-14 z-20 min-w-44 rounded-2xl border border-blueprint-line bg-white p-2 shadow-xl">
                        <button onClick={() => { setMenuOpen(false); setIsRenaming(true); }} className="w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-blueprint-bg">Edit</button>
                        <button onClick={() => { setMenuOpen(false); void handleDuplicateWorkflow(); }} className="w-full rounded-xl px-4 py-2 text-left text-sm hover:bg-blueprint-bg">Duplicate</button>
                        <button onClick={() => { setMenuOpen(false); void handleDeleteWorkflow(); }} className="w-full rounded-xl px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete</button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={cn('rounded-[28px] border border-blueprint-line bg-white shadow-[0_22px_60px_rgba(0,0,0,0.08)] overflow-hidden transition-all', phase === 'running' ? 'h-[42vh] sm:h-[48vh] lg:h-[55vh]' : 'h-[55vh]')}>
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  nodeTypes={nodeTypes}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={(_, node) => {
                    const matched = dag?.nodes.find((candidate) => candidate.id === node.id) ?? null;
                    setSelectedNode(matched);
                  }}
                  fitView
                >
                  <Background gap={24} size={1} color="#e5e7eb" />
                  <Controls position="bottom-right" />
                </ReactFlow>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <section className="rounded-[24px] border border-blueprint-line bg-white p-5 sm:p-6 shadow-sm space-y-6">
                  <div>
                    <h2 className="font-serif text-2xl">Schedule & Config</h2>
                    <p className="mt-2 text-sm text-blueprint-muted">Operational details for this workflow and the integrations it needs to activate.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-blueprint-bg p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted mb-2">Schedule</p>
                      <p className="text-sm font-medium">{humanizeCron(String(scheduleNode?.config?.cron ?? workflow?.dag?.nodes.find((node) => node.type === 'cron_trigger')?.config?.cron ?? ''))}</p>
                    </div>
                    <div className="rounded-2xl bg-blueprint-bg p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted mb-2">Created</p>
                      <p className="text-sm font-medium">{workflow?.createdAt ? formatDistanceToNow(new Date(workflow.createdAt), { addSuffix: true }) : 'Unknown'}</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-blueprint-muted">Integrations Needed</h3>
                    {integrationsNeeded.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-blueprint-line p-4 text-sm text-blueprint-muted">No external integrations required.</div>
                    ) : (
                      integrationsNeeded.map((integration) => {
                        const normalizedTarget = integration.toLowerCase();
                        const match = connectedIntegrations.find((item) => {
                          const normalizedProvider = String(item.provider || '').toLowerCase();
                          return normalizedTarget.includes(normalizedProvider) || normalizedProvider.includes(normalizedTarget);
                        });

                        return (
                          <div key={integration} className="flex flex-col gap-2 rounded-2xl border border-blueprint-line p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium text-sm break-words">{integration}</p>
                              <p className="text-xs text-blueprint-muted">{match ? `Connected${match.account ? ` as ${match.account}` : ''}` : 'Not connected'}</p>
                            </div>
                            {match ? (
                              <span className="inline-flex items-center gap-2 rounded-full bg-green-50 px-3 py-1 text-xs text-green-700 border border-green-200">Connected ✓</span>
                            ) : (
                              <button onClick={() => navigate('/settings')} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs text-red-700">
                                Connect in Settings
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>

                <section className="rounded-[24px] border border-blueprint-line bg-white p-5 sm:p-6 shadow-sm space-y-6 overflow-hidden">
                  <div>
                    <h2 className="font-serif text-2xl">Cost Estimate</h2>
                    <p className="mt-2 text-sm text-blueprint-muted">Projected runtime cost per execution based on the LLM and evaluator nodes in this graph.</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="rounded-2xl bg-blueprint-bg p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted mb-2">Per Run</p>
                      <p className="text-xl font-semibold">{formatCurrency(estimatedCost ?? costSummary.total)}</p>
                    </div>
                    <div className="rounded-2xl bg-blueprint-bg p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted mb-2">Monthly</p>
                      <p className="text-xl font-semibold">{formatCurrency((estimatedCost ?? costSummary.total) * 4)}</p>
                    </div>
                    <div className="rounded-2xl bg-blueprint-bg p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted mb-2">Yearly</p>
                      <p className="text-xl font-semibold">{formatCurrency((estimatedCost ?? costSummary.total) * 52)}</p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="border-b border-blueprint-line text-left text-blueprint-muted">
                          <th className="py-3 pr-4 font-medium">Node</th>
                          <th className="py-3 pr-4 font-medium">Model</th>
                          <th className="py-3 pr-4 font-medium">Est. tokens</th>
                          <th className="py-3 font-medium">Est. cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {costSummary.breakdown.map((item) => (
                          <tr key={item.nodeId} className="border-b border-blueprint-line/60">
                            <td className="py-3 pr-4">{item.nodeLabel}</td>
                            <td className="py-3 pr-4 uppercase text-xs text-blueprint-muted">{item.model}</td>
                            <td className="py-3 pr-4">~{item.estimatedTokens.toLocaleString()}</td>
                            <td className="py-3">{formatCurrency(item.estimatedCostInr)}</td>
                          </tr>
                        ))}
                        <tr>
                          <td className="py-3 pr-4 font-semibold">Total</td>
                          <td className="py-3 pr-4 text-blueprint-muted">-</td>
                          <td className="py-3 pr-4">~{costSummary.breakdown.reduce((sum, item) => sum + item.estimatedTokens, 0).toLocaleString()}</td>
                          <td className="py-3 font-semibold">{formatCurrency(estimatedCost ?? costSummary.total)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </section>
              </div>

              <AnimatePresence>
                {selectedNode && (
                  <motion.aside
                    initial={{ x: 320 }}
                    animate={{ x: 0 }}
                    exit={{ x: 320 }}
                    className="fixed inset-y-0 right-0 z-40 w-full max-w-sm border-l border-blueprint-line bg-white shadow-2xl"
                  >
                    <div className="flex items-start justify-between border-b border-blueprint-line p-5">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-blueprint-muted">{selectedNode.type}</p>
                        <h3 className="font-serif text-2xl mt-2">{selectedNode.label}</h3>
                      </div>
                      <button onClick={() => setSelectedNode(null)} className="rounded-full border border-blueprint-line p-2 text-blueprint-muted hover:text-primary">
                        <X size={16} />
                      </button>
                    </div>
                    <div className="p-5 space-y-4 overflow-y-auto h-[calc(100%-89px)]">
                      <pre className="rounded-2xl bg-blueprint-bg p-4 text-xs leading-6 text-blueprint-accent overflow-x-auto">
                        {JSON.stringify(selectedNode.config, null, 2)}
                      </pre>
                    </div>
                  </motion.aside>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {phase === 'running' && activeRun && (
                  <motion.section
                    initial={{ y: '100%' }}
                    animate={{ y: 0 }}
                    exit={{ y: '100%' }}
                    transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                    className="fixed bottom-0 left-0 right-0 z-30 h-[52vh] md:h-[45vh] border-t border-white/10 bg-[#0d0f12] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
                  >
                    <div className="flex h-full flex-col px-4 sm:px-6 lg:px-8 py-4">
                      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div>
                          <div className="text-sm sm:text-base font-semibold">
                            {activeRun.status === 'running'
                              ? `Live Run · Started ${formatDistanceToNow(activeRun.startedAt, { addSuffix: true })} · ${formatCurrency(runCostSoFar)} so far`
                              : `Run ${activeRun.status === 'completed' ? 'Complete' : 'Failed'} · ${formatCurrency(activeRun.totalCostInr)} · ${((activeRun.durationMs ?? 0) / 1000).toFixed(1)} seconds`}
                          </div>
                          {activeRun.error && <p className="mt-1 text-sm text-red-300">{activeRun.error}</p>}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          {activeRun.status === 'running' ? (
                            <button onClick={handleStopRun} className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-sm text-red-200">
                              <StopCircle size={14} className="inline mr-2" /> Stop
                            </button>
                          ) : (
                            <>
                              <button onClick={() => { setPhase('ready'); setActiveRun(null); setRunLogs([]); }} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80">
                                Close console
                              </button>
                              <button onClick={() => void handleRunNow()} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black">
                                Run again
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${progressPercent}%` }} />
                      </div>

                      <div ref={logContainerRef} className="flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-black/25 p-4 space-y-3">
                        {runLogs.map((log) => (
                          <motion.div
                            key={log.id}
                            initial={{ opacity: 0, x: -12 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs text-white/40 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                                <p className="mt-1 text-sm text-white/90 break-words">{log.nodeLabel} → <span className={cn(log.status === 'running' && 'text-blue-300', log.status === 'passed' && 'text-green-300', log.status === 'failed' && 'text-red-300', log.status === 'skipped' && 'text-yellow-200')}>{log.status}</span></p>
                                {log.outputPreview && <p className="mt-1 text-xs text-white/55 break-words">{log.outputPreview}</p>}
                              </div>
                              <div className="text-right text-xs text-white/45 font-mono">
                                <p>+ {formatCurrency(log.costInr)}</p>
                                <p>{log.durationMs}ms</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>

                      <div className="mt-4 flex items-center justify-between text-sm text-white/70">
                        <span>Total so far: {formatCurrency(activeRun.status === 'running' ? runCostSoFar : activeRun.totalCostInr)}</span>
                        <span>{progressPercent}% complete</span>
                      </div>
                    </div>
                  </motion.section>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowDetail() {
  return (
    <ReactFlowProvider>
      <WorkflowDetailInner />
    </ReactFlowProvider>
  );
}
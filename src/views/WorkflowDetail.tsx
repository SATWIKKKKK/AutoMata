import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Diamond,
  Loader2,
  Play,
  Plug,
  Power,
  Sparkles,
  X,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useParams } from 'react-router-dom';
import { cn } from '../lib/utils';

type WorkflowStatus = 'draft' | 'generating' | 'ready' | 'active' | 'paused' | 'archived' | 'failed';
type PagePhase = 'loading' | 'generating' | 'ready' | 'running' | 'error';

type WorkflowNode = {
  id: string;
  type: 'cron_trigger' | 'tool_call' | 'llm_call' | 'evaluator' | 'condition' | 'human_gate';
  label: string;
  config: Record<string, any>;
  position?: { x: number; y: number };
};

type WorkflowDag = {
  workflow_name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: Array<{ id: string; source: string; target: string; label?: string }>;
};

type WorkflowRecord = {
  id: string;
  name: string;
  description: string;
  prompt: string;
  status: WorkflowStatus;
  dag: WorkflowDag | null;
  cronSchedule?: string | null;
  generationError: string | null;
  shareToken?: string | null;
  isPublic?: boolean;
  forkCount?: number;
  createdAt?: string;
  updatedAt?: string;
};

type IntegrationRow = { provider: string; account?: string };

type RunHistoryLog = {
  node_id: string;
  node_label: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  output_preview: string;
  created_at: string | null;
};

type RunHistoryRow = {
  id: string;
  status: 'running' | 'completed' | 'failed';
  trigger: string;
  started_at: string | null;
  ended_at: string | null;
  duration_ms: number | null;
  node_logs: RunHistoryLog[];
};

type LiveRunLog = {
  nodeId: string;
  nodeLabel: string;
  status: 'running' | 'passed' | 'failed' | 'skipped';
  outputPreview?: string;
  skipReason?: string | null;
  durationMs: number;
  timestamp: string;
};

type ActiveRun = {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: number;
  durationMs?: number;
  error?: string | null;
};

const GENERATION_STEPS = [
  { key: 'understanding', label: 'Understanding your workflow' },
  { key: 'building', label: 'Building your workflow graph' },
  { key: 'finalizing', label: 'Finalizing your workflow' },
] as const;

function sanitizeDagForRender(dag: WorkflowDag | null): WorkflowDag | null {
  if (!dag || !Array.isArray(dag.nodes) || !Array.isArray(dag.edges)) return null;
  const nodes = dag.nodes
    .filter((node) => node && typeof node.id === 'string' && node.id.trim().length > 0)
    .map((node, index) => ({
      ...node,
      label: String(node.label ?? node.id),
      position: {
        x: Number.isFinite(Number(node?.position?.x)) ? Number(node.position?.x) : 0,
        y: Number.isFinite(Number(node?.position?.y)) ? Number(node.position?.y) : index * 120,
      },
    }));
  return {
    ...dag,
    nodes,
    edges: (dag.edges ?? []).filter((edge) => nodes.some((node) => node.id === edge.source) && nodes.some((node) => node.id === edge.target)),
  };
}

function normalizeIntegrationName(value: string | null | undefined): string {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('gmail') || normalized.includes('email')) return 'gmail';
  if (normalized.includes('google_sheets') || normalized.includes('sheets') || normalized.includes('sheet')) return 'google_sheets';
  if (normalized.includes('slack')) return 'slack';
  if (normalized.includes('notion')) return 'notion';
  return normalized;
}

function humanizeCron(cron: string | undefined | null) {
  if (!cron) return 'Manual';
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return cron;

  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;
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
    const h = Number(hour);
    const m = String(minute).padStart(2, '0');
    const suffix = h >= 12 ? 'PM' : 'AM';
    const twelveHour = h % 12 || 12;
    return `Every ${weekdays[dayOfWeek] ?? 'week'} at ${twelveHour}:${m} ${suffix}`;
  }

  if (dayOfMonth !== '*' && hour !== '*' && minute !== '*') {
    return `Day ${dayOfMonth} of every month at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  }

  return 'Manual';
}

function nodeIcon(type: WorkflowNode['type']) {
  if (type === 'cron_trigger') return <Clock3 size={16} className="text-blueprint-muted" />;
  if (type === 'llm_call') return <Sparkles size={16} className="text-blueprint-muted" />;
  if (type === 'evaluator') return <CheckCircle2 size={16} className="text-blueprint-muted" />;
  if (type === 'tool_call') return <Plug size={16} className="text-blueprint-muted" />;
  if (type === 'condition') return <Diamond size={16} className="text-blueprint-muted" />;
  return <ChevronRight size={16} className="text-blueprint-muted" />;
}

function generationStepState(stepKey: string, generatingPhase: string) {
  const isPostValidationPhase = Boolean(
    generatingPhase
    && generatingPhase !== 'named'
    && generatingPhase !== 'fallback'
    && generatingPhase !== 'validated',
  );

  if (stepKey === 'understanding') {
    if (generatingPhase) return 'complete';
    return 'active';
  }
  if (stepKey === 'building') {
    if (generatingPhase === 'validated' || isPostValidationPhase) return 'complete';
    if (generatingPhase === 'named' || generatingPhase === 'fallback') return 'active';
    return 'inactive';
  }
  if (stepKey === 'finalizing') {
    if (generatingPhase === 'validated' || isPostValidationPhase) return 'active';
    return 'inactive';
  }
  return 'inactive';
}

function WorkflowDetailInner() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const workflowId = id ?? '';

  const [workflow, setWorkflow] = useState<WorkflowRecord | null>(null);
  const [dag, setDag] = useState<WorkflowDag | null>(null);
  const [phase, setPhase] = useState<PagePhase>('loading');
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generatingPhase, setGeneratingPhase] = useState('');

  const [integrations, setIntegrations] = useState<IntegrationRow[]>([]);
  const [runHistory, setRunHistory] = useState<RunHistoryRow[]>([]);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

  const [isStepsOpen, setIsStepsOpen] = useState<boolean>(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1024));
  const [isStartingRun, setIsStartingRun] = useState(false);
  const [activeRun, setActiveRun] = useState<ActiveRun | null>(null);
  const [runLogs, setRunLogs] = useState<LiveRunLog[]>([]);

  const [shareUrl, setShareUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [activationWarning, setActivationWarning] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const liveRunStreamRef = useRef<EventSource | null>(null);
  const generationStreamRef = useRef<EventSource | null>(null);
  const generationPollRef = useRef<number | null>(null);
  const generationPollTimeoutRef = useRef<number | null>(null);
  const runPollRef = useRef<number | null>(null);
  const runPollTimeoutRef = useRef<number | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  const stopGenerationPolling = () => {
    if (generationPollRef.current != null) {
      window.clearInterval(generationPollRef.current);
      generationPollRef.current = null;
    }
    if (generationPollTimeoutRef.current != null) {
      window.clearTimeout(generationPollTimeoutRef.current);
      generationPollTimeoutRef.current = null;
    }
  };

  const stopRunPolling = () => {
    if (runPollRef.current != null) {
      window.clearInterval(runPollRef.current);
      runPollRef.current = null;
    }
    if (runPollTimeoutRef.current != null) {
      window.clearTimeout(runPollTimeoutRef.current);
      runPollTimeoutRef.current = null;
    }
  };

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [runLogs]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 1024) {
        setIsStepsOpen(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const fetchIntegrations = async () => {
    try {
      const response = await fetch('/api/integrations');
      const data = await response.json();
      setIntegrations(Array.isArray(data) ? data : []);
    } catch {
      setIntegrations([]);
    }
  };

  const fetchRunHistory = async (targetWorkflowId: string) => {
    try {
      const response = await fetch(`/api/workflows/${targetWorkflowId}/runs`);
      const data = await response.json();
      if (!response.ok) return;
      setRunHistory(Array.isArray(data?.runs) ? data.runs : []);
    } catch {
      setRunHistory([]);
    }
  };

  const hydrateReadyWorkflow = async (nextWorkflow: WorkflowRecord) => {
    const safeDag = sanitizeDagForRender(nextWorkflow.dag);
    setWorkflow(nextWorkflow);
    setDag(safeDag);
    setShareUrl(nextWorkflow.shareToken ? `http://localhost:3000/w/${nextWorkflow.shareToken}` : '');
    setGenerationError(nextWorkflow.generationError ?? null);
    setPhase('ready');
    await Promise.all([
      fetchIntegrations(),
      fetchRunHistory(nextWorkflow.id),
    ]);
  };

  const fetchWorkflow = async () => {
    const response = await fetch(`/api/workflows/${workflowId}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? 'Failed to load workflow.');
    }
    return data.workflow as WorkflowRecord;
  };

  useEffect(() => {
    let cancelled = false;
    const boot = async () => {
      try {
        setPhase('loading');
        const nextWorkflow = await fetchWorkflow();
        if (cancelled) return;
        if (nextWorkflow.status === 'failed') {
          setWorkflow(nextWorkflow);
          setGenerationError(nextWorkflow.generationError ?? 'Workflow generation failed.');
          setPhase('error');
          return;
        }
        if (nextWorkflow.status === 'generating') {
          setWorkflow(nextWorkflow);
          setDag(sanitizeDagForRender(nextWorkflow.dag));
          setPhase('generating');
          return;
        }
        await hydrateReadyWorkflow(nextWorkflow);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'Failed to load workflow.';
        setGenerationError(message);
        setPhase('error');
      }
    };

    if (workflowId) {
      void boot();
    }

    return () => {
      cancelled = true;
      generationStreamRef.current?.close();
      liveRunStreamRef.current?.close();
      stopGenerationPolling();
      stopRunPolling();
    };
  }, [workflowId]);

  useEffect(() => {
    if (phase !== 'generating' || !workflowId) return;

    stopGenerationPolling();
    generationStreamRef.current?.close();

    const source = new EventSource(`/api/workflows/${workflowId}/stream`);
    generationStreamRef.current = source;

    const recoverAfterError = async () => {
      try {
        const latest = await fetchWorkflow();
        if (latest.status === 'ready' && latest.dag) {
          stopGenerationPolling();
          await hydrateReadyWorkflow(latest);
          return;
        }
        if (latest.status === 'failed') {
          stopGenerationPolling();
          setGenerationError(latest.generationError ?? 'Workflow generation failed.');
          setPhase('error');
          return;
        }

        stopGenerationPolling();
        generationPollRef.current = window.setInterval(async () => {
          try {
            const polled = await fetchWorkflow();
            if (polled.status === 'ready' && polled.dag) {
              stopGenerationPolling();
              await hydrateReadyWorkflow(polled);
            } else if (polled.status === 'failed') {
              stopGenerationPolling();
              setGenerationError(polled.generationError ?? 'Workflow generation failed.');
              setPhase('error');
            }
          } catch {
            // ignore until timeout
          }
        }, 2000);

        generationPollTimeoutRef.current = window.setTimeout(() => {
          stopGenerationPolling();
        }, 180000);
      } catch {
        setGenerationError('Workflow generation failed.');
        setPhase('error');
      }
    };

    source.addEventListener('phase', (event) => {
      const data = JSON.parse((event as MessageEvent).data);
      setGeneratingPhase(String(data.phase ?? ''));
      if (data.phase === 'named') {
        setWorkflow((current) => current ? { ...current, name: data.name ?? current.name, description: data.description ?? current.description } : current);
      }
    });

    source.addEventListener('complete', (event) => {
      const data = JSON.parse((event as MessageEvent).data) as {
        name: string;
        description?: string;
        dag: WorkflowDag;
        estimatedCostPerRunInr?: number;
      };
      const safeDag = sanitizeDagForRender(data.dag);
      setDag(safeDag);
      setWorkflow((current) => ({
        ...(current ?? {
          id: workflowId,
          name: data.name,
          description: data.description ?? '',
          prompt: '',
          status: 'ready',
          dag: safeDag,
          generationError: null,
        }),
        name: data.name,
        description: data.description ?? current?.description ?? '',
        status: 'ready',
        dag: safeDag,
      }));
      setPhase('ready');
      window.setTimeout(() => {
        source.close();
      }, 100);
      void Promise.all([fetchIntegrations(), fetchRunHistory(workflowId)]);
    });

    source.onerror = () => {
      source.close();
      void recoverAfterError();
    };

    return () => {
      source.close();
      stopGenerationPolling();
    };
  }, [phase, workflowId]);

  const requiredIntegrations = useMemo(() => {
    const nodes = dag?.nodes ?? [];
    const required = new Set<string>();
    for (const node of nodes) {
      if (node.type !== 'tool_call') continue;
      const mcp = normalizeIntegrationName(node.config?.mcp_server);
      const tool = normalizeIntegrationName(node.config?.tool_name);
      if (mcp) required.add(mcp);
      if (tool.includes('gmail') || tool.includes('email')) required.add('gmail');
      if (tool.includes('sheet')) required.add('google_sheets');
      if (tool.includes('slack')) required.add('slack');
      if (tool.includes('notion')) required.add('notion');
    }
    return Array.from(required);
  }, [dag]);

  const connectedIntegrations = useMemo(
    () => new Set(integrations.map((item) => normalizeIntegrationName(item.provider))),
    [integrations],
  );

  const missingIntegrations = useMemo(
    () => requiredIntegrations.filter((provider) => !connectedIntegrations.has(provider)),
    [connectedIntegrations, requiredIntegrations],
  );

  const scheduleText = useMemo(() => {
    const cronNode = dag?.nodes.find((node) => node.type === 'cron_trigger');
    return humanizeCron(String(cronNode?.config?.cron ?? workflow?.cronSchedule ?? ''));
  }, [dag, workflow?.cronSchedule]);

  const lastRunLabel = useMemo(() => {
    const latest = runHistory[0];
    if (!latest?.started_at) return 'Never';
    return formatDistanceToNow(new Date(latest.started_at), { addSuffix: true });
  }, [runHistory]);

  const integrationStatusLabel = useMemo(() => {
    if (requiredIntegrations.length === 0) {
      return { ok: true, text: 'No external integrations required' };
    }
    if (missingIntegrations.length === 0) {
      return { ok: true, text: `${requiredIntegrations.join(', ')} connected` };
    }
    return { ok: false, text: `${missingIntegrations.join(', ')} not connected — connect in Settings` };
  }, [requiredIntegrations, missingIntegrations]);

  const patchWorkflowStatus = async (nextStatus: WorkflowStatus) => {
    setActionError(null);
    const response = await fetch(`/api/workflows/${workflowId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? 'Failed to update workflow status.');
    }
    const updated = data.workflow as WorkflowRecord;
    setWorkflow(updated);
  };

  const handleActivateToggle = async () => {
    if (!workflow) return;
    setActivationWarning(null);
    setActionError(null);
    try {
      if (workflow.status === 'active') {
        await patchWorkflowStatus('paused');
        return;
      }
      if (missingIntegrations.length > 0) {
        const names = missingIntegrations.map((integration) => integration.replace('_', ' ')).join(', ');
        setActivationWarning(`Connect ${names} in Settings before activating`);
        return;
      }
      await patchWorkflowStatus('active');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update workflow status.';
      setActionError(message);
    }
  };

  const handleShare = async () => {
    if (!workflow) return;
    setIsSharing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/share`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? 'Failed to share workflow.');
      const url = String(data?.share_url ?? '');
      const token = (() => {
        try {
          return new URL(url).pathname.split('/').filter(Boolean).pop() ?? null;
        } catch {
          return null;
        }
      })();
      setShareUrl(url);
      setWorkflow((current) => current ? { ...current, isPublic: true, shareToken: token } : current);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share workflow.';
      setActionError(message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleUnshare = async () => {
    if (!workflow) return;
    setIsSharing(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/unshare`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data?.error ?? 'Failed to unshare workflow.');
      }
      setWorkflow((current) => current ? { ...current, isPublic: false, shareToken: null } : current);
      setShareUrl('');
      setCopied(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unshare workflow.';
      setActionError(message);
    } finally {
      setIsSharing(false);
    }
  };

  const startRunPoll = (runId: string) => {
    stopRunPolling();
    runPollRef.current = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/runs/${runId}`);
        const data = await response.json();
        const run = data?.run as { status?: string; duration_ms?: number | null } | undefined;
        if (!run) return;
        if (run.status === 'completed' || run.status === 'failed') {
          stopRunPolling();
          setActiveRun((current) => current ? {
            ...current,
            status: run.status === 'completed' ? 'completed' : 'failed',
            durationMs: run.duration_ms ?? current.durationMs,
          } : current);
          setIsStartingRun(false);
          void fetchRunHistory(workflowId);
        }
      } catch {
        // ignore and keep polling
      }
    }, 3000);
    runPollTimeoutRef.current = window.setTimeout(() => {
      stopRunPolling();
    }, 180000);
  };

  const handleRunNow = async () => {
    if (!workflow || isStartingRun) return;
    setActionError(null);
    setIsStartingRun(true);
    setRunLogs([]);
    try {
      const response = await fetch(`/api/workflows/${workflow.id}/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      });
      const data = await response.json();
      if (!response.ok || !data?.runId) {
        throw new Error(data?.error ?? 'Failed to start run.');
      }

      const runId = String(data.runId);
      setActiveRun({
        id: runId,
        status: 'running',
        startedAt: Date.now(),
      });

      liveRunStreamRef.current?.close();
      const source = new EventSource(`/api/runs/${runId}/stream`);
      liveRunStreamRef.current = source;

      source.addEventListener('node_update', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          nodeId: string;
          nodeLabel: string;
          status: 'running' | 'passed' | 'failed' | 'skipped';
          outputPreview?: string;
          skipReason?: string | null;
          durationMs: number;
          timestamp: string;
        };
        setRunLogs((current) => [
          ...current,
          {
            nodeId: payload.nodeId,
            nodeLabel: payload.nodeLabel,
            status: payload.status,
            outputPreview: payload.outputPreview,
            skipReason: payload.skipReason,
            durationMs: payload.durationMs,
            timestamp: payload.timestamp,
          },
        ]);
      });

      source.addEventListener('run_complete', (event) => {
        const payload = JSON.parse((event as MessageEvent).data) as {
          status: 'completed' | 'failed';
          durationMs: number;
          error?: string | null;
        };
        setActiveRun((current) => current ? {
          ...current,
          status: payload.status === 'completed' ? 'completed' : 'failed',
          durationMs: payload.durationMs,
          error: payload.error ?? null,
        } : current);
        setIsStartingRun(false);
        source.close();
        void fetchRunHistory(workflow.id);
      });

      source.onerror = () => {
        source.close();
        startRunPoll(runId);
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start run.';
      setActionError(message);
      setIsStartingRun(false);
    }
  };

  const closeConsole = () => {
    liveRunStreamRef.current?.close();
    stopRunPolling();
    setActiveRun(null);
    setRunLogs([]);
  };

  if (phase === 'loading') {
    return (
      <div className="min-h-screen bg-blueprint-bg flex items-center justify-center px-4">
        <div className="flex items-center gap-3 text-blueprint-muted font-mono text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading workflow...
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return (
      <div className="min-h-screen bg-blueprint-bg flex items-center justify-center px-4">
        <div className="max-w-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-8 text-center space-y-4 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
          <h1 className="font-display-xl text-display-xl text-primary">Workflow unavailable</h1>
          <p className="font-body-md text-body-md text-on-surface-variant">{generationError || 'The workflow could not be loaded.'}</p>
          <button onClick={() => navigate('/workflows')} className="w-full text-center py-3 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors">
            Back to workflows
          </button>
        </div>
      </div>
    );
  }

  if (phase === 'ready' && (!dag || !Array.isArray(dag.nodes) || dag.nodes.length === 0)) {
    return (
      <div className="min-h-screen bg-blueprint-bg">
        <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
          <button onClick={() => navigate('/workflows')} className="inline-flex items-center gap-2 text-sm text-blueprint-muted hover:text-primary transition-colors">
            <ArrowLeft size={14} /> Back to workflows
          </button>
          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-8 shadow-[0_8px_30px_rgba(0,0,0,0.03)]">
            <h1 className="font-display-xl text-display-xl text-primary">{workflow?.name}</h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-3">Workflow ready but graph is empty. Click Run Now to execute.</p>
            <div className="mt-6">
              <button
                onClick={handleRunNow}
                disabled={isStartingRun}
                className="w-full sm:w-auto text-center py-3 px-6 bg-primary text-on-primary rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors disabled:opacity-50"
              >
                {isStartingRun ? 'Running...' : 'Run Now'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blueprint-bg text-blueprint-accent">
      <AnimatePresence mode="wait">
        {phase === 'generating' ? (
          <motion.section
            key="generating"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            transition={{ duration: 0.3 }}
            className="min-h-screen bg-blueprint-bg flex items-center justify-center px-4"
          >
            <div className="w-full max-w-3xl rounded-xl border border-outline-variant bg-surface-container-lowest shadow-[0_8px_30px_rgba(0,0,0,0.03)] p-6 sm:p-8">
              <button onClick={() => navigate('/workflows')} className="mb-8 inline-flex items-center gap-2 text-sm text-blueprint-muted hover:text-primary transition-colors">
                <ArrowLeft size={14} /> Back to workflows
              </button>

              <div className="space-y-2 mb-10">
                <p className="font-ui-label text-ui-label text-on-surface-variant">Workflow Generation</p>
                <h1 className="font-display-xl text-display-xl text-primary">{workflow?.name || 'Generating...'}</h1>
                <p className="font-body-md text-body-md text-on-surface-variant">We are translating your request into a production-ready workflow graph.</p>
              </div>

              <div className="space-y-4">
                {GENERATION_STEPS.map((step) => {
                  const state = generationStepState(step.key, generatingPhase);
                  return (
                    <div
                      key={step.key}
                      className={cn(
                        'rounded-xl border px-5 py-4 bg-surface-container-lowest',
                        state === 'complete' && 'border-green-500/30 bg-green-50',
                        state === 'active' && 'border-blue-500/30 bg-blue-50',
                        state === 'inactive' && 'border-outline-variant',
                      )}
                    >
                      <div className="flex items-center gap-3">
                        {state === 'complete' ? (
                          <CheckCircle2 size={18} className="text-green-600" />
                        ) : state === 'active' ? (
                          <Loader2 size={18} className="text-blue-500 animate-spin" />
                        ) : (
                          <span className="block h-4 w-4 rounded-full border border-outline-variant bg-surface-container-lowest" />
                        )}
                        <p className="font-body-md text-body-md text-primary">{step.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.section>
        ) : (
          <motion.section
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.35 }}
          >
            <div className="max-w-[1200px] mx-auto px-4 py-6 space-y-6">
              <button onClick={() => navigate('/workflows')} className="inline-flex items-center gap-2 text-sm text-blueprint-muted hover:text-primary transition-colors">
                <ArrowLeft size={14} /> Back to workflows
              </button>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h1 className="font-display-xl text-display-xl text-primary break-words">{workflow?.name}</h1>
                    <p className="font-body-md text-body-md text-on-surface-variant mt-2">{workflow?.description}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      onClick={() => { if (workflow?.isPublic) { void handleUnshare(); } else { void handleShare(); } }}
                      disabled={isSharing}
                      className={cn(
                        'text-center py-3 px-5 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors',
                        workflow?.isPublic && 'bg-surface-container',
                      )}
                    >
                      {workflow?.isPublic ? 'Shared' : 'Share'}
                    </button>
                    <button
                      onClick={() => { void handleActivateToggle(); }}
                      className="text-center py-3 px-5 bg-primary text-on-primary rounded-full font-ui-label text-ui-label hover:bg-inverse-surface transition-colors"
                    >
                      {workflow?.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => { void handleRunNow(); }}
                      disabled={isStartingRun}
                      className="text-center py-3 px-5 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors disabled:opacity-50"
                    >
                      {isStartingRun ? 'Running...' : 'Run Now'}
                    </button>
                  </div>
                </div>

                {(workflow?.isPublic || shareUrl) && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 space-y-2">
                    <p className="font-body-md text-body-md text-on-surface-variant break-all">
                      Share link: {shareUrl || (workflow?.shareToken ? `http://localhost:3000/w/${workflow.shareToken}` : '')}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button
                        onClick={async () => {
                          const url = shareUrl || (workflow?.shareToken ? `http://localhost:3000/w/${workflow.shareToken}` : '');
                          if (!url) return;
                          await navigator.clipboard.writeText(url);
                          setCopied(true);
                          window.setTimeout(() => setCopied(false), 2000);
                        }}
                        className="text-center py-2 px-4 border border-outline-variant rounded-full font-ui-label text-ui-label text-primary hover:bg-surface-container transition-colors"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => { void handleUnshare(); }}
                        className="font-body-md text-body-md text-on-surface-variant underline underline-offset-2"
                      >
                        Unshare
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 text-sm text-blueprint-muted">
                  <span className={cn(
                    'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs uppercase tracking-[0.16em]',
                    workflow?.status === 'active'
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-blueprint-line bg-blueprint-bg text-blueprint-muted',
                  )}>
                    {workflow?.status ?? 'ready'}
                  </span>
                  <span>Schedule: {scheduleText}</span>
                  <span>Last run: {lastRunLabel}</span>
                  <span className={cn('inline-flex items-center gap-2', integrationStatusLabel.ok ? 'text-green-700' : 'text-red-700')}>
                    <span className={cn('h-2 w-2 rounded-full', integrationStatusLabel.ok ? 'bg-green-500' : 'bg-red-500')} />
                    {integrationStatusLabel.text}
                  </span>
                </div>

                {activationWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    {activationWarning}{' '}
                    <button
                      onClick={() => navigate('/settings?tab=integrations')}
                      className="underline underline-offset-2"
                    >
                      Open Settings
                    </button>
                  </div>
                )}

                {actionError && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {actionError}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                <button
                  onClick={() => setIsStepsOpen((current) => !current)}
                  className="w-full flex items-center justify-between"
                >
                  <h2 className="font-headline-md text-headline-md text-primary not-italic">Workflow Steps</h2>
                  {isStepsOpen ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </button>
                {isStepsOpen && (
                  <div className="space-y-2">
                    {(dag?.nodes ?? []).map((node) => (
                      <div key={node.id} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          {nodeIcon(node.type)}
                          <span className="font-body-md text-body-md text-primary truncate">{node.label}</span>
                        </div>
                        <span className="inline-flex items-center rounded-full border border-blueprint-line bg-blueprint-bg px-3 py-1 text-xs uppercase tracking-[0.12em] text-blueprint-muted">
                          {node.type}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-6 shadow-[0_8px_30px_rgba(0,0,0,0.03)] space-y-4">
                <h2 className="font-headline-md text-headline-md text-primary not-italic">Run History</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-blueprint-line text-left text-blueprint-muted">
                        <th className="py-3 pr-4 font-medium">Run date</th>
                        <th className="py-3 pr-4 font-medium">Status</th>
                        <th className="py-3 pr-4 font-medium">Duration</th>
                        <th className="py-3 pr-4 font-medium">Triggered by</th>
                      </tr>
                    </thead>
                    <tbody>
                      {runHistory.map((run) => (
                        <React.Fragment key={run.id}>
                          <tr
                            className="border-b border-blueprint-line/60 cursor-pointer hover:bg-blueprint-bg"
                            onClick={() => setExpandedRunId((current) => current === run.id ? null : run.id)}
                          >
                            <td className="py-3 pr-4">{run.started_at ? new Date(run.started_at).toLocaleString() : '-'}</td>
                            <td className="py-3 pr-4 uppercase text-xs">{run.status}</td>
                            <td className="py-3 pr-4">{run.duration_ms != null ? `${(run.duration_ms / 1000).toFixed(1)}s` : '-'}</td>
                            <td className="py-3 pr-4">{run.trigger}</td>
                          </tr>
                          {expandedRunId === run.id && (
                            <tr className="border-b border-blueprint-line/60">
                              <td colSpan={4} className="py-3 pr-4">
                                <div className="space-y-2">
                                  {run.node_logs.map((log) => (
                                    <div key={`${run.id}-${log.node_id}-${log.created_at}`} className="rounded-xl border border-outline-variant bg-surface-container-lowest p-3">
                                      <p className="text-sm">
                                        {log.node_label} →{' '}
                                        <span className={cn(
                                          'font-semibold',
                                          log.status === 'passed' && 'text-green-700',
                                          log.status === 'failed' && 'text-red-700',
                                          log.status === 'skipped' && 'text-amber-700',
                                          log.status === 'running' && 'text-blue-700',
                                        )}>
                                          {log.status}
                                        </span>
                                      </p>
                                      {log.status === 'skipped' ? (
                                        <p className="text-xs text-amber-700 mt-1 break-words">{log.output_preview}</p>
                                      ) : (
                                        <p className="text-xs text-blueprint-muted mt-1 break-words">{log.output_preview}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                      {runHistory.length === 0 && (
                        <tr>
                          <td colSpan={4} className="py-6 text-center text-blueprint-muted">No runs yet.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <AnimatePresence>
              {activeRun && (
                <motion.section
                  initial={{ y: '100%' }}
                  animate={{ y: 0 }}
                  exit={{ y: '100%' }}
                  transition={{ duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
                  className="fixed bottom-0 left-0 right-0 z-30 max-h-[45vh] h-[40vh] border-t border-white/10 bg-[#0d0f12] text-white shadow-[0_-20px_60px_rgba(0,0,0,0.45)]"
                >
                  <div className="flex h-full flex-col px-4 sm:px-6 lg:px-8 py-4">
                    <div className="mx-auto mb-3 h-1.5 w-14 rounded-full bg-white/25" />
                    <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-sm sm:text-base font-semibold">
                          {activeRun.status === 'running'
                            ? `Live Run · Started ${formatDistanceToNow(activeRun.startedAt, { addSuffix: true })}`
                            : `Run ${activeRun.status === 'completed' ? 'Complete' : 'Failed'} · ${((activeRun.durationMs ?? 0) / 1000).toFixed(1)}s`}
                        </div>
                        {activeRun.error && <p className="mt-1 text-sm text-red-300 break-words">{activeRun.error}</p>}
                      </div>
                      <div className="flex gap-2">
                        {activeRun.status !== 'running' && (
                          <button onClick={() => { void handleRunNow(); }} className="rounded-full border border-white/25 px-4 py-2 text-sm text-white/85 hover:bg-white/10">
                            Run again
                          </button>
                        )}
                        <button onClick={closeConsole} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/80">
                          Close console
                        </button>
                      </div>
                    </div>
                    <div ref={logContainerRef} className="flex-1 overflow-y-auto rounded-2xl border border-white/8 bg-black/25 p-4 space-y-3">
                      {runLogs.length === 0 ? (
                        <div className="h-full flex items-center justify-center text-white/50 text-sm">Waiting for node events...</div>
                      ) : (
                        runLogs.map((log, index) => (
                          <div key={`${log.nodeId}-${log.timestamp}-${index}`} className="rounded-xl border border-white/10 bg-white/5 p-3">
                            <p className="text-xs text-white/40 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</p>
                            <p className="mt-1 text-sm text-white/90 break-words">
                              {log.nodeLabel} →{' '}
                              <span className={cn(
                                log.status === 'running' && 'text-blue-300',
                                log.status === 'passed' && 'text-green-300',
                                log.status === 'failed' && 'text-red-300',
                                log.status === 'skipped' && 'text-amber-300',
                              )}>
                                {log.status}
                              </span>
                            </p>
                            {log.status === 'skipped' && log.skipReason ? (
                              <p className="mt-1 text-xs text-amber-300 break-words">{log.skipReason}</p>
                            ) : (
                              log.outputPreview && <p className="mt-1 text-xs text-white/55 break-words">{log.outputPreview}</p>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>
          </motion.section>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function WorkflowDetail() {
  return <WorkflowDetailInner />;
}

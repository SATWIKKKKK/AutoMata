export interface GeneratedWorkflowNode {
  id: string;
  type: 'cron_trigger' | 'tool_call' | 'llm_call' | 'evaluator' | 'condition' | 'human_gate';
  label: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

export interface GeneratedWorkflowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface GeneratedWorkflowDag {
  workflow_name: string;
  description: string;
  nodes: GeneratedWorkflowNode[];
  edges: GeneratedWorkflowEdge[];
}

export const WORKFLOW_DAG_SYSTEM_PROMPT = `You are an expert workflow architect for the Automata platform.
Convert the user's request into a valid workflow DAG JSON only. Do not wrap the response in markdown.

Requirements:
- The workflow must contain exactly one cron_trigger node.
- Every llm_call node must eventually lead to an evaluator node downstream.
- Use these node types only: cron_trigger, tool_call, llm_call, evaluator, condition, human_gate.
- Each node must include: id, type, label, config, position.
- Each edge must include: id, source, target, optional label.
- Node positions should be laid out top-to-bottom with y increasing by 180 and x offsets for branches.
- Keep labels concise and production-ready.

Node config rules:
- cron_trigger: { cron: string }
- tool_call: { mcp_server: string, tool_name: string, tool_params_template: object }
- llm_call: { model: string, system_prompt: string, input_template: string, max_tokens: number }
- evaluator: { model: string, evaluates: string, criteria: string, max_retries: number, pass_threshold?: number }
- condition: { expression: string }
- human_gate: { notify_user_id: string, instructions?: string }

Return JSON with this exact shape:
{
  "workflow_name": "string",
  "description": "string",
  "nodes": [ ... ],
  "edges": [ ... ]
}`;

const NODE_TYPE_MAP: Record<string, GeneratedWorkflowNode['type']> = {
  trigger: 'cron_trigger',
  cron: 'cron_trigger',
  cron_trigger: 'cron_trigger',
  action: 'tool_call',
  integration: 'tool_call',
  tool: 'tool_call',
  tool_call: 'tool_call',
  llm: 'llm_call',
  llm_call: 'llm_call',
  evaluator: 'evaluator',
  judge: 'evaluator',
  condition: 'condition',
  branch: 'condition',
  human_gate: 'human_gate',
  approval: 'human_gate',
};

function normalizeNodeType(value: unknown): GeneratedWorkflowNode['type'] {
  const key = String(value ?? '').trim().toLowerCase();
  return NODE_TYPE_MAP[key] ?? 'tool_call';
}

function defaultLabel(type: GeneratedWorkflowNode['type'], index: number): string {
  switch (type) {
    case 'cron_trigger':
      return 'Schedule Trigger';
    case 'tool_call':
      return `Tool Step ${index + 1}`;
    case 'llm_call':
      return `AI Step ${index + 1}`;
    case 'evaluator':
      return `Evaluator ${index + 1}`;
    case 'condition':
      return `Condition ${index + 1}`;
    case 'human_gate':
      return `Approval ${index + 1}`;
    default:
      return `Node ${index + 1}`;
  }
}

export function extractJSONObject(text: string): any {
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('Model returned invalid JSON.');
  }

  return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
}

export function normalizeGeneratedWorkflowDag(raw: any): GeneratedWorkflowDag {
  const sourceNodes = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const sourceEdges = Array.isArray(raw?.edges) ? raw.edges : [];

  const nodes: GeneratedWorkflowNode[] = sourceNodes.map((node: any, index: number) => {
    const type = normalizeNodeType(node?.type);
    const baseX = type === 'condition' ? 120 : 0;

    return {
      id: String(node?.id ?? `node_${index + 1}`),
      type,
      label: String(node?.label ?? defaultLabel(type, index)),
      config: typeof node?.config === 'object' && node?.config !== null ? node.config : {},
      position: {
        x: Number(node?.position?.x ?? baseX),
        y: Number(node?.position?.y ?? index * 180),
      },
    };
  });

  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges: GeneratedWorkflowEdge[] = sourceEdges
    .map((edge: any, index: number) => {
      const source = String(edge?.source ?? edge?.from ?? '');
      const target = String(edge?.target ?? edge?.to ?? '');
      return {
        id: String(edge?.id ?? `edge_${index + 1}`),
        source,
        target,
        label: edge?.label ? String(edge.label) : undefined,
      };
    })
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target));

  return {
    workflow_name: String(raw?.workflow_name ?? raw?.name ?? 'Generated Workflow'),
    description: String(raw?.description ?? ''),
    nodes,
    edges,
  };
}

export function validateGeneratedWorkflowDag(dag: GeneratedWorkflowDag) {
  const nodeIds = new Set(dag.nodes.map((node) => node.id));

  for (const edge of dag.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      throw new Error(`Edge ${edge.id} references an unknown node.`);
    }
  }

  const cronTriggerCount = dag.nodes.filter((node) => node.type === 'cron_trigger').length;
  if (cronTriggerCount !== 1) {
    throw new Error('A workflow must contain exactly one cron_trigger node.');
  }

  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const node of dag.nodes) {
    adjacency.set(node.id, []);
    inDegree.set(node.id, 0);
  }

  for (const edge of dag.edges) {
    adjacency.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue = dag.nodes.filter((node) => (inDegree.get(node.id) ?? 0) === 0).map((node) => node.id);
  let visited = 0;

  while (queue.length > 0) {
    const current = queue.shift()!;
    visited += 1;
    for (const next of adjacency.get(current) ?? []) {
      const remaining = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, remaining);
      if (remaining === 0) queue.push(next);
    }
  }

  if (visited !== dag.nodes.length) {
    throw new Error('The workflow graph contains a circular dependency.');
  }

  const hasEvaluatorDownstream = (startNodeId: string): boolean => {
    const seen = new Set<string>();
    const stack = [...(adjacency.get(startNodeId) ?? [])];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (seen.has(current)) continue;
      seen.add(current);
      const node = dag.nodes.find((candidate) => candidate.id === current);
      if (node?.type === 'evaluator') return true;
      stack.push(...(adjacency.get(current) ?? []));
    }

    return false;
  };

  for (const node of dag.nodes) {
    if (node.type === 'llm_call' && !hasEvaluatorDownstream(node.id)) {
      throw new Error(`LLM node ${node.label} must lead to an evaluator node.`);
    }
  }
}

export function estimateWorkflowRunCostInr(dag: GeneratedWorkflowDag) {
  const breakdown = dag.nodes
    .filter((node) => node.type === 'llm_call' || node.type === 'evaluator')
    .map((node) => {
      const model = String(node.config?.model ?? 'claude-haiku-4-5').toLowerCase();
      const inputRate = model.includes('sonnet') ? 3.0 : 0.8;
      const outputRate = model.includes('sonnet') ? 15.0 : 4.0;
      const estimatedInputTokens = 1500;
      const estimatedOutputTokens = Number(node.config?.max_tokens ?? 400);
      const nodeCostUsd =
        (estimatedInputTokens / 1_000_000) * inputRate +
        (estimatedOutputTokens / 1_000_000) * outputRate;
      const nodeCostInr = nodeCostUsd * 84;

      return {
        nodeId: node.id,
        nodeLabel: node.label,
        model,
        estimatedTokens: estimatedInputTokens + estimatedOutputTokens,
        estimatedCostInr: nodeCostInr,
      };
    });

  return {
    estimatedCostPerRunInr: breakdown.reduce((total, item) => total + item.estimatedCostInr, 0),
    breakdown,
  };
}

function capitalize(word: string): string {
  if (!word) return word;
  return `${word[0].toUpperCase()}${word.slice(1).toLowerCase()}`;
}

function parseScheduleToCron(prompt: string): string {
  const text = prompt.toLowerCase();
  const dayMap: Record<string, string> = {
    sunday: '0',
    monday: '1',
    tuesday: '2',
    wednesday: '3',
    thursday: '4',
    friday: '5',
    saturday: '6',
  };

  let minute = 0;
  let hour = 9;
  const timeMatch = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i);
  if (timeMatch) {
    const parsedHour = Number(timeMatch[1]);
    const parsedMinute = Number(timeMatch[2] ?? '0');
    const meridian = String(timeMatch[3]).toLowerCase();
    hour = parsedHour % 12;
    if (meridian === 'pm') hour += 12;
    minute = Math.max(0, Math.min(59, parsedMinute));
  }

  let dayOfWeek = '*';
  for (const [dayName, dayNumber] of Object.entries(dayMap)) {
    if (text.includes(dayName)) {
      dayOfWeek = dayNumber;
      break;
    }
  }

  if (text.includes('weekday')) {
    dayOfWeek = '1-5';
  }

  return `${minute} ${hour} * * ${dayOfWeek}`;
}

export function buildFallbackSummary(prompt: string): { name: string; description: string } {
  const cleaned = String(prompt ?? '').replace(/\s+/g, ' ').trim();
  const words = cleaned
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map(capitalize);

  const name = words.join(' ') || 'Generated Workflow';
  const description = cleaned.length > 180 ? `${cleaned.slice(0, 177)}...` : cleaned;
  return { name, description };
}

export function buildFallbackWorkflowDag(
  prompt: string,
  preferredName?: string,
  preferredDescription?: string,
): GeneratedWorkflowDag {
  const text = String(prompt ?? '').toLowerCase();
  const hasSheet = text.includes('google sheet') || text.includes('spreadsheet') || text.includes('sheet');
  const hasEmail = text.includes('email') || text.includes('gmail');
  const hasSlack = text.includes('slack');

  const fallbackSummary = buildFallbackSummary(prompt);
  const workflowName = String(preferredName ?? fallbackSummary.name).trim() || 'Generated Workflow';
  const workflowDescription = String(preferredDescription ?? fallbackSummary.description).trim() || fallbackSummary.description;

  const nodes: GeneratedWorkflowNode[] = [];
  const edges: GeneratedWorkflowEdge[] = [];

  const addEdge = (source: string, target: string, label?: string) => {
    edges.push({ id: `edge_${edges.length + 1}`, source, target, label });
  };

  nodes.push({
    id: 'trigger_1',
    type: 'cron_trigger',
    label: 'Schedule Trigger',
    config: { cron: parseScheduleToCron(prompt) },
    position: { x: 0, y: 0 },
  });

  let previousNodeId = 'trigger_1';
  let currentY = 180;

  if (hasSheet) {
    const sheetNodeId = 'tool_sheet_1';
    nodes.push({
      id: sheetNodeId,
      type: 'tool_call',
      label: 'Read Google Sheet',
      config: {
        mcp_server: 'google_sheets',
        tool_name: 'read_rows',
        tool_params_template: {
          spreadsheet: 'Primary Sheet',
          range: 'A:Z',
        },
      },
      position: { x: 0, y: currentY },
    });
    addEdge(previousNodeId, sheetNodeId);
    previousNodeId = sheetNodeId;
    currentY += 180;
  }

  nodes.push({
    id: 'llm_1',
    type: 'llm_call',
    label: 'Generate Summary',
    config: {
      model: 'claude-haiku-3-5-20251001',
      system_prompt: 'You are an operations assistant. Produce a concise summary and clear action items.',
      input_template: hasSheet
        ? 'Summarize the latest sheet data for stakeholders. Include major metrics and key actions.'
        : `Summarize this workflow request and produce an execution-ready brief: ${prompt}`,
      max_tokens: 450,
    },
    position: { x: 0, y: currentY },
  });
  addEdge(previousNodeId, 'llm_1');
  currentY += 180;

  nodes.push({
    id: 'evaluator_1',
    type: 'evaluator',
    label: 'Quality Check',
    config: {
      model: 'claude-haiku-3-5-20251001',
      evaluates: 'llm_1',
      criteria: 'The output is clear, accurate, and actionable for the intended recipients.',
      max_retries: 1,
      pass_threshold: 0.7,
    },
    position: { x: 0, y: currentY },
  });
  addEdge('llm_1', 'evaluator_1');
  currentY += 180;

  const finalNodeId = 'tool_notify_1';
  const finalNode: GeneratedWorkflowNode = hasEmail
    ? {
        id: finalNodeId,
        type: 'tool_call',
        label: 'Send Email Summary',
        config: {
          mcp_server: 'gmail',
          tool_name: 'send_email',
          tool_params_template: {
            to: 'team@company.com',
            subject: `${workflowName} Update`,
            body: '{{ llm_1.output }}',
          },
        },
        position: { x: 0, y: currentY },
      }
    : hasSlack
      ? {
          id: finalNodeId,
          type: 'tool_call',
          label: 'Post Slack Digest',
          config: {
            mcp_server: 'slack',
            tool_name: 'post_message',
            tool_params_template: {
              channel: '#team-updates',
              text: '{{ llm_1.output }}',
            },
          },
          position: { x: 0, y: currentY },
        }
      : {
          id: finalNodeId,
          type: 'tool_call',
          label: 'Persist Result',
          config: {
            mcp_server: 'internal',
            tool_name: 'store_result',
            tool_params_template: {
              payload: '{{ llm_1.output }}',
            },
          },
          position: { x: 0, y: currentY },
        };

  nodes.push(finalNode);
  addEdge('evaluator_1', finalNodeId, 'passed');

  return {
    workflow_name: workflowName,
    description: workflowDescription,
    nodes,
    edges,
  };
}
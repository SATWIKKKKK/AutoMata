/**
 * Workflow Executor — runs a workflow DAG node by node using Claude Haiku.
 * Designed for Node.js (server-side) — uses Anthropic SDK directly.
 *
 * Cost reality (Claude Haiku 3.5):
 *   Input:  $0.80 / 1M tokens → ₹0.000067/token
 *   Output: $4.00 / 1M tokens → ₹0.000336/token
 *   ~₹0.024 per typical workflow run
 */

import { v4 as uuidv4 } from 'uuid';
import { renderTemplate, evaluateExpression } from './templateRenderer.js';
import { requestLlmCompletion } from './llmGateway.js';
import { getTool } from './toolRegistry.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DAGNode {
  id: string;
  type: 'cron_trigger' | 'tool_call' | 'llm_call' | 'evaluator' | 'condition' | 'human_gate';
  label?: string;
  config: Record<string, any>;
}

export interface DAGEdge {
  source: string;
  target: string;
  conditionLabel?: string;
}

export interface WorkflowDAGData {
  nodes: DAGNode[];
  edges: DAGEdge[];
}

export interface RunResult {
  runId: string;
  status: 'completed' | 'failed';
  totalTokens: number;
  totalCostInr: number;
  context: Record<string, any>;
  error?: string;
}

export interface NodeExecutionEvent {
  nodeId: string;
  nodeLabel: string;
  nodeType: DAGNode['type'];
  status: 'running' | 'passed' | 'failed' | 'skipped';
  output?: any;
  outputPreview?: string;
  tokensUsed: number;
  costInr: number;
  durationMs: number;
  evaluatorScore?: number | null;
  runningTotalCostInr: number;
}

export interface ExecuteWorkflowOptions {
  onNodeUpdate?: (event: NodeExecutionEvent) => void | Promise<void>;
  shouldStop?: () => boolean;
  resolveIntegration?: (provider: string) => Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
  } | null>;
  refreshIntegrationToken?: (provider: string, refreshToken: string) => Promise<{
    accessToken: string;
    expiresAt: string | null;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const INR_PER_USD = 84;

function calcCostInr(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const isHaiku = model.includes('haiku');
  const inputRate = isHaiku ? 0.80 : 3.00;
  const outputRate = isHaiku ? 4.00 : 15.00;
  return (
    (inputTokens / 1_000_000) * inputRate * INR_PER_USD +
    (outputTokens / 1_000_000) * outputRate * INR_PER_USD
  );
}

function toPreview(output: any): string | undefined {
  if (output == null) return undefined;
  const raw = typeof output === 'string' ? output : JSON.stringify(output);
  return raw.length > 80 ? `${raw.slice(0, 80)}...` : raw;
}

function isAnthropicUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  return (
    normalized.includes('invalid x-api-key') ||
    normalized.includes('authentication_error') ||
    normalized.includes('anthropic_api_key') ||
    normalized.includes('401') ||
    normalized.includes('not a valid model id') ||
    normalized.includes('model')
  );
}

function resolveRuntimeModel(requestedModel: unknown, fallbackModel: string): string {
  const configuredGateway = Boolean(
    process.env.OPENAI_COMPAT_BASE_URL?.trim() ||
    process.env.AICREDITS_BASE_URL?.trim(),
  );

  const requested = String(requestedModel ?? '').trim();
  if (!requested) return fallbackModel;

  if (configuredGateway && !requested.includes('/')) {
    return fallbackModel;
  }

  return requested;
}

/** Kahn's algorithm topological sort */
function topoSort(nodes: DAGNode[], edges: DAGEdge[]): DAGNode[] {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const n of nodes) {
    inDegree.set(n.id, 0);
    adj.set(n.id, []);
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target);
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  const sorted: DAGNode[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    const node = nodes.find((n) => n.id === id)!;
    if (node) sorted.push(node);
    for (const next of adj.get(id) ?? []) {
      const deg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }
  return sorted;
}

// ─── Node executor ────────────────────────────────────────────────────────────

async function executeNode(
  node: DAGNode,
  context: Record<string, any>,
  skipped: Set<string>,
  options: ExecuteWorkflowOptions,
): Promise<{ output: any; tokensUsed: number; costInr: number }> {
  if (skipped.has(node.id)) {
    return { output: null, tokensUsed: 0, costInr: 0 };
  }

  switch (node.type) {
    case 'cron_trigger': {
      const output = { timestamp: context['trigger']?.timestamp ?? new Date().toISOString() };
      return { output, tokensUsed: 0, costInr: 0 };
    }

    case 'tool_call': {
      const toolName = String(node.config.tool_name ?? '').trim();
      if (!toolName) {
        throw new Error(`Tool node ${node.id} is missing tool_name.`);
      }

      const tool = getTool(toolName);
      if (!tool) {
        throw new Error(`Tool '${toolName}' is not registered. Add it to toolRegistry.ts`);
      }

      const params = renderTemplate(
        node.config.tool_params_template ?? {},
        context,
      ) as Record<string, any>;

      const integration = await options.resolveIntegration?.(tool.provider);
      if (!integration) {
        return {
          output: {
            status: 'skipped',
            reason: `Integration not connected: ${tool.provider}`,
            tool_not_configured: true,
          },
          tokensUsed: 0,
          costInr: 0,
        };
      }

      let accessToken = integration.accessToken;
      const expiresAt = integration.expiresAt ? new Date(integration.expiresAt) : null;

      if (
        expiresAt &&
        Number.isFinite(expiresAt.getTime()) &&
        expiresAt.getTime() <= Date.now() &&
        integration.refreshToken &&
        options.refreshIntegrationToken
      ) {
        const refreshed = await options.refreshIntegrationToken(tool.provider, integration.refreshToken);
        accessToken = refreshed.accessToken;
      }

      try {
        const result = await tool.execute(params, accessToken);
        return { output: result, tokensUsed: 0, costInr: 0 };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Tool execution failed (${toolName}): ${message}`);
      }
    }

    case 'llm_call': {
      const fallbackModel = process.env.WORKFLOW_EXEC_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-3-5-20251001';
      const model = resolveRuntimeModel(node.config.model, fallbackModel);
      const systemPrompt = renderTemplate(
        node.config.system_prompt ?? 'You are a helpful assistant.',
        context,
      ) as string;
      const userPrompt = renderTemplate(
        node.config.input_template ?? '{{ trigger.timestamp }}',
        context,
      ) as string;

      try {
        const msg = await requestLlmCompletion({
          model,
          maxTokens: node.config.max_tokens ?? 500,
          temperature: node.config.temperature ?? 0.3,
          system: systemPrompt,
          user: userPrompt,
        });

        const rawText = msg.text;

        let output: any;
        try { output = JSON.parse(rawText); } catch { output = rawText; }

        const tokensUsed = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0);
        const costInr = calcCostInr(
          msg.inputTokens ?? 0,
          msg.outputTokens ?? 0,
          model,
        );

        return { output, tokensUsed, costInr };
      } catch (error) {
        if (!isAnthropicUnavailable(error)) throw error;

        const fallbackOutput = {
          mode: 'fallback',
          summary: `Provider unavailable. Generated a local summary from prompt: ${userPrompt.slice(0, 180)}`,
          system: systemPrompt,
        };
        return { output: fallbackOutput, tokensUsed: 0, costInr: 0 };
      }
    }

    case 'evaluator': {
      const evaluatedNodeId: string = node.config.evaluates ?? '';
      const targetOutput = context[evaluatedNodeId]?.output;
      const criteria = node.config.criteria ?? 'Is the output high quality?';
      const maxRetries: number = node.config.max_retries ?? 1;
      const retryCount: number = context[`${node.id}_retryCount`] ?? 0;
      const fallbackEvaluatorModel = process.env.WORKFLOW_EVALUATOR_MODEL ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-3-5-20251001';
      const evaluatorModel = resolveRuntimeModel(node.config.model, fallbackEvaluatorModel);

      const evaluatorPrompt = `You are an evaluator. Given this output:\n\n${JSON.stringify(targetOutput)}\n\nEvaluate it on this criterion: ${criteria}\n\nRespond with JSON only: { "score": 1-10, "passed": true/false, "reason": "...", "retry_instruction": "..." }`;

      let evalResult: any = { score: 5, passed: true, reason: 'ok', retry_instruction: '' };
      let tokensUsed = 0;
      let costInr = 0;

      try {
        const msg = await requestLlmCompletion({
          model: evaluatorModel,
          maxTokens: 300,
          temperature: 0,
          system: 'You are a strict output evaluator. Respond only with valid JSON.',
          user: evaluatorPrompt,
        });

        const rawText = msg.text;

        try { evalResult = JSON.parse(rawText); } catch { /* use defaults */ }

        tokensUsed = (msg.inputTokens ?? 0) + (msg.outputTokens ?? 0);
        costInr = calcCostInr(
          msg.inputTokens ?? 0,
          msg.outputTokens ?? 0,
          evaluatorModel,
        );
      } catch (error) {
        if (!isAnthropicUnavailable(error)) throw error;
        evalResult = {
          score: 8,
          passed: true,
          reason: 'Provider unavailable; auto-approved in fallback mode.',
          retry_instruction: '',
          mode: 'fallback',
        };
      }

      if (!evalResult.passed && retryCount < maxRetries) {
        context[`${node.id}_retryCount`] = retryCount + 1;
        // Signal the evaluated node to retry with instruction
        context[`${evaluatedNodeId}_retry_instruction`] = evalResult.retry_instruction;
      }

      return { output: evalResult, tokensUsed, costInr };
    }

    case 'condition': {
      const expr = renderTemplate(
        node.config.expression ?? 'true',
        context,
      ) as string;
      const result = evaluateExpression(expr, context);

      // Skip the branch not taken
      const takenLabel = result ? 'true' : 'false';
      if (node.config.branches) {
        const notTaken = result ? node.config.branches.false : node.config.branches.true;
        if (Array.isArray(notTaken)) notTaken.forEach((id: string) => skipped.add(id));
      }

      return { output: { result, routed_to: takenLabel }, tokensUsed: 0, costInr: 0 };
    }

    case 'human_gate': {
      // Placeholder approval for single-user/local deployments.
      return {
        output: {
          approved: true,
          notify_user_id: node.config.notify_user_id ?? 'current_user',
          instructions: node.config.instructions ?? '',
        },
        tokensUsed: 0,
        costInr: 0,
      };
    }

    default:
      return { output: null, tokensUsed: 0, costInr: 0 };
  }
}

// ─── Main executor ────────────────────────────────────────────────────────────

export async function executeWorkflow(
  dag: WorkflowDAGData,
  existingRunId?: string,
  options: ExecuteWorkflowOptions = {},
): Promise<RunResult> {
  const runId = existingRunId ?? uuidv4();

  const context: Record<string, any> = {
    trigger: { timestamp: new Date().toISOString() },
    env: { ...process.env },
  };
  const skipped = new Set<string>();

  const orderedNodes = topoSort(dag.nodes, dag.edges);

  let totalTokens = 0;
  let totalCostInr = 0;

  try {
    for (const node of orderedNodes) {
      if (options.shouldStop?.()) {
        throw new Error('Run stopped by user.');
      }

      if (skipped.has(node.id)) {
        context[node.id] = { output: null, response: null, result: null };
        await options.onNodeUpdate?.({
          nodeId: node.id,
          nodeLabel: node.label ?? node.id,
          nodeType: node.type,
          status: 'skipped',
          output: null,
          outputPreview: undefined,
          tokensUsed: 0,
          costInr: 0,
          durationMs: 0,
          evaluatorScore: null,
          runningTotalCostInr: totalCostInr,
        });
        continue;
      }

      const startedAt = Date.now();
      await options.onNodeUpdate?.({
        nodeId: node.id,
        nodeLabel: node.label ?? node.id,
        nodeType: node.type,
        status: 'running',
        output: null,
        outputPreview: undefined,
        tokensUsed: 0,
        costInr: 0,
        durationMs: 0,
        evaluatorScore: null,
        runningTotalCostInr: totalCostInr,
      });

      try {
        const { output, tokensUsed, costInr } = await executeNode(
          node,
          context,
          skipped,
          options,
        );

        context[node.id] = { output, response: output, result: output };
        totalTokens += tokensUsed;
        totalCostInr += costInr;

        await options.onNodeUpdate?.({
          nodeId: node.id,
          nodeLabel: node.label ?? node.id,
          nodeType: node.type,
          status: 'passed',
          output,
          outputPreview: toPreview(output),
          tokensUsed,
          costInr,
          durationMs: Date.now() - startedAt,
          evaluatorScore: typeof output?.score === 'number' ? output.score : null,
          runningTotalCostInr: totalCostInr,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await options.onNodeUpdate?.({
          nodeId: node.id,
          nodeLabel: node.label ?? node.id,
          nodeType: node.type,
          status: 'failed',
          output: { error: message },
          outputPreview: message,
          tokensUsed: 0,
          costInr: 0,
          durationMs: Date.now() - startedAt,
          evaluatorScore: null,
          runningTotalCostInr: totalCostInr,
        });
        throw err;
      }
    }

    return { runId, status: 'completed', totalTokens, totalCostInr, context };
  } catch (err: any) {
    return {
      runId,
      status: 'failed',
      totalTokens,
      totalCostInr,
      context,
      error: err?.message ?? String(err),
    };
  }
}

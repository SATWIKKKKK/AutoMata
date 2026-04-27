import { useState, useEffect, useCallback } from 'react';
import { useWorkflowStore, Workflow } from '../stores/workflowStore';

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export function useWorkflows() {
  const { workflows, setWorkflows, lastFetchedAt } = useWorkflowStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWorkflows = useCallback(async (force = false) => {
    const stale = !lastFetchedAt || Date.now() - lastFetchedAt > CACHE_TTL;
    if (!stale && !force) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workflows');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setWorkflows(
        (data.workflows ?? data).map((w: any) => ({
          id: w.id,
          name: w.name,
          description: w.description ?? '',
          prompt: w.prompt ?? '',
          dag: w.dag ? (typeof w.dag === 'string' ? JSON.parse(w.dag) : w.dag) : null,
          status: w.status ?? 'draft',
          cronSchedule: w.cron_schedule ?? null,
          createdAt: w.created_at ?? new Date().toISOString(),
          updatedAt: w.updated_at ?? w.created_at ?? new Date().toISOString(),
        })),
      );
    } catch {
      setError('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  }, [lastFetchedAt, setWorkflows]);

  useEffect(() => {
    fetchWorkflows();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { workflows, loading, error, refetch: () => fetchWorkflows(true) };
}

export function useWorkflow(id: string | null) {
  const workflow = useWorkflowStore((s) =>
    s.workflows.find((w) => w.id === id) ?? null,
  );
  return workflow;
}

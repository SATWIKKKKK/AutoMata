import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getStoredUser } from '../lib/session';

type SharedNode = {
  id: string;
  label?: string;
  type: string;
};

type SharedDag = {
  nodes?: SharedNode[];
  edges?: Array<{ source: string; target: string }>;
};

type SharedWorkflowData = {
  id: string;
  name: string;
  description: string;
  dag: SharedDag | null;
  fork_count: number;
};

export default function SharedWorkflow() {
  const navigate = useNavigate();
  const { token } = useParams<{ token: string }>();
  const [workflow, setWorkflow] = useState<SharedWorkflowData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forking, setForking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch(`/api/w/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? 'Failed to load shared workflow.');
        setWorkflow(data.workflow);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  const nodes = useMemo(() => workflow?.dag?.nodes ?? [], [workflow]);

  const handleFork = async () => {
    const user = getStoredUser();
    if (!user?.loggedIn) {
      navigate('/signup');
      return;
    }
    if (!token) return;
    setForking(true);
    try {
      const res = await fetch(`/api/w/${token}/fork`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? 'Failed to fork workflow.');
      navigate(`/workflows/${data.workflowId}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to fork workflow.');
    } finally {
      setForking(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full">
        <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl">
          <p className="text-blueprint-muted font-mono">Loading shared workflow...</p>
        </div>
      </div>
    );
  }

  if (error || !workflow) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full">
        <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl">
          <p className="text-blueprint-muted font-mono">{error ?? 'Shared workflow not found.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full space-y-8 sm:space-y-12">
      <div className="space-y-2">
        <h2 className="text-headline-lg text-blueprint-accent">{workflow.name}</h2>
        <p className="text-body-md text-blueprint-muted max-w-2xl">{workflow.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
        <div className="bg-surface-container-lowest border border-blueprint-line rounded-xl p-8">
          <span className="text-ui-label text-blueprint-muted">Nodes</span>
          <div className="text-headline-lg text-blueprint-accent mt-2">{nodes.length}</div>
        </div>
        <div className="bg-surface-container-lowest border border-blueprint-line rounded-xl p-8">
          <span className="text-ui-label text-blueprint-muted">Community Forks</span>
          <div className="text-headline-lg text-blueprint-accent mt-2">Forked {Number(workflow.fork_count ?? 0)} times</div>
        </div>
      </div>

      <div className="rounded-[24px] border border-blueprint-line bg-white p-5 sm:p-6 shadow-sm space-y-4">
        <h3 className="font-serif text-2xl">Workflow Nodes</h3>
        {nodes.length === 0 ? (
          <p className="text-sm text-blueprint-muted">No nodes found.</p>
        ) : (
          <div className="space-y-2">
            {nodes.map((node) => (
              <div key={node.id} className="rounded-2xl bg-blueprint-bg p-4 flex items-center justify-between">
                <span className="text-sm font-medium">{node.label || node.id}</span>
                <span className="text-xs uppercase tracking-[0.16em] text-blueprint-muted">{node.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <button
          onClick={handleFork}
          disabled={forking}
          className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-on-primary hover:bg-inverse-surface disabled:opacity-50"
        >
          {forking ? 'Forking...' : 'Fork this workflow'}
        </button>
      </div>
    </div>
  );
}

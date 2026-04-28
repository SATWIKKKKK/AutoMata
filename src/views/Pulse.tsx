import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { cn } from '../lib/utils';

type PulseWidget = {
  metric_key: string;
  latest_value: number;
  latest_label: string;
  data_points: Array<{ date: string; value: number }>;
  change_pct: number;
  workflow_name: string;
};

type PulseSummary = {
  total_workflows: number;
  active_workflows: number;
  runs_this_month: number;
  estimated_hours_saved: number;
};

function toTitleCase(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Pulse() {
  const navigate = useNavigate();
  const [widgets, setWidgets] = useState<PulseWidget[]>([]);
  const [summary, setSummary] = useState<PulseSummary>({
    total_workflows: 0,
    active_workflows: 0,
    runs_this_month: 0,
    estimated_hours_saved: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchPulse = async () => {
    try {
      const res = await fetch('/api/pulse');
      const data = await res.json();
      if (!res.ok) return;
      setWidgets(Array.isArray(data?.widgets) ? data.widgets : []);
      if (data?.summary) setSummary(data.summary);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPulse();
    const interval = window.setInterval(() => {
      void fetchPulse();
    }, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const statCards = useMemo(() => ([
    { label: 'Total Workflows', value: String(summary.total_workflows) },
    { label: 'Active Workflows', value: String(summary.active_workflows) },
    { label: 'Runs This Month', value: String(summary.runs_this_month) },
    { label: 'Estimated Impact', value: `${Number(summary.estimated_hours_saved ?? 0).toFixed(1)}hrs saved` },
  ]), [summary]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-[1440px] mx-auto w-full space-y-8 sm:space-y-12">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-blueprint-line pb-6 sm:pb-8 gap-4">
        <div className="space-y-2">
          <h2 className="text-headline-lg text-blueprint-accent">Pulse</h2>
          <p className="text-body-md text-blueprint-muted max-w-2xl">
            Real-time business metrics extracted from your workflow runs.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 sm:gap-8">
        {statCards.map((card) => (
          <div key={card.label} className="bg-surface-container-lowest border border-blueprint-line rounded-xl p-8 flex flex-col justify-between h-40 shadow-sm">
            <span className="text-ui-label text-blueprint-muted">{card.label}</span>
            <div className="text-headline-lg text-blueprint-accent">{card.value}</div>
          </div>
        ))}
      </div>

      {!loading && widgets.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-blueprint-line rounded-2xl space-y-4">
          <p className="text-blueprint-muted font-mono">Pulse populates automatically after your first workflow runs.</p>
          <button
            onClick={() => navigate('/builder')}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-on-primary hover:bg-inverse-surface"
          >
            Go To Builder
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {widgets.map((widget) => {
            const isPositive = widget.change_pct >= 0;
            return (
              <div key={widget.metric_key} className="rounded-[24px] border border-blueprint-line bg-white p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-serif text-2xl">{toTitleCase(widget.metric_key)}</h3>
                    <p className="text-sm text-blueprint-muted">{widget.workflow_name}</p>
                  </div>
                  <span
                    className={cn(
                      'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
                      isPositive ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700',
                    )}
                  >
                    {isPositive ? '+' : ''}{widget.change_pct.toFixed(1)}%
                  </span>
                </div>

                <div className="text-3xl sm:text-4xl font-semibold text-blueprint-accent">
                  {widget.latest_value}
                </div>

                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={widget.data_points}>
                      <Line type="monotone" dataKey="value" stroke="#000" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

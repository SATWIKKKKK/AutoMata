import { useState, useEffect } from 'react';

interface AnalyticsSummary {
  success_rate: string;
  p99_latency: string;
  total_runs: number;
  total_cost_inr: number;
}

export function useAnalytics() {
  const [data, setData] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch_ = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/analytics/summary');
      if (!res.ok) throw new Error('Failed to fetch analytics');
      const d = await res.json();
      setData(d);
    } catch {
      setError('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch_(); }, []);

  return { data, loading, error, refetch: fetch_ };
}

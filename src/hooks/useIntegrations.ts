import { useState, useEffect } from 'react';

export interface IntegrationStatus {
  provider: string;
  account?: string;
  connected_at?: string;
}

export function useIntegrations() {
  const [integrations, setIntegrations] = useState<IntegrationStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchIntegrations = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations');
      if (!res.ok) throw new Error('Failed to fetch integrations');
      const data = await res.json();
      setIntegrations(Array.isArray(data) ? data : []);
    } catch {
      setError('Failed to load integrations');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntegrations(); }, []);

  return { integrations, loading, error, refetch: fetchIntegrations };
}

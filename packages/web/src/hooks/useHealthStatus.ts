import { useState, useEffect } from 'react';

interface HealthStatus {
  status: string;
  timestamp: string;
  services: {
    graphql: { status: string; port: number };
    neo4j: { status: string; uri: string; error?: string };
    mcp: { status: string; port: number; error?: string };
  };
}

export function useHealthStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const response = await fetch('http://localhost:4127/health');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = await response.json();
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Health check failed');
      setHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkHealth();
    // Check health every 30 seconds
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  return { health, loading, error, refetch: checkHealth };
}
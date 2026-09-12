import { hostedUsageEnabled, skipBackgroundPoll } from '../lib/hostedUsage';
import { useState, useEffect } from 'react';

export interface HealthStatus {
  status: string;
  timestamp?: string;
  check?: string;
  db?: boolean | string;
  services: {
    graphql: { status: string; port?: number; check?: string };
    neo4j?: { status: string; uri: string; error?: string; check?: string };
    mcp?: { status: string; port: number; error?: string };
  };
}

/** A liveness endpoint may prove the API route is mounted without spending a DB read. */
export function isGraphServiceAvailable(health: HealthStatus | null): boolean {
  const status = health?.services?.graphql?.status;
  return status === 'healthy' || status === 'available';
}

export function useHealthStatus() {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const checkHealth = async () => {
    try {
      const response = await fetch('/health'); // Use relative URL to leverage Vite proxy
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
    const reconnect=()=>void checkHealth();
    window.addEventListener('online',reconnect);
    
    // Dynamic polling: faster when unhealthy, slower when healthy
    const getPollingInterval = () => {
      if (hostedUsageEnabled) return 60000;
      if (!health) return 5000; // Initial check every 5 seconds
      
      const hasUnhealthyService = !isGraphServiceAvailable(health);
      
      // Poll every 5 seconds if unhealthy, 15 seconds if healthy
      return hasUnhealthyService ? 5000 : 15000;
    };
    
    // Set up dynamic polling
    let timeoutId: ReturnType<typeof setTimeout>;
    
    const scheduleNext = () => {
      const interval = getPollingInterval();
      timeoutId = setTimeout(async () => {
        if (!skipBackgroundPoll()) await checkHealth();
        scheduleNext(); // Schedule the next check
      }, interval);
    };
    
    // Start polling
    scheduleNext();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      window.removeEventListener('online',reconnect);
    };
  }, [health?.services?.graphql?.status]);

  return { health, loading, error, refetch: checkHealth };
}

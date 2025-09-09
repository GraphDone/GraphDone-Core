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
    
    // Dynamic polling: faster when unhealthy, slower when healthy
    const getPollingInterval = () => {
      if (!health) return 5000; // Initial check every 5 seconds
      
      const hasUnhealthyService = health.services?.neo4j?.status !== 'healthy' || 
                                  health.services?.graphql?.status !== 'healthy';
      
      // Poll every 5 seconds if unhealthy, 15 seconds if healthy
      return hasUnhealthyService ? 5000 : 15000;
    };
    
    // Set up dynamic polling
    let timeoutId: NodeJS.Timeout;
    
    const scheduleNext = () => {
      const interval = getPollingInterval();
      timeoutId = setTimeout(async () => {
        await checkHealth();
        scheduleNext(); // Schedule the next check
      }, interval);
    };
    
    // Start polling
    scheduleNext();
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [health?.services?.neo4j?.status, health?.services?.graphql?.status]);

  return { health, loading, error, refetch: checkHealth };
}
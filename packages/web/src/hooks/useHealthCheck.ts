import { useState, useEffect, useCallback } from 'react';

export interface ServiceHealth {
  status: 'healthy' | 'unhealthy' | 'offline' | 'unknown' | 'degraded';
  error?: string;
  [key: string]: any;
}

export interface McpHealth extends ServiceHealth {
  port: number;
  version?: string;
  uptime?: number;
  capabilities: string[];
  lastAccessed?: string | null;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    graphql: ServiceHealth & { port: number };
    neo4j: ServiceHealth & { uri: string };
    mcp: McpHealth;
  };
}

export interface McpStatus {
  connected: boolean;
  active?: boolean;
  connectedClients?: number;
  totalRequests?: number;
  lastRequest?: string;
  neo4j?: {
    connected: boolean;
    uri: string;
  };
  error?: string;
}

interface UseHealthCheckOptions {
  interval?: number; // Polling interval in milliseconds
  enabled?: boolean;
}

export function useHealthCheck(options: UseHealthCheckOptions = {}) {
  const { interval = 30000, enabled = true } = options; // Default 30 second polling
  
  const [health, setHealth] = useState<HealthCheckResult | null>(null);
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const API_BASE_URL = ''; // Always use relative URLs to leverage Vite proxy in all environments

  const checkHealth = useCallback(async () => {
    // Create AbortController for proper timeout handling
    const controller = new AbortController();
    let timeoutId: NodeJS.Timeout | null = null;
    
    try {
      setLoading(true);
      setError(null);

      timeoutId = setTimeout(() => {
        controller.abort();
        setError('Health check timed out after 10 seconds');
        setLoading(false);
      }, 10000);

      // Fetch general health status
      const healthResponse = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal
      });
      
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      if (!healthResponse.ok) {
        throw new Error(`Health check failed: ${healthResponse.statusText}`);
      }

      const healthData: HealthCheckResult = await healthResponse.json();
      setHealth(healthData);

      // Fetch MCP-specific status
      try {
        const mcpResponse = await fetch(`${API_BASE_URL}/mcp/status`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (mcpResponse.ok) {
          const mcpData: McpStatus = await mcpResponse.json();
          setMcpStatus(mcpData);
        } else {
          // MCP might be offline, which is ok
          setMcpStatus({ connected: false });
        }
      } catch (mcpError) {
        // MCP status fetch failed, but that's ok
        setMcpStatus({ connected: false });
      }

      setLastChecked(new Date());
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Health check failed';
      setError(errorMessage);
      
      // Set fallback status when there's an error
      setHealth({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          graphql: { status: 'unknown', port: 0 },
          neo4j: { status: 'unknown', uri: '' },
          mcp: { status: 'unknown', port: 3128, capabilities: [] }
        }
      });
      setMcpStatus({ connected: false, error: errorMessage });
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      setLoading(false);
    }
  }, [API_BASE_URL]);

  // Initial check
  useEffect(() => {
    if (enabled) {
      checkHealth();
    }
  }, [enabled, checkHealth]);

  // Set up polling
  useEffect(() => {
    if (!enabled || !interval) return;

    const intervalId = setInterval(checkHealth, interval);

    return () => clearInterval(intervalId);
  }, [enabled, interval, checkHealth]);

  const refresh = useCallback(() => {
    return checkHealth();
  }, [checkHealth]);

  // Helper to get overall system status
  const getOverallStatus = useCallback((): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' => {
    if (!health) return 'unknown';
    
    const criticalServices = [health.services.graphql, health.services.neo4j];
    const hasCriticalIssue = criticalServices.some(s => s.status === 'unhealthy');
    
    if (hasCriticalIssue) return 'unhealthy';
    if (health.status === 'degraded' || health.services.mcp.status === 'unhealthy') return 'degraded';
    
    return 'healthy';
  }, [health]);

  // Helper to get status color
  const getStatusColor = useCallback((status: string): string => {
    switch (status) {
      case 'healthy':
        return 'text-green-500';
      case 'degraded':
        return 'text-yellow-500';
      case 'unhealthy':
        return 'text-red-500';
      case 'offline':
        return 'text-gray-500';
      default:
        return 'text-gray-400';
    }
  }, []);

  // Helper to get status icon
  const getStatusIcon = useCallback((status: string): string => {
    switch (status) {
      case 'healthy':
        return '✓';
      case 'degraded':
        return '⚠';
      case 'unhealthy':
        return '✗';
      case 'offline':
        return '○';
      default:
        return '?';
    }
  }, []);

  return {
    health,
    mcpStatus,
    loading,
    error,
    lastChecked,
    refresh,
    getOverallStatus,
    getStatusColor,
    getStatusIcon,
    isHealthy: getOverallStatus() === 'healthy',
    isDegraded: getOverallStatus() === 'degraded',
    isUnhealthy: getOverallStatus() === 'unhealthy',
  };
}
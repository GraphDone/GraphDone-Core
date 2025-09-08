import { useState, useEffect, useRef } from 'react';

interface SystemConfig {
  timestamp: string;
  services: {
    api: {
      port: number;
      protocol: string;
      host: string;
      path: string;
      healthPath: string;
    };
    web: {
      port: number;
      protocol: string;
      host: string;
      path: string;
    };
    neo4j: {
      uri: string;
      port: number;
      protocol: string;
      host: string;
    };
    mcp: {
      port: number;
      protocol: string;
      host: string;
      path: string;
    };
    proxy: {
      enabled: boolean;
      httpsPort: number;
      httpPort: number;
      protocol: string;
      host: string;
      certPath: string | null;
      keyPath: string | null;
    };
  };
  tls: {
    enabled: boolean;
    certPath: string | null;
    keyPath: string | null;
    httpsPort: number | null;
  };
  environment: {
    nodeEnv: string;
    clientUrl: string;
    corsOrigin: string;
  };
}

interface UseSystemConfigOptions {
  refreshInterval?: number; // in milliseconds
  enableAutoRefresh?: boolean;
}

export function useSystemConfig(options: UseSystemConfigOptions = {}) {
  const {
    refreshInterval = 10000, // 10 seconds default
    enableAutoRefresh = true
  } = options;

  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const intervalRef = useRef<NodeJS.Timeout>();
  const abortControllerRef = useRef<AbortController>();

  const fetchConfig = async () => {
    try {
      // Cancel any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      
      abortControllerRef.current = new AbortController();
      
      const response = await fetch('/config', {
        signal: abortControllerRef.current.signal,
        headers: {
          'Cache-Control': 'no-cache',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.statusText}`);
      }
      
      const configData = await response.json() as SystemConfig;
      setConfig(configData);
      setError(null);
      setLastUpdated(new Date());
    } catch (err) {
      // Don't set error if request was aborted (component unmounting)
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
        console.error('Failed to fetch system config:', err);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Manual refresh function
  const refresh = () => {
    setIsLoading(true);
    fetchConfig();
  };

  useEffect(() => {
    // Initial fetch
    fetchConfig();

    // Set up periodic refresh if enabled
    if (enableAutoRefresh && refreshInterval > 0) {
      intervalRef.current = setInterval(fetchConfig, refreshInterval);
    }

    // Cleanup function
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [refreshInterval, enableAutoRefresh]);

  // Helper functions to get specific configuration values
  const getApiUrl = () => {
    if (!config) return null;
    return `${config.services.api.protocol}://${config.services.api.host}:${config.services.api.port}`;
  };

  const getWebUrl = () => {
    if (!config) return null;
    return `${config.services.web.protocol}://${config.services.web.host}:${config.services.web.port}`;
  };

  const getProxyUrl = () => {
    if (!config || !config.services.proxy.enabled) return null;
    return `${config.services.proxy.protocol}://${config.services.proxy.host}:${config.services.proxy.httpsPort}`;
  };

  const getNeo4jUrl = () => {
    if (!config) return null;
    return config.services.neo4j.uri;
  };

  const getMcpUrl = () => {
    if (!config) return null;
    return `${config.services.mcp.protocol}://${config.services.mcp.host}:${config.services.mcp.port}`;
  };

  return {
    config,
    isLoading,
    error,
    lastUpdated,
    refresh,
    // Helper methods
    getApiUrl,
    getWebUrl,
    getProxyUrl,
    getNeo4jUrl,
    getMcpUrl,
  };
}
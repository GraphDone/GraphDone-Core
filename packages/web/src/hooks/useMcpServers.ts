import { useState, useEffect } from 'react';

export interface MCPServer {
  id: string;
  name: string;
  type: 'mcp';
  status: 'active' | 'inactive' | 'error' | 'unknown';
  description: string;
  capabilities: string[];
  lastActivity: string;
  actionsToday: number;
  connectedGraphs: string[];
  owner: string;
  isLocal: boolean;
  port?: number;
  endpoint?: string;
}

export function useMcpServers() {
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Function to detect MCP servers
  const detectMcpServers = async (setLoadingState = true) => {
    if (setLoadingState) {
      setIsLoading(true);
    }
    
    try {
      const detectedServers: MCPServer[] = [];

      // Check for GraphDone MCP server via health endpoint
      let mcpStatus: MCPServer['status'] = 'inactive';
      let lastActivity = 'Never';
      let actionsToday = 0;
      
      try {
        const healthResponse = await fetch('http://localhost:3128/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000) // 2 second timeout
        });
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          mcpStatus = 'active';
          lastActivity = healthData.lastAccessed ? 
            new Date(healthData.lastAccessed).toLocaleString() : 
            'No recent activity';
          
          // Get additional status info
          try {
            const statusResponse = await fetch('http://localhost:3128/status', {
              method: 'GET',
              signal: AbortSignal.timeout(2000)
            });
            
            if (statusResponse.ok) {
              const statusData = await statusResponse.json();
              actionsToday = statusData.totalRequests || 0;
            }
          } catch (statusError) {
            // Status endpoint failed, but health worked
            console.warn('MCP status endpoint failed:', statusError);
          }
        }
      } catch (healthError) {
        // Health check failed - server not running or not accessible
        mcpStatus = 'unknown';
        lastActivity = 'Health check failed - server may not be running';
      }

      const graphdoneMcp: MCPServer = {
        id: 'graphdone-mcp',
        name: 'GraphDone MCP Server',
        type: 'mcp',
        status: mcpStatus,
        description: 'Provides Claude Code with access to GraphDone graph operations',
        capabilities: [
          'browse-graph',
          'create-nodes',
          'manage-edges',
          'path-finding',
          'cycle-detection'
        ],
        lastActivity,
        actionsToday,
        connectedGraphs: ['current'],
        owner: 'system',
        isLocal: true,
        port: 3128,
        endpoint: 'http://localhost:3128'
      };
      
      detectedServers.push(graphdoneMcp);
      setMcpServers(detectedServers);
    } catch (error) {
      console.error('Error detecting MCP servers:', error);
    } finally {
      if (setLoadingState) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    // Initial detection
    detectMcpServers();

    // Check periodically for MCP server status
    const interval = setInterval(() => detectMcpServers(false), 30000); // Check every 30 seconds without loading state

    return () => clearInterval(interval);
  }, []);

  const refreshMcpServers = () => {
    detectMcpServers(true);
  };

  return {
    mcpServers,
    isLoading,
    refreshMcpServers
  };
}
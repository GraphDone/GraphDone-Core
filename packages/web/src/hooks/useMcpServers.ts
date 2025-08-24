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
      let capabilities: string[] = []; // Default empty capabilities
      
      try {
        // Use the Vite proxy endpoints instead of direct localhost:3128
        const healthResponse = await fetch('/health', {
          method: 'GET',
          signal: AbortSignal.timeout(2000) // 2 second timeout
        });
        
        if (healthResponse.ok) {
          const healthData = await healthResponse.json();
          const mcpService = healthData.services?.mcp;
          
          if (mcpService && mcpService.status === 'healthy') {
            mcpStatus = 'active';
            lastActivity = mcpService.lastAccessed ? 
              new Date(mcpService.lastAccessed).toLocaleString() : 
              'Server running - Ready for requests';
            
            // Get capabilities from the actual server response
            if (mcpService.capabilities && Array.isArray(mcpService.capabilities)) {
              capabilities = mcpService.capabilities;
            }
              
            // Get additional status info
            try {
              const statusResponse = await fetch('/mcp/status', {
                method: 'GET',
                signal: AbortSignal.timeout(2000)
              });
              
              if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                // Show connected clients instead of total requests since request counting has issues
                actionsToday = statusData.connectedClients || 0;
              }
            } catch (statusError) {
              // Status endpoint failed, but health worked, show that it's active
              actionsToday = 1; // Indicate server is responding
              console.warn('MCP status endpoint failed:', statusError);
            }
          } else {
            mcpStatus = 'inactive';
            lastActivity = 'MCP service not healthy in health check';
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
        capabilities,
        lastActivity,
        actionsToday,
        connectedGraphs: ['current'],
        owner: 'system',
        isLocal: true,
        port: 3128,
        endpoint: '/health' // Use proxy endpoint for UI display
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
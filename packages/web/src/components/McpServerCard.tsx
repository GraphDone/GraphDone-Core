import { Server, Activity, AlertCircle, CheckCircle, HelpCircle, ExternalLink, RefreshCw } from 'lucide-react';
import { MCPServer } from '../hooks/useMcpServers';

interface McpServerCardProps {
  server: MCPServer;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export function McpServerCard({ server, onRefresh, isRefreshing = false }: McpServerCardProps) {
  const getStatusColor = (status: MCPServer['status']) => {
    switch (status) {
      case 'active': return 'text-green-400 bg-green-900 border-green-700';
      case 'inactive': return 'text-gray-400 bg-gray-700 border-gray-600';
      case 'error': return 'text-red-400 bg-red-900 border-red-700';
      case 'unknown': return 'text-yellow-400 bg-yellow-900 border-yellow-700';
    }
  };

  const getStatusIcon = (status: MCPServer['status']) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-4 w-4" />;
      case 'inactive': return <Activity className="h-4 w-4" />;
      case 'error': return <AlertCircle className="h-4 w-4" />;
      case 'unknown': return <HelpCircle className="h-4 w-4" />;
    }
  };

  const getStatusText = (status: MCPServer['status']) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'error': return 'Error';
      case 'unknown': return 'Unknown';
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-blue-900 rounded-lg flex items-center justify-center">
            <Server className="h-5 w-5 text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-100">{server.name}</h3>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(server.status)}`}>
                {getStatusIcon(server.status)}
                <span className="ml-1">{getStatusText(server.status)}</span>
              </span>
              <span className="text-xs text-gray-400">MCP Server</span>
              {server.isLocal && (
                <span className="text-xs text-blue-400">Local</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className={`p-2 transition-colors ${
              isRefreshing 
                ? 'text-blue-400 cursor-wait' 
                : 'text-gray-400 hover:text-gray-300'
            }`}
            title={isRefreshing ? "Refreshing..." : "Refresh status"}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </button>
          {server.endpoint && (
            <button className="p-2 text-gray-400 hover:text-blue-400 transition-colors">
              <ExternalLink className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <p className="text-gray-300 text-sm mb-4">{server.description}</p>

      <div className="space-y-3">
        {server.status === 'unknown' && (
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <HelpCircle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-yellow-300 font-medium">Server Not Detected</p>
                <p className="text-yellow-400 mt-1">
                  {server.lastActivity?.includes('Health check failed') 
                    ? 'Health check failed - MCP server may not be running or configured in Claude Code.'
                    : 'MCP servers run in Claude Code and cannot be directly monitored from the web interface.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {server.status === 'active' && (
          <div className="bg-green-900 border border-green-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-green-300 font-medium">Server Running</p>
                <p className="text-green-400 mt-1">
                  MCP server is active and responding to health checks. Claude Code should have access to graph operations.
                </p>
                {server.endpoint && (
                  <p className="text-green-400 mt-1 text-xs">
                    Health endpoint: {server.endpoint}/health
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {server.status === 'inactive' && (
          <div className="bg-red-900 border border-red-700 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm">
                <p className="text-red-300 font-medium">Server Inactive</p>
                <p className="text-red-400 mt-1">
                  MCP server is not responding. Check if Claude Code is running and configured properly.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Last Activity:</span>
          <span className="text-gray-100">{server.lastActivity}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Connected Clients:</span>
          <span className="text-gray-100">{server.actionsToday}</span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-400">Connected Graphs:</span>
          <span className="text-gray-100">{server.connectedGraphs.length}</span>
        </div>

        <div>
          <span className="text-sm text-gray-400 block mb-2">Capabilities:</span>
          <div className="flex flex-wrap gap-1">
            {server.capabilities.map((capability) => (
              <span key={capability} className="bg-blue-700 text-blue-200 text-xs px-2 py-1 rounded">
                {capability}
              </span>
            ))}
          </div>
        </div>

        {server.status === 'unknown' && (
          <div className="pt-2 border-t border-gray-600">
            <div className="text-sm text-gray-400">
              <p className="mb-2">To activate this MCP server:</p>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Add the server configuration to Claude Code settings</li>
                <li>Restart Claude Code</li>
                <li>The server will appear as active when used</li>
              </ol>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
import React from 'react';
import { useHealthCheck } from '../hooks/useHealthCheck';

interface McpHealthIndicatorProps {
  showDetails?: boolean;
  className?: string;
}

export const McpHealthIndicator: React.FC<McpHealthIndicatorProps> = ({ 
  showDetails = false,
  className = ''
}) => {
  const { 
    health, 
    mcpStatus, 
    loading, 
    error,
    lastChecked,
    refresh,
    getStatusColor,
    getStatusIcon
  } = useHealthCheck({ interval: 30000 });

  if (loading && !health) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="animate-pulse w-3 h-3 bg-gray-400 rounded-full"></div>
        <span className="text-sm text-gray-500">Checking MCP status...</span>
      </div>
    );
  }

  if (error && !health) {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <span className="text-red-500">✗</span>
        <span className="text-sm text-red-500">Health check failed</span>
      </div>
    );
  }

  const mcpHealth = health?.services.mcp;
  const statusColor = mcpHealth ? getStatusColor(mcpHealth.status) : 'text-gray-400';
  const statusIcon = mcpHealth ? getStatusIcon(mcpHealth.status) : '?';

  const handleRefresh = (e: React.MouseEvent) => {
    e.preventDefault();
    refresh();
  };

  if (!showDetails) {
    // Compact view - just an icon
    return (
      <button
        onClick={handleRefresh}
        className={`flex items-center space-x-1 hover:opacity-80 transition-opacity ${className}`}
        title={`MCP Server: ${mcpHealth?.status || 'unknown'}\nClick to refresh`}
      >
        <span className={`text-lg ${statusColor}`}>{statusIcon}</span>
        <span className="text-xs text-gray-500">MCP</span>
      </button>
    );
  }

  // Detailed view
  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 ${className}`}>
      <div className="flex justify-between items-start mb-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          MCP Server Status
        </h3>
        <button
          onClick={handleRefresh}
          className="text-sm text-blue-500 hover:text-blue-700 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Overall MCP Status */}
      <div className="flex items-center space-x-2 mb-4">
        <span className={`text-2xl ${statusColor}`}>{statusIcon}</span>
        <div>
          <p className={`font-medium ${statusColor}`}>
            {mcpHealth?.status ? mcpHealth.status.charAt(0).toUpperCase() + mcpHealth.status.slice(1) : 'Unknown'}
          </p>
          {mcpHealth?.version && (
            <p className="text-xs text-gray-500">Version: {mcpHealth.version}</p>
          )}
        </div>
      </div>

      {/* MCP Details */}
      {mcpHealth?.status === 'healthy' && (
        <div className="space-y-2 border-t pt-3">
          {mcpHealth.uptime && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Uptime:</span>
              <span className="text-gray-900 dark:text-white">
                {formatUptime(mcpHealth.uptime)}
              </span>
            </div>
          )}
          
          {mcpStatus?.connectedClients !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Connected Clients:</span>
              <span className="text-gray-900 dark:text-white">{mcpStatus.connectedClients}</span>
            </div>
          )}

          {mcpStatus?.totalRequests !== undefined && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Total Requests:</span>
              <span className="text-gray-900 dark:text-white">{mcpStatus.totalRequests}</span>
            </div>
          )}

          {mcpHealth.lastAccessed && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">Last Accessed:</span>
              <span className="text-gray-900 dark:text-white">
                {new Date(mcpHealth.lastAccessed).toLocaleTimeString()}
              </span>
            </div>
          )}

          {/* MCP Capabilities */}
          {mcpHealth.capabilities && mcpHealth.capabilities.length > 0 && (
            <div className="mt-3">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Capabilities ({mcpHealth.capabilities.length}):
              </p>
              <div className="flex flex-wrap gap-1">
                {mcpHealth.capabilities.map((cap, index) => (
                  <span
                    key={index}
                    className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {mcpHealth?.error && (
        <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/20 rounded">
          <p className="text-sm text-red-600 dark:text-red-400">
            Error: {mcpHealth.error}
          </p>
        </div>
      )}

      {/* Last Checked */}
      {lastChecked && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
          Last checked: {lastChecked.toLocaleTimeString()}
        </p>
      )}
    </div>
  );
};

// Helper function to format uptime
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
}

export default McpHealthIndicator;
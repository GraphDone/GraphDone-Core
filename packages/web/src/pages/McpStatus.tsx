import React from 'react';
import { McpHealthIndicator } from '../components/McpHealthIndicator';
import { useHealthCheck } from '../hooks/useHealthCheck';
import { RefreshCw, Activity, Server, Database, Cpu } from 'lucide-react';

export function McpStatus() {
  const { 
    health, 
    mcpStatus, 
    loading, 
    error,
    lastChecked,
    refresh,
    getStatusColor,
    getStatusIcon,
    isHealthy
  } = useHealthCheck({ interval: 10000 }); // More frequent updates on this page

  const handleRefresh = () => {
    refresh();
  };

  return (
    <div className="min-h-screen bg-gray-900 py-8 px-4">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              System Health Status
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor the health of all GraphDone services including the MCP server
            </p>
          </div>

          {/* Overall Status Banner */}
          <div className={`mb-8 p-6 rounded-lg shadow-lg ${
            isHealthy ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800' :
            health?.status === 'degraded' ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' :
            'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Activity className={`h-8 w-8 ${
                  isHealthy ? 'text-green-500' :
                  health?.status === 'degraded' ? 'text-yellow-500' :
                  'text-red-500'
                }`} />
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    System Status: {health?.status ? health.status.charAt(0).toUpperCase() + health.status.slice(1) : 'Unknown'}
                  </h2>
                  {lastChecked && (
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Last updated: {lastChecked.toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  loading 
                    ? 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span>{loading ? 'Checking...' : 'Refresh'}</span>
              </button>
            </div>
          </div>

          {/* Services Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* GraphQL Service */}
            <ServiceCard
              title="GraphQL API"
              icon={<Server className="h-6 w-6" />}
              service={health?.services.graphql}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              details={[
                { label: 'Port', value: health?.services.graphql?.port },
                { label: 'Endpoint', value: '/graphql' }
              ]}
            />

            {/* Neo4j Database */}
            <ServiceCard
              title="Neo4j Database"
              icon={<Database className="h-6 w-6" />}
              service={health?.services.neo4j}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              details={[
                { label: 'URI', value: health?.services.neo4j?.uri },
                { label: 'Type', value: 'Graph Database' }
              ]}
            />

            {/* MCP Server Card - Simplified since we have detailed view below */}
            <ServiceCard
              title="MCP Server"
              icon={<Cpu className="h-6 w-6" />}
              service={health?.services.mcp}
              getStatusColor={getStatusColor}
              getStatusIcon={getStatusIcon}
              details={[
                { label: 'Port', value: health?.services.mcp?.port },
                { label: 'Version', value: health?.services.mcp?.version }
              ]}
            />
          </div>

          {/* Detailed MCP Status */}
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              MCP Server Details
            </h2>
            <McpHealthIndicator showDetails={true} />
          </div>

          {/* MCP Connection Status */}
          {mcpStatus && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                MCP Connection Details
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatusMetric
                  label="Connected"
                  value={mcpStatus.connected ? 'Yes' : 'No'}
                  type={mcpStatus.connected ? 'success' : 'error'}
                />
                <StatusMetric
                  label="Active"
                  value={mcpStatus.active ? 'Yes' : 'No'}
                  type={mcpStatus.active ? 'success' : 'warning'}
                />
                <StatusMetric
                  label="Connected Clients"
                  value={mcpStatus.connectedClients?.toString() || '0'}
                  type="info"
                />
                <StatusMetric
                  label="Total Requests"
                  value={mcpStatus.totalRequests?.toString() || '0'}
                  type="info"
                />
              </div>
              
              {mcpStatus.lastRequest && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Last Request: {new Date(mcpStatus.lastRequest).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-red-600 dark:text-red-400">
                Error: {error}
              </p>
            </div>
          )}
        </div>
      </div>
  );
}

// Service Card Component
interface ServiceCardProps {
  title: string;
  icon: React.ReactNode;
  service: any;
  getStatusColor: (status: string) => string;
  getStatusIcon: (status: string) => string;
  details: Array<{ label: string; value: any }>;
}

const ServiceCard: React.FC<ServiceCardProps> = ({
  title,
  icon,
  service,
  getStatusColor,
  getStatusIcon,
  details
}) => {
  const status = service?.status || 'unknown';
  const statusColor = getStatusColor(status);
  const statusIcon = getStatusIcon(status);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="text-gray-600 dark:text-gray-400">{icon}</div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
        </div>
        <span className={`text-2xl ${statusColor}`}>{statusIcon}</span>
      </div>
      
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">Status:</span>
          <span className={`text-sm font-medium ${statusColor}`}>
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        </div>
        
        {details.map((detail, index) => 
          detail.value && (
            <div key={index} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{detail.label}:</span>
              <span className="text-sm text-gray-900 dark:text-white truncate max-w-[150px]">
                {detail.value}
              </span>
            </div>
          )
        )}
        
        {service?.error && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-red-500 truncate" title={service.error}>
              Error: {service.error}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Status Metric Component
interface StatusMetricProps {
  label: string;
  value: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

const StatusMetric: React.FC<StatusMetricProps> = ({ label, value, type }) => {
  const colorClasses = {
    success: 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20',
    warning: 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20',
    error: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
    info: 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
  };

  return (
    <div className={`p-3 rounded-lg ${colorClasses[type]}`}>
      <p className="text-xs opacity-75 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
};

export default McpStatus;
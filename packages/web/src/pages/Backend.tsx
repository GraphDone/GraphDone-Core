import { useState, useEffect } from 'react';
import { Server, Database, Globe, Activity, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface ServiceStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime?: number;
  lastChecked: Date;
  description: string;
  dependencies?: string[];
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceStatus[];
}

export function Backend() {
  const [systemHealth, setSystemHealth] = useState<SystemHealth>({
    overall: 'healthy',
    services: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Mock health check function - replace with actual API calls
  const checkServiceHealth = async (): Promise<SystemHealth> => {
    setIsLoading(true);
    
    try {
      // Simulate API calls to check service health
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const services: ServiceStatus[] = [
        {
          name: 'GraphQL API Server',
          status: 'healthy',
          responseTime: 45,
          lastChecked: new Date(),
          description: 'Apollo Server handling GraphQL queries and mutations',
          dependencies: ['PostgreSQL Database', 'Redis Cache']
        },
        {
          name: 'WebSocket Server',
          status: 'healthy',
          responseTime: 12,
          lastChecked: new Date(),
          description: 'Real-time subscriptions for graph updates',
          dependencies: ['GraphQL API Server']
        },
        {
          name: 'PostgreSQL Database',
          status: 'healthy',
          responseTime: 8,
          lastChecked: new Date(),
          description: 'Primary database storing graph nodes and relationships'
        },
        {
          name: 'Redis Cache',
          status: 'healthy',
          responseTime: 3,
          lastChecked: new Date(),
          description: 'Session storage and caching layer'
        },
        {
          name: 'Graph Engine Core',
          status: 'healthy',
          responseTime: 15,
          lastChecked: new Date(),
          description: 'Core graph operations and priority calculations'
        },
        {
          name: 'Web Application',
          status: 'healthy',
          responseTime: 120,
          lastChecked: new Date(),
          description: 'React frontend with D3.js visualization'
        }
      ];

      // Determine overall health
      const hasDown = services.some(s => s.status === 'down');
      const hasDegraded = services.some(s => s.status === 'degraded');
      const overall: 'healthy' | 'degraded' | 'down' = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';

      return { overall, services };
    } catch (_error) {
      // Health check failed, return default status
      return {
        overall: 'down',
        services: []
      };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkServiceHealth().then(setSystemHealth);
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      checkServiceHealth().then(setSystemHealth);
      setLastUpdate(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    checkServiceHealth().then(setSystemHealth);
    setLastUpdate(new Date());
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'text-green-600';
      case 'degraded': return 'text-yellow-600';
      case 'down': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'degraded': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'down': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <Activity className="h-5 w-5 text-gray-600" />;
    }
  };

  const getServiceIcon = (serviceName: string) => {
    if (serviceName.includes('GraphQL') || serviceName.includes('WebSocket')) {
      return <Server className="h-6 w-6" />;
    }
    if (serviceName.includes('Database') || serviceName.includes('Cache')) {
      return <Database className="h-6 w-6" />;
    }
    if (serviceName.includes('Web')) {
      return <Globe className="h-6 w-6" />;
    }
    return <Activity className="h-6 w-6" />;
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Backend Status</h1>
            <p className="text-sm text-gray-500 mt-1">
              System architecture and service health monitoring
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className={`flex items-center space-x-1 ${getStatusColor(systemHealth.overall)}`}>
                {getStatusIcon(systemHealth.overall)}
                <span className="text-sm font-medium capitalize">{systemHealth.overall}</span>
              </div>
            </div>
            
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="space-y-8">
            
            {/* System Overview */}
            <div className="card p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">System Architecture</h2>
              
              {/* Architecture Diagram */}
              <div className="bg-gray-50 rounded-lg p-6">
                <svg viewBox="0 0 800 500" className="w-full h-96">
                  {/* Client Layer */}
                  <g>
                    <rect x="50" y="50" width="700" height="80" fill="#e3f2fd" stroke="#1976d2" strokeWidth="2" rx="8" />
                    <text x="400" y="75" textAnchor="middle" className="fill-blue-800 text-sm font-semibold">Client Layer</text>
                    
                    <rect x="80" y="90" width="150" height="30" fill="#bbdefb" stroke="#1976d2" rx="4" />
                    <text x="155" y="110" textAnchor="middle" className="fill-blue-800 text-xs">Web Application</text>
                    
                    <rect x="250" y="90" width="150" height="30" fill="#bbdefb" stroke="#1976d2" rx="4" />
                    <text x="325" y="110" textAnchor="middle" className="fill-blue-800 text-xs">Mobile App (Planned)</text>
                    
                    <rect x="420" y="90" width="150" height="30" fill="#bbdefb" stroke="#1976d2" rx="4" />
                    <text x="495" y="110" textAnchor="middle" className="fill-blue-800 text-xs">AI Agent SDK (Planned)</text>
                  </g>

                  {/* API Layer */}
                  <g>
                    <rect x="50" y="180" width="700" height="80" fill="#e8f5e8" stroke="#388e3c" strokeWidth="2" rx="8" />
                    <text x="400" y="205" textAnchor="middle" className="fill-green-800 text-sm font-semibold">API Layer</text>
                    
                    <rect x="100" y="220" width="180" height="30" fill="#c8e6c9" stroke="#388e3c" rx="4" />
                    <text x="190" y="240" textAnchor="middle" className="fill-green-800 text-xs">GraphQL Server</text>
                    
                    <rect x="310" y="220" width="180" height="30" fill="#c8e6c9" stroke="#388e3c" rx="4" />
                    <text x="400" y="240" textAnchor="middle" className="fill-green-800 text-xs">WebSocket Server</text>
                    
                    <rect x="520" y="220" width="150" height="30" fill="#c8e6c9" stroke="#388e3c" rx="4" />
                    <text x="595" y="240" textAnchor="middle" className="fill-green-800 text-xs">Health Check</text>
                  </g>

                  {/* Business Logic */}
                  <g>
                    <rect x="50" y="310" width="700" height="80" fill="#fff3e0" stroke="#f57c00" strokeWidth="2" rx="8" />
                    <text x="400" y="335" textAnchor="middle" className="fill-orange-800 text-sm font-semibold">Business Logic</text>
                    
                    <rect x="100" y="350" width="150" height="30" fill="#ffcc02" stroke="#f57c00" rx="4" />
                    <text x="175" y="370" textAnchor="middle" className="fill-orange-800 text-xs">Graph Engine</text>
                    
                    <rect x="270" y="350" width="150" height="30" fill="#ffcc02" stroke="#f57c00" rx="4" />
                    <text x="345" y="370" textAnchor="middle" className="fill-orange-800 text-xs">Priority Calculator</text>
                    
                    <rect x="440" y="350" width="150" height="30" fill="#ffcc02" stroke="#f57c00" rx="4" />
                    <text x="515" y="370" textAnchor="middle" className="fill-orange-800 text-xs">Graph Algorithms</text>
                  </g>

                  {/* Data Layer */}
                  <g>
                    <rect x="50" y="420" width="700" height="60" fill="#fce4ec" stroke="#c2185b" strokeWidth="2" rx="8" />
                    <text x="400" y="440" textAnchor="middle" className="fill-pink-800 text-sm font-semibold">Data Layer</text>
                    
                    <rect x="150" y="450" width="150" height="25" fill="#f8bbd9" stroke="#c2185b" rx="4" />
                    <text x="225" y="467" textAnchor="middle" className="fill-pink-800 text-xs">PostgreSQL</text>
                    
                    <rect x="350" y="450" width="150" height="25" fill="#f8bbd9" stroke="#c2185b" rx="4" />
                    <text x="425" y="467" textAnchor="middle" className="fill-pink-800 text-xs">Redis Cache</text>
                  </g>

                  {/* Connection Lines */}
                  <line x1="400" y1="130" x2="400" y2="180" stroke="#666" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <line x1="400" y1="260" x2="400" y2="310" stroke="#666" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <line x1="400" y1="390" x2="400" y2="420" stroke="#666" strokeWidth="2" markerEnd="url(#arrowhead)" />

                  {/* Arrow marker */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Service Status Grid */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-900">Service Status</h2>
                <div className="text-sm text-gray-500">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemHealth.services.map((service) => (
                  <div key={service.name} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-600">
                          {getServiceIcon(service.name)}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">{service.name}</h3>
                          <p className="text-xs text-gray-500 mt-1">{service.description}</p>
                        </div>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Status:</span>
                        <span className={`font-medium capitalize ${getStatusColor(service.status)}`}>
                          {service.status}
                        </span>
                      </div>
                      
                      {service.responseTime && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-500">Response:</span>
                          <span className="text-gray-900">{service.responseTime}ms</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-500">Checked:</span>
                        <span className="text-gray-900">{service.lastChecked.toLocaleTimeString()}</span>
                      </div>
                      
                      {service.dependencies && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <span className="text-xs text-gray-500">Dependencies:</span>
                          <div className="mt-1">
                            {service.dependencies.map((dep) => (
                              <span key={dep} className="inline-block bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded mr-1 mb-1">
                                {dep}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* System Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Uptime</p>
                    <p className="text-2xl font-bold text-gray-900">99.9%</p>
                  </div>
                  <CheckCircle className="h-8 w-8 text-green-600" />
                </div>
              </div>
              
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Avg Response</p>
                    <p className="text-2xl font-bold text-gray-900">45ms</p>
                  </div>
                  <Activity className="h-8 w-8 text-blue-600" />
                </div>
              </div>
              
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Active Nodes</p>
                    <p className="text-2xl font-bold text-gray-900">1,247</p>
                  </div>
                  <Server className="h-8 w-8 text-purple-600" />
                </div>
              </div>
              
              <div className="card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">DB Connections</p>
                    <p className="text-2xl font-bold text-gray-900">23/100</p>
                  </div>
                  <Database className="h-8 w-8 text-orange-600" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
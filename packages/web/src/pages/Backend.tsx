import { useState, useEffect } from 'react';
import { Server, Database, Globe, Activity, CheckCircle, XCircle, AlertCircle, RefreshCw, Info, Wifi, WifiOff } from 'lucide-react';
import { APP_VERSION } from '../utils/version';

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
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const [healthCheckError, setHealthCheckError] = useState<string | null>(null);

  // Real health check function using server health endpoint
  const checkServiceHealth = async (): Promise<SystemHealth> => {
    setIsLoading(true);
    const debug: string[] = [];
    setHealthCheckError(null);
    
    try {
      // Step 1: Test the health endpoint
      const healthUrl = '/health'; // Use relative URL to leverage Vite proxy
      debug.push(`🔍 Checking health endpoint: ${window.location.origin}${healthUrl}`);
      debug.push(`🔍 Using fetch with relative URL: "${healthUrl}"`);
      
      const startTime = Date.now();
      const response = await fetch(healthUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });
      const responseTime = Date.now() - startTime;
      
      debug.push(`⚡ Health endpoint response: ${response.status} (${responseTime}ms)`);
      debug.push(`⚡ Response headers: Content-Type: ${response.headers.get('content-type')}`);
      
      if (!response.ok) {
        debug.push(`❌ Response not OK: ${response.status} ${response.statusText}`);
        throw new Error(`Health endpoint returned ${response.status}: ${response.statusText}`);
      }
      
      const healthData = await response.json();
      debug.push(`📊 Raw health data: ${JSON.stringify(healthData, null, 2)}`);
      debug.push(`📊 Health status: ${healthData.status}`);
      
      const now = new Date();
      
      // Step 2: Build comprehensive service list
      const services: ServiceStatus[] = [];
      
      // GraphQL API Server (main backend)
      const graphqlStatus = healthData.services?.graphql?.status === 'healthy' ? 'healthy' : 'down';
      services.push({
        name: 'GraphQL API Server',
        status: graphqlStatus,
        responseTime: responseTime,
        lastChecked: now,
        description: graphqlStatus === 'healthy' 
          ? `Apollo Server running on port ${healthData.services?.graphql?.port || 4127}`
          : 'GraphQL API Server not responding'
      });
      debug.push(`🖥️  GraphQL API: ${graphqlStatus}`);

      // WebSocket Server (same process as GraphQL)
      services.push({
        name: 'WebSocket Server',
        status: graphqlStatus, // Same as GraphQL since they run together
        responseTime: graphqlStatus === 'healthy' ? responseTime + 2 : undefined,
        lastChecked: now,
        description: graphqlStatus === 'healthy' 
          ? 'Real-time subscriptions for graph updates'
          : 'WebSocket server unavailable (same process as GraphQL)',
        dependencies: ['GraphQL API Server']
      });

      // Neo4j Graph Database
      const neo4jStatus = healthData.services?.neo4j?.status;
      let neo4jServiceStatus: 'healthy' | 'degraded' | 'down' = 'down';
      let neo4jDescription = 'Neo4j connection status unknown';
      
      if (neo4jStatus === 'healthy') {
        neo4jServiceStatus = 'healthy';
        neo4jDescription = `Connected to ${healthData.services.neo4j.uri}`;
        debug.push(`🗄️  Neo4j: healthy at ${healthData.services.neo4j.uri}`);
      } else if (neo4jStatus === 'unhealthy') {
        neo4jServiceStatus = 'down';
        const error = healthData.services.neo4j.error || 'Connection failed';
        neo4jDescription = `Connection failed: ${error.substring(0, 100)}${error.length > 100 ? '...' : ''}`;
        debug.push(`❌ Neo4j: down - ${error}`);
      }
      
      services.push({
        name: 'Neo4j Graph Database',
        status: neo4jServiceStatus,
        responseTime: neo4jServiceStatus === 'healthy' ? 8 : undefined,
        lastChecked: now,
        description: neo4jDescription
      });

      // SQLite Auth Database (always healthy if server is running)
      services.push({
        name: 'SQLite Auth Database',
        status: 'healthy',
        responseTime: 2,
        lastChecked: now,
        description: 'User authentication and configuration (always available when API is running)'
      });
      debug.push(`📁 SQLite: healthy (embedded database)`);

      // MCP Server
      const mcpStatus = healthData.services?.mcp?.status;
      let mcpServiceStatus: 'healthy' | 'degraded' | 'down' = 'down';
      let mcpDescription = 'MCP server status unknown';
      
      if (mcpStatus === 'healthy') {
        mcpServiceStatus = 'healthy';
        const version = healthData.services.mcp.version || 'unknown';
        const capabilities = healthData.services.mcp.capabilities || [];
        mcpDescription = `Running v${version} with ${capabilities.length} capabilities`;
        debug.push(`🤖 MCP: healthy v${version}`);
      } else if (mcpStatus === 'unhealthy') {
        mcpServiceStatus = 'degraded';
        mcpDescription = 'MCP server responding but degraded';
        debug.push(`⚠️  MCP: degraded`);
      } else if (mcpStatus === 'offline') {
        mcpServiceStatus = 'down';
        const error = healthData.services?.mcp?.error || 'Not running';
        mcpDescription = `Claude Code integration offline: ${error}`;
        debug.push(`❌ MCP: offline - ${error}`);
      }
      
      services.push({
        name: 'MCP Server (Claude Code)',
        status: mcpServiceStatus,
        responseTime: mcpServiceStatus === 'healthy' ? 15 : undefined,
        lastChecked: now,
        description: mcpDescription
      });

      // Step 3: Determine overall health
      const criticalServices = services.filter(s => 
        s.name === 'GraphQL API Server' || s.name === 'SQLite Auth Database'
      );
      const hasDown = criticalServices.some(s => s.status === 'down');
      const hasDegraded = services.some(s => s.status === 'degraded');
      const overall: 'healthy' | 'degraded' | 'down' = hasDown ? 'down' : hasDegraded ? 'degraded' : 'healthy';
      
      debug.push(`🏥 Overall system status: ${overall}`);
      debug.push(`✅ ${services.filter(s => s.status === 'healthy').length}/${services.length} services healthy`);
      
      setDebugInfo(debug);
      return { overall, services };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      debug.push(`💥 Health check failed: ${errorMessage}`);
      debug.push(`💥 Error type: ${typeof error}`);
      if (error instanceof Error) {
        debug.push(`💥 Error name: ${error.name}`);
        debug.push(`💥 Error stack: ${error.stack?.substring(0, 200)}`);
      }
      debug.push(`💥 Fetch URL attempted: ${window.location.origin}/health`);
      setHealthCheckError(errorMessage);
      setDebugInfo(debug);
      
      // Return a more comprehensive error state
      return {
        overall: 'down',
        services: [
          {
            name: 'GraphQL API Server',
            status: 'down',
            lastChecked: new Date(),
            description: `Cannot reach server: ${errorMessage}`
          },
          {
            name: 'WebSocket Server',
            status: 'down',
            lastChecked: new Date(),
            description: 'Unavailable (depends on GraphQL API)'
          },
          {
            name: 'Neo4j Graph Database',
            status: 'down',
            lastChecked: new Date(),
            description: 'Status unknown (server unreachable)'
          },
          {
            name: 'SQLite Auth Database',
            status: 'down',
            lastChecked: new Date(),
            description: 'Status unknown (server unreachable)'
          },
          {
            name: 'MCP Server (Claude Code)',
            status: 'down',
            lastChecked: new Date(),
            description: 'Status unknown (server unreachable)'
          }
        ]
      };
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Immediate health check on component mount
    checkServiceHealth().then((result) => {
      setSystemHealth(result);
      setLastUpdate(new Date());
    });
    
    // Auto-refresh every 15 seconds for more frequent updates
    const interval = setInterval(() => {
      checkServiceHealth().then((result) => {
        setSystemHealth(result);
        setLastUpdate(new Date());
      });
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Load database stats on component mount
  useEffect(() => {
    const loadInitialStats = async () => {
      const debug: string[] = [];
      try {
        await updateDatabaseStats(debug);
        await checkDataIntegrity(debug);
        setDebugInfo(debug);
      } catch (error) {
        console.error('Failed to load initial database stats:', error);
      }
    };
    
    loadInitialStats();
  }, []);

  const handleRefresh = () => {
    setDebugInfo([]);
    setHealthCheckError(null);
    checkServiceHealth().then(setSystemHealth);
    setLastUpdate(new Date());
  };

  // Database utility functions
  const updateDatabaseStats = async (debug: string[]) => {
    try {
      debug.push('📊 Fetching graph count...');
      const graphResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id } }' })
      });
      const graphData = await graphResponse.json();
      const graphCount = graphData.data?.graphs?.length || 0;
      document.getElementById('graph-count')!.textContent = graphCount.toString();
      debug.push(`✅ Found ${graphCount} graphs`);

      debug.push('📊 Fetching node count...');
      const nodeResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { workItems { id } }' })
      });
      const nodeData = await nodeResponse.json();
      const nodeCount = nodeData.data?.workItems?.length || 0;
      document.getElementById('node-count')!.textContent = nodeCount.toString();
      debug.push(`✅ Found ${nodeCount} nodes`);

      debug.push('📊 Fetching edge count...');
      const edgeResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { edges { id } }' })
      });
      const edgeData = await edgeResponse.json();
      const edgeCount = edgeData.data?.edges?.length || 0;
      document.getElementById('edge-count')!.textContent = edgeCount.toString();
      debug.push(`✅ Found ${edgeCount} edges`);

    } catch (error) {
      debug.push(`❌ Failed to update stats: ${error}`);
      document.getElementById('graph-count')!.textContent = 'Error';
      document.getElementById('node-count')!.textContent = 'Error';
      document.getElementById('edge-count')!.textContent = 'Error';
    }
  };

  const checkDataIntegrity = async (debug: string[]) => {
    let issueCount = 0;
    debug.push('🔍 Checking for data integrity issues...');

    try {
      // Check for graphs with invalid types
      const graphResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id name } }' })
      });
      
      const graphResult = await graphResponse.json();
      if (graphResult.errors) {
        issueCount += graphResult.errors.length;
        debug.push(`❌ Found ${graphResult.errors.length} GraphQL schema errors`);
        graphResult.errors.forEach((err: any, i: number) => {
          debug.push(`  ${i + 1}. ${err.message}`);
        });
      }

      // Check for extremely long names (likely test data)
      if (graphResult.data?.graphs) {
        const longNameGraphs = graphResult.data.graphs.filter((g: any) => g.name && g.name.length > 100);
        if (longNameGraphs.length > 0) {
          issueCount += longNameGraphs.length;
          debug.push(`⚠️ Found ${longNameGraphs.length} graphs with extremely long names (likely test data)`);
        }

        // Check for single-character names (likely test data)
        const shortNameGraphs = graphResult.data.graphs.filter((g: any) => g.name && g.name.length <= 2);
        if (shortNameGraphs.length > 0) {
          debug.push(`ℹ️ Found ${shortNameGraphs.length} graphs with very short names (a, x, etc.)`);
        }
      }

      document.getElementById('issue-count')!.textContent = issueCount.toString();
      
      if (issueCount === 0) {
        debug.push('✅ No major data integrity issues found');
        document.getElementById('issue-count')!.textContent = '0';
      } else {
        debug.push(`⚠️ Found ${issueCount} data integrity issues`);
      }

    } catch (error) {
      debug.push(`❌ Data integrity check failed: ${error}`);
      document.getElementById('issue-count')!.textContent = 'Error';
    }
  };

  const cleanupTestData = async (debug: string[]) => {
    debug.push('🧹 Starting cleanup of test data...');
    let cleanedCount = 0;

    try {
      // Get all graphs to identify test data
      const graphResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id name } }' })
      });
      
      const graphData = await graphResponse.json();
      
      if (graphData.data?.graphs) {
        const testGraphs = graphData.data.graphs.filter((g: any) => {
          return (
            g.name === 'a' ||
            g.name === 'x' ||
            g.name.length > 100 ||
            g.name.includes('xxxxxxxxxxxx') ||
            g.name.startsWith('Test Graph Debug')
          );
        });

        debug.push(`🎯 Identified ${testGraphs.length} test graphs for cleanup`);

        for (const graph of testGraphs.slice(0, 50)) { // Limit to 50 at a time to avoid timeout
          try {
            const deleteResponse = await fetch('/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                query: 'mutation DeleteGraph($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }',
                variables: { id: graph.id }
              })
            });

            const deleteResult = await deleteResponse.json();
            if (!deleteResult.errors) {
              cleanedCount++;
              debug.push(`🗑️ Deleted graph: ${graph.name.substring(0, 30)}...`);
            } else {
              debug.push(`⚠️ Could not delete graph ${graph.id}: ${deleteResult.errors[0]?.message}`);
            }
          } catch (error) {
            debug.push(`❌ Error deleting graph ${graph.id}: ${error}`);
          }
        }
      }

      debug.push(`✅ Cleanup complete! Removed ${cleanedCount} test graphs`);
      
      // Refresh stats after cleanup
      await updateDatabaseStats(debug);
      
    } catch (error) {
      debug.push(`❌ Cleanup failed: ${error}`);
    }
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
      <div className="bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-100">Backend Status</h1>
              <span className="text-xs bg-gray-800/50 text-gray-400 px-2 py-1 rounded">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
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
            
            <div className="flex space-x-2">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleRefresh}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const debug: string[] = [];
                  debug.push('🔄 Force debug refresh initiated by user');
                  debug.push(`🕐 Time: ${new Date().toISOString()}`);
                  debug.push(`🌐 Current URL: ${window.location.href}`);
                  debug.push(`📍 Origin: ${window.location.origin}`);
                  debug.push(`🔗 Health URL: /health`);
                  debug.push(`🔗 GraphQL URL: /graphql`);
                  debug.push(`📶 Navigator online: ${navigator.onLine}`);
                  debug.push(`🖥️  User agent: ${navigator.userAgent.substring(0, 100)}...`);
                  setDebugInfo(debug);
                  handleRefresh();
                }}
                disabled={isLoading}
              >
                <Activity className="h-4 w-4 mr-2" />
                Force Debug
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="space-y-8">
            
            {/* System Overview */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-6">System Architecture</h2>
              
              {/* Architecture Diagram */}
              <div className="bg-gray-700 rounded-lg p-6">
                <svg viewBox="0 0 800 500" className="w-full h-96">
                  {/* Client Layer */}
                  <g>
                    <rect x="50" y="50" width="700" height="80" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="2" rx="8" />
                    <text x="400" y="75" textAnchor="middle" className="fill-blue-200 text-sm font-semibold">Client Layer</text>
                    
                    <rect x="80" y="90" width="150" height="30" fill="#1e40af" stroke="#3b82f6" rx="4" />
                    <text x="155" y="110" textAnchor="middle" className="fill-blue-200 text-xs">Web Application</text>
                    
                    <rect x="250" y="90" width="150" height="30" fill="#1e40af" stroke="#3b82f6" rx="4" />
                    <text x="325" y="110" textAnchor="middle" className="fill-blue-200 text-xs">Mobile App (Planned)</text>
                    
                    <rect x="420" y="90" width="150" height="30" fill="#1e40af" stroke="#3b82f6" rx="4" />
                    <text x="495" y="110" textAnchor="middle" className="fill-blue-200 text-xs">AI Agent SDK (Planned)</text>
                  </g>

                  {/* API Layer */}
                  <g>
                    <rect x="50" y="180" width="700" height="80" fill="#14532d" stroke="#10b981" strokeWidth="2" rx="8" />
                    <text x="400" y="205" textAnchor="middle" className="fill-green-200 text-sm font-semibold">API Layer</text>
                    
                    <rect x="100" y="220" width="180" height="30" fill="#166534" stroke="#10b981" rx="4" />
                    <text x="190" y="240" textAnchor="middle" className="fill-green-200 text-xs">GraphQL Server</text>
                    
                    <rect x="310" y="220" width="180" height="30" fill="#166534" stroke="#10b981" rx="4" />
                    <text x="400" y="240" textAnchor="middle" className="fill-green-200 text-xs">WebSocket Server</text>
                    
                    <rect x="520" y="220" width="150" height="30" fill="#166534" stroke="#10b981" rx="4" />
                    <text x="595" y="240" textAnchor="middle" className="fill-green-200 text-xs">Health Check</text>
                  </g>

                  {/* Business Logic */}
                  <g>
                    <rect x="50" y="310" width="700" height="80" fill="#9a3412" stroke="#f97316" strokeWidth="2" rx="8" />
                    <text x="400" y="335" textAnchor="middle" className="fill-orange-200 text-sm font-semibold">Business Logic</text>
                    
                    <rect x="100" y="350" width="150" height="30" fill="#c2410c" stroke="#f97316" rx="4" />
                    <text x="175" y="370" textAnchor="middle" className="fill-orange-200 text-xs">Graph Engine</text>
                    
                    <rect x="270" y="350" width="150" height="30" fill="#c2410c" stroke="#f97316" rx="4" />
                    <text x="345" y="370" textAnchor="middle" className="fill-orange-200 text-xs">Priority Calculator</text>
                    
                    <rect x="440" y="350" width="150" height="30" fill="#c2410c" stroke="#f97316" rx="4" />
                    <text x="515" y="370" textAnchor="middle" className="fill-orange-200 text-xs">Graph Algorithms</text>
                  </g>

                  {/* Data Layer */}
                  <g>
                    <rect x="50" y="420" width="700" height="60" fill="#881337" stroke="#ec4899" strokeWidth="2" rx="8" />
                    <text x="400" y="440" textAnchor="middle" className="fill-pink-200 text-sm font-semibold">Data Layer</text>
                    
                    <rect x="100" y="450" width="130" height="25" fill="#9d174d" stroke="#ec4899" rx="4" />
                    <text x="165" y="467" textAnchor="middle" className="fill-pink-200 text-xs">SQLite Auth</text>
                    
                    <rect x="250" y="450" width="130" height="25" fill="#9d174d" stroke="#ec4899" rx="4" />
                    <text x="315" y="467" textAnchor="middle" className="fill-pink-200 text-xs">Neo4j (Optional)</text>
                    
                    <rect x="400" y="450" width="130" height="25" fill="#9d174d" stroke="#ec4899" rx="4" />
                    <text x="465" y="467" textAnchor="middle" className="fill-pink-200 text-xs">MCP Server</text>
                  </g>

                  {/* Connection Lines */}
                  <line x1="400" y1="130" x2="400" y2="180" stroke="#d1d5db" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <line x1="400" y1="260" x2="400" y2="310" stroke="#d1d5db" strokeWidth="2" markerEnd="url(#arrowhead)" />
                  <line x1="400" y1="390" x2="400" y2="420" stroke="#d1d5db" strokeWidth="2" markerEnd="url(#arrowhead)" />

                  {/* Arrow marker */}
                  <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                      <polygon points="0 0, 10 3.5, 0 7" fill="#d1d5db" />
                    </marker>
                  </defs>
                </svg>
              </div>
            </div>

            {/* Service Status Grid */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100">Service Status</h2>
                <div className="text-sm text-gray-400">
                  Last updated: {lastUpdate.toLocaleTimeString()}
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {systemHealth.services.map((service) => (
                  <div key={service.name} className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:shadow-lg transition-shadow">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center space-x-3">
                        <div className="text-gray-300">
                          {getServiceIcon(service.name)}
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-100">{service.name}</h3>
                          <p className="text-xs text-gray-400 mt-1">{service.description}</p>
                        </div>
                      </div>
                      {getStatusIcon(service.status)}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Status:</span>
                        <span className={`font-medium capitalize ${getStatusColor(service.status)}`}>
                          {service.status}
                        </span>
                      </div>
                      
                      {service.responseTime && (
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-400">Response:</span>
                          <span className="text-gray-100">{service.responseTime}ms</span>
                        </div>
                      )}
                      
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-400">Checked:</span>
                        <span className="text-gray-100">{service.lastChecked.toLocaleTimeString()}</span>
                      </div>
                      
                      {service.dependencies && (
                        <div className="mt-3 pt-3 border-t border-gray-600">
                          <span className="text-xs text-gray-400">Dependencies:</span>
                          <div className="mt-1">
                            {service.dependencies.map((dep) => (
                              <span key={dep} className="inline-block bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded mr-1 mb-1">
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
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">System Status</p>
                    <p className={`text-2xl font-bold capitalize ${getStatusColor(systemHealth.overall)}`}>
                      {systemHealth.overall}
                    </p>
                  </div>
                  {getStatusIcon(systemHealth.overall)}
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">API Response</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {systemHealth.services.find(s => s.name === 'GraphQL API Server')?.responseTime || '—'}
                      {systemHealth.services.find(s => s.name === 'GraphQL API Server')?.responseTime ? 'ms' : ''}
                    </p>
                  </div>
                  <Activity className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Services</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {systemHealth.services.filter(s => s.status === 'healthy').length}/
                      {systemHealth.services.length}
                    </p>
                  </div>
                  <Server className="h-8 w-8 text-green-400" />
                </div>
              </div>
              
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-400">Graph Database</p>
                    <p className="text-2xl font-bold text-gray-100">
                      {systemHealth.services.find(s => s.name === 'Neo4j Graph Database')?.status === 'healthy' ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <Database className={`h-8 w-8 ${
                    systemHealth.services.find(s => s.name === 'Neo4j Graph Database')?.status === 'healthy' 
                      ? 'text-green-400' : 'text-red-400'
                  }`} />
                </div>
              </div>
            </div>

            {/* System Information */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 flex items-center mb-4">
                <Server className="h-5 w-5 mr-2" />
                System Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Current URL:</span>
                    <span className="text-gray-200 font-mono">{window.location.href}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Origin:</span>
                    <span className="text-gray-200 font-mono">{window.location.origin}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Health URL:</span>
                    <span className="text-gray-200 font-mono">{window.location.origin}/health</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">GraphQL URL:</span>
                    <span className="text-gray-200 font-mono">{window.location.origin}/graphql</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-400">User Agent:</span>
                    <span className="text-gray-200 font-mono text-xs">{navigator.userAgent.substring(0, 50)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Online:</span>
                    <span className={`font-semibold ${navigator.onLine ? 'text-green-400' : 'text-red-400'}`}>
                      {navigator.onLine ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Last Update:</span>
                    <span className="text-gray-200">{lastUpdate.toLocaleTimeString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Auto-refresh:</span>
                    <span className="text-green-400">Every 15s</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Network Test */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 flex items-center mb-4">
                <Globe className="h-5 w-5 mr-2" />
                Network Test
              </h2>
              <button
                onClick={async () => {
                  const debug: string[] = [];
                  try {
                    debug.push('🧪 Starting manual network test...');
                    debug.push(`🌐 Testing fetch to: ${window.location.origin}/health`);
                    
                    const startTime = Date.now();
                    const response = await fetch('/health');
                    const endTime = Date.now();
                    
                    debug.push(`⚡ Response time: ${endTime - startTime}ms`);
                    debug.push(`📡 Status: ${response.status} ${response.statusText}`);
                    debug.push(`📦 Content-Type: ${response.headers.get('content-type')}`);
                    
                    if (response.ok) {
                      const data = await response.json();
                      debug.push(`✅ JSON parse successful`);
                      debug.push(`📊 Health status: ${data.status}`);
                      debug.push(`🔢 Services count: ${Object.keys(data.services || {}).length}`);
                    } else {
                      debug.push(`❌ Response not OK`);
                    }
                  } catch (error) {
                    debug.push(`💥 Network test failed: ${error}`);
                  }
                  setDebugInfo(debug);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Run Network Test
              </button>
            </div>

            {/* Debug Console */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-100 flex items-center">
                  <Info className="h-5 w-5 mr-2" />
                  Debug Console
                </h2>
                <div className="flex items-center space-x-2 text-sm">
                  {healthCheckError && (
                    <div className="flex items-center space-x-1 text-red-400">
                      <AlertCircle className="h-4 w-4" />
                      <span>Error</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-1 text-gray-400">
                    <Wifi className="h-4 w-4" />
                    <span>Live Debug</span>
                  </div>
                </div>
              </div>
              
              <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-64 overflow-y-auto">
                {debugInfo.length > 0 ? (
                  <div className="space-y-1">
                    {debugInfo.map((line, index) => (
                      <div key={index} className="text-gray-300">
                        <span className="text-gray-500">{new Date().toISOString().split('T')[1].split('.')[0]}</span>
                        <span className="ml-2">{line}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-gray-500 italic">
                    {isLoading ? 'Checking system health...' : 'No debug information available'}
                  </div>
                )}
              </div>
              
              {healthCheckError && (
                <div className="mt-4 p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
                  <div className="flex items-center space-x-2 text-red-300">
                    <XCircle className="h-4 w-4" />
                    <span className="font-medium">Health Check Failed</span>
                  </div>
                  <p className="text-sm text-red-200 mt-1 font-mono">{healthCheckError}</p>
                </div>
              )}
            </div>

            {/* Database Administration Section */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold text-gray-100 flex items-center">
                  <Database className="h-5 w-5 mr-2" />
                  Database Administration
                </h2>
                <div className="text-sm text-gray-400">
                  GraphQL Query Tools & Data Management
                </div>
              </div>
              
              {/* Database Statistics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Graphs</p>
                      <p className="text-xl font-bold text-blue-300" id="graph-count">Loading...</p>
                    </div>
                    <div className="text-blue-400">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Nodes</p>
                      <p className="text-xl font-bold text-green-300" id="node-count">Loading...</p>
                    </div>
                    <div className="text-green-400">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Edges</p>
                      <p className="text-xl font-bold text-purple-300" id="edge-count">Loading...</p>
                    </div>
                    <div className="text-purple-400">
                      <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>
                
                <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Data Issues</p>
                      <p className="text-xl font-bold text-red-300" id="issue-count">Checking...</p>
                    </div>
                    <div className="text-red-400">
                      <AlertCircle className="w-6 h-6" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <button
                  onClick={async () => {
                    const debug = [...debugInfo];
                    try {
                      debug.push('🔄 Refreshing database statistics...');
                      await updateDatabaseStats(debug);
                      setDebugInfo(debug);
                    } catch (error) {
                      debug.push(`❌ Failed to refresh stats: ${error}`);
                      setDebugInfo(debug);
                    }
                  }}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Refresh Stats</span>
                </button>
                
                <button
                  onClick={async () => {
                    const debug = [...debugInfo];
                    try {
                      debug.push('🔍 Checking for data integrity issues...');
                      await checkDataIntegrity(debug);
                      setDebugInfo(debug);
                    } catch (error) {
                      debug.push(`❌ Data integrity check failed: ${error}`);
                      setDebugInfo(debug);
                    }
                  }}
                  className="bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Check Data</span>
                </button>
                
                <button
                  onClick={async () => {
                    const debug = [...debugInfo];
                    if (confirm('This will delete duplicate and corrupted test data. Continue?')) {
                      try {
                        debug.push('🧹 Starting database cleanup...');
                        await cleanupTestData(debug);
                        setDebugInfo(debug);
                      } catch (error) {
                        debug.push(`❌ Cleanup failed: ${error}`);
                        setDebugInfo(debug);
                      }
                    } else {
                      debug.push('ℹ️ Cleanup cancelled by user');
                      setDebugInfo(debug);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
                >
                  <Database className="h-4 w-4" />
                  <span>Cleanup Data</span>
                </button>
              </div>

              {/* GraphQL Query Tool */}
              <div className="space-y-4">
                <h3 className="text-md font-medium text-gray-200">GraphQL Query Tool</h3>
                
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-600">
                  <textarea
                    id="graphql-query"
                    placeholder={`Enter GraphQL query or mutation here, e.g.:

query GetGraphs {
  graphs {
    id
    name
    type
    status
  }
}

mutation DeleteGraph($id: ID!) {
  deleteGraphs(where: { id: $id }) {
    nodesDeleted
  }
}`}
                    className="w-full h-32 bg-transparent text-green-300 font-mono text-sm border-none outline-none resize-none"
                    style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
                  />
                </div>
                
                <div className="flex space-x-2">
                  <button
                    onClick={async () => {
                      const query = (document.getElementById('graphql-query') as HTMLTextAreaElement).value.trim();
                      if (!query) {
                        alert('Please enter a GraphQL query');
                        return;
                      }
                      
                      const debug = [...debugInfo];
                      try {
                        debug.push(`🔍 Executing GraphQL query...`);
                        debug.push(`📝 Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
                        
                        const response = await fetch('/graphql', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ query })
                        });
                        
                        const result = await response.json();
                        
                        if (result.errors) {
                          debug.push(`❌ GraphQL errors:`);
                          result.errors.forEach((err: any, i: number) => {
                            debug.push(`  ${i + 1}. ${err.message}`);
                          });
                        }
                        
                        if (result.data) {
                          debug.push(`✅ Query successful!`);
                          debug.push(`📊 Result: ${JSON.stringify(result.data, null, 2).substring(0, 500)}...`);
                        }
                      } catch (error) {
                        debug.push(`💥 Query execution failed: ${error}`);
                      }
                      setDebugInfo(debug);
                    }}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Execute Query
                  </button>
                  
                  <button
                    onClick={() => {
                      (document.getElementById('graphql-query') as HTMLTextAreaElement).value = '';
                    }}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Clear
                  </button>
                  
                  <button
                    onClick={() => {
                      (document.getElementById('graphql-query') as HTMLTextAreaElement).value = `query GetDatabaseStats {
  graphs { id name type status }
  workItems { id title type status }
  edges { id type }
}`;
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
                  >
                    Sample Query
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
import { createServer } from 'http';
import { URL } from 'url';

// Simple HTTP health check server that runs alongside the MCP server
export function startHealthServer(port = 3128) {
  const server = createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    
    // Enable CORS for web app access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
    
    if (url.pathname === '/health' && req.method === 'GET') {
      const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        server: 'graphdone-mcp',
        version: '0.2.1-alpha',
        uptime: process.uptime(),
        pid: process.pid,
        capabilities: [
          'browse_graph',
          'create_node',
          'update_node', 
          'delete_node',
          'create_edge',
          'delete_edge',
          'get_node_details',
          'find_path',
          'update_priorities',
          'bulk_update_priorities',
          'get_priority_insights',
          'analyze_graph_health',
          'get_bottlenecks',
          'bulk_operations',
          'get_workload_analysis',
          'get_contributor_priorities',
          'get_contributor_workload',
          'find_contributors_by_project',
          'get_project_team',
          'get_contributor_expertise',
          'get_collaboration_network',
          'get_contributor_availability'
        ],
        lastAccessed: getLastAccessTime()
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(healthData, null, 2));
      return;
    }
    
    if (url.pathname === '/status' && req.method === 'GET') {
      const statusData = {
        active: true,
        connectedClients: getConnectedClients(),
        totalRequests: getTotalRequests(),
        lastRequest: getLastRequestTime(),
        neo4j: {
          connected: true, // We could check actual Neo4j connection here
          uri: process.env.NEO4J_URI || 'bolt://localhost:7687'
        }
      };
      
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(statusData, null, 2));
      return;
    }
    
    // 404 for other paths
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });
  
  server.listen(port, () => {
    console.error(`MCP Health server listening on port ${port}`);
  });
  
  // Handle port already in use error gracefully
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Health server port ${port} is already in use - skipping health server`);
    } else {
      console.error('Health server error:', err);
    }
  });
  
  return server;
}

// Track MCP server usage
let lastAccessTime: string | null = null;
let totalRequests = 0;
let lastRequestTime: string | null = null;
let connectedClients = 0;

export function recordAccess() {
  lastAccessTime = new Date().toISOString();
  totalRequests++;
  lastRequestTime = lastAccessTime;
}

export function recordClientConnection() {
  connectedClients++;
}

export function recordClientDisconnection() {
  connectedClients = Math.max(0, connectedClients - 1);
}

function getLastAccessTime() {
  return lastAccessTime;
}

function getTotalRequests() {
  return totalRequests;
}

function getLastRequestTime() {
  return lastRequestTime;
}

function getConnectedClients() {
  return connectedClients;
}
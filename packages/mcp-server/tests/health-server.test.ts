import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startHealthServer } from '../src/health-server';
import { Server } from 'http';

describe('MCP Health Server', () => {
  let server: Server;
  const testPort = 3129; // Use different port for tests

  beforeAll(async () => {
    server = startHealthServer(testPort);
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Health Endpoint', () => {
    it('should return health status', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      expect(response.ok).toBe(true);
      
      const health = await response.json();
      expect(health).toBeDefined();
      expect(health.status).toBe('healthy');
      expect(health.server).toBe('graphdone-mcp');
      expect(health.version).toBe('0.2.1-alpha');
      expect(health.capabilities).toBeDefined();
      expect(Array.isArray(health.capabilities)).toBe(true);
      expect(health.capabilities.length).toBeGreaterThan(0);
    });

    it('should include all expected capabilities', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const health = await response.json();
      
      const expectedCapabilities = [
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
      ];

      expectedCapabilities.forEach(capability => {
        expect(health.capabilities).toContain(capability);
      });
    });

    it('should return valid timestamps', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const health = await response.json();
      
      expect(health.timestamp).toBeDefined();
      expect(new Date(health.timestamp).getTime()).not.toBeNaN();
      expect(Date.now() - new Date(health.timestamp).getTime()).toBeLessThan(5000); // Within 5 seconds
    });

    it('should return process information', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const health = await response.json();
      
      expect(health.uptime).toBeDefined();
      expect(typeof health.uptime).toBe('number');
      expect(health.uptime).toBeGreaterThan(0);
      
      expect(health.pid).toBeDefined();
      expect(typeof health.pid).toBe('number');
      expect(health.pid).toBeGreaterThan(0);
    });
  });

  describe('Status Endpoint', () => {
    it('should return status information', async () => {
      const response = await fetch(`http://localhost:${testPort}/status`);
      expect(response.ok).toBe(true);
      
      const status = await response.json();
      expect(status).toBeDefined();
      expect(status.active).toBe(true);
      expect(status.connectedClients).toBeDefined();
      expect(status.totalRequests).toBeDefined();
      expect(status.neo4j).toBeDefined();
      expect(status.neo4j.connected).toBeDefined();
      expect(status.neo4j.uri).toBeDefined();
    });
  });

  describe('CORS Headers', () => {
    it('should include CORS headers', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
      expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
    });

    it('should handle OPTIONS requests', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'OPTIONS'
      });
      
      expect(response.status).toBe(200);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const response = await fetch(`http://localhost:${testPort}/unknown`);
      expect(response.status).toBe(404);
      
      const error = await response.json();
      expect(error.error).toBe('Not found');
    });

    it('should handle malformed requests gracefully', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`, {
        method: 'POST',
        body: 'invalid-json'
      });
      
      // Should still respond to POST on health endpoint
      expect(response.status).toBe(404);
    });
  });

  describe('Performance', () => {
    it('should respond to health checks quickly', async () => {
      const start = Date.now();
      const response = await fetch(`http://localhost:${testPort}/health`);
      const duration = Date.now() - start;
      
      expect(response.ok).toBe(true);
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should handle concurrent requests', async () => {
      const requests = Array(10).fill(0).map(() => 
        fetch(`http://localhost:${testPort}/health`)
      );
      
      const responses = await Promise.all(requests);
      
      responses.forEach(response => {
        expect(response.ok).toBe(true);
      });
    });
  });

  describe('Content Types', () => {
    it('should return JSON content type', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      
      expect(response.headers.get('Content-Type')).toBe('application/json');
    });

    it('should return properly formatted JSON', async () => {
      const response = await fetch(`http://localhost:${testPort}/health`);
      const text = await response.text();
      
      expect(() => JSON.parse(text)).not.toThrow();
      const parsed = JSON.parse(text);
      expect(typeof parsed).toBe('object');
    });
  });
});
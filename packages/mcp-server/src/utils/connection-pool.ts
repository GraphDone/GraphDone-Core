/**
 * Connection pool management and limiting utilities
 */

interface PoolStats {
  active: number;
  idle: number;
  waiting: number;
  created: number;
  destroyed: number;
  maxUsed: number;
}

/**
 * Connection pool limiter to prevent resource exhaustion
 */
export class ConnectionPoolLimiter {
  private static instance: ConnectionPoolLimiter | null = null;
  
  private activeConnections = 0;
  private maxConnections = 50; // Max concurrent connections
  private connectionQueue: Array<{
    resolve: (value: number) => void;
    reject: (error: Error) => void;
    timestamp: number;
  }> = [];
  
  private connectionTimeout = 5000; // 5 second timeout
  private stats: PoolStats = {
    active: 0,
    idle: 0,
    waiting: 0,
    created: 0,
    destroyed: 0,
    maxUsed: 0
  };
  
  private connectionHistory: Array<{
    acquired: number;
    released: number;
    duration: number;
  }> = [];
  
  private constructor() {
    this.startCleanupInterval();
  }
  
  static getInstance(): ConnectionPoolLimiter {
    if (!this.instance) {
      this.instance = new ConnectionPoolLimiter();
    }
    return this.instance;
  }
  
  /**
   * Acquire a connection slot (blocking if pool is full)
   */
  async acquireConnection(): Promise<number> {
    return new Promise((resolve, reject) => {
      if (this.activeConnections < this.maxConnections) {
        this.activeConnections++;
        this.stats.active++;
        this.stats.created++;
        this.stats.maxUsed = Math.max(this.stats.maxUsed, this.activeConnections);
        
        const connectionId = Date.now() + Math.random();
        this.recordConnectionAcquisition(connectionId);
        resolve(connectionId);
        return;
      }
      
      // Pool is full, queue the request
      const timestamp = Date.now();
      this.connectionQueue.push({ resolve, reject, timestamp });
      this.stats.waiting++;
      
      // Set timeout for queued connection
      setTimeout(() => {
        const index = this.connectionQueue.findIndex(req => req.timestamp === timestamp);
        if (index >= 0) {
          const request = this.connectionQueue.splice(index, 1)[0];
          this.stats.waiting--;
          request.reject(new Error(
            `Connection pool timeout after ${this.connectionTimeout}ms. ` +
            `Active: ${this.activeConnections}/${this.maxConnections}, ` +
            `Queue: ${this.connectionQueue.length}`
          ));
        }
      }, this.connectionTimeout);
    });
  }
  
  /**
   * Release a connection slot
   */
  releaseConnection(connectionId: number): void {
    if (this.activeConnections > 0) {
      this.activeConnections--;
      this.stats.active--;
      this.stats.destroyed++;
      
      this.recordConnectionRelease(connectionId);
      
      // Process queue if any requests are waiting
      if (this.connectionQueue.length > 0) {
        const next = this.connectionQueue.shift();
        if (next) {
          this.stats.waiting--;
          this.activeConnections++;
          this.stats.active++;
          this.stats.created++;
          
          const newConnectionId = Date.now() + Math.random();
          this.recordConnectionAcquisition(newConnectionId);
          next.resolve(newConnectionId);
        }
      }
    }
  }
  
  /**
   * Get current pool statistics
   */
  getStats(): PoolStats & {
    utilizationPercent: number;
    averageConnectionDuration: number;
    queueLength: number;
  } {
    const avgDuration = this.connectionHistory.length > 0
      ? this.connectionHistory.reduce((sum, conn) => sum + conn.duration, 0) / this.connectionHistory.length
      : 0;
    
    return {
      ...this.stats,
      utilizationPercent: (this.activeConnections / this.maxConnections) * 100,
      averageConnectionDuration: avgDuration,
      queueLength: this.connectionQueue.length
    };
  }
  
  /**
   * Check if pool is under stress
   */
  isUnderStress(): { stressed: boolean; reason?: string; stats: any } {
    const stats = this.getStats();
    
    const stressed = 
      stats.utilizationPercent > 90 ||           // > 90% utilization
      stats.queueLength > 10 ||                  // > 10 requests queued
      stats.averageConnectionDuration > 10000 || // Connections held > 10s on average
      (this.connectionQueue.length > 0 && this.connectionQueue[0].timestamp < Date.now() - 2000); // Oldest request > 2s old
    
    let reason = '';
    if (stats.utilizationPercent > 90) reason = `High utilization: ${stats.utilizationPercent.toFixed(1)}%`;
    if (stats.queueLength > 10) reason += ` ${reason ? ', ' : ''}Queue backed up: ${stats.queueLength} requests`;
    if (stats.averageConnectionDuration > 10000) reason += ` ${reason ? ', ' : ''}Long connection duration: ${(stats.averageConnectionDuration/1000).toFixed(1)}s avg`;
    
    return {
      stressed,
      reason: reason || undefined,
      stats
    };
  }
  
  /**
   * Force emergency pool reset (use sparingly)
   */
  emergencyReset(): void {
    console.warn('🚨 Emergency connection pool reset');
    
    // Reject all queued requests
    this.connectionQueue.forEach(request => {
      request.reject(new Error('Connection pool emergency reset'));
    });
    
    // Reset counters
    this.activeConnections = 0;
    this.connectionQueue = [];
    this.stats.waiting = 0;
    this.stats.active = 0;
  }
  
  /**
   * Configure pool limits (for testing/tuning)
   */
  configure(options: {
    maxConnections?: number;
    connectionTimeout?: number;
  }): void {
    if (options.maxConnections && options.maxConnections > 0) {
      this.maxConnections = options.maxConnections;
    }
    if (options.connectionTimeout && options.connectionTimeout > 0) {
      this.connectionTimeout = options.connectionTimeout;
    }
  }
  
  private recordConnectionAcquisition(connectionId: number): void {
    // Store for tracking connection lifetime
    (this as any)[`conn_${connectionId}`] = Date.now();
  }
  
  private recordConnectionRelease(connectionId: number): void {
    const startTime = (this as any)[`conn_${connectionId}`];
    if (startTime) {
      const duration = Date.now() - startTime;
      
      this.connectionHistory.push({
        acquired: startTime,
        released: Date.now(),
        duration
      });
      
      // Keep only recent history
      if (this.connectionHistory.length > 100) {
        this.connectionHistory.shift();
      }
      
      delete (this as any)[`conn_${connectionId}`];
    }
  }
  
  private startCleanupInterval(): void {
    // Clean up expired queue requests every 30 seconds
    setInterval(() => {
      const now = Date.now();
      const expiredRequests: typeof this.connectionQueue = [];
      
      this.connectionQueue = this.connectionQueue.filter(request => {
        const age = now - request.timestamp;
        if (age > this.connectionTimeout * 2) {
          expiredRequests.push(request);
          return false;
        }
        return true;
      });
      
      // Reject expired requests
      expiredRequests.forEach(request => {
        this.stats.waiting--;
        request.reject(new Error('Connection request expired in cleanup'));
      });
      
      if (expiredRequests.length > 0) {
        console.warn(`Cleaned up ${expiredRequests.length} expired connection requests`);
      }
    }, 30000);
  }
}

/**
 * Middleware to manage connection pool for database operations
 */
export async function withConnectionPoolLimit<T>(
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const pool = ConnectionPoolLimiter.getInstance();
  
  // Check for stress before acquiring connection
  const stressCheck = pool.isUnderStress();
  if (stressCheck.stressed) {
    throw new Error(
      `Connection pool under stress${operationName ? ` for ${operationName}` : ''}: ${stressCheck.reason}`
    );
  }
  
  const connectionId = await pool.acquireConnection();
  
  try {
    return await operation();
  } finally {
    pool.releaseConnection(connectionId);
  }
}

/**
 * Get current connection pool status
 */
export function getConnectionPoolStatus(): {
  healthy: boolean;
  stats: any;
  recommendations?: string[];
} {
  const pool = ConnectionPoolLimiter.getInstance();
  const stats = pool.getStats();
  const stressCheck = pool.isUnderStress();
  
  const recommendations: string[] = [];
  
  if (stats.utilizationPercent > 80) {
    recommendations.push('Consider increasing max connection limit');
  }
  
  if (stats.averageConnectionDuration > 5000) {
    recommendations.push('Optimize database queries to reduce connection hold time');
  }
  
  if (stats.queueLength > 5) {
    recommendations.push('Implement query optimization or horizontal scaling');
  }
  
  return {
    healthy: !stressCheck.stressed,
    stats: {
      ...stats,
      stressed: stressCheck.stressed,
      stressReason: stressCheck.reason
    },
    recommendations: recommendations.length > 0 ? recommendations : undefined
  };
}
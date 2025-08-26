/**
 * Read-after-write consistency management utilities
 */

interface WriteOperation {
  nodeId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  timestamp: number;
  version: number;
  data?: any;
}

interface ConsistencyLock {
  nodeId: string;
  timestamp: number;
  operation: string;
  version: number;
}

/**
 * Manages read-after-write consistency to prevent stale reads
 */
export class ConsistencyManager {
  private static instance: ConsistencyManager | null = null;
  
  private recentWrites: Map<string, WriteOperation> = new Map();
  private locks: Map<string, ConsistencyLock> = new Map();
  private versionCounter = 0;
  private readonly staleReadTimeoutMs = 1000; // 1 second timeout for writes to propagate
  
  private constructor() {
    this.startCleanupInterval();
  }
  
  static getInstance(): ConsistencyManager {
    if (!this.instance) {
      this.instance = new ConsistencyManager();
    }
    return this.instance;
  }
  
  /**
   * Record a write operation that might cause consistency issues
   */
  recordWrite(
    nodeId: string, 
    operation: 'CREATE' | 'UPDATE' | 'DELETE',
    data?: any
  ): number {
    const version = ++this.versionCounter;
    const writeOp: WriteOperation = {
      nodeId,
      operation,
      timestamp: Date.now(),
      version,
      data
    };
    
    this.recentWrites.set(nodeId, writeOp);
    
    // Set lock to prevent stale reads
    this.locks.set(nodeId, {
      nodeId,
      timestamp: Date.now(),
      operation,
      version
    });
    
    return version;
  }
  
  /**
   * Check if a read operation might return stale data
   */
  wouldReadBeStale(nodeId: string): { stale: boolean; waitMs?: number; version?: number } {
    const recentWrite = this.recentWrites.get(nodeId);
    const lock = this.locks.get(nodeId);
    
    if (!recentWrite || !lock) {
      return { stale: false };
    }
    
    const timeSinceWrite = Date.now() - recentWrite.timestamp;
    
    // If write was very recent, consider read potentially stale
    if (timeSinceWrite < this.staleReadTimeoutMs) {
      return {
        stale: true,
        waitMs: this.staleReadTimeoutMs - timeSinceWrite,
        version: recentWrite.version
      };
    }
    
    // Write is old enough, clear the lock
    this.locks.delete(nodeId);
    return { stale: false };
  }
  
  /**
   * Wait for write consistency before performing read
   */
  async waitForConsistency(nodeId: string, maxWaitMs: number = 2000): Promise<void> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitMs) {
      const staleCheck = this.wouldReadBeStale(nodeId);
      
      if (!staleCheck.stale) {
        return; // Consistent now
      }
      
      const waitMs = Math.min(staleCheck.waitMs || 100, maxWaitMs - (Date.now() - startTime));
      if (waitMs > 0) {
        await this.sleep(waitMs);
      }
    }
    
    // Timeout reached, proceed anyway but log warning
    console.warn(
      `Consistency timeout for node ${nodeId} after ${maxWaitMs}ms. ` +
      `Read may be stale.`
    );
  }
  
  /**
   * Clear consistency locks for a node (for testing or recovery)
   */
  clearLock(nodeId: string): void {
    this.locks.delete(nodeId);
    this.recentWrites.delete(nodeId);
  }
  
  /**
   * Get consistency statistics
   */
  getStats(): {
    activeWrites: number;
    activeLocks: number;
    oldestWrite: number | null;
    averageWriteAge: number;
  } {
    const now = Date.now();
    const writeAges = Array.from(this.recentWrites.values()).map(w => now - w.timestamp);
    
    return {
      activeWrites: this.recentWrites.size,
      activeLocks: this.locks.size,
      oldestWrite: writeAges.length > 0 ? Math.max(...writeAges) : null,
      averageWriteAge: writeAges.length > 0 
        ? writeAges.reduce((sum, age) => sum + age, 0) / writeAges.length
        : 0
    };
  }
  
  /**
   * Check if system has consistency issues
   */
  hasConsistencyIssues(): { issues: boolean; details: any } {
    const stats = this.getStats();
    const now = Date.now();
    
    // Check for stuck writes (should be cleared within reasonable time)
    const stuckWrites = Array.from(this.recentWrites.values()).filter(
      write => now - write.timestamp > 10000 // 10 seconds
    );
    
    // Check for excessive locks
    const excessiveLocks = this.locks.size > 50;
    
    const issues = stuckWrites.length > 0 || excessiveLocks;
    
    return {
      issues,
      details: {
        ...stats,
        stuckWrites: stuckWrites.length,
        excessiveLocks,
        stuckWriteIds: stuckWrites.map(w => w.nodeId)
      }
    };
  }
  
  /**
   * Emergency cleanup of all consistency state
   */
  emergencyCleanup(): void {
    console.warn('🚨 Emergency consistency manager cleanup');
    this.recentWrites.clear();
    this.locks.clear();
  }
  
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  private startCleanupInterval(): void {
    // Clean up old writes every 30 seconds
    setInterval(() => {
      const now = Date.now();
      const cutoffTime = now - (this.staleReadTimeoutMs * 3); // 3x timeout
      
      // Clean old writes
      for (const [nodeId, write] of this.recentWrites) {
        if (write.timestamp < cutoffTime) {
          this.recentWrites.delete(nodeId);
        }
      }
      
      // Clean old locks
      for (const [nodeId, lock] of this.locks) {
        if (lock.timestamp < cutoffTime) {
          this.locks.delete(nodeId);
        }
      }
    }, 30000);
  }
}

/**
 * Middleware to ensure read-after-write consistency
 */
export async function withReadConsistency<T>(
  nodeId: string,
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const consistency = ConsistencyManager.getInstance();
  
  // Check if read might be stale
  const staleCheck = consistency.wouldReadBeStale(nodeId);
  
  if (staleCheck.stale) {
    console.log(
      `Waiting for consistency for ${operationName || 'read'} on node ${nodeId}. ` +
      `Recent write version: ${staleCheck.version}, wait: ${staleCheck.waitMs}ms`
    );
    
    await consistency.waitForConsistency(nodeId);
  }
  
  return await operation();
}

/**
 * Middleware to record write operations for consistency tracking
 */
export async function withWriteConsistency<T>(
  nodeId: string,
  operationType: 'CREATE' | 'UPDATE' | 'DELETE',
  operation: () => Promise<T>,
  operationName?: string
): Promise<T> {
  const consistency = ConsistencyManager.getInstance();
  
  try {
    const result = await operation();
    
    // Record successful write
    const version = consistency.recordWrite(nodeId, operationType, result);
    
    console.log(
      `Recorded write consistency for ${operationName || 'write'} on node ${nodeId}. ` +
      `Version: ${version}, operation: ${operationType}`
    );
    
    return result;
  } catch (error) {
    // Don't record failed writes
    throw error;
  }
}

/**
 * Get global consistency status
 */
export function getConsistencyStatus(): {
  healthy: boolean;
  stats: any;
  recommendations?: string[];
} {
  const consistency = ConsistencyManager.getInstance();
  const stats = consistency.getStats();
  const issues = consistency.hasConsistencyIssues();
  
  const recommendations: string[] = [];
  
  if (issues.details.stuckWrites > 0) {
    recommendations.push('Clear stuck write operations');
  }
  
  if (issues.details.excessiveLocks) {
    recommendations.push('Reduce concurrent write operations');
  }
  
  if (stats.averageWriteAge > 5000) {
    recommendations.push('Optimize write operation performance');
  }
  
  return {
    healthy: !issues.issues,
    stats: {
      ...stats,
      ...issues.details
    },
    recommendations: recommendations.length > 0 ? recommendations : undefined
  };
}
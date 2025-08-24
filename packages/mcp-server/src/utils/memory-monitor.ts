/**
 * Memory monitoring and protection utilities
 */

let memoryWarningCount = 0;
let lastMemoryCheck = 0;
const MEMORY_CHECK_INTERVAL = 5000; // 5 seconds
const MEMORY_LIMIT_MB = 512; // 512MB limit
const MEMORY_WARNING_MB = 256; // 256MB warning threshold

/**
 * Check current memory usage and enforce limits
 */
export function checkMemoryUsage(): void {
  const now = Date.now();
  
  // Don't check too frequently to avoid performance impact
  if (now - lastMemoryCheck < MEMORY_CHECK_INTERVAL) {
    return;
  }
  
  lastMemoryCheck = now;
  
  const memoryUsage = process.memoryUsage();
  const heapUsedMB = memoryUsage.heapUsed / (1024 * 1024);
  const totalMemoryMB = memoryUsage.rss / (1024 * 1024);
  
  // Enforce hard memory limit
  if (heapUsedMB > MEMORY_LIMIT_MB) {
    console.error(`🚨 MEMORY LIMIT EXCEEDED: ${heapUsedMB.toFixed(2)}MB > ${MEMORY_LIMIT_MB}MB`);
    
    // Force garbage collection if available
    if (global.gc) {
      console.log('🗑️ Forcing garbage collection...');
      global.gc();
      
      // Check memory again after GC
      const afterGC = process.memoryUsage().heapUsed / (1024 * 1024);
      if (afterGC > MEMORY_LIMIT_MB) {
        throw new Error(`Memory limit exceeded: ${afterGC.toFixed(2)}MB. Server shutting down to prevent system instability.`);
      }
    } else {
      throw new Error(`Memory limit exceeded: ${heapUsedMB.toFixed(2)}MB. Server shutting down to prevent system instability.`);
    }
  }
  
  // Warning for high memory usage
  if (heapUsedMB > MEMORY_WARNING_MB) {
    memoryWarningCount++;
    
    if (memoryWarningCount % 5 === 0) { // Log every 5th warning to avoid spam
      console.warn(`⚠️ HIGH MEMORY USAGE: ${heapUsedMB.toFixed(2)}MB (Warning #${memoryWarningCount})`);
      console.warn(`RSS: ${totalMemoryMB.toFixed(2)}MB, External: ${(memoryUsage.external / (1024 * 1024)).toFixed(2)}MB`);
    }
  } else {
    memoryWarningCount = 0; // Reset warning count when memory is back to normal
  }
}

/**
 * Validate that an operation won't exceed memory limits
 */
export function validateOperationMemory(estimatedSizeMB: number): void {
  const currentMemoryMB = process.memoryUsage().heapUsed / (1024 * 1024);
  const projectedMemoryMB = currentMemoryMB + estimatedSizeMB;
  
  if (projectedMemoryMB > MEMORY_LIMIT_MB) {
    throw new Error(`Operation would exceed memory limit: ${projectedMemoryMB.toFixed(2)}MB > ${MEMORY_LIMIT_MB}MB`);
  }
  
  if (projectedMemoryMB > MEMORY_WARNING_MB) {
    console.warn(`⚠️ Operation may cause high memory usage: ${projectedMemoryMB.toFixed(2)}MB`);
  }
}

/**
 * Get current memory statistics
 */
export function getMemoryStats() {
  const usage = process.memoryUsage();
  
  return {
    heapUsed: Math.round(usage.heapUsed / (1024 * 1024) * 100) / 100, // MB
    heapTotal: Math.round(usage.heapTotal / (1024 * 1024) * 100) / 100, // MB
    rss: Math.round(usage.rss / (1024 * 1024) * 100) / 100, // MB
    external: Math.round(usage.external / (1024 * 1024) * 100) / 100, // MB
    limit: MEMORY_LIMIT_MB,
    warning: MEMORY_WARNING_MB,
    warningCount: memoryWarningCount
  };
}

/**
 * Start periodic memory monitoring
 */
export function startMemoryMonitoring(): void {
  // Check memory immediately
  checkMemoryUsage();
  
  // Set up periodic monitoring
  const monitoringInterval = setInterval(() => {
    try {
      checkMemoryUsage();
    } catch (error) {
      console.error('💥 Memory monitoring failed:', error);
      clearInterval(monitoringInterval);
      
      // Critical memory issue - attempt graceful shutdown
      console.error('🚨 Server shutting down due to memory issues');
      process.exit(1);
    }
  }, MEMORY_CHECK_INTERVAL);
  
  // Clean up on process exit
  process.on('SIGINT', () => {
    clearInterval(monitoringInterval);
  });
  
  process.on('SIGTERM', () => {
    clearInterval(monitoringInterval);
  });
  
  console.log(`🛡️ Memory monitoring started (Limit: ${MEMORY_LIMIT_MB}MB, Warning: ${MEMORY_WARNING_MB}MB)`);
}

/**
 * Memory-safe JSON parsing with size limits
 */
export function safeJsonParse(jsonString: string, maxSizeMB: number = 10): any {
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB > maxSizeMB) {
    throw new Error(`JSON size limit exceeded: ${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB`);
  }
  
  return JSON.parse(jsonString);
}

/**
 * Memory-safe JSON stringification with size limits
 */
export function safeJsonStringify(obj: any, maxSizeMB: number = 10): string {
  const jsonString = JSON.stringify(obj);
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB > maxSizeMB) {
    throw new Error(`JSON output size limit exceeded: ${sizeMB.toFixed(2)}MB > ${maxSizeMB}MB`);
  }
  
  return jsonString;
}
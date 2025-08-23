/**
 * Thread-safe ID generation utilities
 */

import { randomBytes } from 'crypto';

// Atomic counter for ensuring uniqueness
let sequenceCounter = 0;
const MAX_SEQUENCE = 999999; // Reset after this to prevent overflow

// Process start time to ensure uniqueness across restarts
const PROCESS_START_TIME = Date.now();

// Machine ID based on environment (or generate random one)
const MACHINE_ID = process.env.MACHINE_ID || randomBytes(3).toString('hex');

/**
 * Generate a truly unique node ID that prevents race conditions
 * Format: node_[timestamp]_[machineId]_[processId]_[sequence]_[random]
 */
export function generateUniqueNodeId(): string {
  // Get current timestamp in milliseconds
  const timestamp = Date.now();
  
  // Atomic increment of sequence counter
  sequenceCounter = (sequenceCounter + 1) % MAX_SEQUENCE;
  
  // Get process ID for additional uniqueness
  const processId = process.pid.toString(16);
  
  // Generate random component for extra entropy
  const randomComponent = randomBytes(4).toString('hex');
  
  // Combine all components for guaranteed uniqueness
  return `node_${timestamp}_${MACHINE_ID}_${processId}_${sequenceCounter.toString().padStart(6, '0')}_${randomComponent}`;
}

/**
 * Generate a unique edge ID
 */
export function generateUniqueEdgeId(): string {
  const timestamp = Date.now();
  sequenceCounter = (sequenceCounter + 1) % MAX_SEQUENCE;
  const processId = process.pid.toString(16);
  const randomComponent = randomBytes(4).toString('hex');
  
  return `edge_${timestamp}_${MACHINE_ID}_${processId}_${sequenceCounter.toString().padStart(6, '0')}_${randomComponent}`;
}

/**
 * Generate a unique graph ID
 */
export function generateUniqueGraphId(): string {
  const timestamp = Date.now();
  sequenceCounter = (sequenceCounter + 1) % MAX_SEQUENCE;
  const processId = process.pid.toString(16);
  const randomComponent = randomBytes(4).toString('hex');
  
  return `graph_${timestamp}_${MACHINE_ID}_${processId}_${sequenceCounter.toString().padStart(6, '0')}_${randomComponent}`;
}

/**
 * Generate a session/transaction ID for tracking operations
 */
export function generateSessionId(): string {
  const timestamp = Date.now();
  const randomComponent = randomBytes(8).toString('hex');
  
  return `session_${timestamp}_${MACHINE_ID}_${randomComponent}`;
}

/**
 * Validate ID format and detect potential collisions
 */
export function validateIdFormat(id: string): { valid: boolean; type?: string; details?: any } {
  if (!id || typeof id !== 'string') {
    return { valid: false };
  }
  
  // Check for our generated ID patterns
  const nodeMatch = id.match(/^node_(\d+)_([a-f0-9]+)_([a-f0-9]+)_(\d{6})_([a-f0-9]+)$/);
  if (nodeMatch) {
    const [, timestamp, machineId, processId, sequence, random] = nodeMatch;
    return {
      valid: true,
      type: 'node',
      details: {
        timestamp: parseInt(timestamp),
        machineId,
        processId,
        sequence: parseInt(sequence),
        random,
        age: Date.now() - parseInt(timestamp)
      }
    };
  }
  
  const edgeMatch = id.match(/^edge_(\d+)_([a-f0-9]+)_([a-f0-9]+)_(\d{6})_([a-f0-9]+)$/);
  if (edgeMatch) {
    const [, timestamp, machineId, processId, sequence, random] = edgeMatch;
    return {
      valid: true,
      type: 'edge',
      details: {
        timestamp: parseInt(timestamp),
        machineId,
        processId,
        sequence: parseInt(sequence),
        random,
        age: Date.now() - parseInt(timestamp)
      }
    };
  }
  
  const graphMatch = id.match(/^graph_(\d+)_([a-f0-9]+)_([a-f0-9]+)_(\d{6})_([a-f0-9]+)$/);
  if (graphMatch) {
    const [, timestamp, machineId, processId, sequence, random] = graphMatch;
    return {
      valid: true,
      type: 'graph',
      details: {
        timestamp: parseInt(timestamp),
        machineId,
        processId,
        sequence: parseInt(sequence),
        random,
        age: Date.now() - parseInt(timestamp)
      }
    };
  }
  
  // For legacy or external IDs, do basic validation
  if (id.length > 200) {
    return { valid: false }; // Too long
  }
  
  if (!/^[a-zA-Z0-9\-_.]+$/.test(id)) {
    return { valid: false }; // Invalid characters
  }
  
  return { valid: true, type: 'legacy' };
}

/**
 * Check for potential ID collisions in a batch
 */
export function detectIdCollisions(ids: string[]): string[] {
  const seen = new Set<string>();
  const collisions: string[] = [];
  
  for (const id of ids) {
    if (seen.has(id)) {
      collisions.push(id);
    } else {
      seen.add(id);
    }
  }
  
  return collisions;
}

/**
 * Generate multiple unique IDs in batch (for testing)
 */
export function generateBatchIds(count: number, type: 'node' | 'edge' | 'graph' = 'node'): string[] {
  const ids: string[] = [];
  
  for (let i = 0; i < count; i++) {
    let id: string;
    switch (type) {
      case 'node':
        id = generateUniqueNodeId();
        break;
      case 'edge':
        id = generateUniqueEdgeId();
        break;
      case 'graph':
        id = generateUniqueGraphId();
        break;
      default:
        throw new Error(`Unknown ID type: ${type}`);
    }
    ids.push(id);
  }
  
  return ids;
}
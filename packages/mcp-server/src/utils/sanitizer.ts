/**
 * Input sanitization utilities for security
 */

/**
 * Sanitize HTML/XSS content from user input
 */
export function sanitizeHTML(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  return input
    // Remove script tags and content, but preserve safe text
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '[SCRIPT_REMOVED]')
    .replace(/<script[^>]*>/gi, '[SCRIPT_REMOVED]')
    
    // Remove javascript: URLs
    .replace(/javascript:/gi, '[JS_URL_REMOVED]')
    
    // Remove event handlers (onclick, onerror, etc)  
    .replace(/\s*on\w+\s*=\s*[^>]*/gi, '[EVENT_HANDLER_REMOVED]')
    
    // Remove dangerous HTML elements
    .replace(/<(iframe|object|embed|link|meta|form)[^>]*>/gi, '[$1_REMOVED]')
    .replace(/<\/(iframe|object|embed|link|meta|form)>/gi, '')
    
    // Remove data: URLs that could contain scripts
    .replace(/data:\s*[^;]*;[^,]*,/gi, '')
    
    // Remove vbscript: URLs
    .replace(/vbscript:/gi, '')
    
    // Remove expressions
    .replace(/expression\s*\(/gi, '')
    
    // Remove CSS expressions
    .replace(/expression\s*\([^)]*\)/gi, '')
    
    // Remove @import
    .replace(/@import/gi, '')
    
    // Remove eval and similar dangerous functions
    .replace(/(eval|setTimeout|setInterval|Function|execScript|execSync|atob|btoa|unescape|decodeURI|decodeURIComponent)\s*\(/gi, '[BLOCKED_FUNCTION]');
}

/**
 * Sanitize and validate string length
 */
export function sanitizeString(input: unknown, maxLength: number = 10000): string {
  if (input === null || input === undefined) {
    return '';
  }
  
  let str = String(input);
  
  // Limit string length to prevent memory exhaustion
  if (str.length > maxLength) {
    str = str.substring(0, maxLength) + '...[TRUNCATED]';
  }
  
  // Remove null bytes and control characters
  str = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Sanitize HTML/XSS
  str = sanitizeHTML(str);
  
  return str;
}

/**
 * Sanitize node ID to prevent injection
 */
export function sanitizeNodeId(id: unknown): string {
  if (!id) {
    throw new Error('Node ID is required');
  }
  
  const str = String(id).trim();
  
  // Check for Cypher injection patterns
  const dangerousPatterns = [
    /[';]/g,              // Semicolons and single quotes
    /\bmatch\b/gi,        // MATCH keyword
    /\bdelete\b/gi,       // DELETE keyword  
    /\bcreate\b/gi,       // CREATE keyword
    /\bset\b/gi,          // SET keyword
    /\bunion\b/gi,        // UNION keyword
    /\bcall\b/gi,         // CALL keyword
    /\bdrop\b/gi,         // DROP keyword
    /\bremove\b/gi,       // REMOVE keyword
    /\breturn\b/gi,       // RETURN keyword (when suspicious)
    /\bwhere\b/gi,        // WHERE keyword
    /\/\//,               // Cypher comments
    /\/\*/,               // Multi-line comments
    /\$\w+/               // Parameter injection attempts
  ];
  
  for (const pattern of dangerousPatterns) {
    if (pattern.test(str)) {
      throw new Error('Node ID contains invalid characters or patterns');
    }
  }
  
  // Only allow alphanumeric, hyphens, underscores, and periods
  const sanitized = str.replace(/[^a-zA-Z0-9\-_.]/g, '');
  
  if (!sanitized || sanitized.length === 0) {
    throw new Error('Invalid node ID format - only alphanumeric, hyphens, underscores, and periods allowed');
  }
  
  if (sanitized.length > 100) {
    throw new Error('Node ID too long (max 100 characters)');
  }
  
  // Ensure it doesn't start with special characters that could be problematic
  if (/^[._-]/.test(sanitized)) {
    throw new Error('Node ID cannot start with special characters');
  }
  
  return sanitized;
}

/**
 * Sanitize metadata object
 */
export function sanitizeMetadata(metadata: unknown): Record<string, unknown> {
  if (!metadata || typeof metadata !== 'object') {
    return {};
  }
  
  const sanitized: Record<string, unknown> = {};
  const obj = metadata as Record<string, unknown>;
  
  // Prevent circular references
  const seen = new WeakSet();
  
  function sanitizeValue(value: unknown, depth: number = 0): unknown {
    // Prevent infinite recursion
    if (depth > 10) {
      return '[MAX_DEPTH_EXCEEDED]';
    }
    
    if (value === null || value === undefined) {
      return value;
    }
    
    if (typeof value === 'string') {
      return sanitizeString(value, 1000); // Shorter limit for metadata
    }
    
    if (typeof value === 'number') {
      if (!isFinite(value)) {
        return 0; // Replace NaN/Infinity with 0
      }
      return value;
    }
    
    if (typeof value === 'boolean') {
      return value;
    }
    
    if (Array.isArray(value)) {
      // Limit array size to prevent memory exhaustion
      if (value.length > 1000) {
        return value.slice(0, 1000).concat(['[ARRAY_TRUNCATED]']);
      }
      return value.map(item => sanitizeValue(item, depth + 1));
    }
    
    if (typeof value === 'object') {
      // Check for circular references
      if (seen.has(value)) {
        return '[CIRCULAR_REFERENCE_REMOVED]';
      }
      seen.add(value);
      
      const sanitizedObj: Record<string, unknown> = {};
      const entries = Object.entries(value as Record<string, unknown>);
      
      // Limit object properties to prevent memory exhaustion
      const limitedEntries = entries.slice(0, 100);
      if (entries.length > 100) {
        sanitizedObj['[OBJECT_TRUNCATED]'] = `${entries.length - 100} properties removed`;
      }
      
      for (const [key, val] of limitedEntries) {
        const sanitizedKey = sanitizeString(key, 100);
        if (sanitizedKey) {
          sanitizedObj[sanitizedKey] = sanitizeValue(val, depth + 1);
        }
      }
      
      return sanitizedObj;
    }
    
    // For any other type, convert to string and sanitize
    return sanitizeString(value);
  }
  
  const entries = Object.entries(obj);
  const limitedEntries = entries.slice(0, 50); // Limit top-level properties
  
  for (const [key, value] of limitedEntries) {
    const sanitizedKey = sanitizeString(key, 100);
    if (sanitizedKey) {
      sanitized[sanitizedKey] = sanitizeValue(value);
    }
  }
  
  return sanitized;
}

/**
 * Validate and sanitize node type
 */
export function sanitizeNodeType(type: unknown): string {
  const validTypes = ['OUTCOME', 'EPIC', 'INITIATIVE', 'STORY', 'TASK', 'BUG', 'FEATURE', 'MILESTONE'];
  
  if (!type || typeof type !== 'string') {
    throw new Error('Node type is required and must be a string');
  }
  
  const upperType = type.toUpperCase();
  
  if (!validTypes.includes(upperType)) {
    throw new Error(`Invalid node type. Must be one of: ${validTypes.join(', ')}`);
  }
  
  return upperType;
}

/**
 * Validate and sanitize node status
 */
export function sanitizeNodeStatus(status: unknown): string {
  const validStatuses = ['PROPOSED', 'ACTIVE', 'IN_PROGRESS', 'BLOCKED', 'COMPLETED', 'ARCHIVED'];
  
  if (!status) {
    return 'PROPOSED'; // Default status
  }
  
  if (typeof status !== 'string') {
    throw new Error('Node status must be a string');
  }
  
  const upperStatus = status.toUpperCase();
  
  if (!validStatuses.includes(upperStatus)) {
    throw new Error(`Invalid node status. Must be one of: ${validStatuses.join(', ')}`);
  }
  
  return upperStatus;
}

/**
 * Sanitize priority value
 */
export function sanitizePriority(priority: unknown): number | null {
  if (priority === null || priority === undefined) {
    return null;
  }
  
  const num = Number(priority);
  
  if (!isFinite(num)) {
    throw new Error('Priority must be a finite number');
  }
  
  if (num < 0 || num > 1) {
    throw new Error('Priority must be between 0 and 1');
  }
  
  return num;
}

/**
 * Validate bulk operation limits
 */
export function validateBulkOperation(count: number, maxCount: number = 100): void {
  if (count > maxCount) {
    throw new Error(`Bulk operation limit exceeded. Maximum ${maxCount} items allowed, got ${count}`);
  }
}

/**
 * Validate memory usage for operations
 */
export function validateMemoryUsage(data: unknown, maxSizeMB: number = 10): void {
  const jsonString = JSON.stringify(data);
  const sizeBytes = Buffer.byteLength(jsonString, 'utf8');
  const sizeMB = sizeBytes / (1024 * 1024);
  
  if (sizeMB > maxSizeMB) {
    throw new Error(`Data size limit exceeded. Maximum ${maxSizeMB}MB allowed, got ${sizeMB.toFixed(2)}MB`);
  }
}
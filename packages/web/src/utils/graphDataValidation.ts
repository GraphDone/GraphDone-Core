import { RelationshipType } from '../types/projectData';

// Types for validation results
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  validNodes: any[];
  validEdges: any[];
  invalidNodes: any[];
  invalidEdges: any[];
  stats: ValidationStats;
}

export interface ValidationError {
  type: 'error';
  category: 'node' | 'edge' | 'data';
  itemId?: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationWarning {
  type: 'warning';
  category: 'node' | 'edge' | 'data';
  itemId?: string;
  field?: string;
  message: string;
  suggestion?: string;
}

export interface ValidationStats {
  totalNodes: number;
  validNodes: number;
  invalidNodes: number;
  totalEdges: number;
  validEdges: number;
  invalidEdges: number;
  orphanNodes: number;
  duplicateIds: number;
  missingReferences: number;
}

// Validation functions
export function validateGraphData(nodes: any[], edges: any[]): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];
  const validNodes: any[] = [];
  const invalidNodes: any[] = [];
  const validEdges: any[] = [];
  const invalidEdges: any[] = [];
  
  // Create a map of valid node IDs for edge validation
  const nodeIdMap = new Map<string, any>();
  const duplicateIds = new Set<string>();
  
  // Validate nodes
  nodes.forEach((node, index) => {
    const nodeErrors = validateNode(node, index);
    
    if (nodeErrors.length === 0) {
      // Check for duplicate IDs
      if (nodeIdMap.has(node.id)) {
        duplicateIds.add(node.id);
        errors.push({
          type: 'error',
          category: 'node',
          itemId: node.id,
          message: `Duplicate node ID: ${node.id}`,
          suggestion: 'Ensure all node IDs are unique'
        });
        invalidNodes.push(node);
      } else {
        nodeIdMap.set(node.id, node);
        validNodes.push(sanitizeNode(node));
      }
    } else {
      errors.push(...nodeErrors);
      invalidNodes.push(node);
      
      // Add a warning for partial data
      if (node.id && node.title) {
        warnings.push({
          type: 'warning',
          category: 'node',
          itemId: node.id,
          message: `Node "${node.title}" has validation errors but may be partially renderable`,
          suggestion: 'Fix validation errors for full functionality'
        });
      }
    }
  });
  
  // Validate edges
  const missingReferences = new Set<string>();
  edges.forEach((edge, index) => {
    const edgeErrors = validateEdge(edge, index, nodeIdMap);
    
    if (edgeErrors.length === 0) {
      validEdges.push(sanitizeEdge(edge));
    } else {
      // Check if it's just missing references
      const hasMissingRef = edgeErrors.some(e => 
        e.message.includes('not found') || e.message.includes('does not exist')
      );
      
      if (hasMissingRef) {
        if (edge.source) missingReferences.add(edge.source);
        if (edge.target) missingReferences.add(edge.target);
      }
      
      errors.push(...edgeErrors);
      invalidEdges.push(edge);
    }
  });
  
  // Find orphan nodes (nodes with no edges)
  const connectedNodeIds = new Set<string>();
  validEdges.forEach(edge => {
    connectedNodeIds.add(edge.source);
    connectedNodeIds.add(edge.target);
  });
  
  const orphanNodes = validNodes.filter(node => !connectedNodeIds.has(node.id));
  orphanNodes.forEach(node => {
    warnings.push({
      type: 'warning',
      category: 'node',
      itemId: node.id,
      message: `Node "${node.title}" has no connections`,
      suggestion: 'Consider adding relationships to connect this node to the graph'
    });
  });
  
  // Calculate stats
  const stats: ValidationStats = {
    totalNodes: nodes.length,
    validNodes: validNodes.length,
    invalidNodes: invalidNodes.length,
    totalEdges: edges.length,
    validEdges: validEdges.length,
    invalidEdges: invalidEdges.length,
    orphanNodes: orphanNodes.length,
    duplicateIds: duplicateIds.size,
    missingReferences: missingReferences.size
  };
  
  // Determine overall validity
  const isValid = errors.length === 0 || 
    (validNodes.length > 0 && stats.invalidNodes < stats.totalNodes * 0.5);
  
  return {
    isValid,
    errors,
    warnings,
    validNodes,
    validEdges,
    invalidNodes,
    invalidEdges,
    stats
  };
}

function validateNode(node: any, index: number): ValidationError[] {
  const errors: ValidationError[] = [];
  
  // Check required fields
  if (!node) {
    errors.push({
      type: 'error',
      category: 'node',
      message: `Node at index ${index} is null or undefined`,
      suggestion: 'Remove null entries from nodes array'
    });
    return errors;
  }
  
  if (!node.id) {
    errors.push({
      type: 'error',
      category: 'node',
      field: 'id',
      message: `Node at index ${index} is missing required field: id`,
      suggestion: 'Add a unique ID to each node'
    });
  }
  
  if (!node.title && !node.name) {
    errors.push({
      type: 'error',
      category: 'node',
      itemId: node.id,
      field: 'title',
      message: `Node ${node.id || `at index ${index}`} is missing title`,
      suggestion: 'Add a title or name field to the node'
    });
  }
  
  if (!node.type) {
    errors.push({
      type: 'error',
      category: 'node',
      itemId: node.id,
      field: 'type',
      message: `Node ${node.id || `at index ${index}`} is missing type`,
      suggestion: 'Add a type field (e.g., TASK, EPIC, MILESTONE)'
    });
  }
  
  // Validate numeric fields
  const numericFields = [
    'positionX', 'positionY', 'positionZ',
    'priorityExec', 'priorityIndiv', 'priorityComm', 'priorityComp',
    'x', 'y', 'z'
  ];
  
  numericFields.forEach(field => {
    if (node[field] !== undefined && node[field] !== null) {
      if (typeof node[field] !== 'number' || isNaN(node[field]) || !isFinite(node[field])) {
        errors.push({
          type: 'error',
          category: 'node',
          itemId: node.id,
          field,
          message: `Node ${node.id || `at index ${index}`} has invalid numeric value for ${field}: ${node[field]}`,
          suggestion: `Ensure ${field} is a valid number`
        });
      }
    }
  });
  
  // Validate priority values are between 0 and 1
  const priorityFields = ['priorityExec', 'priorityIndiv', 'priorityComm', 'priorityComp'];
  priorityFields.forEach(field => {
    if (node[field] !== undefined && node[field] !== null) {
      const value = node[field];
      if (typeof value === 'number' && (value < 0 || value > 1)) {
        errors.push({
          type: 'error',
          category: 'node',
          itemId: node.id,
          field,
          message: `Node ${node.id} has priority value outside valid range [0,1]: ${value}`,
          suggestion: 'Priority values should be between 0 and 1'
        });
      }
    }
  });
  
  return errors;
}

function validateEdge(edge: any, index: number, nodeIdMap: Map<string, any>): ValidationError[] {
  const errors: ValidationError[] = [];
  
  if (!edge) {
    errors.push({
      type: 'error',
      category: 'edge',
      message: `Edge at index ${index} is null or undefined`,
      suggestion: 'Remove null entries from edges array'
    });
    return errors;
  }
  
  if (!edge.id) {
    // Generate an ID if missing (warning, not error)
    edge.id = `edge-${edge.source}-${edge.target}-${index}`;
  }
  
  if (!edge.source) {
    errors.push({
      type: 'error',
      category: 'edge',
      field: 'source',
      message: `Edge ${edge.id || `at index ${index}`} is missing source node`,
      suggestion: 'Add a source node ID to the edge'
    });
  } else if (!nodeIdMap.has(edge.source)) {
    errors.push({
      type: 'error',
      category: 'edge',
      itemId: edge.id,
      field: 'source',
      message: `Edge ${edge.id} references non-existent source node: ${edge.source}`,
      suggestion: 'Ensure the source node exists in the nodes array'
    });
  }
  
  if (!edge.target) {
    errors.push({
      type: 'error',
      category: 'edge',
      field: 'target',
      message: `Edge ${edge.id || `at index ${index}`} is missing target node`,
      suggestion: 'Add a target node ID to the edge'
    });
  } else if (!nodeIdMap.has(edge.target)) {
    errors.push({
      type: 'error',
      category: 'edge',
      itemId: edge.id,
      field: 'target',
      message: `Edge ${edge.id} references non-existent target node: ${edge.target}`,
      suggestion: 'Ensure the target node exists in the nodes array'
    });
  }
  
  // Validate edge type
  if (edge.type) {
    const validTypes: RelationshipType[] = [
      'DEPENDS_ON', 'BLOCKS', 'ENABLES', 'RELATES_TO',
      'IS_PART_OF', 'FOLLOWS', 'PARALLEL_WITH', 'DUPLICATES',
      'CONFLICTS_WITH', 'VALIDATES', 'REFERENCES', 'CONTAINS'
    ];
    
    if (!validTypes.includes(edge.type)) {
      errors.push({
        type: 'error',
        category: 'edge',
        itemId: edge.id,
        field: 'type',
        message: `Edge ${edge.id} has invalid type: ${edge.type}`,
        suggestion: `Use one of: ${validTypes.join(', ')}`
      });
    }
  }
  
  // Validate numeric fields
  if (edge.weight !== undefined && edge.weight !== null) {
    if (typeof edge.weight !== 'number' || isNaN(edge.weight) || !isFinite(edge.weight)) {
      errors.push({
        type: 'error',
        category: 'edge',
        itemId: edge.id,
        field: 'weight',
        message: `Edge ${edge.id} has invalid weight: ${edge.weight}`,
        suggestion: 'Weight should be a valid number'
      });
    }
  }
  
  if (edge.strength !== undefined && edge.strength !== null) {
    if (typeof edge.strength !== 'number' || edge.strength < 0 || edge.strength > 1) {
      errors.push({
        type: 'error',
        category: 'edge',
        itemId: edge.id,
        field: 'strength',
        message: `Edge ${edge.id} has invalid strength: ${edge.strength}`,
        suggestion: 'Strength should be between 0 and 1'
      });
    }
  }
  
  return errors;
}

function sanitizeNode(node: any): any {
  const sanitized = { ...node };
  
  // Ensure title exists
  if (!sanitized.title && sanitized.name) {
    sanitized.title = sanitized.name;
  }
  
  // Set default values for missing fields
  sanitized.type = sanitized.type || 'TASK';
  sanitized.status = sanitized.status || 'PROPOSED';
  
  // Initialize numeric fields with defaults
  if (sanitized.positionX === undefined) sanitized.positionX = 0;
  if (sanitized.positionY === undefined) sanitized.positionY = 0;
  if (sanitized.positionZ === undefined) sanitized.positionZ = 0;
  
  // Initialize priority fields
  if (sanitized.priorityExec === undefined) sanitized.priorityExec = 0.5;
  if (sanitized.priorityIndiv === undefined) sanitized.priorityIndiv = 0.5;
  if (sanitized.priorityComm === undefined) sanitized.priorityComm = 0.5;
  if (sanitized.priorityComp === undefined) sanitized.priorityComp = 0.5;
  
  // Clamp priority values to valid range
  const priorityFields = ['priorityExec', 'priorityIndiv', 'priorityComm', 'priorityComp'];
  priorityFields.forEach(field => {
    if (typeof sanitized[field] === 'number') {
      sanitized[field] = Math.max(0, Math.min(1, sanitized[field]));
    }
  });
  
  // Remove any NaN or Infinity values
  Object.keys(sanitized).forEach(key => {
    if (typeof sanitized[key] === 'number' && (!isFinite(sanitized[key]) || isNaN(sanitized[key]))) {
      sanitized[key] = 0;
    }
  });
  
  return sanitized;
}

function sanitizeEdge(edge: any): any {
  const sanitized = { ...edge };
  
  // Set default type if missing
  if (!sanitized.type) {
    sanitized.type = 'RELATES_TO';
  }
  
  
  // Set default weight/strength
  if (sanitized.weight === undefined) sanitized.weight = 1.0;
  if (sanitized.strength === undefined) sanitized.strength = 0.8;
  
  // Clamp values to valid ranges
  if (typeof sanitized.weight === 'number') {
    sanitized.weight = Math.max(0, sanitized.weight);
  }
  if (typeof sanitized.strength === 'number') {
    sanitized.strength = Math.max(0, Math.min(1, sanitized.strength));
  }
  
  return sanitized;
}

// Helper function to create a summary message for display
export function getValidationSummary(result: ValidationResult): string {
  const { stats, errors, warnings } = result;
  
  if (errors.length === 0 && warnings.length === 0) {
    return `✅ All ${stats.totalNodes} nodes and ${stats.totalEdges} edges are valid`;
  }
  
  const parts = [];
  
  if (stats.invalidNodes > 0) {
    parts.push(`${stats.invalidNodes} invalid node${stats.invalidNodes > 1 ? 's' : ''}`);
  }
  
  if (stats.invalidEdges > 0) {
    parts.push(`${stats.invalidEdges} invalid edge${stats.invalidEdges > 1 ? 's' : ''}`);
  }
  
  if (stats.duplicateIds > 0) {
    parts.push(`${stats.duplicateIds} duplicate ID${stats.duplicateIds > 1 ? 's' : ''}`);
  }
  
  if (stats.missingReferences > 0) {
    parts.push(`${stats.missingReferences} missing reference${stats.missingReferences > 1 ? 's' : ''}`);
  }
  
  if (warnings.length > 0) {
    parts.push(`${warnings.length} warning${warnings.length > 1 ? 's' : ''}`);
  }
  
  return `⚠️ Found ${parts.join(', ')}. Showing ${stats.validNodes} valid nodes.`;
}
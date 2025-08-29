/**
 * Utility functions for managing node connections
 * Handles both Edge entities and WorkItem relationships consistently
 */
import React from 'react';
import { 
  ArrowLeft, 
  Ban, 
  CheckCircle, 
  Link2, 
  Folder, 
  ArrowRight, 
  Split, 
  Copy, 
  Zap, 
  Shield, 
  Bookmark,
  Package
} from 'lucide-react';

// Icon mapping for relationship types
const iconMap = {
  'ArrowLeft': ArrowLeft,
  'Ban': Ban,
  'CheckCircle': CheckCircle,
  'Link2': Link2,
  'Folder': Folder,
  'ArrowRight': ArrowRight,
  'Split': Split,
  'Copy': Copy,
  'Zap': Zap,
  'Shield': Shield,
  'Bookmark': Bookmark,
  'Package': Package
} as const;

export function getRelationshipIcon(iconName: string, className: string = "h-4 w-4") {
  const IconComponent = iconMap[iconName as keyof typeof iconMap];
  return IconComponent ? React.createElement(IconComponent, { className }) : null;
}

export interface WorkItem {
  id: string;
  title: string;
  type: string;
  status: string;
  description?: string;
  priorityComp?: number;
  dependencies?: Array<{ id: string; title: string; }>;
  dependents?: Array<{ id: string; title: string; }>;
}

export interface Edge {
  id: string;
  type: string;
  source: { id: string; title: string; };
  target: { id: string; title: string; };
}

export const RELATIONSHIP_TYPES = [
  {
    type: 'DEPENDS_ON',
    label: 'Depends On',
    description: 'Source node depends on target node',
    icon: 'ArrowLeft',
    color: 'text-emerald-400'
  },
  {
    type: 'BLOCKS', 
    label: 'Blocks',
    description: 'Source node blocks target node',
    icon: 'Ban',
    color: 'text-red-400'
  },
  {
    type: 'ENABLES',
    label: 'Enables', 
    description: 'Source node enables target node',
    icon: 'CheckCircle',
    color: 'text-green-400'
  },
  {
    type: 'RELATES_TO',
    label: 'Related To',
    description: 'Source node relates to target node',
    icon: 'Link2',
    color: 'text-purple-400'
  },
  {
    type: 'IS_PART_OF',
    label: 'Is Part Of',
    description: 'Source node is part of target node',
    icon: 'Folder',
    color: 'text-orange-400'
  },
  {
    type: 'FOLLOWS',
    label: 'Follows',
    description: 'Source node follows target node',
    icon: 'ArrowRight',
    color: 'text-indigo-400'
  },
  {
    type: 'PARALLEL_WITH',
    label: 'Parallel With',
    description: 'Source node runs parallel to target',
    icon: 'Split',
    color: 'text-teal-400'
  },
  {
    type: 'DUPLICATES',
    label: 'Duplicates',
    description: 'Source node duplicates target node',
    icon: 'Copy',
    color: 'text-yellow-400'
  },
  {
    type: 'CONFLICTS_WITH',
    label: 'Conflicts With',
    description: 'Source node conflicts with target',
    icon: 'Zap',
    color: 'text-red-500'
  },
  {
    type: 'VALIDATES',
    label: 'Validates',
    description: 'Source node validates target node',
    icon: 'Shield',
    color: 'text-emerald-400'
  },
  {
    type: 'REFERENCES',
    label: 'References',
    description: 'Source node references target node',
    icon: 'Bookmark',
    color: 'text-slate-400'
  },
  {
    type: 'CONTAINS',
    label: 'Contains',
    description: 'Source node contains target node',
    icon: 'Package',
    color: 'text-blue-400'
  }
];

/**
 * Get all relationships between two nodes (from both Edge entities and WorkItem relationships)
 * Returns array of relationship types that exist between sourceId and targetId
 */
export function getExistingRelationships(
  sourceId: string,
  targetId: string,
  edges: Edge[],
  workItems: WorkItem[]
): string[] {
  const relationships: string[] = [];

  // Check Edge entities (both directions)
  const edgeRelationships = edges
    .filter(edge => 
      (edge.source.id === sourceId && edge.target.id === targetId) ||
      (edge.source.id === targetId && edge.target.id === sourceId)
    )
    .map(edge => edge.type);

  relationships.push(...edgeRelationships);

  // Check WorkItem relationships (DEPENDS_ON only)
  const sourceNode = workItems.find(item => item.id === sourceId);
  const targetNode = workItems.find(item => item.id === targetId);

  // If sourceNode depends on targetNode
  if (sourceNode?.dependencies?.some(dep => dep.id === targetId)) {
    relationships.push('DEPENDS_ON');
  }

  // If targetNode depends on sourceNode  
  if (targetNode?.dependencies?.some(dep => dep.id === sourceId)) {
    relationships.push('DEPENDS_ON');
  }

  // Remove duplicates and return
  return [...new Set(relationships)];
}

/**
 * Check if a specific relationship type already exists between two nodes
 */
export function relationshipExists(
  sourceId: string,
  targetId: string,
  relationshipType: string,
  edges: Edge[],
  workItems: WorkItem[]
): boolean {
  const existingRelationships = getExistingRelationships(sourceId, targetId, edges, workItems);
  return existingRelationships.includes(relationshipType);
}

/**
 * Get all nodes that already have a specific relationship with the source node
 * Returns array of node IDs that should be disabled/filtered out
 */
export function getNodesWithExistingRelationship(
  sourceId: string,
  relationshipType: string,
  edges: Edge[],
  workItems: WorkItem[]
): string[] {
  return workItems
    .filter(node => 
      node.id !== sourceId && 
      relationshipExists(sourceId, node.id, relationshipType, edges, workItems)
    )
    .map(node => node.id);
}

/**
 * Check if any of the selected nodes already have the given relationship with source
 * Used to disable relationship type buttons and connect button
 */
export function hasExistingRelationshipWithSelected(
  sourceId: string,
  selectedNodeIds: string[],
  relationshipType: string,
  edges: Edge[],
  workItems: WorkItem[]
): boolean {
  return selectedNodeIds.some(nodeId =>
    relationshipExists(sourceId, nodeId, relationshipType, edges, workItems)
  );
}

/**
 * Filter out nodes that already have the selected relationship
 * Used to remove disabled nodes from selection when relationship type changes
 */
export function filterValidSelectedNodes(
  sourceId: string,
  selectedNodeIds: string[],
  relationshipType: string,
  edges: Edge[],
  workItems: WorkItem[]
): string[] {
  return selectedNodeIds.filter(nodeId =>
    !relationshipExists(sourceId, nodeId, relationshipType, edges, workItems)
  );
}

/**
 * Professional Duplicate Detection and Management System
 */

export interface DuplicateConnection {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: string;
  duplicateType: 'exact' | 'circular' | 'redundant';
  conflictingWith: string[];
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

/**
 * Detect all duplicate connections in the graph
 */
export function detectDuplicateConnections(
  edges: Edge[],
  workItems: WorkItem[]
): DuplicateConnection[] {
  const duplicates: DuplicateConnection[] = [];

  // Track all connections for analysis
  const connectionMap = new Map<string, Array<{id: string, type: string, source: string, target: string}>>();

  // Add Edge entity connections
  edges.forEach(edge => {
    const key = `${edge.source.id}-${edge.target.id}`;
    const reverseKey = `${edge.target.id}-${edge.source.id}`;
    
    if (!connectionMap.has(key)) connectionMap.set(key, []);
    if (!connectionMap.has(reverseKey)) connectionMap.set(reverseKey, []);
    
    connectionMap.get(key)!.push({
      id: edge.id,
      type: edge.type,
      source: edge.source.id,
      target: edge.target.id
    });
  });

  // Add WorkItem dependency connections
  workItems.forEach(workItem => {
    workItem.dependencies?.forEach(dep => {
      const key = `${workItem.id}-${dep.id}`;
      if (!connectionMap.has(key)) connectionMap.set(key, []);
      
      connectionMap.get(key)!.push({
        id: `workitem-${workItem.id}-${dep.id}`,
        type: 'DEPENDS_ON',
        source: workItem.id,
        target: dep.id
      });
    });
  });

  // Analyze connections for duplicates
  connectionMap.forEach((connections, key) => {
    if (connections.length <= 1) return;

    const [sourceId, targetId] = key.split('-');
    const reverseKey = `${targetId}-${sourceId}`;
    const reverseConnections = connectionMap.get(reverseKey) || [];

    // Check for exact duplicates (same relationship type)
    const typeGroups = new Map<string, Array<typeof connections[0]>>();
    connections.forEach(conn => {
      if (!typeGroups.has(conn.type)) typeGroups.set(conn.type, []);
      typeGroups.get(conn.type)!.push(conn);
    });

    typeGroups.forEach((group, type) => {
      if (group.length > 1) {
        // Exact duplicate found
        group.slice(1).forEach((duplicate, index) => {
          duplicates.push({
            id: duplicate.id,
            sourceId,
            targetId,
            relationshipType: type,
            duplicateType: 'exact',
            conflictingWith: [group[0].id],
            severity: 'high',
            recommendation: `Remove duplicate ${type} relationship. Keep the original connection.`
          });
        });
      }
    });

    // Check for circular relationships
    reverseConnections.forEach(reverseConn => {
      connections.forEach(conn => {
        if (conn.type === reverseConn.type && isCircularRelationship(conn.type)) {
          duplicates.push({
            id: reverseConn.id,
            sourceId: reverseConn.source,
            targetId: reverseConn.target,
            relationshipType: reverseConn.type,
            duplicateType: 'circular',
            conflictingWith: [conn.id],
            severity: 'medium',
            recommendation: `Circular ${reverseConn.type} relationship detected. Consider keeping only one direction.`
          });
        }
      });
    });

    // Check for redundant relationships
    connections.forEach(conn => {
      const redundantTypes = getRedundantRelationshipTypes(conn.type);
      connections.forEach(otherConn => {
        if (conn.id !== otherConn.id && redundantTypes.includes(otherConn.type)) {
          duplicates.push({
            id: otherConn.id,
            sourceId,
            targetId,
            relationshipType: otherConn.type,
            duplicateType: 'redundant',
            conflictingWith: [conn.id],
            severity: 'low',
            recommendation: `${otherConn.type} is redundant when ${conn.type} exists. Consider consolidating.`
          });
        }
      });
    });
  });

  return duplicates;
}

/**
 * Check if a relationship type creates circular dependencies
 */
function isCircularRelationship(relationshipType: string): boolean {
  const circularTypes = ['DEPENDS_ON', 'BLOCKS', 'FOLLOWS'];
  return circularTypes.includes(relationshipType);
}

/**
 * Get relationship types that are redundant with the given type
 */
function getRedundantRelationshipTypes(relationshipType: string): string[] {
  const redundancyMap: Record<string, string[]> = {
    'DEPENDS_ON': ['RELATES_TO'],
    'BLOCKS': ['CONFLICTS_WITH'],
    'ENABLES': ['RELATES_TO'],
    'IS_PART_OF': ['RELATES_TO'],
    'FOLLOWS': ['DEPENDS_ON'],
    'VALIDATES': ['RELATES_TO']
  };
  
  return redundancyMap[relationshipType] || [];
}

/**
 * Get cleanup recommendations for duplicate connections
 */
export function getCleanupRecommendations(
  duplicates: DuplicateConnection[]
): Array<{
  action: 'remove' | 'consolidate' | 'review';
  priority: 'high' | 'medium' | 'low';
  description: string;
  affectedConnections: string[];
}> {
  const recommendations: Array<{
    action: 'remove' | 'consolidate' | 'review';
    priority: 'high' | 'medium' | 'low';
    description: string;
    affectedConnections: string[];
  }> = [];

  // Group duplicates by type
  const exactDuplicates = duplicates.filter(d => d.duplicateType === 'exact');
  const circularDuplicates = duplicates.filter(d => d.duplicateType === 'circular');
  const redundantDuplicates = duplicates.filter(d => d.duplicateType === 'redundant');

  // Exact duplicates - high priority removal
  if (exactDuplicates.length > 0) {
    recommendations.push({
      action: 'remove',
      priority: 'high',
      description: `Remove ${exactDuplicates.length} exact duplicate connection${exactDuplicates.length > 1 ? 's' : ''}`,
      affectedConnections: exactDuplicates.map(d => d.id)
    });
  }

  // Circular relationships - medium priority review
  if (circularDuplicates.length > 0) {
    recommendations.push({
      action: 'review',
      priority: 'medium',
      description: `Review ${circularDuplicates.length} circular relationship${circularDuplicates.length > 1 ? 's' : ''} - may cause dependency loops`,
      affectedConnections: circularDuplicates.map(d => d.id)
    });
  }

  // Redundant relationships - low priority consolidation
  if (redundantDuplicates.length > 0) {
    recommendations.push({
      action: 'consolidate',
      priority: 'low',
      description: `Consider consolidating ${redundantDuplicates.length} redundant relationship${redundantDuplicates.length > 1 ? 's' : ''}`,
      affectedConnections: redundantDuplicates.map(d => d.id)
    });
  }

  return recommendations;
}

/**
 * Validate a new connection before creation to prevent duplicates
 */
export function validateNewConnection(
  sourceId: string,
  targetId: string,
  relationshipType: string,
  edges: Edge[],
  workItems: WorkItem[]
): {
  isValid: boolean;
  reason?: string;
  suggestion?: string;
} {
  // Check for exact duplicate
  if (relationshipExists(sourceId, targetId, relationshipType, edges, workItems)) {
    return {
      isValid: false,
      reason: `${relationshipType} relationship already exists between these nodes`,
      suggestion: 'Choose a different relationship type or different target node'
    };
  }

  // Check for circular dependency
  if (isCircularRelationship(relationshipType) && 
      relationshipExists(targetId, sourceId, relationshipType, edges, workItems)) {
    return {
      isValid: false,
      reason: `This would create a circular ${relationshipType} relationship`,
      suggestion: 'Remove the existing reverse relationship first, or choose a different relationship type'
    };
  }

  // Check for redundant relationship
  const redundantTypes = getRedundantRelationshipTypes(relationshipType);
  const existingRedundant = redundantTypes.find(type => 
    relationshipExists(sourceId, targetId, type, edges, workItems)
  );
  
  if (existingRedundant) {
    return {
      isValid: true, // Allow but warn
      reason: `${relationshipType} may be redundant with existing ${existingRedundant} relationship`,
      suggestion: `Consider whether both ${relationshipType} and ${existingRedundant} are necessary`
    };
  }

  return { isValid: true };
}
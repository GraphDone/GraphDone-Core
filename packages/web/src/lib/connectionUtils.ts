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
  Bookmark 
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
  'Bookmark': Bookmark
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
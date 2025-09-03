/* 
DEPRECATED: This file has been replaced by centralized workItemConstants.tsx
All color schemes, icons, and utility functions are now in workItemConstants.tsx
This file is kept for reference but should not be used in new code.
TODO: Remove this file once migration is complete
*/

 
/*
/**
 * Unified Node Color System
 * Provides consistent color schemes across Status, Type, and Priority for visual harmony
 *

export interface ColorScheme {
  primary: string;       // Main color
  background: string;    // Background variant
  border: string;        // Border variant
  text: string;         // Text class
  icon: string;         // Icon class
  hex: string;          // Raw hex for D3/canvas
}

// Status Color System
export const STATUS_COLORS = {
  PROPOSED: {
    primary: 'text-cyan-400',
    background: 'bg-cyan-400/10',
    border: 'border-cyan-400/30',
    text: 'text-cyan-400',
    icon: 'text-cyan-400',
    hex: '#06b6d4'
  },
  PLANNED: {
    primary: 'text-purple-400', 
    background: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    text: 'text-purple-400',
    icon: 'text-purple-400',
    hex: '#a855f7'
  },
  IN_PROGRESS: {
    primary: 'text-yellow-400',
    background: 'bg-yellow-400/10', 
    border: 'border-yellow-400/30',
    text: 'text-yellow-400',
    icon: 'text-yellow-400',
    hex: '#eab308'
  },
  COMPLETED: {
    primary: 'text-green-400',
    background: 'bg-green-400/10',
    border: 'border-green-400/30', 
    text: 'text-green-400',
    icon: 'text-green-400',
    hex: '#22c55e'
  },
  BLOCKED: {
    primary: 'text-red-400',
    background: 'bg-red-400/10',
    border: 'border-red-400/30',
    text: 'text-red-400', 
    icon: 'text-red-400',
    hex: '#ef4444'
  }
} as const;

// Node Type Color System
export const TYPE_COLORS = {
  TASK: {
    primary: 'text-green-400',
    background: 'bg-green-400/10',
    border: 'border-green-400/30',
    text: 'text-green-400',
    icon: 'text-green-400',
    hex: '#4ade80'
  },
  FEATURE: {
    primary: 'text-sky-400',
    background: 'bg-sky-400/10',
    border: 'border-sky-400/30',
    text: 'text-sky-400',
    icon: 'text-sky-400', 
    hex: '#38bdf8'
  },
  EPIC: {
    primary: 'text-purple-400',
    background: 'bg-purple-400/10',
    border: 'border-purple-400/30',
    text: 'text-purple-400',
    icon: 'text-purple-400',
    hex: '#c084fc'
  },
  MILESTONE: {
    primary: 'text-orange-400',
    background: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    text: 'text-orange-400',
    icon: 'text-orange-400',
    hex: '#fb923c'
  },
  BUG: {
    primary: 'text-red-400',
    background: 'bg-red-400/10', 
    border: 'border-red-400/30',
    text: 'text-red-400',
    icon: 'text-red-400',
    hex: '#ef4444'
  },
  RESEARCH: {
    primary: 'text-indigo-400',
    background: 'bg-indigo-400/10',
    border: 'border-indigo-400/30',
    text: 'text-indigo-400',
    icon: 'text-indigo-400', 
    hex: '#6366f1'
  }
} as const;

// Priority Color System
export const PRIORITY_COLORS = {
  CRITICAL: {
    primary: 'text-red-400',
    background: 'bg-red-400/10',
    border: 'border-red-400/30',
    text: 'text-red-400',
    icon: 'text-red-400',
    hex: '#ef4444'
  },
  HIGH: {
    primary: 'text-orange-400',
    background: 'bg-orange-400/10',
    border: 'border-orange-400/30',
    text: 'text-orange-400', 
    icon: 'text-orange-400',
    hex: '#f97316'
  },
  MODERATE: {
    primary: 'text-yellow-400',
    background: 'bg-yellow-400/10',
    border: 'border-yellow-400/30',
    text: 'text-yellow-400',
    icon: 'text-yellow-400',
    hex: '#eab308'
  },
  LOW: {
    primary: 'text-blue-400',
    background: 'bg-blue-400/10',
    border: 'border-blue-400/30',
    text: 'text-blue-400',
    icon: 'text-blue-400',
    hex: '#3b82f6'
  },
  MINIMAL: {
    primary: 'text-gray-400',
    background: 'bg-gray-400/10',
    border: 'border-gray-400/30', 
    text: 'text-gray-400',
    icon: 'text-gray-400',
    hex: '#6b7280'
  }
} as const;

// Helper functions
export function getStatusColor(status: string): ColorScheme {
  return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || STATUS_COLORS.PROPOSED;
}

export function getTypeColor(type: string): ColorScheme {
  return TYPE_COLORS[type as keyof typeof TYPE_COLORS] || TYPE_COLORS.TASK;
}

export function getPriorityColor(priority: number): ColorScheme {
  if (priority >= 0.8) return PRIORITY_COLORS.CRITICAL;
  if (priority >= 0.6) return PRIORITY_COLORS.HIGH; 
  if (priority >= 0.4) return PRIORITY_COLORS.MODERATE;
  if (priority >= 0.2) return PRIORITY_COLORS.LOW;
  return PRIORITY_COLORS.MINIMAL;
}

export function getPriorityColorByLevel(level: string): ColorScheme {
  return PRIORITY_COLORS[level as keyof typeof PRIORITY_COLORS] || PRIORITY_COLORS.MINIMAL;
}

// Color similarity helpers for smart node suggestions
export function getComplementaryColors(baseColor: string): ColorScheme[] {
  const colorMap = {
    // Red family
    '#ef4444': [PRIORITY_COLORS.CRITICAL, STATUS_COLORS.BLOCKED, TYPE_COLORS.BUG],
    // Orange family  
    '#f97316': [PRIORITY_COLORS.HIGH, TYPE_COLORS.MILESTONE],
    '#fb923c': [TYPE_COLORS.MILESTONE, PRIORITY_COLORS.HIGH],
    // Yellow family
    '#eab308': [PRIORITY_COLORS.MODERATE, STATUS_COLORS.IN_PROGRESS],
    // Green family
    '#22c55e': [STATUS_COLORS.COMPLETED],
    '#4ade80': [TYPE_COLORS.TASK, STATUS_COLORS.COMPLETED],
    // Blue family
    '#3b82f6': [PRIORITY_COLORS.LOW],
    '#38bdf8': [TYPE_COLORS.FEATURE],
    '#06b6d4': [STATUS_COLORS.PROPOSED],
    // Purple family
    '#a855f7': [STATUS_COLORS.PLANNED],
    '#c084fc': [TYPE_COLORS.EPIC],
    '#6366f1': [TYPE_COLORS.RESEARCH],
    // Gray family
    '#6b7280': [PRIORITY_COLORS.MINIMAL]
  };
  
  return colorMap[baseColor as keyof typeof colorMap] || [];
}

// Smart suggestions based on existing node colors
export function suggestSimilarNodes(existingNodes: Array<{status: string, type: string, priority: number}>): {
  suggestedStatus: string[];
  suggestedTypes: string[]; 
  suggestedPriorities: string[];
} {
  const statusCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();
  const priorityCounts = new Map<string, number>();
  
  existingNodes.forEach(node => {
    statusCounts.set(node.status, (statusCounts.get(node.status) || 0) + 1);
    typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
    
    const priorityLevel = node.priority >= 0.8 ? 'CRITICAL' :
                         node.priority >= 0.6 ? 'HIGH' :
                         node.priority >= 0.4 ? 'MODERATE' :
                         node.priority >= 0.2 ? 'LOW' : 'MINIMAL';
    priorityCounts.set(priorityLevel, (priorityCounts.get(priorityLevel) || 0) + 1);
  });
  
  // Sort by frequency and return top suggestions
  const sortedStatus = Array.from(statusCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .map(([status]) => status);
    
  const sortedTypes = Array.from(typeCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .map(([type]) => type);
    
  const sortedPriorities = Array.from(priorityCounts.entries())
    .sort(([,a], [,b]) => b - a)
    .map(([priority]) => priority);
  
  return {
    suggestedStatus: sortedStatus.slice(0, 3),
    suggestedTypes: sortedTypes.slice(0, 3),
    suggestedPriorities: sortedPriorities.slice(0, 3)
  };
}

// Visual similarity scoring for UI grouping
export function getColorSimilarityScore(color1: string, color2: string): number {
  // Simple HSL distance calculation for color similarity
  const hslDistance = (hex1: string, hex2: string): number => {
    // Convert hex to RGB, then to HSL and calculate distance
    // Simplified for demonstration - would need proper color space conversion
    const r1 = parseInt(hex1.substr(1, 2), 16);
    const g1 = parseInt(hex1.substr(3, 2), 16);
    const b1 = parseInt(hex1.substr(5, 2), 16);
    
    const r2 = parseInt(hex2.substr(1, 2), 16);
    const g2 = parseInt(hex2.substr(3, 2), 16);
    const b2 = parseInt(hex2.substr(5, 2), 16);
    
    // Simple RGB distance (0-1 scale)
    const distance = Math.sqrt(
      Math.pow(r1 - r2, 2) + 
      Math.pow(g1 - g2, 2) + 
      Math.pow(b1 - b2, 2)
    ) / (255 * Math.sqrt(3));
    
    return 1 - distance; // Convert to similarity score
  };
  
  return hslDistance(color1, color2);
}
*/
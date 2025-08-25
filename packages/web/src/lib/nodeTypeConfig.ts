// Centralized node type configuration for consistent colors across the app
export interface NodeTypeConfig {
  value: string;
  label: string;
  color: string;
  hexColor: string;
}

export const NODE_TYPE_CONFIG: Record<string, NodeTypeConfig> = {
  // Strategic Level - Fuchsia
  EPIC: {
    value: 'EPIC',
    label: 'Epic',
    color: 'text-fuchsia-400',
    hexColor: '#e879f9' // fuchsia-400
  },
  // Milestone - Orange
  MILESTONE: {
    value: 'MILESTONE',
    label: 'Milestone',
    color: 'text-orange-400',
    hexColor: '#fb923c' // orange-400
  },
  // Outcome - Indigo
  OUTCOME: {
    value: 'OUTCOME',
    label: 'Outcome',
    color: 'text-indigo-400',
    hexColor: '#818cf8' // indigo-400
  },
  // Feature - Sky
  FEATURE: {
    value: 'FEATURE',
    label: 'Feature',
    color: 'text-sky-400',
    hexColor: '#38bdf8' // sky-400
  },
  // Task - Green
  TASK: {
    value: 'TASK',
    label: 'Task',
    color: 'text-green-400',
    hexColor: '#4ade80' // green-400
  },
  // Bug - Red
  BUG: {
    value: 'BUG',
    label: 'Bug',
    color: 'text-red-500',
    hexColor: '#ef4444' // red-500
  },
  // Idea - Yellow
  IDEA: {
    value: 'IDEA',
    label: 'Idea',
    color: 'text-yellow-300',
    hexColor: '#fde047' // yellow-300
  },
  // Research - Teal
  RESEARCH: {
    value: 'RESEARCH',
    label: 'Research',
    color: 'text-teal-400',
    hexColor: '#2dd4bf' // teal-400
  }
};

/**
 * Get the hex color for a node type
 * @param type - The node type (e.g., 'EPIC', 'TASK', etc.)
 * @returns The hex color string, or default gray if type not found
 */
export function getNodeColor(type: string): string {
  const color = NODE_TYPE_CONFIG[type]?.hexColor || '#6b7280'; // gray-500 as default
  console.log('getNodeColor - Type:', type, 'Config:', NODE_TYPE_CONFIG[type], 'Color:', color);
  return color;
}

/**
 * Get the Tailwind color class for a node type
 * @param type - The node type
 * @returns The Tailwind color class string
 */
export function getNodeColorClass(type: string): string {
  return NODE_TYPE_CONFIG[type]?.color || 'text-gray-500';
}
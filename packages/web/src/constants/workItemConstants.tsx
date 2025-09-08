import React from 'react';
import { 
  ClipboardList, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  XCircle,
  Eye,
  Pause,
  Layers, 
  Trophy, 
  Target, 
  Sparkles, 
  ListTodo, 
  AlertTriangle, 
  Lightbulb, 
  Microscope,
  Flame,
  Zap,
  Triangle,
  Circle,
  ArrowDown,
  Hexagon,
  // Relationship Icons
  ArrowLeft,
  Ban,
  Link2,
  Folder,
  ArrowRight,
  Split,
  Copy,
  Shield,
  Bookmark,
  Package,
  // Default Icon
  Square,
  Paperclip,
  Eraser
} from 'lucide-react';

// ============================
// RE-EXPORT ICON COMPONENTS
// ============================

// Export all Lucide React icons used in the application
// This provides a single import point for all icons to maintain consistency
export {
  // Status Icons
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Eye,
  Pause,
  
  // Type Icons
  Layers,
  Trophy,
  Target,
  Sparkles,
  ListTodo,
  AlertTriangle,
  Lightbulb,
  Microscope,
  
  // Priority Icons
  Flame,
  Zap,
  Triangle,
  Circle,
  ArrowDown,
  Hexagon,
  
  // Relationship Icons
  ArrowLeft,
  Ban,
  Link2,
  Folder,
  ArrowRight,
  Split,
  Copy,
  Shield,
  Bookmark,
  Package,
  
  // Default Icon
  Square,
  Paperclip
} from 'lucide-react';

// ============================
// CORE TYPE DEFINITIONS  
// ============================

// Work item types define what kind of work this represents
export type WorkItemType = 'EPIC' | 'MILESTONE' | 'OUTCOME' | 'FEATURE' | 'TASK' | 'BUG' | 'IDEA' | 'RESEARCH' | 'DEFAULT';

// Work item statuses represent the current state of progress (9 total statuses)
// NOT_STARTED is the default status for new items
export type WorkItemStatus = 'NOT_STARTED' | 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'IN_REVIEW' | 'BLOCKED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';

// Priority levels map to numeric priority ranges (0.0 - 1.0)
export type PriorityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'minimal';

// ============================
// INTERFACE DEFINITIONS
// ============================

// Configuration interface for work item types (Epic, Task, Bug, etc.)
export interface TypeOption {
  value: WorkItemType | 'all';
  label: string; // Display name for UI
  description?: string; // Tooltip/help text
  icon: React.ComponentType<{ className?: string }> | null; // Lucide React icon
  color: string; // Tailwind text color class
  bgColor?: string; // Tailwind background color class
  borderColor?: string; // Tailwind border color class
  hexColor: string; // Raw hex value for D3/SVG usage
}

// Configuration interface for work item statuses (Not Started, In Progress, etc.)
export interface StatusOption {
  value: WorkItemStatus | 'all';
  label: string; // Display name for UI
  description?: string; // Tooltip/help text
  icon: React.ComponentType<{ className?: string }> | null; // Lucide React icon
  color: string; // Tailwind text color class
  bgColor?: string; // Tailwind background color class
  borderColor?: string; // Tailwind border color class
  dotColor?: string; // Special dot/indicator color for status
  hexColor: string; // Raw hex value for D3/SVG usage
}

// Configuration interface for priority levels (Critical, High, Low, etc.)
export interface PriorityOption {
  value: PriorityLevel | 'all';
  label: string; // Display name for UI
  description?: string; // Priority range description (e.g., "80% - 100%")
  icon: React.ComponentType<{ className?: string }> | null; // Lucide React icon
  color: string; // Tailwind text color class
  bgColor?: string; // Tailwind background color class
  borderColor?: string; // Tailwind border color class
  hexColor: string; // Raw hex value for D3/SVG usage
  threshold: { // Numeric priority range this level represents
    min: number; // Minimum priority value (0.0 - 1.0)
    max: number; // Maximum priority value (0.0 - 1.0)
  };
}

// ============================
// WORK ITEM TYPES CONFIGURATION
// ============================

export const WORK_ITEM_TYPES: Record<WorkItemType, TypeOption> = {
  DEFAULT: {
    value: 'DEFAULT',
    label: 'Default',
    description: 'Generic work item',
    icon: Eraser,
    color: 'text-gray-300',
    bgColor: 'bg-gray-600/20',
    borderColor: 'border-gray-500/30',
    hexColor: '#9ca3af'
  },
  EPIC: {
    value: 'EPIC',
    label: 'Epic',
    description: 'Large initiative spanning multiple deliverables',
    icon: Layers,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-400/10',
    borderColor: 'border-fuchsia-400/30',
    hexColor: '#e879f9'
  },
  MILESTONE: {
    value: 'MILESTONE',
    label: 'Milestone',
    description: 'Key project checkpoint',
    icon: Trophy,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    hexColor: '#fb923c'
  },
  OUTCOME: {
    value: 'OUTCOME',
    label: 'Outcome',
    description: 'Expected result or deliverable',
    icon: Target,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-400/10',
    borderColor: 'border-indigo-400/30',
    hexColor: '#818cf8'
  },
  FEATURE: {
    value: 'FEATURE',
    label: 'Feature',
    description: 'New functionality or capability',
    icon: Sparkles,
    color: 'text-sky-400',
    bgColor: 'bg-sky-400/10',
    borderColor: 'border-sky-400/30',
    hexColor: '#38bdf8'
  },
  TASK: {
    value: 'TASK',
    label: 'Task',
    description: 'Specific work item to be completed',
    icon: ListTodo,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/30',
    hexColor: '#4ade80'
  },
  BUG: {
    value: 'BUG',
    label: 'Bug',
    description: 'Software defect requiring resolution',
    icon: AlertTriangle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    hexColor: '#ef4444'
  },
  IDEA: {
    value: 'IDEA',
    label: 'Idea',
    description: 'Concept or proposal for future development',
    icon: Lightbulb,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    hexColor: '#facc15'
  },
  RESEARCH: {
    value: 'RESEARCH',
    label: 'Research',
    description: 'Investigation or analysis work',
    icon: Microscope,
    color: 'text-teal-400',
    bgColor: 'bg-teal-400/10',
    borderColor: 'border-teal-400/30',
    hexColor: '#2dd4bf'
  }
};

// ============================
// STATUS CONFIGURATION
// ============================

// Complete 9-status system for work items
// Order matters: NOT_STARTED is first/default, followed by typical workflow progression
export const WORK_ITEM_STATUSES: Record<WorkItemStatus, StatusOption> = {
  NOT_STARTED: {
    value: 'NOT_STARTED',
    label: 'Not Started',
    description: 'Waiting to begin',
    icon: Hexagon,
    color: 'text-gray-300',
    bgColor: 'bg-gray-600/20',
    borderColor: 'border-gray-500/30',
    dotColor: 'bg-gray-400',
    hexColor: '#9ca3af'
  },
  PROPOSED: {
    value: 'PROPOSED',
    label: 'Proposed',
    description: 'Idea added',
    icon: ClipboardList,
    color: 'text-cyan-400',
    bgColor: 'bg-cyan-400/10',
    borderColor: 'border-cyan-400/30',
    dotColor: 'bg-cyan-400',
    hexColor: '#06b6d4'
  },
  PLANNED: {
    value: 'PLANNED',
    label: 'Planned',
    description: 'Agreed to do',
    icon: Calendar,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/30',
    dotColor: 'bg-purple-400',
    hexColor: '#a855f7'
  },
  IN_PROGRESS: {
    value: 'IN_PROGRESS',
    label: 'In Progress',
    description: 'Being worked on',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    dotColor: 'bg-yellow-400',
    hexColor: '#eab308'
  },
  IN_REVIEW: {
    value: 'IN_REVIEW',
    label: 'In Review',
    description: 'Needs checking/approval',
    icon: Eye,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    dotColor: 'bg-blue-400',
    hexColor: '#3b82f6'
  },
  BLOCKED: {
    value: 'BLOCKED',
    label: 'Blocked',
    description: 'Can\'t move forward',
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-500',
    hexColor: '#ef4444'
  },
  ON_HOLD: {
    value: 'ON_HOLD',
    label: 'On Hold',
    description: 'Paused for now',
    icon: Pause,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    dotColor: 'bg-orange-400',
    hexColor: '#fb923c'
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Finished successfully',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/30',
    dotColor: 'bg-green-400',
    hexColor: '#22c55e'
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Stopped, won\'t do',
    icon: XCircle,
    color: 'text-pink-500',
    bgColor: 'bg-pink-500/10',
    borderColor: 'border-pink-500/30',
    dotColor: 'bg-pink-500',
    hexColor: '#ff1493'
  }
};

// ============================
// PRIORITY CONFIGURATION
// ============================

export const WORK_ITEM_PRIORITIES: Record<PriorityLevel, PriorityOption> = {
  critical: {
    value: 'critical',
    label: 'Critical',
    description: '80% - 100%',
    icon: Flame,
    color: 'text-red-400',
    bgColor: 'bg-red-400/10',
    borderColor: 'border-red-400/30',
    hexColor: '#ef4444',
    threshold: { min: 0.8, max: 1.0 }
  },
  high: {
    value: 'high',
    label: 'High',
    description: '60% - 79%',
    icon: Zap,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/30',
    hexColor: '#f97316',
    threshold: { min: 0.6, max: 0.79 }
  },
  moderate: {
    value: 'moderate',
    label: 'Moderate',
    description: '40% - 59%',
    icon: Triangle,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    hexColor: '#eab308',
    threshold: { min: 0.4, max: 0.59 }
  },
  low: {
    value: 'low',
    label: 'Low',
    description: '20% - 39%',
    icon: Circle,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/30',
    hexColor: '#3b82f6',
    threshold: { min: 0.2, max: 0.39 }
  },
  minimal: {
    value: 'minimal',
    label: 'Minimal',
    description: '0% - 19%',
    icon: ArrowDown,
    color: 'text-gray-400',
    bgColor: 'bg-gray-400/10',
    borderColor: 'border-gray-400/30',
    hexColor: '#6b7280',
    threshold: { min: 0.0, max: 0.19 }
  }
};

// ============================
// FILTER OPTIONS ARRAYS
// ============================

export const TYPE_OPTIONS: TypeOption[] = [
  { value: 'all', label: 'All Type', icon: null, color: 'text-gray-400', hexColor: '#9ca3af' },
  WORK_ITEM_TYPES.DEFAULT,
  ...Object.values(WORK_ITEM_TYPES).filter(type => type.value !== 'DEFAULT')
];

export const STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'All Status', icon: null, color: 'text-gray-400', hexColor: '#9ca3af' },
  ...Object.values(WORK_ITEM_STATUSES)
];

export const PRIORITY_OPTIONS: PriorityOption[] = [
  { 
    value: 'all', 
    label: 'All Priority', 
    icon: null, 
    color: 'text-gray-400', 
    hexColor: '#9ca3af',
    threshold: { min: 0.0, max: 1.0 }
  },
  ...Object.values(WORK_ITEM_PRIORITIES)
];

// ============================
// UTILITY FUNCTIONS
// ============================

// Get type configuration
export const getTypeConfig = (type: WorkItemType): TypeOption => {
  return WORK_ITEM_TYPES[type] || WORK_ITEM_TYPES.DEFAULT;
};

// Get status configuration
export const getStatusConfig = (status: WorkItemStatus): StatusOption => {
  return WORK_ITEM_STATUSES[status] || WORK_ITEM_STATUSES.NOT_STARTED;
};

// Get priority configuration based on numeric priority value
export const getPriorityConfig = (priorityValue: number): PriorityOption => {
  if (priorityValue >= 0.8) return WORK_ITEM_PRIORITIES.critical;
  if (priorityValue >= 0.6) return WORK_ITEM_PRIORITIES.high;
  if (priorityValue >= 0.4) return WORK_ITEM_PRIORITIES.moderate;
  if (priorityValue >= 0.2) return WORK_ITEM_PRIORITIES.low;
  return WORK_ITEM_PRIORITIES.minimal;
};

// Get priority level from numeric value
export const getPriorityLevel = (priorityValue: number): PriorityLevel => {
  return getPriorityConfig(priorityValue).value as PriorityLevel;
};

// Get status completion percentage (for workflow progression visualization)
export const getStatusCompletionPercentage = (status: WorkItemStatus): number => {
  switch (status) {
    case 'NOT_STARTED': return 0;    // Starting point
    case 'PROPOSED': return 10;      // Idea submitted
    case 'PLANNED': return 25;       // Planning complete
    case 'IN_PROGRESS': return 60;   // Actively working
    case 'IN_REVIEW': return 85;     // Nearly done, awaiting approval
    case 'BLOCKED': return 40;       // Progress halted (maintain current progress)
    case 'ON_HOLD': return 30;       // Paused (maintain current progress)
    case 'COMPLETED': return 100;    // Fully complete
    case 'CANCELLED': return 0;      // Not completed
    default: return 0;
  }
};

// Legacy compatibility functions (for gradual migration)
export const getTypeColor = (type: WorkItemType): string => {
  return getTypeConfig(type).color;
};

export const getStatusColor = (status: WorkItemStatus): string => {
  return getStatusConfig(status).color;
};

export const getPriorityColor = (priorityValue: number): string => {
  return getPriorityConfig(priorityValue).color;
};

export const getTypeIcon = (type: WorkItemType): React.ComponentType<{ className?: string }> | null => {
  return getTypeConfig(type).icon;
};

export const getStatusIcon = (status: WorkItemStatus): React.ComponentType<{ className?: string }> | null => {
  return getStatusConfig(status).icon;
};

export const getPriorityIcon = (priorityValue: number): React.ComponentType<{ className?: string }> | null => {
  return getPriorityConfig(priorityValue).icon;
};

// JSX Element Helper Functions (for components expecting JSX elements directly)
export const getTypeIconElement = (type: WorkItemType, className: string = "h-4 w-4"): React.ReactNode => {
  const IconComponent = getTypeIcon(type);
  const config = getTypeConfig(type);
  const fullClassName = `${className} ${config.color}`;
  return IconComponent ? <IconComponent className={fullClassName} /> : null;
};

export const getStatusIconElement = (status: WorkItemStatus, className: string = "h-4 w-4"): React.ReactNode => {
  const IconComponent = getStatusIcon(status);
  const config = getStatusConfig(status);
  const fullClassName = `${className} ${config.color}`;
  return IconComponent ? <IconComponent className={fullClassName} /> : null;
};

export const getPriorityIconElement = (priorityValue: number, className: string = "h-4 w-4"): React.ReactNode => {
  const IconComponent = getPriorityIcon(priorityValue);
  const config = getPriorityConfig(priorityValue);
  const fullClassName = `${className} ${config.color}`;
  return IconComponent ? <IconComponent className={fullClassName} /> : null;
};

// Enhanced color scheme functions (replaces scattered getColorScheme functions)
export const getTypeColorScheme = (type: WorkItemType) => {
  const config = getTypeConfig(type);
  return {
    text: config.color,
    background: config.bgColor || `${config.color.replace('text-', 'bg-')}/10`,
    border: config.borderColor || `border-${config.color.replace('text-', '')}/30`,
    hex: config.hexColor
  };
};

export const getStatusColorScheme = (status: WorkItemStatus) => {
  const config = getStatusConfig(status);
  return {
    text: config.color,
    background: config.bgColor || `${config.color.replace('text-', 'bg-')}/10`,
    border: config.borderColor || `border-${config.color.replace('text-', '')}/30`,
    hex: config.hexColor,
    dot: config.dotColor || config.color.replace('text-', 'bg-')
  };
};

export const getPriorityColorScheme = (priorityValue: number) => {
  const config = getPriorityConfig(priorityValue);
  return {
    text: config.color,
    background: config.bgColor || `${config.color.replace('text-', 'bg-')}/10`,
    border: config.borderColor || `border-${config.color.replace('text-', '')}/30`,
    hex: config.hexColor,
    level: config.value,
    description: config.description
  };
};

// ============================
// DEFAULT NODE CONFIGURATION
// ============================

// Default values for creating new work items
export const DEFAULT_NODE_CONFIG = {
  title: 'New Node', // Default title for new nodes
  type: 'DEFAULT' as WorkItemType, // Default type (generic work item)
  status: 'NOT_STARTED' as WorkItemStatus, // Default status (beginning of workflow)
  priority: 0.0, // Priority score (0.0-1.0)
  description: '' // Empty description by default
};

// ============================
// VALIDATION HELPERS
// ============================

// Check if a string is a valid work item type
export const isValidWorkItemType = (type: string): type is WorkItemType => {
  return Object.keys(WORK_ITEM_TYPES).includes(type as WorkItemType);
};

// Check if a string is a valid work item status
export const isValidWorkItemStatus = (status: string): status is WorkItemStatus => {
  return Object.keys(WORK_ITEM_STATUSES).includes(status as WorkItemStatus);
};

// Check if a string is a valid priority level
export const isValidPriorityLevel = (priority: string): priority is PriorityLevel => {
  return Object.keys(WORK_ITEM_PRIORITIES).includes(priority as PriorityLevel);
};

// ============================
// RELATIONSHIP TYPES SYSTEM
// ============================

// All possible relationship types between work items
// These define how nodes connect to each other in the graph
export type RelationshipType = 
  | 'DEPENDS_ON'      // Source needs target to be completed first
  | 'BLOCKS'          // Source prevents target from progressing
  | 'ENABLES'         // Source makes target easier/possible
  | 'RELATES_TO'      // General relationship or similarity
  | 'IS_PART_OF'      // Source is component of target
  | 'FOLLOWS'         // Source should be done after target (sequence)
  | 'PARALLEL_WITH'   // Source can be done simultaneously with target
  | 'DUPLICATES'      // Source duplicates effort of target
  | 'CONFLICTS_WITH'  // Source has opposing goals to target
  | 'VALIDATES'       // Source tests/validates target
  | 'REFERENCES'      // Source references/cites target
  | 'CONTAINS'        // Source contains/encompasses target
  | 'DEFAULT_EDGE';   // Generic connection

export interface RelationshipOption {
  type: RelationshipType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  hexColor: string;
}

export const RELATIONSHIP_TYPES: Record<RelationshipType, RelationshipOption> = {
  DEFAULT_EDGE: {
    type: 'DEFAULT_EDGE',
    label: 'Connected',
    description: 'Simple connection between nodes',
    icon: Paperclip,
    color: 'text-gray-400',
    hexColor: '#9ca3af'
  },
  DEPENDS_ON: {
    type: 'DEPENDS_ON',
    label: 'Depends On',
    description: 'Source node depends on target node',
    icon: ArrowLeft,
    color: 'text-emerald-400',
    hexColor: '#34d399'
  },
  BLOCKS: {
    type: 'BLOCKS',
    label: 'Blocks',
    description: 'Source node blocks target node',
    icon: Ban,
    color: 'text-red-400',
    hexColor: '#f87171'
  },
  ENABLES: {
    type: 'ENABLES',
    label: 'Enables',
    description: 'Source node enables target node',
    icon: CheckCircle,
    color: 'text-green-400',
    hexColor: '#4ade80'
  },
  RELATES_TO: {
    type: 'RELATES_TO',
    label: 'Related To',
    description: 'Source node relates to target node',
    icon: Link2,
    color: 'text-purple-400',
    hexColor: '#c084fc'
  },
  IS_PART_OF: {
    type: 'IS_PART_OF',
    label: 'Is Part Of',
    description: 'Source node is part of target node',
    icon: Folder,
    color: 'text-orange-400',
    hexColor: '#fb923c'
  },
  FOLLOWS: {
    type: 'FOLLOWS',
    label: 'Follows',
    description: 'Source node follows target node',
    icon: ArrowRight,
    color: 'text-indigo-400',
    hexColor: '#818cf8'
  },
  PARALLEL_WITH: {
    type: 'PARALLEL_WITH',
    label: 'Parallel With',
    description: 'Source node runs parallel to target',
    icon: Split,
    color: 'text-teal-400',
    hexColor: '#2dd4bf'
  },
  DUPLICATES: {
    type: 'DUPLICATES',
    label: 'Duplicates',
    description: 'Source node duplicates target node',
    icon: Copy,
    color: 'text-yellow-400',
    hexColor: '#facc15'
  },
  CONFLICTS_WITH: {
    type: 'CONFLICTS_WITH',
    label: 'Conflicts With',
    description: 'Source node conflicts with target',
    icon: Zap,
    color: 'text-red-500',
    hexColor: '#ef4444'
  },
  VALIDATES: {
    type: 'VALIDATES',
    label: 'Validates',
    description: 'Source node validates target node',
    icon: Shield,
    color: 'text-emerald-400',
    hexColor: '#34d399'
  },
  REFERENCES: {
    type: 'REFERENCES',
    label: 'References',
    description: 'Source node references target node',
    icon: Bookmark,
    color: 'text-slate-400',
    hexColor: '#94a3b8'
  },
  CONTAINS: {
    type: 'CONTAINS',
    label: 'Contains',
    description: 'Source node contains target node',
    icon: Package,
    color: 'text-blue-400',
    hexColor: '#60a5fa'
  },
};

// ============================
// RELATIONSHIP UTILITY FUNCTIONS
// ============================

// Get relationship configuration
export const getRelationshipConfig = (type: RelationshipType): RelationshipOption => {
  return RELATIONSHIP_TYPES[type] || RELATIONSHIP_TYPES.RELATES_TO;
};

// Get relationship icon component
export const getRelationshipIcon = (type: RelationshipType): React.ComponentType<{ className?: string }> | null => {
  return getRelationshipConfig(type).icon;
};

// Get relationship icon as JSX element with proper styling
export const getRelationshipIconElement = (type: RelationshipType, className: string = "h-4 w-4"): React.ReactNode => {
  const IconComponent = getRelationshipIcon(type);
  const config = getRelationshipConfig(type);
  const fullClassName = `${className} ${config.color}`;
  return IconComponent ? <IconComponent className={fullClassName} /> : null;
};

// Get relationship icon component for D3/SVG usage
export const getRelationshipIconComponent = (type: RelationshipType): React.ComponentType<{ className?: string }> => {
  const IconComponent = getRelationshipIcon(type);
  return IconComponent || Link2; // Fallback to Link2 if not found
};

// Get relationship icon component and color for D3 usage
export const getRelationshipIconForD3 = (type: RelationshipType) => {
  const config = getRelationshipConfig(type);
  return {
    IconComponent: config.icon,
    color: config.color,
    hexColor: config.hexColor
  };
};

// Get appropriate arrow for relationship type
export const getRelationshipArrow = (type: RelationshipType): '→' | '↔' | '—' => {
  const bidirectionalTypes: RelationshipType[] = ['RELATES_TO', 'PARALLEL_WITH', 'CONFLICTS_WITH'];
  const undirectedTypes: RelationshipType[] = ['DUPLICATES'];
  
  if (bidirectionalTypes.includes(type)) return '↔';
  if (undirectedTypes.includes(type)) return '—';
  return '→';
};

// Get full descriptive text for tooltip
export const getRelationshipDescription = (
  sourceTitle: string, 
  targetTitle: string, 
  type: RelationshipType, 
  isIncoming: boolean = false
): string => {
  const config = getRelationshipConfig(type);
  const arrow = getRelationshipArrow(type);
  
  if (isIncoming && arrow === '→') {
    return `${targetTitle} ${config.label.toLowerCase()} ${sourceTitle}`;
  }
  return `${sourceTitle} ${config.label.toLowerCase()} ${targetTitle}`;
};

// Get relationship color scheme
export const getRelationshipColorScheme = (type: RelationshipType) => {
  const config = getRelationshipConfig(type);
  return {
    text: config.color,
    background: `${config.color.replace('text-', 'bg-')}/10`,
    border: `border-${config.color.replace('text-', '')}/30`,
    hex: config.hexColor
  };
};

// Convert relationship types array for dropdown/filter usage
export const RELATIONSHIP_OPTIONS: RelationshipOption[] = Object.values(RELATIONSHIP_TYPES);

// Legacy compatibility function (matches existing connectionUtils.ts interface)
export function getRelationshipIconLegacy(iconName: string, className: string = "h-4 w-4"): React.ReactNode {
  // Map old string-based icon names to new system
  const iconMap: Record<string, RelationshipType> = {
    'ArrowLeft': 'DEPENDS_ON',
    'Ban': 'BLOCKS',
    'CheckCircle': 'ENABLES',
    'Link2': 'RELATES_TO',
    'Folder': 'IS_PART_OF',
    'ArrowRight': 'FOLLOWS',
    'Split': 'PARALLEL_WITH',
    'Copy': 'DUPLICATES',
    'Zap': 'CONFLICTS_WITH',
    'Shield': 'VALIDATES',
    'Bookmark': 'REFERENCES',
    'Package': 'CONTAINS'
  };
  
  const relationshipType = iconMap[iconName];
  return relationshipType ? getRelationshipIconElement(relationshipType, className) : null;
}

// ============================
// UTILITY COLOR SCHEMES
// ============================

// Contributor avatar colors for consistent user representation
export const CONTRIBUTOR_COLORS = [
  'bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-pink-500',
  'bg-indigo-500', 'bg-yellow-500', 'bg-red-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-violet-500'
];

// Due date color schemes for time-based status indicators
export const DUE_DATE_COLORS = {
  overdue: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-400',
    textSecondary: 'text-red-600 dark:text-red-400'
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800',
    text: 'text-amber-800 dark:text-amber-400',
    textSecondary: 'text-amber-600 dark:text-amber-400'
  },
  normal: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-400',
    textSecondary: 'text-blue-600 dark:text-blue-400'
  },
  none: {
    bg: 'bg-gray-100 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-400',
    textSecondary: 'text-gray-500 dark:text-gray-400'
  }
};

// Utility functions for contributor colors
export const getContributorColor = (name: string): string => {
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return CONTRIBUTOR_COLORS[hash % CONTRIBUTOR_COLORS.length];
};

// Utility function for due date colors
export const getDueDateColorScheme = (dueDate?: string) => {
  if (!dueDate) return DUE_DATE_COLORS.none;
  
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) return DUE_DATE_COLORS.overdue;
  if (diffDays <= 7) return DUE_DATE_COLORS.warning;
  return DUE_DATE_COLORS.normal;
};

// ============================
// PROJECT HEALTH COLORS
// ============================

// Health indicator colors based on completion percentage
export const PROJECT_HEALTH_COLORS = {
  outstanding: '#22c55e', // 90%+ completion
  excellent: '#3b82f6',   // 70%+ completion  
  good: '#a855f7',        // 50%+ completion
  fair: '#f59e0b',        // 30%+ completion
  critical: '#f43f5e',    // <30% completion
  noData: '#6b7280'       // No data available
};

// Get project health color based on completion percentage
export const getProjectHealthColor = (completionRatio: number): string => {
  if (completionRatio >= 0.9) return PROJECT_HEALTH_COLORS.outstanding;
  if (completionRatio >= 0.7) return PROJECT_HEALTH_COLORS.excellent;
  if (completionRatio >= 0.5) return PROJECT_HEALTH_COLORS.good;
  if (completionRatio >= 0.3) return PROJECT_HEALTH_COLORS.fair;
  return PROJECT_HEALTH_COLORS.critical;
};

// Get project health status text
export const getProjectHealthStatus = (completionRatio: number): string => {
  if (completionRatio >= 0.9) return 'Outstanding 🌟';
  if (completionRatio >= 0.7) return 'Excellent ✨';
  if (completionRatio >= 0.5) return 'Good 👍';
  if (completionRatio >= 0.3) return 'Fair ⚠️';
  return 'Critical 🚨';
};

// ============================
// CENTRALIZED GRADIENT SYSTEM
// ============================

// Gradient style types for different views
export type GradientStyle = 'table' | 'card' | 'kanban' | 'dashboard';

// Central function to get type-based gradient backgrounds
export const getTypeGradientBackground = (type: WorkItemType, style: GradientStyle): string => {
  const config = getTypeConfig(type);
  
  // Extract base color from hex (remove #)
  const baseColor = config.hexColor.replace('#', '');
  
  // Map hex to Tailwind color names for consistency
  const colorMap: Record<string, string> = {
    'e879f9': 'fuchsia-500',  // EPIC
    'fb923c': 'orange-500',   // MILESTONE  
    '818cf8': 'indigo-500',   // OUTCOME
    '38bdf8': 'sky-500',      // FEATURE
    '4ade80': 'green-500',    // TASK
    'ef4444': 'red-500',      // BUG
    'facc15': 'yellow-500',   // IDEA
    '2dd4bf': 'teal-500',     // RESEARCH
    '9ca3af': 'gray-500'      // DEFAULT
  };
  
  const tailwindColor = colorMap[baseColor] || 'gray-500';
  
  switch (style) {
    case 'table': {
      // Use static gradient classes for proper Tailwind compilation and better transparency
      const gradientMap: Record<string, string> = {
        'green-500': 'bg-gradient-to-r from-green-500/15 via-green-500/5 to-green-500/15',   // OUTCOME
        'blue-500': 'bg-gradient-to-r from-blue-500/15 via-blue-500/5 to-blue-500/15',       // TASK
        'purple-500': 'bg-gradient-to-r from-purple-500/15 via-purple-500/5 to-purple-500/15', // MILESTONE
        'amber-500': 'bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-amber-500/15',   // DELIVERABLE
        'rose-500': 'bg-gradient-to-r from-rose-500/15 via-rose-500/5 to-rose-500/15',       // EPIC
        'indigo-500': 'bg-gradient-to-r from-indigo-500/15 via-indigo-500/5 to-indigo-500/15', // FEATURE
        'teal-500': 'bg-gradient-to-r from-teal-500/15 via-teal-500/5 to-teal-500/15',       // STORY
        'orange-500': 'bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-orange-500/15', // BUG
        'slate-500': 'bg-gradient-to-r from-slate-500/15 via-slate-500/5 to-slate-500/15'    // ISSUE
      };
      
      const hoverMap: Record<string, string> = {
        'green-500': 'hover:from-green-500/25 hover:via-green-500/15 hover:to-green-500/25',
        'blue-500': 'hover:from-blue-500/25 hover:via-blue-500/15 hover:to-blue-500/25',
        'purple-500': 'hover:from-purple-500/25 hover:via-purple-500/15 hover:to-purple-500/25',
        'amber-500': 'hover:from-amber-500/25 hover:via-amber-500/15 hover:to-amber-500/25',
        'rose-500': 'hover:from-rose-500/25 hover:via-rose-500/15 hover:to-rose-500/25',
        'indigo-500': 'hover:from-indigo-500/25 hover:via-indigo-500/15 hover:to-indigo-500/25',
        'teal-500': 'hover:from-teal-500/25 hover:via-teal-500/15 hover:to-teal-500/25',
        'orange-500': 'hover:from-orange-500/25 hover:via-orange-500/15 hover:to-orange-500/25',
        'slate-500': 'hover:from-slate-500/25 hover:via-slate-500/15 hover:to-slate-500/25'
      };
      
      const gradientClass = gradientMap[tailwindColor] || 'bg-gradient-to-r from-gray-500/15 via-gray-500/5 to-gray-500/15';
      const hoverClass = hoverMap[tailwindColor] || 'hover:from-gray-500/25 hover:via-gray-500/15 hover:to-gray-500/25';
      
      return `${gradientClass} ${hoverClass} backdrop-blur-sm`;
    }
    
    case 'card': {
      // Use static gradient classes for proper Tailwind compilation and transparency
      const gradientMap: Record<string, string> = {
        'green-500': 'bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5',   // OUTCOME
        'blue-500': 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5',       // TASK
        'purple-500': 'bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5', // MILESTONE
        'amber-500': 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5',   // DELIVERABLE
        'rose-500': 'bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-rose-500/5',       // EPIC
        'indigo-500': 'bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-indigo-500/5', // FEATURE
        'teal-500': 'bg-gradient-to-br from-teal-500/20 via-teal-500/10 to-teal-500/5',       // STORY
        'orange-500': 'bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5', // BUG
        'slate-500': 'bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-500/5'    // ISSUE
      };
      
      const borderColorMap: Record<string, string> = {
        'green-500': 'border-l-green-400/40',
        'blue-500': 'border-l-blue-400/40',
        'purple-500': 'border-l-purple-400/40',
        'amber-500': 'border-l-amber-400/40',
        'rose-500': 'border-l-rose-400/40',
        'indigo-500': 'border-l-indigo-400/40',
        'teal-500': 'border-l-teal-400/40',
        'orange-500': 'border-l-orange-400/40',
        'slate-500': 'border-l-slate-400/40'
      };
      
      const gradientClass = gradientMap[tailwindColor] || 'bg-gradient-to-br from-gray-500/20 via-gray-500/10 to-gray-500/5';
      const borderClass = borderColorMap[tailwindColor] || 'border-l-gray-400/40';
      
      return `${gradientClass} border-l-4 ${borderClass}`;
    }
    
    case 'kanban': {
      // Use static gradient classes for proper Tailwind compilation and transparency
      const gradientMap: Record<string, string> = {
        'green-500': 'bg-gradient-to-br from-green-500/20 via-green-500/10 to-green-500/5',   // OUTCOME
        'blue-500': 'bg-gradient-to-br from-blue-500/20 via-blue-500/10 to-blue-500/5',       // TASK
        'purple-500': 'bg-gradient-to-br from-purple-500/20 via-purple-500/10 to-purple-500/5', // MILESTONE
        'amber-500': 'bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-amber-500/5',   // DELIVERABLE
        'rose-500': 'bg-gradient-to-br from-rose-500/20 via-rose-500/10 to-rose-500/5',       // EPIC
        'indigo-500': 'bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-indigo-500/5', // FEATURE
        'teal-500': 'bg-gradient-to-br from-teal-500/20 via-teal-500/10 to-teal-500/5',       // STORY
        'orange-500': 'bg-gradient-to-br from-orange-500/20 via-orange-500/10 to-orange-500/5', // BUG
        'slate-500': 'bg-gradient-to-br from-slate-500/20 via-slate-500/10 to-slate-500/5'    // ISSUE
      };
      
      return gradientMap[tailwindColor] || 'bg-gradient-to-br from-gray-500/20 via-gray-500/10 to-gray-500/5';
    }
    
    case 'dashboard':
      return `bg-gradient-to-br from-${tailwindColor}/10 via-gray-800 to-${tailwindColor}/5 border-l-4 border-l-${tailwindColor.replace('-500', '-400')}/40 hover:from-${tailwindColor}/20 hover:to-${tailwindColor}/20 hover:border-l-${tailwindColor.replace('-500', '-300')}/60`;
    
    default:
      return `bg-gradient-to-br from-${tailwindColor}/10 via-gray-800 to-${tailwindColor}/5`;
  }
};

// Central function to get status-based gradient backgrounds (for Dashboard)
export const getStatusGradientBackground = (status: WorkItemStatus, style: GradientStyle): string => {
  const config = getStatusConfig(status);
  
  // Extract base color from hex (remove #)
  const baseColor = config.hexColor.replace('#', '');
  
  // Map hex to Tailwind color names for consistency
  const colorMap: Record<string, string> = {
    '9ca3af': 'gray-500',     // NOT_STARTED
    '06b6d4': 'cyan-500',     // PROPOSED
    'a855f7': 'purple-500',   // PLANNED
    'eab308': 'yellow-500',   // IN_PROGRESS
    '3b82f6': 'blue-500',     // IN_REVIEW
    'ef4444': 'red-500',      // BLOCKED
    'fb923c': 'orange-500',   // ON_HOLD
    '22c55e': 'green-500',    // COMPLETED
    'ff1493': 'pink-500'      // CANCELLED
  };
  
  const tailwindColor = colorMap[baseColor] || 'gray-500';
  
  // Use static classes to ensure Tailwind generates them
  const borderColorMap: Record<string, string> = {
    'gray-500': 'border-l-gray-400/70',
    'cyan-500': 'border-l-cyan-400/70', 
    'purple-500': 'border-l-purple-400/70',
    'yellow-500': 'border-l-yellow-400/70',
    'blue-500': 'border-l-blue-400/70',
    'red-500': 'border-l-red-400/70',
    'orange-500': 'border-l-orange-400/70',
    'green-500': 'border-l-green-400/70',
    'pink-500': 'border-l-pink-400/70'
  };

  const hoverColorMap: Record<string, string> = {
    'gray-500': 'hover:from-gray-500/40 hover:via-gray-500/30 hover:to-gray-500/35',
    'cyan-500': 'hover:from-cyan-500/40 hover:via-cyan-500/30 hover:to-cyan-500/35', 
    'purple-500': 'hover:from-purple-500/40 hover:via-purple-500/30 hover:to-purple-500/35',
    'yellow-500': 'hover:from-yellow-500/40 hover:via-yellow-500/30 hover:to-yellow-500/35',
    'blue-500': 'hover:from-blue-500/40 hover:via-blue-500/30 hover:to-blue-500/35',
    'red-500': 'hover:from-red-500/40 hover:via-red-500/30 hover:to-red-500/35',
    'orange-500': 'hover:from-orange-500/40 hover:via-orange-500/30 hover:to-orange-500/35',
    'green-500': 'hover:from-green-500/40 hover:via-green-500/30 hover:to-green-500/35',
    'pink-500': 'hover:from-pink-500/40 hover:via-pink-500/30 hover:to-pink-500/35'
  };

  switch (style) {
    case 'dashboard': {
      // Use static gradient classes for proper Tailwind compilation
      const gradientMap: Record<string, string> = {
        'gray-500': 'bg-gradient-to-br from-gray-500/30 via-gray-500/20 to-gray-500/10',     // NOT_STARTED
        'cyan-500': 'bg-gradient-to-br from-cyan-500/30 via-cyan-500/20 to-cyan-500/10',     // PROPOSED
        'purple-500': 'bg-gradient-to-br from-purple-500/30 via-purple-500/20 to-purple-500/10', // PLANNED
        'yellow-500': 'bg-gradient-to-br from-yellow-500/30 via-yellow-500/20 to-yellow-500/10', // IN_PROGRESS
        'blue-500': 'bg-gradient-to-br from-blue-500/30 via-blue-500/20 to-blue-500/10',     // IN_REVIEW
        'red-500': 'bg-gradient-to-br from-red-500/30 via-red-500/20 to-red-500/10',         // BLOCKED
        'orange-500': 'bg-gradient-to-br from-orange-500/30 via-orange-500/20 to-orange-500/10', // ON_HOLD
        'green-500': 'bg-gradient-to-br from-green-500/30 via-green-500/20 to-green-500/10', // COMPLETED
        'pink-500': 'bg-gradient-to-br from-pink-500/30 via-pink-500/20 to-pink-500/10'      // CANCELLED
      };
      
      const gradientClass = gradientMap[tailwindColor] || 'bg-gradient-to-br from-gray-500/30 via-gray-500/20 to-gray-500/10';
      const borderClass = borderColorMap[tailwindColor] || 'border-l-gray-400/40';
      const hoverClass = hoverColorMap[tailwindColor] || 'hover:from-gray-500/25 hover:via-gray-500/15 hover:to-gray-500/20';
      return `${gradientClass} backdrop-blur-sm border-l-4 ${borderClass} ${hoverClass}`;
    }
    
    default:
      return `bg-gradient-to-br from-${tailwindColor}/10 via-gray-800 to-${tailwindColor}/5`;
  }
};

// ============================
// SIDEBAR SECTION COLORS
// ============================

// Unique colors for RightSidebar main sections (completely unused elsewhere in project)
export const SIDEBAR_SECTION_COLORS = {
  projectOverview: '#8E24AA',   // Material Deep Purple 500 - unique
  taskStatus: '#00ACC1',        // Material Cyan 600 - unique  
  priorityDistribution: '#FFA726', // Material Orange 400 - unique
  nodeTypes: '#D32F2F'          // Material Red 700 - unique
} as const;

// Get sidebar section border color
export const getSidebarSectionColor = (section: keyof typeof SIDEBAR_SECTION_COLORS): string => {
  return SIDEBAR_SECTION_COLORS[section];
};

// ============================
// EXPORT DEFAULT COLLECTIONS
// ============================

export default {
  TYPES: WORK_ITEM_TYPES,
  STATUSES: WORK_ITEM_STATUSES,
  PRIORITIES: WORK_ITEM_PRIORITIES,
  RELATIONSHIPS: RELATIONSHIP_TYPES,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  RELATIONSHIP_OPTIONS,
  getTypeConfig,
  getStatusConfig,
  getPriorityConfig,
  getRelationshipConfig,
  getTypeColorScheme,
  getStatusColorScheme,
  getPriorityColorScheme,
  getRelationshipColorScheme,
  getTypeIconElement,
  getStatusIconElement,
  getPriorityIconElement,
  getRelationshipIconElement
};
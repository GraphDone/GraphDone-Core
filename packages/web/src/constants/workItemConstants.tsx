import React from 'react';
import { 
  ClipboardList, 
  Calendar, 
  Clock, 
  CheckCircle, 
  AlertCircle,
  XCircle,
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
  ArrowDown
} from 'lucide-react';

// ============================
// RE-EXPORT ICON COMPONENTS
// ============================

// Export all icon components for centralized importing
export {
  // Status Icons
  ClipboardList,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  
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
  ArrowDown
} from 'lucide-react';

// ============================
// CORE TYPE DEFINITIONS  
// ============================

export type WorkItemType = 'EPIC' | 'MILESTONE' | 'OUTCOME' | 'FEATURE' | 'TASK' | 'BUG' | 'IDEA' | 'RESEARCH';
export type WorkItemStatus = 'PROPOSED' | 'PLANNED' | 'IN_PROGRESS' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
export type PriorityLevel = 'critical' | 'high' | 'moderate' | 'low' | 'minimal';

// ============================
// INTERFACE DEFINITIONS
// ============================

export interface TypeOption {
  value: WorkItemType | 'all';
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }> | null;
  color: string;
  bgColor?: string;
  borderColor?: string;
  hexColor: string;
}

export interface StatusOption {
  value: WorkItemStatus | 'all';
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }> | null;
  color: string;
  bgColor?: string;
  borderColor?: string;
  dotColor?: string;
  hexColor: string;
}

export interface PriorityOption {
  value: PriorityLevel | 'all';
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }> | null;
  color: string;
  bgColor?: string;
  borderColor?: string;
  hexColor: string;
  threshold: {
    min: number;
    max: number;
  };
}

// ============================
// WORK ITEM TYPES CONFIGURATION
// ============================

export const WORK_ITEM_TYPES: Record<WorkItemType, TypeOption> = {
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
    hexColor: '#fde047'
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

export const WORK_ITEM_STATUSES: Record<WorkItemStatus, StatusOption> = {
  PROPOSED: {
    value: 'PROPOSED',
    label: 'Proposed',
    description: 'Initial idea or suggestion',
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
    description: 'Approved and scheduled for work',
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
    description: 'Currently being worked on',
    icon: Clock,
    color: 'text-yellow-400',
    bgColor: 'bg-yellow-400/10',
    borderColor: 'border-yellow-400/30',
    dotColor: 'bg-yellow-400',
    hexColor: '#eab308'
  },
  COMPLETED: {
    value: 'COMPLETED',
    label: 'Completed',
    description: 'Work has been finished',
    icon: CheckCircle,
    color: 'text-green-400',
    bgColor: 'bg-green-400/10',
    borderColor: 'border-green-400/30',
    dotColor: 'bg-green-400',
    hexColor: '#22c55e'
  },
  BLOCKED: {
    value: 'BLOCKED',
    label: 'Blocked',
    description: 'Cannot proceed due to dependencies or issues',
    icon: AlertCircle,
    color: 'text-red-500',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    dotColor: 'bg-red-500',
    hexColor: '#ef4444'
  },
  CANCELLED: {
    value: 'CANCELLED',
    label: 'Cancelled',
    description: 'Work was stopped and will not be completed',
    icon: XCircle,
    color: 'text-slate-400',
    bgColor: 'bg-slate-400/10',
    borderColor: 'border-slate-400/30',
    dotColor: 'bg-slate-400',
    hexColor: '#94a3b8'
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
  ...Object.values(WORK_ITEM_TYPES)
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
  return WORK_ITEM_TYPES[type] || WORK_ITEM_TYPES.TASK;
};

// Get status configuration
export const getStatusConfig = (status: WorkItemStatus): StatusOption => {
  return WORK_ITEM_STATUSES[status] || WORK_ITEM_STATUSES.PROPOSED;
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
// VALIDATION HELPERS
// ============================

export const isValidWorkItemType = (type: string): type is WorkItemType => {
  return Object.keys(WORK_ITEM_TYPES).includes(type as WorkItemType);
};

export const isValidWorkItemStatus = (status: string): status is WorkItemStatus => {
  return Object.keys(WORK_ITEM_STATUSES).includes(status as WorkItemStatus);
};

export const isValidPriorityLevel = (priority: string): priority is PriorityLevel => {
  return Object.keys(WORK_ITEM_PRIORITIES).includes(priority as PriorityLevel);
};

// ============================
// EXPORT DEFAULT COLLECTIONS
// ============================

export default {
  TYPES: WORK_ITEM_TYPES,
  STATUSES: WORK_ITEM_STATUSES,
  PRIORITIES: WORK_ITEM_PRIORITIES,
  TYPE_OPTIONS,
  STATUS_OPTIONS,
  PRIORITY_OPTIONS,
  getTypeConfig,
  getStatusConfig,
  getPriorityConfig,
  getTypeColorScheme,
  getStatusColorScheme,
  getPriorityColorScheme,
  getTypeIconElement,
  getStatusIconElement,
  getPriorityIconElement
};
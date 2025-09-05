import React from 'react';
import { 
  WORK_ITEM_STATUSES,
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  WorkItemStatus,
  WorkItemType,
  PriorityLevel,
  getProjectHealthColor,
  getProjectHealthStatus,
  PROJECT_HEALTH_COLORS,
  getSidebarSectionColor
} from '../constants/workItemConstants';

interface RightSidebarProps {
  currentView: 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity';
  stats: {
    total: number;
    notStarted: number;
    proposed: number;
    planned: number;
    inProgress: number;
    inReview: number;
    blocked: number;
    onHold: number;
    completed: number;
    cancelled: number;
    priorityStats: {
      critical: number;
      high: number;
      moderate: number;
      low: number;
      minimal: number;
    };
    typeStats: Record<string, number>;
  };
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const RightSidebar: React.FC<RightSidebarProps> = ({ currentView, stats }) => {
  // Helper function to blend colors when there's a tie
  const blendColors = (colors: Array<{hex: string, weight: number}>): string => {
    if (colors.length === 0) return '#9ca3af';
    if (colors.length === 1) return colors[0].hex;
    
    let totalWeight = colors.reduce((sum, c) => sum + c.weight, 0);
    if (totalWeight === 0) return '#9ca3af';
    
    let r = 0, g = 0, b = 0;
    
    colors.forEach(color => {
      const hex = color.hex.replace('#', '');
      const weight = color.weight / totalWeight;
      r += parseInt(hex.substr(0, 2), 16) * weight;
      g += parseInt(hex.substr(2, 2), 16) * weight;
      b += parseInt(hex.substr(4, 2), 16) * weight;
    });
    
    const rHex = Math.round(r).toString(16).padStart(2, '0');
    const gHex = Math.round(g).toString(16).padStart(2, '0');
    const bHex = Math.round(b).toString(16).padStart(2, '0');
    
    return `#${rHex}${gHex}${bHex}`;
  };

  // Helper functions for dynamic border colors
  const getProjectHealthBorderColor = () => {
    return stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData;
  };

  const getDominantStatusColor = () => {
    const statusCounts = [
      { key: 'BLOCKED', count: stats.blocked, config: WORK_ITEM_STATUSES.BLOCKED },
      { key: 'IN_PROGRESS', count: stats.inProgress, config: WORK_ITEM_STATUSES.IN_PROGRESS },
      { key: 'IN_REVIEW', count: stats.inReview, config: WORK_ITEM_STATUSES.IN_REVIEW },
      { key: 'COMPLETED', count: stats.completed, config: WORK_ITEM_STATUSES.COMPLETED },
      { key: 'PLANNED', count: stats.planned, config: WORK_ITEM_STATUSES.PLANNED },
      { key: 'PROPOSED', count: stats.proposed, config: WORK_ITEM_STATUSES.PROPOSED },
      { key: 'ON_HOLD', count: stats.onHold, config: WORK_ITEM_STATUSES.ON_HOLD },
      { key: 'NOT_STARTED', count: stats.notStarted, config: WORK_ITEM_STATUSES.NOT_STARTED },
      { key: 'CANCELLED', count: stats.cancelled, config: WORK_ITEM_STATUSES.CANCELLED }
    ].filter(status => status.count > 0);
    
    if (statusCounts.length === 0) return WORK_ITEM_STATUSES.NOT_STARTED.hexColor;
    if (statusCounts.length === 1) return statusCounts[0].config.hexColor;
    
    const maxCount = Math.max(...statusCounts.map(s => s.count));
    const topStatuses = statusCounts.filter(s => s.count === maxCount);
    
    // If there's a clear winner, return its color
    if (topStatuses.length === 1) {
      return topStatuses[0].config.hexColor;
    }
    
    // If there's a tie, blend the colors
    const colorsToBlend = topStatuses.map(status => ({
      hex: status.config.hexColor,
      weight: status.count
    }));
    
    return blendColors(colorsToBlend);
  };

  const getDominantPriorityColor = () => {
    const priorityCounts = [
      { key: 'critical', count: stats.priorityStats.critical, config: WORK_ITEM_PRIORITIES.critical },
      { key: 'high', count: stats.priorityStats.high, config: WORK_ITEM_PRIORITIES.high },
      { key: 'moderate', count: stats.priorityStats.moderate, config: WORK_ITEM_PRIORITIES.moderate },
      { key: 'low', count: stats.priorityStats.low, config: WORK_ITEM_PRIORITIES.low },
      { key: 'minimal', count: stats.priorityStats.minimal, config: WORK_ITEM_PRIORITIES.minimal }
    ].filter(priority => priority.count > 0);
    
    if (priorityCounts.length === 0) return WORK_ITEM_PRIORITIES.minimal.hexColor;
    if (priorityCounts.length === 1) return priorityCounts[0].config.hexColor;
    
    const maxCount = Math.max(...priorityCounts.map(p => p.count));
    const topPriorities = priorityCounts.filter(p => p.count === maxCount);
    
    // If there's a clear winner, return its color
    if (topPriorities.length === 1) {
      return topPriorities[0].config.hexColor;
    }
    
    // If there's a tie, blend the colors
    const colorsToBlend = topPriorities.map(priority => ({
      hex: priority.config.hexColor,
      weight: priority.count
    }));
    
    return blendColors(colorsToBlend);
  };

  const getDominantNodeTypeColor = () => {
    const typeCounts = [
      { key: 'BUG', count: stats.typeStats['BUG'] || 0, config: WORK_ITEM_TYPES.BUG },
      { key: 'EPIC', count: stats.typeStats['EPIC'] || 0, config: WORK_ITEM_TYPES.EPIC },
      { key: 'FEATURE', count: stats.typeStats['FEATURE'] || 0, config: WORK_ITEM_TYPES.FEATURE },
      { key: 'MILESTONE', count: stats.typeStats['MILESTONE'] || 0, config: WORK_ITEM_TYPES.MILESTONE },
      { key: 'OUTCOME', count: stats.typeStats['OUTCOME'] || 0, config: WORK_ITEM_TYPES.OUTCOME },
      { key: 'TASK', count: stats.typeStats['TASK'] || 0, config: WORK_ITEM_TYPES.TASK },
      { key: 'RESEARCH', count: stats.typeStats['RESEARCH'] || 0, config: WORK_ITEM_TYPES.RESEARCH },
      { key: 'IDEA', count: stats.typeStats['IDEA'] || 0, config: WORK_ITEM_TYPES.IDEA }
    ].filter(type => type.count > 0);
    
    if (typeCounts.length === 0) return WORK_ITEM_TYPES.TASK.hexColor;
    if (typeCounts.length === 1) return typeCounts[0].config.hexColor;
    
    const maxCount = Math.max(...typeCounts.map(t => t.count));
    const topTypes = typeCounts.filter(t => t.count === maxCount);
    
    // If there's a clear winner, return its color
    if (topTypes.length === 1) {
      return topTypes[0].config.hexColor;
    }
    
    // If there's a tie, blend the colors
    const colorsToBlend = topTypes.map(type => ({
      hex: type.config.hexColor,
      weight: type.count
    }));
    
    return blendColors(colorsToBlend);
  };
  return (
    <div className="w-80 bg-gray-800 border-l border-gray-700 p-6 transition-all duration-300 ease-in-out">
      <div className="space-y-6">
        {/* Project Overview */}
        <div 
          className="bg-gray-800/50 rounded-xl p-10 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-800/70 transition-all duration-200 backdrop-blur-sm hover:shadow-lg hover:shadow-white/5"
          style={{
            borderLeft: `4px solid ${getProjectHealthBorderColor()}`,
          }}
        >
          <div className="flex items-center space-x-3 mb-7">
            {/* Dynamic Health Icon - Energy Efficiency */}
            <div className="relative group cursor-pointer">
              {/* Tooltip */}
              <div 
                className="absolute -top-14 left-1/2 transform -translate-x-1/2 px-3 py-2 rounded-lg text-white text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap"
                style={{
                  backgroundColor: stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData
                }}
              >
                {stats.total > 0 
                  ? `Project Health: ${Math.round((stats.completed / stats.total) * 100)}% - ${getProjectHealthStatus(stats.completed / stats.total)}`
                  : 'No data available'
                }
                {/* Tooltip arrow */}
                <div 
                  className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-2 h-2 rotate-45"
                  style={{
                    backgroundColor: stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData
                  }}
                />
              </div>
              <svg className="h-12 w-12" viewBox="0 0 118.83 122.88">
                <path 
                  d="M32.07,112.54H54.74A1.52,1.52,0,0,1,56.25,114v7.33a1.52,1.52,0,0,1-1.51,1.51H30.9a1.52,1.52,0,0,1-1.51-1.51V114a1.52,1.52,0,0,1,1.51-1.51h1.17ZM24.85,39.83a2.51,2.51,0,0,1-1.78-.69,2.55,2.55,0,0,1-.8-1.76v-.13a2.53,2.53,0,0,1,2.45-2.48c1.85-.08,3.7-.13,5.54-.19a2.53,2.53,0,1,1,.16,5.06l-5.57.19Zm69-7.86a2.54,2.54,0,0,1,2.66,2.28v.12A2.51,2.51,0,0,1,96,36.1a2.54,2.54,0,0,1-1.7.93l-5.51.58A2.54,2.54,0,0,1,86,35.34a2.47,2.47,0,0,1,.55-1.85,2.52,2.52,0,0,1,1.71-.93c1.85-.19,3.78-.45,5.63-.59Zm-11-22.06a2.54,2.54,0,0,1,3.5-.67h0a2.53,2.53,0,0,1,.68,3.5L84,17.36a2.52,2.52,0,0,1-3.52.69h0a2.48,2.48,0,0,1-1.06-1.6,2.5,2.5,0,0,1,.38-1.9c1.06-1.5,2-3.1,3.09-4.63ZM58.94,2.5a1,1,0,0,1,0-.17A2.54,2.54,0,0,1,61.51,0h.16A2.52,2.52,0,0,1,64,2.56a.28.28,0,0,1,0,.13L63.86,8.1a1,1,0,0,1,0,.17A2.54,2.54,0,0,1,61.3,10.6h-.16a2.52,2.52,0,0,1-1.64-.78A2.56,2.56,0,0,1,58.8,8a.53.53,0,0,1,0-.13l.13-5.41ZM31.48,11.94a2.53,2.53,0,0,1-.8-1.77,2.5,2.5,0,0,1,.67-1.81,2.58,2.58,0,0,1,1.77-.81,2.52,2.52,0,0,1,1.81.68L39,12a2.49,2.49,0,0,1,.8,1.76,2.52,2.52,0,0,1-.67,1.82,2.58,2.58,0,0,1-1.77.81,2.55,2.55,0,0,1-1.81-.68l-4.06-3.78ZM45.76,53.27a31.39,31.39,0,0,1-5.3-7.59,22.92,22.92,0,0,1-2.3-9.94A23.45,23.45,0,0,1,41,25.1L41,25h0a20.2,20.2,0,0,1,9.85-8.6A21.76,21.76,0,0,1,61.09,15a23.51,23.51,0,0,1,9.78,3.14,20.17,20.17,0,0,1,8.54,9.68A21.4,21.4,0,0,1,81,35.31a21.62,21.62,0,0,1-1.66,8.83,31.11,31.11,0,0,1-6,9.24l-3.4,5.43a1.39,1.39,0,0,0-.5,0l-5.1.76,6.09-21.22a.84.84,0,0,0-1.62-.46l-6.31,22-6.09.91L49.94,40.16l.1.07a1,1,0,0,0,1.3-.34l4.54-7.73,2.36,5.4a.95.95,0,0,0,1.75,0l2.12-5.36,2.46,6.48A1,1,0,1,0,66.35,38L63,29.26a1,1,0,0,0-.56-.6.94.94,0,0,0-1.23.53l-2.19,5.52-2.19-5a.92.92,0,0,0-.39-.44.94.94,0,0,0-1.29.34L49.7,38.93a1.76,1.76,0,0,0-.09.2l-.52-1.66a.84.84,0,0,0-1.61.51l7.24,23-4.44.66a25.64,25.64,0,0,0-4.52-8.37Zm22.65,8.64L68,63.82l-.11,1.35L51.53,67.61a20.47,20.47,0,0,0-.46-3.12l17.34-2.58Zm-.54,6.23V69l0,.29a12.34,12.34,0,0,1,0,1.61L67.67,72,52.47,74.3l-.27-.61-.59-2.43,0-.7,16.28-2.42Zm-1.2,7a8.69,8.69,0,0,1-3.11,3.12A8.1,8.1,0,0,1,60,79.36a7.35,7.35,0,0,1-3.68-.71A7.5,7.5,0,0,1,54.13,77l12.54-1.86ZM86.38,109H64.09a1.5,1.5,0,0,1-1.44-1.57c0-1,.1-2,.17-2.88s.17-1.9.29-2.87c.19-1.62.35-3,.57-4.27a16.93,16.93,0,0,1,.94-3.54,12.06,12.06,0,0,1,1.8-3.07,21.6,21.6,0,0,1,3.07-3.07l.76-.64c.25-.2.52-.42.82-.64s.54-.4.83-.59a9.32,9.32,0,0,1,.88-.53c3-1.65,6.8-5.65,10-9.08,1.39-1.48,2.68-2.85,3.82-3.93,1.73-1.69,3.59-3.4,5.27-5.14h0a14.16,14.16,0,0,1,2-1.93A8.85,8.85,0,0,1,96,63.93a5.08,5.08,0,0,1,3.23-.24,4.16,4.16,0,0,1,1.48.72,3.51,3.51,0,0,1,1.08,1.41,4,4,0,0,1,.12,2.6,6.17,6.17,0,0,1-.77,1.72,8.55,8.55,0,0,1-1.26,1.51c-4.77,5.2-9.52,11.89-14.37,16.74a.57.57,0,0,0,0,.79.53.53,0,0,0,.41.14.47.47,0,0,0,.35-.15l.12-.12,15.74-15a9.32,9.32,0,0,0,.91-1,7.72,7.72,0,0,0,.72-1.07.8.8,0,0,1,.13-.19l0-.08,7.92-18.86a1.67,1.67,0,0,1,.28-.43,6.23,6.23,0,0,1,1.44-1.18,4.32,4.32,0,0,1,1.71-.59,2.93,2.93,0,0,1,.89.05,2.53,2.53,0,0,1,.87.35,3.32,3.32,0,0,1,.8.79,4.49,4.49,0,0,1,.48.93,9.34,9.34,0,0,1,.35,4.21,24.9,24.9,0,0,1-1.27,5.28l-2.67,9.39-.57,2-.47,1.74a36.44,36.44,0,0,1-2.37,7.09,33.84,33.84,0,0,1-5.15,7.21c-2.27,2.61-4.5,5-6.69,7.15s-4.33,4.21-6.42,6.18l-2.85,2.7-.07.08c-.94.89-1.84,1.77-2.7,2.62a1.48,1.48,0,0,1-1.14.52Zm1.55,3.54A1.52,1.52,0,0,1,89.44,114v7.33a1.52,1.52,0,0,1-1.51,1.51H64.1a1.51,1.51,0,0,1-1.51-1.51V114a1.51,1.51,0,0,1,1.51-1.51H86.76c.47,0,.7,0,1.17,0ZM54.68,109H32.45a1.51,1.51,0,0,1-1.14-.52c-.86-.85-1.76-1.73-2.69-2.62l-2.93-2.78c-2.08-2-4.22-4-6.41-6.18s-4.43-4.54-6.69-7.15a34,34,0,0,1-5.16-7.21,36.44,36.44,0,0,1-2.37-7.09L4.59,73.7l-.57-2c-.89-3.14-1.75-6.32-2.69-9.44A25.46,25.46,0,0,1,.08,57a9.34,9.34,0,0,1,.35-4.21,4.06,4.06,0,0,1,.49-.93,3.12,3.12,0,0,1,.79-.79,2.5,2.5,0,0,1,.88-.35,2.86,2.86,0,0,1,.88-.05,4.26,4.26,0,0,1,1.71.59,6.23,6.23,0,0,1,1.44,1.18,1.67,1.67,0,0,1,.28.43l7.92,18.86,0,.08A1.27,1.27,0,0,1,15,72a8.62,8.62,0,0,0,.71,1.07,9.45,9.45,0,0,0,.92,1l15.73,15,.12.12a.49.49,0,0,0,.35.15.57.57,0,0,0,.36-.09l.1-.09a.62.62,0,0,0,.13-.34.55.55,0,0,0-.1-.35,1,1,0,0,1-.13-.16c-4.47-5.2-9.61-11.88-14.29-16.65a8.09,8.09,0,0,1-1.25-1.5,6.17,6.17,0,0,1-.77-1.72,4,4,0,0,1,.12-2.6,3.6,3.6,0,0,1,1.08-1.41,4.12,4.12,0,0,1,1.49-.72,5,5,0,0,1,3.22.24,8.85,8.85,0,0,1,2.15,1.29,13.64,13.64,0,0,1,2,1.93h0c1.67,1.74,3.53,3.45,5.27,5.14,1.13,1.08,2.43,2.45,3.82,3.93,3.24,3.43,7,7.43,10,9.08a9.13,9.13,0,0,1,.87.53c.3.19.57.39.84.59s.52.4.81.64c0,0,.74.64.77.64a22,22,0,0,1,3.06,3.07,12.41,12.41,0,0,1,1.81,3.07l0,.09a17.54,17.54,0,0,1,.9,3.45c.22,1.25.39,2.65.58,4.27.06.55.13,1.21.2,2s.12,1.37.15,1.93l.11,1.86A1.51,1.51,0,0,1,54.75,109Z"
                  fill={stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData}
                />
                {/* Pulse animation for critical health */}
                {stats.total > 0 && (stats.completed / stats.total) < 0.25 && (
                  <animate 
                    attributeName="opacity" 
                    values="1;0.5;1" 
                    dur="1.5s" 
                    repeatCount="indefinite"
                  />
                )}
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-white">Project Health</h3>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-300">Overall Progress</span>
              <span 
                className="text-sm font-medium" 
                style={{
                  color: stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData
                }}
              >
                {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
              </span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${stats.total > 0 ? (stats.completed / stats.total) * 100 : 0}%`,
                  backgroundColor: stats.total > 0 ? getProjectHealthColor(stats.completed / stats.total) : PROJECT_HEALTH_COLORS.noData
                }}
              ></div>
            </div>
          </div>

          {/* Total Count */}
          <div className="text-center mb-4">
            <div className="text-3xl font-bold text-white">{stats.total}</div>
            <div className="text-sm text-gray-400">Total Tasks</div>
          </div>
        </div>

        {/* Status Breakdown */}
        <div 
          className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-800/70 transition-all duration-200 backdrop-blur-sm"
          style={{
            borderLeft: `4px solid ${getDominantStatusColor()}`,
          }}
        >
          <h3 className="text-xl font-semibold text-white mb-6">Task Status</h3>
          
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(WORK_ITEM_STATUSES).map(([statusKey, statusConfig]) => {
              const getCount = (key: string) => {
                switch(key) {
                  case 'NOT_STARTED': return stats.notStarted;
                  case 'PROPOSED': return stats.proposed;
                  case 'PLANNED': return stats.planned;
                  case 'IN_PROGRESS': return stats.inProgress;
                  case 'IN_REVIEW': return stats.inReview;
                  case 'BLOCKED': return stats.blocked;
                  case 'ON_HOLD': return stats.onHold;
                  case 'COMPLETED': return stats.completed;
                  case 'CANCELLED': return stats.cancelled;
                  default: return 0;
                }
              };
              const count = getCount(statusKey);
              const IconComponent = statusConfig.icon;
              
              return (
                <div
                  key={statusKey}
                  className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-700/70 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg cursor-pointer backdrop-blur-sm"
                  style={{
                    borderLeft: `4px solid ${statusConfig.hexColor}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {IconComponent && <IconComponent className={`h-5 w-5 ${statusConfig.color}`} />}
                      <span className="text-gray-200 font-medium text-sm">{statusConfig.label}</span>
                    </div>
                    <span className="text-white font-bold text-lg">{count || 0}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${stats.total > 0 ? ((count || 0) / stats.total) * 100 : 0}%`,
                        backgroundColor: statusConfig.hexColor
                      }}
                    ></div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-xs text-gray-400">
                      {stats.total > 0 ? Math.round(((count || 0) / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Priority Distribution */}
        <div 
          className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-800/70 transition-all duration-200 backdrop-blur-sm"
          style={{
            borderLeft: `4px solid ${getDominantPriorityColor()}`,
          }}
        >
          <h3 className="text-xl font-semibold text-white mb-6">Priority Distribution</h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(WORK_ITEM_PRIORITIES).map(([priorityKey, priorityConfig]) => {
              const count = stats.priorityStats[priorityKey as keyof typeof stats.priorityStats];
              const IconComponent = priorityConfig.icon;
              
              return (
                <div
                  key={priorityKey}
                  className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-700/70 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg cursor-pointer backdrop-blur-sm"
                  style={{
                    borderLeft: `4px solid ${priorityConfig.hexColor}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {IconComponent && <IconComponent className={`h-5 w-5 ${priorityConfig.color}`} />}
                      <span className="text-gray-200 font-medium text-sm">{priorityConfig.label}</span>
                    </div>
                    <span className="text-white font-bold text-lg">{count || 0}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${stats.total > 0 ? ((count || 0) / stats.total) * 100 : 0}%`,
                        backgroundColor: priorityConfig.hexColor
                      }}
                    ></div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-xs text-gray-400">
                      {stats.total > 0 ? Math.round(((count || 0) / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Node Types */}
        <div 
          className="bg-gray-800/50 rounded-xl p-6 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-800/70 transition-all duration-200 backdrop-blur-sm"
          style={{
            borderLeft: `4px solid ${getDominantNodeTypeColor()}`,
          }}
        >
          <h3 className="text-xl font-semibold text-white mb-6">Node Types</h3>
          <div className="grid grid-cols-1 gap-3">
            {Object.entries(WORK_ITEM_TYPES).map(([typeKey, typeConfig]) => {
              const count = stats.typeStats[typeKey] || 0;
              const IconComponent = typeConfig.icon;
              
              return (
                <div
                  key={typeKey}
                  className="bg-gray-700/50 rounded-xl p-4 border border-gray-600/50 hover:border-gray-500/70 hover:bg-gray-700/70 transition-all duration-200 hover:scale-[1.02] hover:-translate-y-1 hover:shadow-lg cursor-pointer backdrop-blur-sm"
                  style={{
                    borderLeft: `4px solid ${typeConfig.hexColor}`,
                  }}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      {IconComponent && <IconComponent className={`h-5 w-5 ${typeConfig.color}`} />}
                      <span className="text-gray-200 font-medium text-sm">{typeConfig.label}</span>
                    </div>
                    <span className="text-white font-bold text-lg">{count}</span>
                  </div>
                  <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div 
                      className="h-2 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${stats.total > 0 ? (count / stats.total) * 100 : 0}%`,
                        backgroundColor: typeConfig.hexColor
                      }}
                    ></div>
                  </div>
                  <div className="mt-2 text-right">
                    <span className="text-xs text-gray-400">
                      {stats.total > 0 ? Math.round((count / stats.total) * 100) : 0}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RightSidebar;
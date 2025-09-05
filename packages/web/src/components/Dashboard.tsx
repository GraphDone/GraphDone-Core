import React, { useState } from 'react';
import { 
  BarChart3, 
  Sigma,
  RotateCcw,
  ZoomIn,
  ZoomOut
} from 'lucide-react';
import { 
  getStatusConfig, 
  getTypeConfig, 
  getPriorityConfig,
  getStatusIconElement,
  getTypeIconElement,
  getPriorityIconElement,
  getStatusGradientBackground,
  WORK_ITEM_STATUSES, 
  WORK_ITEM_PRIORITIES,
  WORK_ITEM_TYPES,
  type WorkItemStatus,
  type WorkItemType,
  type PriorityLevel
} from '../constants/workItemConstants';
import { TaskDistributionRadar } from './TaskDistributionRadar';
import { PriorityDistributionRadar } from './PriorityDistributionRadar';
import { NodeDistributionRadar } from './NodeDistributionRadar';

// WorkItem interface matching GraphQL schema
interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: number;
  dueDate?: string;
  tags?: string[];
  metadata?: string;
  createdAt: string;
  updatedAt: string;
  owner?: { id: string; name: string; username: string; };
  assignedTo?: { id: string; name: string; username: string; };
  graph?: { id: string; name: string; team?: { id: string; name: string; } };
  contributors?: Array<{ id: string; name: string; type: string; }>;
  dependencies?: Array<{ id: string; title: string; type: string; }>;
  dependents?: Array<{ id: string; title: string; type: string; }>;
}

interface DashboardProps {
  filteredNodes: WorkItem[];
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

const PieChart = ({ data, title }: { data: Array<{label: string, value: number, color: string}>, title: string }) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const filteredData = data.filter(item => item.value > 0);
  const total = filteredData.reduce((sum, item) => sum + item.value, 0);
  let cumulativePercentage = 0;
  
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };
  
  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleResetLayout = () => {
    setZoomLevel(1);
  };

  const createPath = (percentage: number, startPercentage: number) => {
    const startAngle = startPercentage * 3.6 - 90;
    const endAngle = (startPercentage + percentage) * 3.6 - 90;
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    const startX = 50 + 40 * Math.cos(startAngle * Math.PI / 180);
    const startY = 50 + 40 * Math.sin(startAngle * Math.PI / 180);
    const endX = 50 + 40 * Math.cos(endAngle * Math.PI / 180);
    const endY = 50 + 40 * Math.sin(endAngle * Math.PI / 180);

    return `M 50 50 L ${startX} ${startY} A 40 40 0 ${largeArcFlag} 1 ${endX} ${endY} Z`;
  };

  if (total === 0) {
    return (
      <div className="bg-gray-800 rounded-lg p-4 pl-2 border border-gray-700">
        <h3 className="text-lg font-semibold text-white mb-4 text-center">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <div className="text-center">
            <div className="text-gray-400 text-sm mb-2">No data to display</div>
            <div className="text-gray-500 text-xs">Try adjusting your filters</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      </div>
      <div className="relative">
        <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
          <button
            onClick={handleZoomIn}
            className="p-2 text-white rounded shadow-lg transition-all duration-200"
            style={{ backgroundColor: '#228B22', boxShadow: '0 4px 6px rgba(34, 139, 34, 0.25)' }}
            title="Zoom In"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#32CD32'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#228B22'}
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomOut}
            className="p-2 text-white rounded shadow-lg transition-all duration-200"
            style={{ backgroundColor: '#DC143C', boxShadow: '0 4px 6px rgba(220, 20, 60, 0.25)' }}
            title="Zoom Out"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#FF6347'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#DC143C'}
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <button
            onClick={handleResetLayout}
            className="p-2 text-white rounded shadow-lg transition-all duration-200"
            style={{ backgroundColor: '#4682B4', boxShadow: '0 4px 6px rgba(70, 130, 180, 0.25)' }}
            title="Reset Zoom"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#5A9BD4'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4682B4'}
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      
        <div className="flex justify-center">
          <div 
            style={{ 
              transform: `scale(${zoomLevel})`,
              transformOrigin: 'center',
              transition: 'transform 0.2s ease-in-out'
            }}
          >
            <svg 
              width="350" 
              height="350" 
              viewBox="0 0 100 100"
            >
            {filteredData.map((item, index) => {
            const percentage = (item.value / total) * 100;
            const path = createPath(percentage, cumulativePercentage);
            
            cumulativePercentage += percentage;
            
            return (
              <g key={index}>
                <path
                  d={path}
                  fill={item.color}
                  stroke="#374151"
                  strokeWidth="0.5"
                  className="hover:opacity-80 transition-opacity"
                />
              </g>
            );
          })}
            </svg>
          </div>
        </div>
      </div>
      <div className="mt-4">
        {(() => {
          const isPriorityChart = filteredData.some(item => ['Critical', 'High', 'Moderate', 'Low', 'Minimal'].includes(item.label));
          const isStatusChart = filteredData.some(item => ['Proposed', 'Planned', 'In Progress', 'Completed', 'Blocked'].includes(item.label));
          const gridCols = isPriorityChart ? "grid grid-cols-2 gap-2" : 
                           isStatusChart ? "grid grid-cols-2 gap-2" : 
                           "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2";
          
          return (
            <div className={gridCols}>
              {filteredData.map((item, index) => {
                const percentage = ((item.value / total) * 100).toFixed(1);
                const getIcon = (label: string) => {
              // Find status by label
              const statusEntry = Object.entries(WORK_ITEM_STATUSES).find(([, config]) => config.label === label);
              if (statusEntry) {
                return getStatusIconElement(statusEntry[0] as WorkItemStatus, "h-5 w-5");
              }
              
              // Find type by label  
              const typeEntry = Object.entries(WORK_ITEM_TYPES).find(([, config]) => config.label === label);
              if (typeEntry) {
                return getTypeIconElement(typeEntry[0] as WorkItemType, "h-5 w-5");
              }
              
              // Find priority by label
              const priorityEntry = Object.entries(WORK_ITEM_PRIORITIES).find(([, config]) => config.label === label);
              if (priorityEntry) {
                // Convert label back to priority value for getPriorityIconElement
                const priorityLevel = priorityEntry[0] as PriorityLevel;
                const priorityValue = priorityEntry[1].threshold.min;
                return getPriorityIconElement(priorityValue, "h-5 w-5");
              }
              
              return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color }}></div>;
            };
                
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-2 rounded-lg bg-gray-700/50 hover:bg-gray-700 transition-colors"
                  >
                    {getIcon(item.label)}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-white font-medium truncate">{item.label}</div>
                      <div className="text-xs text-gray-400">{item.value} ({percentage}%)</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ filteredNodes, stats }) => {
  return (
    <div className="p-6 space-y-6">
      {/* Total Tasks - Full Width Card */}
      <div className="bg-gradient-to-br from-lime-500/15 via-lime-500/8 to-lime-500/5 rounded-lg p-8 border border-gray-700 border-l-4 border-l-lime-400/70 hover:from-lime-500/25 hover:via-lime-500/18 hover:to-lime-500/15 transition-all duration-200 hover:scale-[1.01] hover:-translate-y-1 cursor-pointer">
        <div className="flex items-center justify-center">
          <div className="flex-shrink-0">
            <Sigma className="h-12 w-12 text-lime-400" />
          </div>
          <div className="ml-6 text-center">
            <div className="text-2xl font-bold text-gray-300">Total Tasks</div>
            <div className="text-4xl font-bold text-lime-400">{stats.total}</div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Second Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={`${getStatusGradientBackground('NOT_STARTED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('NOT_STARTED').icon!, { className: `h-8 w-8 ${getStatusConfig('NOT_STARTED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Not Started</div>
              <div className={`text-3xl font-bold ${getStatusConfig('NOT_STARTED').color}`}>{stats.notStarted}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('PROPOSED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('PROPOSED').icon!, { className: `h-8 w-8 ${getStatusConfig('PROPOSED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Proposed</div>
              <div className={`text-3xl font-bold ${getStatusConfig('PROPOSED').color}`}>{stats.proposed}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('PLANNED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('PLANNED').icon!, { className: `h-8 w-8 ${getStatusConfig('PLANNED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Planned</div>
              <div className={`text-3xl font-bold ${getStatusConfig('PLANNED').color}`}>{stats.planned}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Third Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={`${getStatusGradientBackground('IN_PROGRESS' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('IN_PROGRESS').icon!, { className: `h-8 w-8 ${getStatusConfig('IN_PROGRESS').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">In Progress</div>
              <div className={`text-3xl font-bold ${getStatusConfig('IN_PROGRESS').color}`}>{stats.inProgress}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('IN_REVIEW' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('IN_REVIEW').icon!, { className: `h-8 w-8 ${getStatusConfig('IN_REVIEW').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">In Review</div>
              <div className={`text-3xl font-bold ${getStatusConfig('IN_REVIEW').color}`}>{stats.inReview}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('BLOCKED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('BLOCKED').icon!, { className: `h-8 w-8 ${getStatusConfig('BLOCKED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Blocked</div>
              <div className={`text-3xl font-bold ${getStatusConfig('BLOCKED').color}`}>{stats.blocked}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards - Fourth Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className={`${getStatusGradientBackground('ON_HOLD' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('ON_HOLD').icon!, { className: `h-8 w-8 ${getStatusConfig('ON_HOLD').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">On Hold</div>
              <div className={`text-3xl font-bold ${getStatusConfig('ON_HOLD').color}`}>{stats.onHold}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('COMPLETED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('COMPLETED').icon!, { className: `h-8 w-8 ${getStatusConfig('COMPLETED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Completed</div>
              <div className={`text-3xl font-bold ${getStatusConfig('COMPLETED').color}`}>{stats.completed}</div>
            </div>
          </div>
        </div>

        <div className={`${getStatusGradientBackground('CANCELLED' as WorkItemStatus, 'dashboard')} rounded-lg p-6 border border-gray-700 hover:scale-[1.02] hover:-translate-y-1 transition-all duration-200 cursor-pointer`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {React.createElement(getStatusConfig('CANCELLED').icon!, { className: `h-8 w-8 ${getStatusConfig('CANCELLED').color}` })}
            </div>
            <div className="ml-4">
              <div className="text-base font-bold text-gray-300">Cancelled</div>
              <div className={`text-3xl font-bold ${getStatusConfig('CANCELLED').color}`}>{stats.cancelled}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics Dashboard */}
      <div className="space-y-8 relative">
        {/* Dashboard Header */}
        <div className="text-center relative">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/10 to-transparent rounded-lg"></div>
          <div className="relative py-4">
            <div className="flex items-center justify-center space-x-3">
              <BarChart3 className="h-8 w-8" style={{ color: 'gold' }} />
              <h2 className="text-2xl font-bold mb-1" style={{ color: 'gold' }}>Analytics Dashboard</h2>
            </div>
            <p className="text-sm font-medium" style={{ color: 'mediumspringgreen' }}>Project metrics and distributions</p>
          </div>
        </div>

        {/* Pie Charts Container */}
        <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-600 rounded-lg p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <svg className="h-6 w-6" viewBox="0 0 90 90" style={{ fill: '#00FFFF' }}>
                <path d="M 41.808 45.075 L 56.531 1.497 C 52.85 0.524 48.987 0 45 0 C 20.147 0 0 20.147 0 45 c 0 24.853 20.147 45 45 45 c 4.727 0 9.283 -0.733 13.563 -2.085 L 41.808 45.075 z" fill="#00FFFF" fillOpacity="0.7"/>
                <path d="M 86.934 28.656 c -4.452 -11.41 -13.425 -20.558 -24.72 -25.239 L 49.59 40.788 L 86.934 28.656 z" fill="#00FFFF" fillOpacity="0.9"/>
                <path d="M 49.104 47.255 L 64.15 85.725 C 79.424 78.53 90 63.003 90 45 c 0 -3.659 -0.442 -7.214 -1.267 -10.62 L 49.104 47.255 z" fill="#00FFFF" fillOpacity="1"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: '#00FFFF' }}>Distribution Overview</h3>
                <p className="text-xs" style={{ color: '#FF6B35' }}>Statistical breakdown by status, priority, and type</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-lg shadow-blue-500/50"></div>
              <span className="text-xs text-gray-300 font-medium">Pie Charts</span>
            </div>
          </div>
          
          <div className="space-y-8">
            {/* Status Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Status Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={[
                    { label: WORK_ITEM_STATUSES.NOT_STARTED.label, value: stats.notStarted, color: WORK_ITEM_STATUSES.NOT_STARTED.hexColor },
                    { label: WORK_ITEM_STATUSES.PROPOSED.label, value: stats.proposed, color: WORK_ITEM_STATUSES.PROPOSED.hexColor },
                    { label: WORK_ITEM_STATUSES.PLANNED.label, value: stats.planned, color: WORK_ITEM_STATUSES.PLANNED.hexColor },
                    { label: WORK_ITEM_STATUSES.IN_PROGRESS.label, value: stats.inProgress, color: WORK_ITEM_STATUSES.IN_PROGRESS.hexColor },
                    { label: WORK_ITEM_STATUSES.IN_REVIEW.label, value: stats.inReview, color: WORK_ITEM_STATUSES.IN_REVIEW.hexColor },
                    { label: WORK_ITEM_STATUSES.BLOCKED.label, value: stats.blocked, color: WORK_ITEM_STATUSES.BLOCKED.hexColor },
                    { label: WORK_ITEM_STATUSES.ON_HOLD.label, value: stats.onHold, color: WORK_ITEM_STATUSES.ON_HOLD.hexColor },
                    { label: WORK_ITEM_STATUSES.COMPLETED.label, value: stats.completed, color: WORK_ITEM_STATUSES.COMPLETED.hexColor },
                    { label: WORK_ITEM_STATUSES.CANCELLED.label, value: stats.cancelled, color: WORK_ITEM_STATUSES.CANCELLED.hexColor }
                  ]}
                />
              </div>
            </div>

            {/* Priority Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Priority Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={[
                    { label: WORK_ITEM_PRIORITIES.critical.label, value: stats.priorityStats.critical, color: WORK_ITEM_PRIORITIES.critical.hexColor },
                    { label: WORK_ITEM_PRIORITIES.high.label, value: stats.priorityStats.high, color: WORK_ITEM_PRIORITIES.high.hexColor },
                    { label: WORK_ITEM_PRIORITIES.moderate.label, value: stats.priorityStats.moderate, color: WORK_ITEM_PRIORITIES.moderate.hexColor },
                    { label: WORK_ITEM_PRIORITIES.low.label, value: stats.priorityStats.low, color: WORK_ITEM_PRIORITIES.low.hexColor },
                    { label: WORK_ITEM_PRIORITIES.minimal.label, value: stats.priorityStats.minimal, color: WORK_ITEM_PRIORITIES.minimal.hexColor }
                  ]}
                />
              </div>
            </div>

            {/* Node Distribution */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Node Distribution</h4>
              <div className="w-full">
                <PieChart 
                  title=""
                  data={Object.entries(stats.typeStats)
                    .filter(([, count]) => count > 0)
                    .map(([type, count]) => ({
                      label: formatLabel(type),
                      value: count,
                      color: getTypeConfig(type as any).hexColor
                    }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Radar Charts Container */}
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-600 rounded-lg p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:border-gray-500">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <svg className="h-6 w-6" viewBox="0 0 24 24" fill="hotpink">
                <path d="M12 2l2.5 7h7l-5.5 4.5 2 6.5-6-4.5-6 4.5 2-6.5L2 9h7L12 2z" fillOpacity="0.3"/>
                <circle cx="12" cy="12" r="8" fill="none" stroke="hotpink" strokeWidth="1" strokeDasharray="2,2"/>
                <circle cx="12" cy="12" r="5" fill="none" stroke="hotpink" strokeWidth="1" strokeDasharray="1,1"/>
                <circle cx="12" cy="12" r="2" fill="none" stroke="hotpink" strokeWidth="1"/>
                <line x1="12" y1="4" x2="12" y2="20" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="4" y1="12" x2="20" y2="12" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="6.34" y1="6.34" x2="17.66" y2="17.66" stroke="hotpink" strokeWidth="0.5"/>
                <line x1="17.66" y1="6.34" x2="6.34" y2="17.66" stroke="hotpink" strokeWidth="0.5"/>
              </svg>
              <div>
                <h3 className="text-lg font-semibold" style={{ color: 'hotpink' }}>Radar Analysis</h3>
                <p className="text-xs" style={{ color: 'goldenrod' }}>Multi-dimensional data patterns</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shadow-lg shadow-green-500/50"></div>
              <span className="text-xs text-gray-300 font-medium">Radar Charts</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* Task Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Task Category Distribution</h4>
              <div className="w-full">
                <TaskDistributionRadar showLegend={false} />
              </div>
            </div>

            {/* Priority Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Priority Category Distribution</h4>
              <div className="w-full">
                <PriorityDistributionRadar showLegend={false} />
              </div>
            </div>

            {/* Node Category Distribution Radar */}
            <div className="flex flex-col items-center">
              <h4 className="text-base font-semibold text-white mb-4 tracking-wide">Node Category Distribution</h4>
              <div className="w-full">
                <NodeDistributionRadar showLegend={false} />
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;
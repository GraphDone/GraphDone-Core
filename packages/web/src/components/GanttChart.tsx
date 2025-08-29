import React from 'react';
import { GitBranch } from 'lucide-react';
import { Calendar, Clock, CheckCircle, getStatusConfig, WorkItemStatus } from '../constants/workItemConstants';

interface WorkItem {
  id: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priorityExec: number;
  priorityIndiv: number;
  priorityComm: number;
  priorityComp: number;
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

interface GanttChartProps {
  filteredNodes: WorkItem[];
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getStatusColor = (status: string) => {
  const config = getStatusConfig(status as WorkItemStatus);
  return config.bgColor;
};

const GanttChart: React.FC<GanttChartProps> = ({ filteredNodes }) => {
  // Generate timeline data
  const timelineData = filteredNodes.map((node, index) => {
    const startDate = new Date(node.createdAt);
    const endDate = node.dueDate ? new Date(node.dueDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const duration = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
    
    return {
      ...node,
      startDate,
      endDate,
      duration,
      row: index
    };
  });

  // Calculate timeline bounds
  const allDates = timelineData.flatMap(item => [item.startDate, item.endDate]);
  const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
  const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
  const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  // Generate week headers
  const weeks = [];
  const currentWeek = new Date(minDate);
  currentWeek.setDate(currentWeek.getDate() - currentWeek.getDay()); // Start of week
  
  for (let i = 0; i < Math.ceil(totalDays / 7) + 1; i++) {
    weeks.push(new Date(currentWeek));
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  return (
    <div className="p-6 bg-gray-900 h-full overflow-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <GitBranch className="h-6 w-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">Gantt Chart</h2>
        </div>
        <p className="text-gray-400">Interactive timeline showing task dependencies and progress</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            {/* Timeline Header */}
            <div className="flex bg-gray-700 border-b border-gray-600">
              <div className="w-80 px-4 py-3 border-r border-gray-600">
                <span className="text-sm font-medium text-gray-300">Tasks</span>
              </div>
              <div className="flex-1 flex">
                {weeks.map((week, index) => (
                  <div key={index} className="flex-1 min-w-[100px] px-2 py-3 border-r border-gray-600 text-center">
                    <div className="text-xs font-medium text-gray-300">
                      {week.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Timeline Rows */}
            <div className="space-y-0">
              {timelineData.map((item, index) => {
                const startOffset = Math.floor((item.startDate.getTime() - minDate.getTime()) / (1000 * 60 * 60 * 24));
                const barWidth = (item.duration / totalDays) * 100;
                const barLeft = (startOffset / totalDays) * 100;

                return (
                  <div key={item.id} className="flex border-b border-gray-700 hover:bg-gray-700/30 transition-colors">
                    {/* Task Info */}
                    <div className="w-80 px-4 py-4 border-r border-gray-600">
                      <div className="flex items-center space-x-3">
                        <div className={`w-3 h-3 rounded-full ${getStatusColor(item.status)}`}></div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{item.title}</div>
                          <div className="text-xs text-gray-400">{formatLabel(item.status)}</div>
                        </div>
                      </div>
                    </div>

                    {/* Timeline Bar */}
                    <div className="flex-1 relative py-4 px-2">
                      <div className="relative h-6">
                        <div 
                          className={`absolute h-6 ${getStatusColor(item.status)} rounded-md shadow-sm flex items-center px-2 transition-all duration-200 hover:shadow-lg`}
                          style={{
                            left: `${barLeft}%`,
                            width: `${Math.max(barWidth, 2)}%`
                          }}
                          title={`${item.title} (${item.duration} days)`}
                        >
                          <span className="text-xs font-medium text-white truncate">
                            {item.title.length > 15 ? item.title.substring(0, 15) + '...' : item.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 flex items-center space-x-6">
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          <span className="text-sm text-gray-300">Proposed</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-sm text-gray-300">Planned</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
          <span className="text-sm text-gray-300">In Progress</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-300">Completed</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-300">Blocked</span>
        </div>
      </div>
    </div>
  );
};

export default GanttChart;
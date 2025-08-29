import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Calendar, Clock, CheckCircle } from '../constants/workItemConstants';

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

interface CalendarViewProps {
  filteredNodes: WorkItem[];
}

const formatLabel = (label: string) => {
  return label
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'PROPOSED': return 'bg-cyan-500 text-white';
    case 'PLANNED': return 'bg-purple-500 text-white';
    case 'IN_PROGRESS': return 'bg-yellow-500 text-black';
    case 'COMPLETED': return 'bg-green-500 text-white';
    case 'BLOCKED': return 'bg-red-500 text-white';
    default: return 'bg-gray-500 text-white';
  }
};

const CalendarViewComponent: React.FC<CalendarViewProps> = ({ filteredNodes }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Group nodes by date
  const nodesByDate = useMemo(() => {
    const grouped: Record<string, WorkItem[]> = {};
    
    filteredNodes.forEach(node => {
      if (node.dueDate) {
        const dateKey = new Date(node.dueDate).toDateString();
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(node);
      }
    });
    
    return grouped;
  }, [filteredNodes]);

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    const firstCalendarDay = new Date(firstDayOfMonth);
    firstCalendarDay.setDate(firstCalendarDay.getDate() - firstDayOfMonth.getDay());
    
    const days = [];
    const currentDay = new Date(firstCalendarDay);
    
    // Generate 42 days (6 weeks)
    for (let i = 0; i < 42; i++) {
      days.push(new Date(currentDay));
      currentDay.setDate(currentDay.getDate() + 1);
    }
    
    return days;
  }, [currentDate]);

  const navigateMonth = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setMonth(newDate.getMonth() + (direction === 'next' ? 1 : -1));
    setCurrentDate(newDate);
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  return (
    <div className="p-6 bg-gray-900 h-full overflow-auto">
      <div className="mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <Calendar className="h-6 w-6 text-green-400" />
          <h2 className="text-2xl font-bold text-white">Calendar View</h2>
        </div>
        <p className="text-gray-400">Monthly calendar with due dates and milestones</p>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
        {/* Calendar Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <h3 className="text-xl font-semibold text-white">
            {currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
          </h3>
          
          <button
            onClick={() => navigateMonth('next')}
            className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center py-3 text-sm font-medium text-gray-400">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dateKey = day.toDateString();
            const dayNodes = nodesByDate[dateKey] || [];
            const isCurrentMonthDay = isCurrentMonth(day);
            const isTodayDay = isToday(day);

            return (
              <div
                key={index}
                className={`
                  min-h-[100px] p-2 border border-gray-600 rounded-lg transition-colors
                  ${isCurrentMonthDay ? 'bg-gray-700' : 'bg-gray-800/50'}
                  ${isTodayDay ? 'ring-2 ring-green-500' : ''}
                  hover:bg-gray-600
                `}
              >
                <div className={`text-sm font-medium mb-2 ${
                  isCurrentMonthDay ? 'text-white' : 'text-gray-500'
                } ${isTodayDay ? 'text-green-400' : ''}`}>
                  {day.getDate()}
                </div>
                
                <div className="space-y-1">
                  {dayNodes.slice(0, 3).map((node, nodeIndex) => (
                    <div
                      key={nodeIndex}
                      className={`text-xs px-2 py-1 rounded-full truncate ${getStatusColor(node.status)}`}
                      title={`${node.title} - ${formatLabel(node.status)}`}
                    >
                      {node.title.length > 12 ? node.title.substring(0, 12) + '...' : node.title}
                    </div>
                  ))}
                  {dayNodes.length > 3 && (
                    <div className="text-xs text-gray-400 px-2">
                      +{dayNodes.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Statistics */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            <div>
              <div className="text-sm font-medium text-gray-300">This Month</div>
              <div className="text-xl font-bold text-white">
                {Object.values(nodesByDate).flat().filter(node => {
                  if (!node.dueDate) return false;
                  const dueDate = new Date(node.dueDate);
                  return dueDate.getMonth() === currentDate.getMonth() && 
                         dueDate.getFullYear() === currentDate.getFullYear();
                }).length}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5 text-yellow-400" />
            <div>
              <div className="text-sm font-medium text-gray-300">Due Today</div>
              <div className="text-xl font-bold text-white">
                {(nodesByDate[new Date().toDateString()] || []).length}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-400" />
            <div>
              <div className="text-sm font-medium text-gray-300">Overdue</div>
              <div className="text-xl font-bold text-white">
                {filteredNodes.filter(node => {
                  if (!node.dueDate) return false;
                  return new Date(node.dueDate) < new Date() && node.status !== 'COMPLETED';
                }).length}
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center space-x-2">
            <Calendar className="h-5 w-5 text-purple-400" />
            <div>
              <div className="text-sm font-medium text-gray-300">No Due Date</div>
              <div className="text-xl font-bold text-white">
                {filteredNodes.filter(node => !node.dueDate).length}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarViewComponent;
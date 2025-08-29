import { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { ClipboardList, Calendar, Clock, CheckCircle, AlertCircle } from '../constants/workItemConstants';
import { RadarChart } from './RadarChart';
import { useGraph } from '../contexts/GraphContext';
import { useQuery, gql } from '@apollo/client';

const GET_TASK_DISTRIBUTION = gql`
  query GetTaskDistribution($graphId: ID) {
    workItems(where: { graph: { id: $graphId } }) {
      type
      status
    }
  }
`;

interface TaskDistributionRadarProps {
  className?: string;
  showLegend?: boolean;
}

export function TaskDistributionRadar({ className = '', showLegend = true }: TaskDistributionRadarProps) {
  const { currentGraph } = useGraph();
  const [zoomLevel, setZoomLevel] = useState(1);
  const { data: taskData, loading, error } = useQuery(GET_TASK_DISTRIBUTION, {
    variables: { graphId: currentGraph?.id },
    skip: !currentGraph?.id
  });

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 2));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.5));
  };

  const handleReset = () => {
    setZoomLevel(1);
  };

  const radarData = useMemo(() => {
    if (!taskData?.workItems) return [];

    // Count tasks by status using the same logic as ListView
    const statusCounts = {
      proposed: 0,
      planned: 0,
      inProgress: 0,
      blocked: 0,
      completed: 0
    };

    taskData.workItems.forEach((item: any) => {
      switch(item.status) {
        case 'PROPOSED':
          statusCounts.proposed++;
          break;
        case 'PLANNED':
          statusCounts.planned++;
          break;
        case 'IN_PROGRESS':
        case 'ACTIVE':
          statusCounts.inProgress++;
          break;
        case 'BLOCKED':
          statusCounts.blocked++;
          break;
        case 'COMPLETED':
          statusCounts.completed++;
          break;
      }
    });

    // Status colors matching the pie chart
    const statusData = [
      { axis: 'Proposed', value: statusCounts.proposed, color: '#22d3ee' },
      { axis: 'Planned', value: statusCounts.planned, color: '#c084fc' },
      { axis: 'In Progress', value: statusCounts.inProgress, color: '#facc15' },
      { axis: 'Completed', value: statusCounts.completed, color: '#4ade80' },
      { axis: 'Blocked', value: statusCounts.blocked, color: '#ef4444' }
    ].filter(item => item.value > 0); // Only show statuses with tasks

    const maxValue = Math.max(...statusData.map(item => item.value), 1);
    
    return statusData.map(item => ({
      ...item,
      maxValue: maxValue
    }));
  }, [taskData]);


  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  if (error || !taskData) {
    return (
      <div className={`${className} flex items-center justify-center h-64 text-gray-400`}>
        <p>Unable to load task distribution data</p>
      </div>
    );
  }

  if (radarData.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64 text-gray-400`}>
        <div className="text-center">
          <p className="mb-2">No tasks found</p>
          <p className="text-sm">Create some work items to see the distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Task Status Distribution */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <div className="mb-4">
        </div>
        <div className="relative">
          {/* Zoom Controls */}
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
              onClick={handleReset}
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
              <RadarChart
                data={radarData}
                width={500}
                height={500}
                margin={80}
                radarColor="#8B4513"
              />
            </div>
          </div>
        </div>
        {showLegend && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Status Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
              {radarData.map((item, index) => {
                const getIcon = (axis: string) => {
                  switch(axis) {
                    case 'Proposed': return <ClipboardList className="h-5 w-5" style={{ color: item.color || '#22d3ee' }} />;
                    case 'Planned': return <Calendar className="h-5 w-5" style={{ color: item.color || '#c084fc' }} />;
                    case 'In Progress': return <Clock className="h-5 w-5" style={{ color: item.color || '#facc15' }} />;
                    case 'Completed': return <CheckCircle className="h-5 w-5" style={{ color: item.color || '#4ade80' }} />;
                    case 'Blocked': return <AlertCircle className="h-5 w-5" style={{ color: item.color || '#ef4444' }} />;
                    default: return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color || '#4ade80' }}></div>;
                  }
                };
                
                return (
                  <div key={index} className="bg-gray-700 rounded p-3">
                    <div className="flex items-center mb-2">
                      {getIcon(item.axis)}
                      <span className="text-gray-200 text-base ml-2">{item.axis}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xl font-bold text-white">{item.value}</span>
                      <span className="text-base text-gray-400 ml-1">tasks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
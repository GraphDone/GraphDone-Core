import { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Flame, Zap, Triangle, Circle, ArrowDown } from 'lucide-react';
import { RadarChart } from './RadarChart';
import { useGraph } from '../contexts/GraphContext';
import { useQuery, gql } from '@apollo/client';

const GET_PRIORITY_DISTRIBUTION = gql`
  query GetPriorityDistribution($graphId: ID) {
    workItems(where: { graph: { id: $graphId } }) {
      priorityExec
      priorityIndiv
      priorityComm
      priorityComp
    }
  }
`;

interface PriorityDistributionRadarProps {
  className?: string;
  showLegend?: boolean;
}

export function PriorityDistributionRadar({ className = '', showLegend = true }: PriorityDistributionRadarProps) {
  const { currentGraph } = useGraph();
  const [zoomLevel, setZoomLevel] = useState(1);
  const { data: queryData, loading, error } = useQuery(GET_PRIORITY_DISTRIBUTION, {
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
    if (!queryData?.workItems) return [];

    // Calculate priority levels based on composite priority
    const priorityCounts = {
      critical: 0,
      high: 0,
      moderate: 0,
      low: 0,
      minimal: 0
    };

    queryData.workItems.forEach((item: any) => {
      // Calculate composite priority (average of all priorities)
      const compositePriority = (
        (item.priorityExec || 0) + 
        (item.priorityIndiv || 0) + 
        (item.priorityComm || 0) + 
        (item.priorityComp || 0)
      ) / 4;

      if (compositePriority >= 0.8) {
        priorityCounts.critical++;
      } else if (compositePriority >= 0.6) {
        priorityCounts.high++;
      } else if (compositePriority >= 0.4) {
        priorityCounts.moderate++;
      } else if (compositePriority >= 0.2) {
        priorityCounts.low++;
      } else {
        priorityCounts.minimal++;
      }
    });

    // Priority colors matching the pie chart
    const priorityData = [
      { axis: 'Critical', value: priorityCounts.critical, color: '#ef4444' },
      { axis: 'High', value: priorityCounts.high, color: '#f97316' },
      { axis: 'Moderate', value: priorityCounts.moderate, color: '#eab308' },
      { axis: 'Low', value: priorityCounts.low, color: '#3b82f6' },
      { axis: 'Minimal', value: priorityCounts.minimal, color: '#6b7280' }
    ].filter(item => item.value > 0); // Only show priorities with tasks

    const maxValue = Math.max(...priorityData.map(item => item.value), 1);
    
    return priorityData.map(item => ({
      ...item,
      maxValue: maxValue
    }));
  }, [queryData]);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center h-64`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
      </div>
    );
  }

  if (error || !queryData) {
    return (
      <div className={`${className} flex items-center justify-center h-64 text-gray-400`}>
        <p>Unable to load priority distribution data</p>
      </div>
    );
  }

  if (radarData.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64 text-gray-400`}>
        <div className="text-center">
          <p className="mb-2">No priority data found</p>
          <p className="text-sm">Create some work items to see the distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Priority Distribution */}
      <div className="bg-gray-800 border border-gray-600 rounded-lg p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-white mb-2">Priority Distribution</h3>
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
                radarColor="#8A2BE2"
              />
            </div>
          </div>
        </div>
        {showLegend && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Priority Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-3">
              {radarData.map((item, index) => {
                const getIcon = (axis: string) => {
                  switch(axis) {
                    case 'Critical': return <Flame className="h-5 w-5" style={{ color: item.color || '#ef4444' }} />;
                    case 'High': return <Zap className="h-5 w-5" style={{ color: item.color || '#f97316' }} />;
                    case 'Moderate': return <Triangle className="h-5 w-5" style={{ color: item.color || '#eab308' }} />;
                    case 'Low': return <Circle className="h-5 w-5" style={{ color: item.color || '#3b82f6' }} />;
                    case 'Minimal': return <ArrowDown className="h-5 w-5" style={{ color: item.color || '#6b7280' }} />;
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
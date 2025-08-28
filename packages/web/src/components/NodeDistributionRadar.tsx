import { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Layers, Trophy, Target, Sparkles, ListTodo, AlertTriangle, Lightbulb, Microscope } from 'lucide-react';
import { RadarChart } from './RadarChart';
import { useGraph } from '../contexts/GraphContext';
import { useQuery, gql } from '@apollo/client';

const GET_NODE_DISTRIBUTION = gql`
  query GetNodeDistribution($graphId: ID) {
    workItems(where: { graph: { id: $graphId } }) {
      type
    }
  }
`;

interface NodeDistributionRadarProps {
  className?: string;
  showLegend?: boolean;
}

export function NodeDistributionRadar({ className = '', showLegend = true }: NodeDistributionRadarProps) {
  const { currentGraph } = useGraph();
  const [zoomLevel, setZoomLevel] = useState(1);
  const { data: queryData, loading, error } = useQuery(GET_NODE_DISTRIBUTION, {
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

    // Count nodes by type
    const typeCounts: { [key: string]: number } = {};

    queryData.workItems.forEach((item: any) => {
      const type = item.type;
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    });

    // Format label function
    const formatLabel = (type: string) => {
      switch(type) {
        case 'EPIC': return 'Epic';
        case 'MILESTONE': return 'Milestone';
        case 'OUTCOME': return 'Outcome';
        case 'FEATURE': return 'Feature';
        case 'TASK': return 'Task';
        case 'BUG': return 'Bug';
        case 'IDEA': return 'Idea';
        case 'RESEARCH': return 'Research';
        default: return type.charAt(0) + type.slice(1).toLowerCase();
      }
    };

    // Node type colors and order matching the pie chart exactly
    const typeOrder = ['EPIC', 'MILESTONE', 'OUTCOME', 'FEATURE', 'TASK', 'BUG', 'IDEA', 'RESEARCH'];
    
    const nodeTypeData = typeOrder
      .filter(type => typeCounts[type] > 0)
      .map(type => ({
        axis: formatLabel(type),
        value: typeCounts[type],
        color: type === 'EPIC' ? '#c084fc' : 
               type === 'MILESTONE' ? '#fb923c' :
               type === 'OUTCOME' ? '#818cf8' :
               type === 'FEATURE' ? '#38bdf8' :
               type === 'TASK' ? '#4ade80' :
               type === 'BUG' ? '#ef4444' :
               type === 'IDEA' ? '#fde047' :
               type === 'RESEARCH' ? '#2dd4bf' : '#6b7280'
      }));

    const maxValue = Math.max(...nodeTypeData.map(item => item.value), 1);
    
    return nodeTypeData.map(item => ({
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
        <p>Unable to load node distribution data</p>
      </div>
    );
  }

  if (radarData.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center h-64 text-gray-400`}>
        <div className="text-center">
          <p className="mb-2">No node data found</p>
          <p className="text-sm">Create some work items to see the distribution</p>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Node Distribution */}
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
                radarColor="#CD5C5C"
              />
            </div>
          </div>
        </div>
        {showLegend && (
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-300 mb-3">Node Type Breakdown</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {radarData.map((item, index) => {
                const getIcon = (axis: string) => {
                  switch(axis) {
                    case 'Epic': return <Layers className="h-5 w-5" style={{ color: item.color || '#c084fc' }} />;
                    case 'Milestone': return <Trophy className="h-5 w-5" style={{ color: item.color || '#fb923c' }} />;
                    case 'Outcome': return <Target className="h-5 w-5" style={{ color: item.color || '#818cf8' }} />;
                    case 'Feature': return <Sparkles className="h-5 w-5" style={{ color: item.color || '#38bdf8' }} />;
                    case 'Task': return <ListTodo className="h-5 w-5" style={{ color: item.color || '#4ade80' }} />;
                    case 'Bug': return <AlertTriangle className="h-5 w-5" style={{ color: item.color || '#ef4444' }} />;
                    case 'Idea': return <Lightbulb className="h-5 w-5" style={{ color: item.color || '#fde047' }} />;
                    case 'Research': return <Microscope className="h-5 w-5" style={{ color: item.color || '#2dd4bf' }} />;
                    default: return <div className="w-4 h-4 rounded-full" style={{ backgroundColor: item.color || '#6b7280' }}></div>;
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
                      <span className="text-base text-gray-400 ml-1">nodes</span>
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
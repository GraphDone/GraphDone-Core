import { RadarChart } from '../components/RadarChart';

export function RadarChartDemo() {
  const sampleData = [
    { axis: 'Strategy', value: 25, maxValue: 50 },
    { axis: 'Development', value: 40, maxValue: 50 },
    { axis: 'Quality', value: 15, maxValue: 50 },
    { axis: 'Operations', value: 8, maxValue: 50 },
    { axis: 'Documentation', value: 12, maxValue: 50 },
    { axis: 'Analysis', value: 20, maxValue: 50 }
  ];

  const completionData = [
    { axis: 'Strategy', value: 75, maxValue: 100 },
    { axis: 'Development', value: 60, maxValue: 100 },
    { axis: 'Quality', value: 90, maxValue: 100 },
    { axis: 'Operations', value: 45, maxValue: 100 },
    { axis: 'Documentation', value: 30, maxValue: 100 },
    { axis: 'Analysis', value: 85, maxValue: 100 }
  ];

  return (
    <div className="p-6 bg-gray-900 min-h-screen">
      <h1 className="text-2xl font-bold text-gray-100 mb-6">Radar Chart Demo</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Task Count by Category</h2>
          <RadarChart data={sampleData} width={350} height={350} />
        </div>
        
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-100 mb-4">Completion Rate by Category</h2>
          <RadarChart data={completionData} width={350} height={350} />
        </div>
      </div>
      
      <div className="mt-8 bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-100 mb-4">How to Use</h2>
        <ul className="text-gray-300 space-y-2">
          <li>• The radar chart visualizes task distribution across different categories</li>
          <li>• Each axis represents a task category (Strategy, Development, Quality, etc.)</li>
          <li>• The distance from center shows the relative value for that category</li>
          <li>• Hover over data points to see exact values</li>
          <li>• The chart automatically scales based on the maximum values in your data</li>
        </ul>
      </div>
    </div>
  );
}
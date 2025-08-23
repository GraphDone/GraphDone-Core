import { useState } from 'react';
import { TrendingUp, Users, Target, Activity, PieChart } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';
import { TaskDistributionRadar } from '../components/TaskDistributionRadar';

export function Analytics() {
  const { currentGraph } = useGraph();
  const { } = useAuth();
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'quarter'>('week');
  const [activeTab, setActiveTab] = useState<'overview' | 'priority' | 'collaboration' | 'distribution' | 'insights'>('overview');

  // Mock analytics data
  const mockMetrics = {
    totalNodes: 247,
    activeNodes: 89,
    completedThisWeek: 23,
    avgPriority: 0.67,
    participationRate: 0.85,
    consensusScore: 0.78
  };

  const priorityTrends = [
    { date: '2024-03-14', avgPriority: 0.62, votes: 45 },
    { date: '2024-03-15', avgPriority: 0.65, votes: 52 },
    { date: '2024-03-16', avgPriority: 0.67, votes: 48 },
    { date: '2024-03-17', avgPriority: 0.64, votes: 56 },
    { date: '2024-03-18', avgPriority: 0.69, votes: 62 },
    { date: '2024-03-19', avgPriority: 0.71, votes: 58 },
    { date: '2024-03-20', avgPriority: 0.67, votes: 65 }
  ];

  const topNodes = [
    { id: '1', title: 'User Authentication System', priority: 0.89, votes: 23, trend: 'up' },
    { id: '2', title: 'Mobile App Release', priority: 0.84, votes: 19, trend: 'up' },
    { id: '3', title: 'Performance Optimization', priority: 0.78, votes: 31, trend: 'stable' },
    { id: '4', title: 'API Documentation', priority: 0.72, votes: 15, trend: 'down' },
    { id: '5', title: 'Bug Fix: Login Issue', priority: 0.69, votes: 28, trend: 'up' }
  ];

  const collaborationData = [
    { user: 'Alice Johnson', contributions: 45, votes: 128, consensus: 0.87 },
    { user: 'Bob Smith', contributions: 38, votes: 95, consensus: 0.81 },
    { user: 'Carol Davis', contributions: 29, votes: 76, consensus: 0.79 },
    { user: 'David Wilson', contributions: 22, votes: 54, consensus: 0.75 }
  ];

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Analytics</h1>
            <p className="text-sm text-gray-400 mt-1">
              Democratic prioritization insights for {currentGraph?.name || 'your graphs'}
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as any)}
              className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="day">Last 24 Hours</option>
              <option value="week">Last Week</option>
              <option value="month">Last Month</option>
              <option value="quarter">Last Quarter</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-gray-900 border-b border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'overview'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab('priority')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'priority'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Target className="h-4 w-4 inline mr-2" />
              Priority Trends
            </button>
            <button
              onClick={() => setActiveTab('collaboration')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'collaboration'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Collaboration
            </button>
            <button
              onClick={() => setActiveTab('distribution')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'distribution'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <PieChart className="h-4 w-4 inline mr-2" />
              Distribution
            </button>
            <button
              onClick={() => setActiveTab('insights')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'insights'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Insights
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Key Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Total Nodes</p>
                      <p className="text-3xl font-bold text-gray-100">{mockMetrics.totalNodes}</p>
                      <p className="text-sm text-green-400">+12 this week</p>
                    </div>
                    <Target className="h-12 w-12 text-green-400" />
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Avg Priority</p>
                      <p className="text-3xl font-bold text-gray-100">{Math.round(mockMetrics.avgPriority * 100)}%</p>
                      <p className="text-sm text-green-400">+5% this week</p>
                    </div>
                    <TrendingUp className="h-12 w-12 text-green-400" />
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Participation</p>
                      <p className="text-3xl font-bold text-gray-100">{Math.round(mockMetrics.participationRate * 100)}%</p>
                      <p className="text-sm text-green-400">Team engagement</p>
                    </div>
                    <Users className="h-12 w-12 text-green-400" />
                  </div>
                </div>
              </div>

              {/* Top Priority Nodes */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-100">Top Priority Nodes</h3>
                  <p className="text-sm text-gray-400">Based on community voting</p>
                </div>
                <div className="divide-y divide-gray-700">
                  {topNodes.map((node, index) => (
                    <div key={node.id} className="p-6 flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-green-900 text-green-300 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </div>
                        <div>
                          <h4 className="font-medium text-gray-100">{node.title}</h4>
                          <div className="flex items-center space-x-3 text-sm text-gray-400">
                            <span>{node.votes} votes</span>
                            <span>•</span>
                            <div className="flex items-center">
                              {node.trend === 'up' ? (
                                <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
                              ) : node.trend === 'down' ? (
                                <TrendingUp className="h-3 w-3 text-red-400 mr-1 rotate-180" />
                              ) : (
                                <div className="w-3 h-3 bg-gray-400 rounded-full mr-1" />
                              )}
                              <span className={
                                node.trend === 'up' ? 'text-green-400' :
                                node.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                              }>
                                {node.trend}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-semibold text-gray-100">
                          {Math.round(node.priority * 100)}%
                        </div>
                        <div className="w-24 h-2 bg-gray-600 rounded-full mt-1">
                          <div 
                            className="h-2 bg-green-500 rounded-full"
                            style={{ width: `${node.priority * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'priority' && (
            <div className="space-y-6">
              {/* Priority Trends Chart Placeholder */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-100 mb-4">Priority Trends</h3>
                <div className="h-64 bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-300">Priority trends chart</p>
                    <p className="text-sm text-gray-400">Shows how community priorities change over time</p>
                  </div>
                </div>
              </div>

              {/* Voting Activity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h4 className="font-medium text-gray-100 mb-4">Recent Voting Activity</h4>
                  <div className="space-y-3">
                    {priorityTrends.slice(-5).map((trend, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                          {new Date(trend.date).toLocaleDateString()}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-100">{trend.votes} votes</span>
                          <div className="w-16 h-2 bg-gray-600 rounded-full">
                            <div 
                              className="h-2 bg-green-500 rounded-full"
                              style={{ width: `${trend.avgPriority * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <h4 className="font-medium text-gray-100 mb-4">Democratic Indicators</h4>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Consensus Score</span>
                        <span className="text-gray-100">{Math.round(mockMetrics.consensusScore * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-600 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${mockMetrics.consensusScore * 100}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Participation Rate</span>
                        <span className="text-gray-100">{Math.round(mockMetrics.participationRate * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-600 rounded-full">
                        <div 
                          className="h-2 bg-green-500 rounded-full"
                          style={{ width: `${mockMetrics.participationRate * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t border-gray-600">
                      <p className="text-xs text-gray-400">
                        High consensus and participation indicate healthy democratic prioritization
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'collaboration' && (
            <div className="space-y-6">
              {/* Team Collaboration Stats */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg">
                <div className="p-6 border-b border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-100">Team Collaboration</h3>
                  <p className="text-sm text-gray-400">Individual contributions and consensus building</p>
                </div>
                <div className="divide-y divide-gray-700">
                  {collaborationData.map((user, index) => (
                    <div key={index} className="p-6">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-medium text-gray-100">{user.user}</h4>
                        <span className="text-sm text-gray-400">Consensus: {Math.round(user.consensus * 100)}%</span>
                      </div>
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Contributions</span>
                          <div className="font-medium text-gray-100">{user.contributions}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Votes Cast</span>
                          <div className="font-medium text-gray-100">{user.votes}</div>
                        </div>
                        <div>
                          <span className="text-gray-400">Consensus</span>
                          <div className="w-full h-2 bg-gray-600 rounded-full mt-1">
                            <div 
                              className="h-2 bg-green-500 rounded-full"
                              style={{ width: `${user.consensus * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'distribution' && (
            <div className="space-y-6">
              <TaskDistributionRadar />
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-100 mb-2">AI-Generated Insights</h3>
                <p className="text-gray-400 mb-4">
                  Coming soon: Intelligent analysis of your team's collaboration patterns
                </p>
                <ul className="text-sm text-gray-300 space-y-1 max-w-md mx-auto">
                  <li>• Priority conflict detection</li>
                  <li>• Collaboration bottleneck identification</li>
                  <li>• Optimal resource allocation suggestions</li>
                  <li>• Democratic health scoring</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
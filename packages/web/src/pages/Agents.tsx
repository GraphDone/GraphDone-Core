import { useState } from 'react';
import { Plus, Bot, Activity, Settings, Play, Pause, Trash2, Eye } from 'lucide-react';
import { useGraph } from '../contexts/GraphContext';
import { useAuth } from '../contexts/AuthContext';

interface Agent {
  id: string;
  name: string;
  description: string;
  type: 'analyzer' | 'generator' | 'validator' | 'coordinator';
  status: 'active' | 'paused' | 'error' | 'idle';
  capabilities: string[];
  lastActivity: string;
  actionsToday: number;
  connectedGraphs: string[];
  owner: string;
}

export function Agents() {
  const { currentGraph } = useGraph();
  const { } = useAuth();
  const [activeTab, setActiveTab] = useState<'active' | 'available' | 'marketplace'>('active');

  // Mock agents
  const mockAgents: Agent[] = [
    {
      id: 'agent-1',
      name: 'Priority Analyzer',
      description: 'Automatically analyzes node priorities and suggests optimizations',
      type: 'analyzer',
      status: 'active',
      capabilities: ['priority-calculation', 'dependency-analysis', 'bottleneck-detection'],
      lastActivity: '2 minutes ago',
      actionsToday: 23,
      connectedGraphs: ['graph-1', 'graph-2'],
      owner: 'system'
    },
    {
      id: 'agent-2',
      name: 'Task Generator',
      description: 'Breaks down outcomes into actionable tasks',
      type: 'generator',
      status: 'active',
      capabilities: ['task-decomposition', 'requirement-analysis', 'template-matching'],
      lastActivity: '15 minutes ago',
      actionsToday: 8,
      connectedGraphs: ['graph-1'],
      owner: 'user-1'
    },
    {
      id: 'agent-3',
      name: 'Dependency Validator',
      description: 'Validates and suggests improvements for node dependencies',
      type: 'validator',
      status: 'paused',
      capabilities: ['dependency-validation', 'cycle-detection', 'path-optimization'],
      lastActivity: '2 hours ago',
      actionsToday: 0,
      connectedGraphs: [],
      owner: 'user-2'
    },
    {
      id: 'agent-4',
      name: 'Team Coordinator',
      description: 'Facilitates collaboration and resolves conflicts',
      type: 'coordinator',
      status: 'idle',
      capabilities: ['conflict-resolution', 'resource-allocation', 'timeline-management'],
      lastActivity: '1 day ago',
      actionsToday: 2,
      connectedGraphs: ['graph-1', 'graph-3'],
      owner: 'system'
    }
  ];

  const getStatusColor = (status: Agent['status']) => {
    switch (status) {
      case 'active': return 'text-green-600 bg-green-50 border-green-200';
      case 'paused': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'error': return 'text-red-600 bg-red-50 border-red-200';
      case 'idle': return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: Agent['type']) => {
    switch (type) {
      case 'analyzer': return '🔍';
      case 'generator': return '⚡';
      case 'validator': return '✓';
      case 'coordinator': return '🤝';
    }
  };

  const activeAgents = mockAgents.filter(agent => 
    agent.status === 'active' && 
    (agent.connectedGraphs.includes(currentGraph?.id || '') || agent.owner === 'system')
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">AI Agents</h1>
            <p className="text-sm text-gray-500 mt-1">
              Collaborate with AI agents as peers in your work graph
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              type="button"
              className="btn btn-secondary"
            >
              <Settings className="h-4 w-4 mr-2" />
              Agent Settings
            </button>
            
            <button
              type="button"
              className="btn btn-primary"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Agent
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Active ({activeAgents.length})
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'available'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Available ({mockAgents.length})
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'marketplace'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Marketplace
            </button>
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeTab === 'active' && (
            <div className="space-y-6">
              {/* Current Graph Context */}
              {currentGraph && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-medium text-blue-900 mb-2">Current Graph: {currentGraph.name}</h3>
                  <p className="text-blue-700 text-sm">
                    Agents shown below are active in this graph or available system-wide.
                  </p>
                </div>
              )}

              {/* Active Agents */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeAgents.map((agent) => (
                  <div key={agent.id} className="bg-white border border-gray-200 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg">
                          {getTypeIcon(agent.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </span>
                            <span className="text-xs text-gray-500">{agent.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        {agent.status === 'active' ? (
                          <button className="p-2 text-gray-400 hover:text-yellow-600 transition-colors">
                            <Pause className="h-4 w-4" />
                          </button>
                        ) : (
                          <button className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-600 text-sm mb-4">{agent.description}</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Last Activity:</span>
                        <span className="text-gray-900">{agent.lastActivity}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Actions Today:</span>
                        <span className="text-gray-900">{agent.actionsToday}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500">Connected Graphs:</span>
                        <span className="text-gray-900">{agent.connectedGraphs.length}</span>
                      </div>

                      <div>
                        <span className="text-sm text-gray-500 block mb-2">Capabilities:</span>
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.map((capability) => (
                            <span key={capability} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded">
                              {capability}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {activeAgents.length === 0 && (
                <div className="text-center py-12">
                  <Bot className="h-16 w-16 mx-auto text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No Active Agents</h3>
                  <p className="text-gray-500 mb-4">
                    {currentGraph 
                      ? `No agents are currently active in "${currentGraph.name}"`
                      : 'Select a graph to see active agents'
                    }
                  </p>
                  <button className="btn btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Activate Agent
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'available' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {mockAgents.map((agent) => (
                <div key={agent.id} className="bg-white border border-gray-200 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg">
                        {getTypeIcon(agent.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{agent.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-green-600 transition-colors">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-600 text-sm mb-4">{agent.description}</p>

                  <div className="text-sm text-gray-500">
                    {agent.owner === 'system' ? 'System Agent' : `Created by ${agent.owner}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Agent Marketplace</h3>
              <p className="text-gray-500 mb-4">
                Discover and install community-created AI agents
              </p>
              <button className="btn btn-primary">
                Browse Marketplace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
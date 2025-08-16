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
      case 'active': return 'text-green-400 bg-green-900 border-green-700';
      case 'paused': return 'text-yellow-400 bg-yellow-900 border-yellow-700';
      case 'error': return 'text-red-400 bg-red-900 border-red-700';
      case 'idle': return 'text-gray-400 bg-gray-700 border-gray-600';
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
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">AI Agents</h1>
            <p className="text-sm text-gray-400 mt-1">
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
      <div className="bg-gray-900 border-b border-gray-700">
        <div className="px-6">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('active')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'active'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              <Activity className="h-4 w-4 inline mr-2" />
              Active ({activeAgents.length})
            </button>
            <button
              onClick={() => setActiveTab('available')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'available'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
              }`}
            >
              Available ({mockAgents.length})
            </button>
            <button
              onClick={() => setActiveTab('marketplace')}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'marketplace'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-600'
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
                <div className="bg-green-900 border border-green-700 rounded-lg p-4">
                  <h3 className="font-medium text-green-300 mb-2">Current Graph: {currentGraph.name}</h3>
                  <p className="text-green-400 text-sm">
                    Agents shown below are active in this graph or available system-wide.
                  </p>
                </div>
              )}

              {/* Active Agents */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {activeAgents.map((agent) => (
                  <div key={agent.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-900 rounded-lg flex items-center justify-center text-lg">
                          {getTypeIcon(agent.type)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-100">{agent.name}</h3>
                          <div className="flex items-center space-x-2">
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                              {agent.status}
                            </span>
                            <span className="text-xs text-gray-400">{agent.type}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1">
                        <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
                          <Eye className="h-4 w-4" />
                        </button>
                        {agent.status === 'active' ? (
                          <button className="p-2 text-gray-400 hover:text-yellow-400 transition-colors">
                            <Pause className="h-4 w-4" />
                          </button>
                        ) : (
                          <button className="p-2 text-gray-400 hover:text-green-400 transition-colors">
                            <Play className="h-4 w-4" />
                          </button>
                        )}
                        <button className="p-2 text-gray-400 hover:text-red-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <p className="text-gray-300 text-sm mb-4">{agent.description}</p>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Last Activity:</span>
                        <span className="text-gray-100">{agent.lastActivity}</span>
                      </div>
                      
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Actions Today:</span>
                        <span className="text-gray-100">{agent.actionsToday}</span>
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Connected Graphs:</span>
                        <span className="text-gray-100">{agent.connectedGraphs.length}</span>
                      </div>

                      <div>
                        <span className="text-sm text-gray-400 block mb-2">Capabilities:</span>
                        <div className="flex flex-wrap gap-1">
                          {agent.capabilities.map((capability) => (
                            <span key={capability} className="bg-gray-700 text-gray-300 text-xs px-2 py-1 rounded">
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
                  <h3 className="text-lg font-medium text-gray-100 mb-2">No Active Agents</h3>
                  <p className="text-gray-400 mb-4">
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
                <div key={agent.id} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-900 rounded-lg flex items-center justify-center text-lg">
                        {getTypeIcon(agent.type)}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-100">{agent.name}</h3>
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(agent.status)}`}>
                          {agent.status}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1">
                      <button className="p-2 text-gray-400 hover:text-gray-300 transition-colors">
                        <Eye className="h-4 w-4" />
                      </button>
                      <button className="p-2 text-gray-400 hover:text-green-400 transition-colors">
                        <Play className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-gray-300 text-sm mb-4">{agent.description}</p>

                  <div className="text-sm text-gray-400">
                    {agent.owner === 'system' ? 'System Agent' : `Created by ${agent.owner}`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'marketplace' && (
            <div className="text-center py-12">
              <Bot className="h-16 w-16 mx-auto text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-100 mb-2">Agent Marketplace</h3>
              <p className="text-gray-400 mb-4">
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
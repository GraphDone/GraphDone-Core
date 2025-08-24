import React, { useState } from 'react';
import { Save, RotateCcw, Users, Settings as SettingsIcon } from 'lucide-react';
import { UserManagement } from '../components/UserManagement';
import { useAuth } from '../contexts/AuthContext';

export function Settings() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('app');
  const [settings, setSettings] = React.useState({
    autoLayout: true,
    showPriorityIndicators: true,
    enableAnimations: true,
    theme: 'light',
    defaultViewMode: '3d'
  });

  const canManageUsers = currentUser && ['PATH_KEEPER', 'GRAPH_MASTER'].includes(currentUser.role);

  const handleSave = () => {
    // Save settings functionality to be implemented
  };

  const handleReset = () => {
    setSettings({
      autoLayout: true,
      showPriorityIndicators: true,
      enableAnimations: true,
      theme: 'light',
      defaultViewMode: '3d'
    });
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
            <p className="text-sm text-gray-400 mt-1">
              Customize your GraphDone experience
            </p>
          </div>
          
          {/* Tab Navigation */}
          <div className="flex space-x-2">
            <button
              onClick={() => setActiveTab('app')}
              className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                activeTab === 'app' 
                  ? 'bg-gray-700 text-gray-100' 
                  : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
              }`}
            >
              <SettingsIcon className="h-4 w-4" />
              <span>App Settings</span>
            </button>
            
            {canManageUsers && (
              <button
                onClick={() => setActiveTab('users')}
                className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                  activeTab === 'users' 
                    ? 'bg-gray-700 text-gray-100' 
                    : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                }`}
              >
                <Users className="h-4 w-4" />
                <span>User Management</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeTab === 'users' && canManageUsers ? (
          <UserManagement />
        ) : (
          <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-100">Application Settings</h2>
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={handleReset}
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Reset
                </button>
                
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSave}
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save Changes
                </button>
              </div>
            </div>
            
            <div className="space-y-8">
              {/* Graph Visualization */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Graph Visualization</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Auto-layout</label>
                      <p className="text-sm text-gray-400">Automatically arrange nodes for optimal viewing</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.autoLayout}
                      onChange={(e) => setSettings(prev => ({ ...prev, autoLayout: e.target.checked }))}
                      className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Priority Indicators</label>
                      <p className="text-sm text-gray-400">Show visual priority indicators on nodes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.showPriorityIndicators}
                      onChange={(e) => setSettings(prev => ({ ...prev, showPriorityIndicators: e.target.checked }))}
                      className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-300">Enable Animations</label>
                      <p className="text-sm text-gray-400">Smooth transitions and animations in the graph</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={settings.enableAnimations}
                      onChange={(e) => setSettings(prev => ({ ...prev, enableAnimations: e.target.checked }))}
                      className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
                    />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Appearance</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Theme</label>
                    <select
                      value={settings.theme}
                      onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                      className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                      <option value="auto">Auto</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Default View Mode</label>
                    <select
                      value={settings.defaultViewMode}
                      onChange={(e) => setSettings(prev => ({ ...prev, defaultViewMode: e.target.value }))}
                      className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded-lg focus:ring-green-500 focus:border-green-500 block w-full p-2.5"
                    >
                      <option value="2d">2D View</option>
                      <option value="3d">3D View</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Role Information */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Your Role & Permissions</h2>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium text-gray-300">Current Role</span>
                      <p className="text-sm text-gray-400">Your current access level in the graph network</p>
                    </div>
                    <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${
                      currentUser?.role === 'GRAPH_MASTER' ? 'bg-yellow-900 text-yellow-300' :
                      currentUser?.role === 'PATH_KEEPER' ? 'bg-purple-900 text-purple-300' :
                      currentUser?.role === 'ORIGIN_NODE' ? 'bg-green-900 text-green-300' :
                      currentUser?.role === 'CONNECTOR' ? 'bg-blue-900 text-blue-300' :
                      'bg-gray-900 text-gray-300'
                    }`}>
                      {currentUser?.role?.replace('_', ' ')}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {currentUser?.role === 'NODE_WATCHER' && 'You have read-only access to view graphs and nodes.'}
                    {currentUser?.role === 'CONNECTOR' && 'You can work on tasks, create edges, and update nodes.'}
                    {currentUser?.role === 'ORIGIN_NODE' && 'You can create and own specific nodes and tasks.'}
                    {currentUser?.role === 'PATH_KEEPER' && 'You can maintain graph structure and manage project flow.'}
                    {currentUser?.role === 'GRAPH_MASTER' && 'You have full system access and user management capabilities.'}
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">About GraphDone</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Version</span>
                    <span className="text-sm font-mono text-gray-100">0.2.1-alpha</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">License</span>
                    <span className="text-sm text-gray-100">MIT</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Philosophy</span>
                    <span className="text-sm text-gray-100">For teams who think differently</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
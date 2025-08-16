import React from 'react';
import { Save, RotateCcw } from 'lucide-react';

export function Settings() {
  const [settings, setSettings] = React.useState({
    autoLayout: true,
    showPriorityIndicators: true,
    enableAnimations: true,
    theme: 'light',
    defaultViewMode: '3d'
  });

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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
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
                    <label className="text-sm font-medium text-gray-300">Animations</label>
                    <p className="text-sm text-gray-400">Enable smooth transitions and animations</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableAnimations}
                    onChange={(e) => setSettings(prev => ({ ...prev, enableAnimations: e.target.checked }))}
                    className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Default View Mode</label>
                    <p className="text-sm text-gray-400">Choose how the graph is displayed by default</p>
                  </div>
                  <select
                    value={settings.defaultViewMode}
                    onChange={(e) => setSettings(prev => ({ ...prev, defaultViewMode: e.target.value }))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="3d">3D Spherical</option>
                    <option value="2d">2D Network</option>
                    <option value="tree">Tree Layout</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Appearance */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">Appearance</h2>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-sm font-medium text-gray-300">Theme</label>
                    <p className="text-sm text-gray-400">Choose your preferred color scheme</p>
                  </div>
                  <select
                    value={settings.theme}
                    onChange={(e) => setSettings(prev => ({ ...prev, theme: e.target.value }))}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-100 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                    <option value="auto">Auto (System)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* About */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-100 mb-4">About GraphDone</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-400">Version</span>
                  <span className="text-sm font-mono text-gray-100">0.1.0-alpha</span>
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
      </div>
    </div>
  );
}
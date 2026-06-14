import React from 'react';
import { Settings as SettingsIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { CustomDropdown } from '../components/CustomDropdown';
import { APP_VERSION } from '../utils/version';
import { useAdaptiveQuality } from '../hooks/useAdaptiveQuality';
import type { QualityTier } from '../lib/adaptiveQuality';

export function Settings() {
  const { currentUser } = useAuth();
  const { tier, override, setOverride } = useAdaptiveQuality();

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
              <span className="text-xs bg-gray-800/50 text-gray-400 px-2 py-1 rounded">
                v{APP_VERSION}
              </span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              Customize your GraphDone experience
            </p>
          </div>
          
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-100">Application Settings</h2>
            </div>
            
            <div className="space-y-8">
              {/* Performance (ADAPT-6) */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">Performance</h2>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-300">Visual Quality</label>
                      <span className="text-xs bg-gray-700/60 text-green-400 px-2 py-1 rounded">
                        active: {tier}{override ? '' : ' (auto)'}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mb-2">
                      Auto adapts to your device and network — effects scale down before responsiveness ever does. Pin a tier if auto guesses wrong.
                    </p>
                    <CustomDropdown
                      options={[
                        { value: 'AUTO', label: 'Auto (recommended)' },
                        { value: 'LOW', label: 'Low — fastest, no effects' },
                        { value: 'MEDIUM', label: 'Medium — glow, light animation' },
                        { value: 'HIGH', label: 'High — full living graph' },
                        { value: 'ULTRA', label: 'Ultra — everything on' }
                      ]}
                      value={override ?? 'AUTO'}
                      onChange={(value) => setOverride(value === 'AUTO' ? null : (value as QualityTier))}
                    />
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
                      currentUser?.role === 'ADMIN' ? 'bg-yellow-900 text-yellow-300' :
                      currentUser?.role === 'USER' ? 'bg-blue-900 text-blue-300' :
                      currentUser?.role === 'VIEWER' ? 'bg-gray-900 text-gray-300' :
                      currentUser?.role === 'GUEST' ? 'bg-purple-900 text-purple-300' :
                      'bg-gray-900 text-gray-300'
                    }`}>
                      {currentUser?.role}
                    </span>
                  </div>
                  
                  <div className="text-sm text-gray-400">
                    {currentUser?.role === 'GUEST' && 'You are in demo mode with read-only access. No account required.'}
                    {currentUser?.role === 'VIEWER' && 'You have read-only access to view graphs and nodes.'}
                    {currentUser?.role === 'USER' && 'You can create and work on tasks, manage nodes and edges.'}
                    {currentUser?.role === 'ADMIN' && 'You have full system access and user management capabilities.'}
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <h2 className="text-lg font-semibold text-gray-100 mb-4">About GraphDone</h2>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-400">Version</span>
                    <span className="text-sm font-mono text-gray-100">{APP_VERSION}</span>
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
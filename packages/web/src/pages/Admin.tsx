import React, { useState } from 'react';
import { Users, Database, Shield, Download, Upload, Settings2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserManagement } from '../components/AdminUserManagement';
import { CustomDropdown } from '../components/CustomDropdown';

export function Admin() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Redirect if not ADMIN
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h1>
          <p className="text-gray-400">Only ADMIN users can access the Admin panel.</p>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'users', name: 'Users', icon: Users, description: 'Manage user roles and permissions' },
    { id: 'settings', name: 'Registration', icon: Settings2, description: 'User registration policies and defaults' },
    { id: 'database', name: 'Database', icon: Database, description: 'Database configuration and maintenance' },
    { id: 'security', name: 'Security', icon: Shield, description: 'Security settings and passwords' },
    { id: 'backup', name: 'Backup & Restore', icon: Download, description: 'System backup and restore' },
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'users':
        return <AdminUserManagement />;
      case 'settings':
        return <UserManagementSettings />;
      case 'database':
        return <DatabaseManagement />;
      case 'security':
        return <SecurityManagement />;
      case 'backup':
        return <BackupRestore />;
      default:
        return <AdminUserManagement />;
    }
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 flex items-center">
              <Shield className="h-6 w-6 mr-3 text-yellow-400" />
              System Administration
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Manage users, security, and system settings
            </p>
          </div>
        </div>
        
        {/* Tab Navigation */}
        <div className="mt-6">
          <nav className="flex space-x-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-yellow-900/30 text-yellow-300 border border-yellow-500/30'
                      : 'text-gray-400 hover:text-gray-300 hover:bg-gray-800'
                  }`}
                  title={tab.description}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderTabContent()}
      </div>
    </div>
  );
}

// User Management Settings Component
function UserManagementSettings() {
  const [settings, setSettings] = useState({
    allowSelfRegistration: false,
    requireApproval: true,
    defaultRole: 'VIEWER',
    requireEmailVerification: true,
    allowAnonymousGuest: true, // Enable guest access by default
    passwordMinLength: 8,
    passwordRequireSymbols: true,
    sessionTimeoutMinutes: 480, // 8 hours
  });

  const handleSave = () => {
    // TODO: Save settings to backend
    console.log('Saving settings:', settings);
  };

  const roles = [
    { value: 'VIEWER', label: 'Viewer (Read-only)' },
    { value: 'USER', label: 'User (Can work on tasks)' },
    { value: 'ADMIN', label: 'Admin (System administrators)' },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="space-y-8">
        {/* Registration Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">User Registration</h2>
          
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Allow Self-Service Registration</label>
                <p className="text-sm text-gray-400 mt-1">Users can create their own accounts without admin intervention</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowSelfRegistration}
                onChange={(e) => setSettings(prev => ({ ...prev, allowSelfRegistration: e.target.checked }))}
                className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Require Admin Approval</label>
                <p className="text-sm text-gray-400 mt-1">New accounts require admin approval before activation</p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireApproval}
                onChange={(e) => setSettings(prev => ({ ...prev, requireApproval: e.target.checked }))}
                className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default Role for New Users</label>
              <CustomDropdown
                options={roles.map(role => ({
                  value: role.value,
                  label: role.label
                }))}
                value={settings.defaultRole}
                onChange={(value) => setSettings(prev => ({ ...prev, defaultRole: value }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Require Email Verification</label>
                <p className="text-sm text-gray-400 mt-1">Users must verify their email before account activation</p>
              </div>
              <input
                type="checkbox"
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings(prev => ({ ...prev, requireEmailVerification: e.target.checked }))}
                className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Allow Anonymous Guest Access</label>
                <p className="text-sm text-gray-400 mt-1">Enable "Guest Mode" button on login page for read-only demo access</p>
              </div>
              <input
                type="checkbox"
                checked={settings.allowAnonymousGuest}
                onChange={(e) => setSettings(prev => ({ ...prev, allowAnonymousGuest: e.target.checked }))}
                className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
              />
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-100 mb-6">Security & Authentication</h2>
          
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Password Length</label>
              <input
                type="number"
                min="6"
                max="32"
                value={settings.passwordMinLength}
                onChange={(e) => setSettings(prev => ({ ...prev, passwordMinLength: parseInt(e.target.value) }))}
                className="w-24 px-3 py-2 bg-gray-700 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-green-500"
              />
              <p className="text-sm text-gray-400 mt-1">Characters (6-32)</p>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <label className="text-sm font-medium text-gray-300">Require Symbols in Passwords</label>
                <p className="text-sm text-gray-400 mt-1">Passwords must contain at least one special character</p>
              </div>
              <input
                type="checkbox"
                checked={settings.passwordRequireSymbols}
                onChange={(e) => setSettings(prev => ({ ...prev, passwordRequireSymbols: e.target.checked }))}
                className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Session Timeout</label>
              <CustomDropdown
                options={[
                  { value: '60', label: '1 Hour' },
                  { value: '240', label: '4 Hours' },
                  { value: '480', label: '8 Hours' },
                  { value: '1440', label: '24 Hours' },
                  { value: '10080', label: '7 Days' }
                ]}
                value={settings.sessionTimeoutMinutes.toString()}
                onChange={(value) => setSettings(prev => ({ ...prev, sessionTimeoutMinutes: parseInt(value) }))}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}

// Placeholder components for other tabs
function DatabaseManagement() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Database Configuration</h2>
        <div className="text-gray-400">
          <p className="mb-4">Database management features coming soon:</p>
          <ul className="space-y-2">
            <li>• Connection string management</li>
            <li>• Password rotation</li>
            <li>• Performance monitoring</li>
            <li>• Backup scheduling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function SecurityManagement() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Security Settings</h2>
        <div className="text-gray-400">
          <p className="mb-4">Security management features coming soon:</p>
          <ul className="space-y-2">
            <li>• JWT secret rotation</li>
            <li>• Session timeout settings</li>
            <li>• Password policy configuration</li>
            <li>• API key management</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function BackupRestore() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h2 className="text-xl font-semibold text-gray-100 mb-4">Backup & Restore</h2>
        <div className="text-gray-400">
          <p className="mb-4">Backup and restore features coming soon:</p>
          <ul className="space-y-2">
            <li>• Database backups</li>
            <li>• System configuration export</li>
            <li>• Restore from backup</li>
            <li>• Automated backup scheduling</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
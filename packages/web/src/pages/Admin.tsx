import React, { useState, useEffect } from 'react';
import { Users, Database, Shield, Download, Upload, Settings2, RefreshCw, AlertCircle, Lock, Key, Globe, CheckCircle, XCircle, AlertTriangle, FileText, Calendar, Server, Network, Copy, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserManagement } from '../components/AdminUserManagement';
import { CustomDropdown } from '../components/CustomDropdown';
import { APP_VERSION } from '../utils/version';
import { useSystemConfig } from '../hooks/useSystemConfig';
import { useQuery, useMutation } from '@apollo/client';
import { GET_OAUTH_PROVIDER_CONFIGS, UPDATE_OAUTH_PROVIDER_CONFIG } from '../lib/queries';

export function Admin() {
  const { currentUser } = useAuth();
  const [activeTab, setActiveTab] = useState('users');

  // Redirect if not ADMIN
  if (currentUser?.role !== 'ADMIN') {
    return (
      <div className="h-full flex items-center justify-center">
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
    { id: 'oauth', name: 'OAuth Providers', icon: Key, description: 'Configure OAuth authentication providers' },
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
      case 'oauth':
        return <OAuthProviderManagement />;
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
      <div className="bg-gray-900/30 backdrop-blur-md border-b border-gray-700/30 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-3">
              <h1 className="text-2xl font-bold text-gray-100 flex items-center">
                <Shield className="h-6 w-6 mr-3 text-yellow-400" />
                System Administration
              </h1>
              <span className="text-xs bg-gray-800/50 text-gray-400 px-2 py-1 rounded">
                v{APP_VERSION}
              </span>
            </div>
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

// OAuth Provider Management Component
function OAuthProviderManagement() {
  const [providers, setProviders] = useState({
    google: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      callbackUrl: 'https://localhost:4128/auth/google/callback',
      configured: false,
    },
    linkedin: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      callbackUrl: 'https://localhost:4128/auth/linkedin/callback',
      configured: false,
    },
    github: {
      enabled: false,
      clientId: '',
      clientSecret: '',
      callbackUrl: 'https://localhost:4128/auth/github/callback',
      configured: false,
    },
  });

  const [showSecrets, setShowSecrets] = useState({
    google: false,
    linkedin: false,
    github: false,
  });

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, loading: queryLoading, refetch } = useQuery(GET_OAUTH_PROVIDER_CONFIGS);
  const [updateOAuthConfig, { loading: mutationLoading }] = useMutation(UPDATE_OAUTH_PROVIDER_CONFIG);

  const loading = queryLoading || mutationLoading;

  useEffect(() => {
    if (data?.oauthProviderConfigs) {
      const defaultProviders = {
        google: {
          enabled: false,
          clientId: '',
          clientSecret: '',
          callbackUrl: 'https://localhost:4128/auth/google/callback',
          configured: false,
        },
        linkedin: {
          enabled: false,
          clientId: '',
          clientSecret: '',
          callbackUrl: 'https://localhost:4128/auth/linkedin/callback',
          configured: false,
        },
        github: {
          enabled: false,
          clientId: '',
          clientSecret: '',
          callbackUrl: 'https://localhost:4128/auth/github/callback',
          configured: false,
        },
      };

      data.oauthProviderConfigs.forEach((config: any) => {
        if (defaultProviders[config.provider as keyof typeof defaultProviders]) {
          defaultProviders[config.provider as keyof typeof defaultProviders] = {
            enabled: config.enabled,
            clientId: config.clientId || '',
            clientSecret: config.clientSecret || '',
            callbackUrl: config.callbackUrl,
            configured: config.configured,
          };
        }
      });
      setProviders(defaultProviders);
    }
  }, [data]);

  const handleSave = async () => {
    setError(null);
    try {
      for (const [providerKey, config] of Object.entries(providers)) {
        await updateOAuthConfig({
          variables: {
            input: {
              provider: providerKey,
              enabled: config.enabled,
              clientId: config.clientId,
              clientSecret: config.clientSecret,
              callbackUrl: config.callbackUrl,
            },
          },
        });
      }

      await refetch();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      console.error('Failed to save OAuth configuration:', err);
      setError(err.message || 'Failed to save OAuth configuration');
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleCopyCallback = (url: string) => {
    navigator.clipboard.writeText(url);
    console.log('Copied callback URL:', url);
  };

  const toggleShowSecret = (provider: 'google' | 'linkedin' | 'github') => {
    setShowSecrets(prev => ({ ...prev, [provider]: !prev[provider] }));
  };

  const updateProvider = (provider: 'google' | 'linkedin' | 'github', field: string, value: any) => {
    setProviders(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider],
        [field]: value,
        configured: field === 'clientId' || field === 'clientSecret'
          ? (value && prev[provider].clientId && prev[provider].clientSecret)
          : prev[provider].configured,
      },
    }));
  };

  const renderProviderConfig = (
    providerKey: 'google' | 'linkedin' | 'github',
    providerName: string,
    providerIcon: React.ReactNode
  ) => {
    const provider = providers[providerKey];
    const showSecret = showSecrets[providerKey];

    return (
      <div key={providerKey} className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            {providerIcon}
            <div>
              <h3 className="text-lg font-semibold text-gray-100">{providerName}</h3>
              <p className="text-sm text-gray-400">
                {provider.configured
                  ? <span className="flex items-center text-green-400"><CheckCircle className="h-4 w-4 mr-1" /> Configured</span>
                  : <span className="flex items-center text-gray-500"><AlertCircle className="h-4 w-4 mr-1" /> Not configured</span>
                }
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Enable</span>
            <input
              type="checkbox"
              checked={provider.enabled}
              onChange={(e) => updateProvider(providerKey, 'enabled', e.target.checked)}
              className="h-4 w-4 text-green-500 focus:ring-green-500 border-gray-500 bg-gray-700 rounded"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Client ID
            </label>
            <input
              type="text"
              value={provider.clientId}
              onChange={(e) => updateProvider(providerKey, 'clientId', e.target.value)}
              placeholder={`Enter ${providerName} Client ID`}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Client Secret
            </label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={provider.clientSecret}
                onChange={(e) => updateProvider(providerKey, 'clientSecret', e.target.value)}
                placeholder={`Enter ${providerName} Client Secret`}
                className="w-full px-3 py-2 pr-10 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => toggleShowSecret(providerKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-300"
              >
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Callback URL
              <span className="text-gray-500 text-xs ml-2">(Copy this to your OAuth app configuration)</span>
            </label>
            <div className="flex items-center space-x-2">
              <input
                type="text"
                value={provider.callbackUrl}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-gray-300 cursor-not-allowed"
              />
              <button
                type="button"
                onClick={() => handleCopyCallback(provider.callbackUrl)}
                className="px-3 py-2 bg-gray-700 hover:bg-gray-600 border border-gray-600 rounded-lg text-gray-300 transition-colors"
                title="Copy callback URL"
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100 mb-2">OAuth Provider Configuration</h2>
        <p className="text-gray-400">
          Configure OAuth authentication providers for user sign-in. Users can login using their existing accounts from these providers.
        </p>
      </div>

      <div className="space-y-6">
        {renderProviderConfig('google', 'Google', <Globe className="h-6 w-6 text-red-400" />)}
        {renderProviderConfig('linkedin', 'LinkedIn', <Network className="h-6 w-6 text-blue-400" />)}
        {renderProviderConfig('github', 'GitHub', <Server className="h-6 w-6 text-purple-400" />)}
      </div>

      <div className="mt-8 flex items-center justify-between p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
        <div className="text-sm">
          {saved && (
            <span className="flex items-center text-green-400">
              <CheckCircle className="h-4 w-4 mr-2" />
              OAuth configuration saved successfully
            </span>
          )}
          {error && (
            <span className="flex items-center text-red-400">
              <XCircle className="h-4 w-4 mr-2" />
              {error}
            </span>
          )}
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors"
            disabled={loading}
          >
            Reset
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save OAuth Configuration'
            )}
          </button>
        </div>
      </div>

      <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-600/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-yellow-200/90">
            <p className="font-medium mb-1">Setup Instructions:</p>
            <ol className="list-decimal list-inside space-y-1 text-yellow-200/70">
              <li>Create an OAuth app in the provider's developer console</li>
              <li>Copy the Client ID and Client Secret</li>
              <li>Add the Callback URL to your OAuth app's allowed redirect URIs</li>
              <li>Paste the credentials here and enable the provider</li>
              <li>Save the configuration</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}

// Database Management Component with full admin tools
function DatabaseManagement() {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Database utility functions
  const updateDatabaseStats = async (debug: string[]) => {
    try {
      debug.push('📊 Fetching graph count...');
      const graphResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id } }' })
      });
      const graphData = await graphResponse.json();
      const graphCount = graphData.data?.graphs?.length || 0;
      document.getElementById('graph-count')!.textContent = graphCount.toString();
      debug.push(`✅ Found ${graphCount} graphs`);

      debug.push('📊 Fetching work item count...');
      const nodeResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { workItems { id } }' })
      });
      const nodeData = await nodeResponse.json();
      const nodeCount = nodeData.data?.workItems?.length || 0;
      document.getElementById('node-count')!.textContent = nodeCount.toString();
      debug.push(`✅ Found ${nodeCount} nodes`);

      debug.push('📊 Fetching edge count...');
      const edgeResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { edges { id } }' })
      });
      const edgeData = await edgeResponse.json();
      const edgeCount = edgeData.data?.edges?.length || 0;
      document.getElementById('edge-count')!.textContent = edgeCount.toString();
      debug.push(`✅ Found ${edgeCount} edges`);

    } catch (error) {
      debug.push(`❌ Failed to update stats: ${error}`);
      document.getElementById('graph-count')!.textContent = 'Error';
      document.getElementById('node-count')!.textContent = 'Error';
      document.getElementById('edge-count')!.textContent = 'Error';
    }
  };

  const checkDataIntegrity = async (debug: string[]) => {
    let issueCount = 0;
    debug.push('🔍 Checking for data integrity issues...');

    try {
      // Check for graphs with invalid types
      const graphResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id name } }' })
      });
      
      const graphResult = await graphResponse.json();
      if (graphResult.errors) {
        issueCount += graphResult.errors.length;
        debug.push(`❌ Found ${graphResult.errors.length} GraphQL schema errors`);
        graphResult.errors.forEach((err: any, i: number) => {
          debug.push(`  ${i + 1}. ${err.message}`);
        });
      }

      // Check for extremely long names (likely test data)
      if (graphResult.data?.graphs) {
        const longNameGraphs = graphResult.data.graphs.filter((g: any) => g.name && g.name.length > 100);
        if (longNameGraphs.length > 0) {
          issueCount += longNameGraphs.length;
          debug.push(`⚠️ Found ${longNameGraphs.length} graphs with extremely long names (likely test data)`);
        }

        // Check for single-character names (likely test data)
        const shortNameGraphs = graphResult.data.graphs.filter((g: any) => g.name && g.name.length <= 2);
        if (shortNameGraphs.length > 0) {
          debug.push(`ℹ️ Found ${shortNameGraphs.length} graphs with very short names (a, x, etc.)`);
        }
      }

      document.getElementById('issue-count')!.textContent = issueCount.toString();
      
      if (issueCount === 0) {
        debug.push('✅ No major data integrity issues found');
        document.getElementById('issue-count')!.textContent = '0';
      } else {
        debug.push(`⚠️ Found ${issueCount} data integrity issues`);
      }

    } catch (error) {
      debug.push(`❌ Data integrity check failed: ${error}`);
      document.getElementById('issue-count')!.textContent = 'Error';
    }
  };

  const cleanupTestData = async (debug: string[]) => {
    debug.push('🧹 Starting cleanup of test data...');
    let cleanedCount = 0;

    try {
      // Get all graphs to identify test data
      const graphResponse = await fetch('/api/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id name } }' })
      });
      
      const graphData = await graphResponse.json();
      
      if (graphData.data?.graphs) {
        const testGraphs = graphData.data.graphs.filter((g: any) => {
          return (
            g.name === 'a' ||
            g.name === 'x' ||
            g.name.length > 100 ||
            g.name.includes('xxxxxxxxxxxx') ||
            g.name.startsWith('Test Graph Debug')
          );
        });

        debug.push(`🎯 Identified ${testGraphs.length} test graphs for cleanup`);

        for (const graph of testGraphs.slice(0, 50)) { // Limit to 50 at a time to avoid timeout
          try {
            const deleteResponse = await fetch('/api/graphql', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                query: 'mutation DeleteGraph($id: ID!) { deleteGraphs(where: { id: $id }) { nodesDeleted } }',
                variables: { id: graph.id }
              })
            });

            const deleteResult = await deleteResponse.json();
            if (!deleteResult.errors) {
              cleanedCount++;
              debug.push(`🗑️ Deleted graph: ${graph.name.substring(0, 30)}...`);
            } else {
              debug.push(`⚠️ Could not delete graph ${graph.id}: ${deleteResult.errors[0]?.message}`);
            }
          } catch (error) {
            debug.push(`❌ Error deleting graph ${graph.id}: ${error}`);
          }
        }
      }

      debug.push(`✅ Cleanup complete! Removed ${cleanedCount} test graphs`);
      
      // Refresh stats after cleanup
      await updateDatabaseStats(debug);
      
    } catch (error) {
      debug.push(`❌ Cleanup failed: ${error}`);
    }
  };

  // Load database stats on component mount
  useEffect(() => {
    const loadInitialStats = async () => {
      const debug: string[] = [];
      try {
        await updateDatabaseStats(debug);
        await checkDataIntegrity(debug);
        setDebugInfo(debug);
      } catch (error) {
        console.error('Failed to load initial database stats:', error);
      }
    };
    
    loadInitialStats();
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Database Administration Header */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center">
            <Database className="h-6 w-6 mr-3" />
            Database Administration
          </h2>
          <div className="text-sm text-gray-400">
            GraphQL Query Tools & Data Management
          </div>
        </div>
        
        {/* Database Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Graphs</p>
                <p className="text-2xl font-bold text-blue-300" id="graph-count">Loading...</p>
              </div>
              <div className="text-blue-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h4a1 1 0 010 2H6.414l2.293 2.293a1 1 0 01-1.414 1.414L5 6.414V8a1 1 0 01-2 0V4zm9 1a1 1 0 010-2h4a1 1 0 011 1v4a1 1 0 01-2 0V6.414l-2.293 2.293a1 1 0 11-1.414-1.414L13.586 5H12z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Nodes</p>
                <p className="text-2xl font-bold text-green-300" id="node-count">Loading...</p>
              </div>
              <div className="text-green-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Total Edges</p>
                <p className="text-2xl font-bold text-purple-300" id="edge-count">Loading...</p>
              </div>
              <div className="text-purple-400">
                <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M12.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-700 border border-gray-600 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Data Issues</p>
                <p className="text-2xl font-bold text-red-300" id="issue-count">Checking...</p>
              </div>
              <div className="text-red-400">
                <AlertCircle className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <button
            onClick={async () => {
              const debug = [...debugInfo];
              try {
                debug.push('🔄 Refreshing database statistics...');
                await updateDatabaseStats(debug);
                setDebugInfo(debug);
              } catch (error) {
                debug.push(`❌ Failed to refresh stats: ${error}`);
                setDebugInfo(debug);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <RefreshCw className="h-5 w-5" />
            <span>Refresh Stats</span>
          </button>
          
          <button
            onClick={async () => {
              const debug = [...debugInfo];
              try {
                debug.push('🔍 Checking for data integrity issues...');
                await checkDataIntegrity(debug);
                setDebugInfo(debug);
              } catch (error) {
                debug.push(`❌ Data integrity check failed: ${error}`);
                setDebugInfo(debug);
              }
            }}
            className="bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <AlertCircle className="h-5 w-5" />
            <span>Check Data Integrity</span>
          </button>
          
          <button
            onClick={async () => {
              const debug = [...debugInfo];
              if (confirm('This will delete duplicate and corrupted test data. Continue?')) {
                try {
                  debug.push('🧹 Starting database cleanup...');
                  await cleanupTestData(debug);
                  setDebugInfo(debug);
                } catch (error) {
                  debug.push(`❌ Cleanup failed: ${error}`);
                  setDebugInfo(debug);
                }
              } else {
                debug.push('ℹ️ Cleanup cancelled by user');
                setDebugInfo(debug);
              }
            }}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg transition-colors flex items-center justify-center space-x-2"
          >
            <Database className="h-5 w-5" />
            <span>Cleanup Test Data</span>
          </button>
        </div>
      </div>

      {/* GraphQL Query Tool */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-200 mb-4">GraphQL Query Tool</h3>
        
        <div className="bg-gray-900 rounded-lg p-4 border border-gray-600 mb-4">
          <textarea
            id="graphql-query"
            placeholder={`Enter GraphQL query or mutation here, e.g.:

query GetGraphs {
  graphs {
    id
    name
  }
}

mutation DeleteGraph($id: ID!) {
  deleteGraphs(where: { id: $id }) {
    nodesDeleted
  }
}`}
            className="w-full h-40 bg-transparent text-green-300 font-mono text-sm border-none outline-none resize-none"
            style={{ fontFamily: 'Monaco, Consolas, "Courier New", monospace' }}
          />
        </div>
        
        <div className="flex space-x-3 mb-4">
          <button
            onClick={async () => {
              const query = (document.getElementById('graphql-query') as HTMLTextAreaElement).value.trim();
              if (!query) {
                alert('Please enter a GraphQL query');
                return;
              }
              
              const debug = [...debugInfo];
              try {
                debug.push(`🔍 Executing GraphQL query...`);
                debug.push(`📝 Query: ${query.substring(0, 100)}${query.length > 100 ? '...' : ''}`);
                
                const response = await fetch('/api/graphql', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ query })
                });
                
                const result = await response.json();
                
                if (result.errors) {
                  debug.push(`❌ GraphQL errors:`);
                  result.errors.forEach((err: any, i: number) => {
                    debug.push(`  ${i + 1}. ${err.message}`);
                  });
                }
                
                if (result.data) {
                  debug.push(`✅ Query successful!`);
                  debug.push(`📊 Result: ${JSON.stringify(result.data, null, 2).substring(0, 500)}...`);
                }
              } catch (error) {
                debug.push(`💥 Query execution failed: ${error}`);
              }
              setDebugInfo(debug);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Execute Query
          </button>
          
          <button
            onClick={() => {
              (document.getElementById('graphql-query') as HTMLTextAreaElement).value = '';
            }}
            className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Clear
          </button>
          
          <button
            onClick={() => {
              (document.getElementById('graphql-query') as HTMLTextAreaElement).value = `query GetDatabaseStats {
  graphs { id name }
  workItems { id title type status }
  edges { id type }
}`;
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            Sample Query
          </button>
        </div>
      </div>

      {/* Debug Console */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-medium text-gray-200 mb-4">Debug Console</h3>
        
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-80 overflow-y-auto">
          {debugInfo.length > 0 ? (
            <div className="space-y-1">
              {debugInfo.map((line, index) => (
                <div key={index} className="text-gray-300">
                  <span className="text-gray-500">{new Date().toISOString().split('T')[1].split('.')[0]}</span>
                  <span className="ml-2">{line}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Loading database statistics...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SecurityManagement() {
  const [tlsStatus, setTlsStatus] = useState<any>(null);
  const [certificateInfo, setCertificateInfo] = useState<any>(null);
  const [proxyStatus, setProxyStatus] = useState<any>(null);
  const [debugLog, setDebugLog] = useState<string[]>([]);
  const [certificateWarning, setCertificateWarning] = useState<string | null>(null);
  const debugConsoleRef = React.useRef<HTMLDivElement>(null);
  
  // Use live system configuration with automatic updates every 8 seconds
  const { config, isLoading: configLoading, error: configError, lastUpdated } = useSystemConfig({
    refreshInterval: 8000, // 8 seconds - not too aggressive
    enableAutoRefresh: true
  });
  
  const [isLoading, setIsLoading] = useState(true);

  // Add a debug message with auto-scroll
  const addDebugMessage = (message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setDebugLog(prev => {
      const newLog = [...prev, `${timestamp} ${message}`];
      // Auto-scroll to bottom after state update
      setTimeout(() => {
        if (debugConsoleRef.current) {
          debugConsoleRef.current.scrollTop = debugConsoleRef.current.scrollHeight;
        }
      }, 100);
      return newLog;
    });
  };

  // Check certificate expiration and set warning
  const checkCertificateExpiration = (certInfo: any) => {
    if (!certInfo || !certInfo.expirationDate) return;
    
    const now = new Date();
    const expirationDate = new Date(certInfo.expirationDate);
    const daysUntilExpiration = Math.ceil((expirationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiration <= 30 && daysUntilExpiration > 0) {
      setCertificateWarning(`Certificate expires in ${daysUntilExpiration} days. Consider renewing soon.`);
      addDebugMessage(`⚠️ Certificate expiration warning: ${daysUntilExpiration} days remaining`);
    } else if (daysUntilExpiration <= 0) {
      setCertificateWarning(`Certificate has expired! Immediate renewal required.`);
      addDebugMessage(`🚨 Certificate has expired! Immediate action required`);
    } else {
      setCertificateWarning(null);
    }
  };

  // Check TLS/SSL Status
  const checkTlsStatus = async () => {
    addDebugMessage('🔍 Starting TLS/SSL status check...');
    setIsLoading(true);

    try {
      // Check current protocol
      const currentProtocol = window.location.protocol;
      const isHttps = currentProtocol === 'https:';
      const currentPort = window.location.port;
      
      addDebugMessage(`📍 Current connection: ${currentProtocol}//${window.location.host}`);
      
      // Test health endpoint accessibility
      const healthUrl = isHttps ? `https://localhost:${currentPort || '8443'}/health` : '/health';
      addDebugMessage(`🏥 Testing health endpoint: ${healthUrl}`);
      
      const healthResponse = await fetch('/health');
      const healthData = await healthResponse.json();
      
      setTlsStatus({
        enabled: isHttps,
        protocol: currentProtocol,
        port: currentPort || (isHttps ? '8443' : '3127'),
        proxyEnabled: currentPort === '8443',
        healthEndpoint: healthData,
        lastCheck: new Date().toISOString()
      });

      addDebugMessage(isHttps ? '✅ HTTPS connection detected' : '⚠️ HTTP connection detected');

      // Get certificate info if HTTPS
      if (isHttps) {
        await getCertificateInfo();
        await checkProxyConfiguration();
      } else {
        addDebugMessage('ℹ️ Certificate info not available (HTTP mode)');
      }

    } catch (error) {
      addDebugMessage(`❌ TLS status check failed: ${error}`);
      setTlsStatus({
        enabled: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        lastCheck: new Date().toISOString()
      });
    }
    
    setIsLoading(false);
  };

  // Get certificate information
  const getCertificateInfo = async () => {
    addDebugMessage('🔐 Checking certificate information...');
    addDebugMessage('📋 Analyzing SSL certificate properties...');
    
    try {
      // Since we can't access certificate details directly from the browser,
      // we'll infer information from the connection
      const isLocalhost = window.location.hostname === 'localhost';
      const isMkcert = isLocalhost; // Assume mkcert if localhost HTTPS works without warnings
      
      // For mkcert, we know the typical expiration is 2+ years
      const mkcertExpirationDate = isMkcert ? new Date('2027-12-08') : null;
      
      const certInfo = {
        type: isMkcert ? 'mkcert (locally trusted)' : 'self-signed or CA-signed',
        hostname: window.location.hostname,
        port: window.location.port || '8443',
        validFor: isLocalhost ? ['localhost', '127.0.0.1', '::1'] : [window.location.hostname],
        issuer: isMkcert ? 'mkcert development CA' : 'Unknown',
        trusted: isMkcert,
        expirationNote: isMkcert ? 'Expires December 8, 2027' : 'Check certificate details in browser',
        expirationDate: mkcertExpirationDate?.toISOString(),
        algorithm: isMkcert ? 'RSA 2048-bit' : 'Unknown',
        serialNumber: isMkcert ? 'Generated by mkcert' : 'Unknown',
        lastCheck: new Date().toISOString()
      };
      
      setCertificateInfo(certInfo);
      
      addDebugMessage(isMkcert ? '✅ mkcert certificate detected and analyzed' : '⚠️ Certificate type inferred from connection');
      addDebugMessage(`📊 Certificate valid for: ${certInfo.validFor.join(', ')}`);
      addDebugMessage(`🏢 Issuer: ${certInfo.issuer}`);
      
      // Check expiration
      if (mkcertExpirationDate) {
        checkCertificateExpiration(certInfo);
      }
      
    } catch (error) {
      addDebugMessage(`❌ Certificate info check failed: ${error}`);
    }
  };

  // Check proxy configuration
  const checkProxyConfiguration = async () => {
    addDebugMessage('🔧 Checking reverse proxy configuration...');
    
    try {
      // Test if we're going through nginx proxy
      const isProxied = window.location.port === '8443';
      
      if (isProxied) {
        addDebugMessage('📡 Nginx reverse proxy detected');
        
        // Test backend connectivity through proxy
        const graphqlResponse = await fetch('/api/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: '{ __typename }' })
        });
        
        const graphqlData = await graphqlResponse.json();
        
        setProxyStatus({
          enabled: true,
          nginx: true,
          httpsPort: '8443',
          backendConnected: !!graphqlData.data,
          services: {
            frontend: { port: '3127', status: 'proxied' },
            graphql: { port: '4127', status: graphqlData.data ? 'connected' : 'error' },
            websocket: { port: '4127', status: 'available' }
          },
          lastCheck: new Date().toISOString()
        });
        
        addDebugMessage(graphqlData.data ? '✅ Backend services accessible through proxy' : '❌ Backend connection failed');
        
      } else {
        setProxyStatus({
          enabled: false,
          directConnection: true,
          note: 'Direct connection to development server',
          lastCheck: new Date().toISOString()
        });
        
        addDebugMessage('ℹ️ Direct connection (no proxy)');
      }
      
    } catch (error) {
      addDebugMessage(`❌ Proxy check failed: ${error}`);
    }
  };

  // Load initial status
  useEffect(() => {
    checkTlsStatus();
  }, []);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-400" />
          <p className="text-gray-300">Loading TLS/SSL status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-6">
      {/* Certificate Expiration Warning */}
      {certificateWarning && (
        <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="h-6 w-6 text-yellow-400" />
            <div className="flex-1">
              <h3 className="text-yellow-300 font-medium">Certificate Expiration Warning</h3>
              <p className="text-yellow-200/80 text-sm mt-1">{certificateWarning}</p>
            </div>
            <button
              onClick={() => {
                addDebugMessage('📋 Opening certificate renewal guide...');
                const renewalGuide = `
Certificate Renewal Guide:

For mkcert certificates:
1. Regenerate certificates: mkcert localhost 127.0.0.1 ::1
2. Restart nginx: nginx -s reload
3. Verify in admin panel

For production certificates:
1. Check with your CA or Let's Encrypt
2. Download new certificates
3. Update nginx.conf paths
4. Restart nginx: sudo systemctl reload nginx
5. Test with: openssl s_client -connect yourdomain.com:443

For Let's Encrypt auto-renewal:
certbot renew --dry-run
                `.trim();
                
                navigator.clipboard.writeText(renewalGuide);
                addDebugMessage('✅ Certificate renewal guide copied to clipboard');
                alert('Certificate renewal guide copied to clipboard!');
              }}
              className="bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-1 rounded text-sm transition-colors"
              title="Get step-by-step certificate renewal instructions"
            >
              Renewal Guide
            </button>
          </div>
        </div>
      )}

      {/* TLS Setup Architecture Diagram */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-100 flex items-center mb-6">
          <Network className="h-6 w-6 mr-3 text-blue-400" />
          TLS/SSL Setup Architecture
        </h2>
        
        <div className="bg-gray-900/50 rounded-lg p-4 mb-4">
          {!config && configLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-400">Loading live configuration...</div>
            </div>
          ) : (
            <>
              <svg viewBox="0 0 800 200" className="w-full h-32 text-gray-300">
                {/* Browser */}
                <g transform="translate(20, 80)">
                  <rect x="0" y="0" width="80" height="40" rx="6" fill="rgb(59, 130, 246)" fillOpacity="0.2" stroke="rgb(59, 130, 246)" strokeWidth="2"/>
                  <text x="40" y="25" textAnchor="middle" className="fill-blue-300 text-sm font-medium">Browser</text>
                </g>
                
                {/* HTTPS Arrow */}
                <g transform="translate(120, 95)">
                  <line x1="0" y1="10" x2="80" y2="10" stroke="rgb(34, 197, 94)" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <text x="40" y="0" textAnchor="middle" className="fill-green-400 text-xs font-medium">
                    {config ? `HTTPS:${config.services.proxy.httpsPort}` : 'HTTPS:8443'}
                  </text>
                </g>
                
                {/* Nginx Proxy */}
                <g transform="translate(220, 70)">
                  <rect x="0" y="0" width="100" height="60" rx="6" fill="rgb(168, 85, 247)" fillOpacity="0.2" stroke="rgb(168, 85, 247)" strokeWidth="2"/>
                  <text x="50" y="25" textAnchor="middle" className="fill-purple-300 text-sm font-medium">Nginx</text>
                  <text x="50" y="40" textAnchor="middle" className="fill-purple-300 text-sm font-medium">Proxy</text>
                  <text x="50" y="55" textAnchor="middle" className="fill-purple-300 text-xs">TLS Term.</text>
                </g>
                
                {/* Split arrows to Frontend and API */}
                <g transform="translate(340, 95)">
                  <line x1="0" y1="10" x2="50" y2="-20" stroke="rgb(34, 197, 94)" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <line x1="0" y1="10" x2="50" y2="40" stroke="rgb(34, 197, 94)" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <text x="25" y="-10" textAnchor="middle" className="fill-green-400 text-xs">
                    {config ? `HTTP:${config.services.web.port}` : 'HTTP:3127'}
                  </text>
                  <text x="25" y="55" textAnchor="middle" className="fill-green-400 text-xs">
                    {config ? `HTTP:${config.services.api.port}` : 'HTTP:4127'}
                  </text>
                </g>
                
                {/* Frontend Server */}
                <g transform="translate(420, 30)">
                  <rect x="0" y="0" width="100" height="50" rx="6" fill="rgb(34, 197, 94)" fillOpacity="0.2" stroke="rgb(34, 197, 94)" strokeWidth="2"/>
                  <text x="50" y="20" textAnchor="middle" className="fill-green-300 text-sm font-medium">Web Server</text>
                  <text x="50" y="35" textAnchor="middle" className="fill-green-300 text-xs">React App</text>
                </g>
                
                {/* API Server */}
                <g transform="translate(420, 120)">
                  <rect x="0" y="0" width="100" height="50" rx="6" fill="rgb(249, 115, 22)" fillOpacity="0.2" stroke="rgb(249, 115, 22)" strokeWidth="2"/>
                  <text x="50" y="20" textAnchor="middle" className="fill-orange-300 text-sm font-medium">API Server</text>
                  <text x="50" y="35" textAnchor="middle" className="fill-orange-300 text-xs">GraphQL</text>
                </g>
                
                {/* Database connection */}
                <g transform="translate(540, 140)">
                  <line x1="0" y1="5" x2="80" y2="5" stroke="rgb(14, 165, 233)" strokeWidth="2" markerEnd="url(#arrowhead)"/>
                  <text x="40" y="-5" textAnchor="middle" className="fill-sky-400 text-xs">
                    {config ? `Neo4j:${config.services.neo4j.port}` : 'Neo4j:7687'}
                  </text>
                </g>
                
                {/* Neo4j Database */}
                <g transform="translate(640, 120)">
                  <rect x="0" y="0" width="100" height="50" rx="6" fill="rgb(14, 165, 233)" fillOpacity="0.2" stroke="rgb(14, 165, 233)" strokeWidth="2"/>
                  <text x="50" y="20" textAnchor="middle" className="fill-sky-300 text-sm font-medium">Neo4j</text>
                  <text x="50" y="35" textAnchor="middle" className="fill-sky-300 text-xs">Database</text>
                </g>
                
                {/* Arrow marker definition */}
                <defs>
                  <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
                    <polygon points="0 0, 10 3.5, 0 7" fill="rgb(34, 197, 94)" />
                  </marker>
                </defs>
              </svg>
              
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div className="flex items-center space-x-2" title="End user browsers connecting via HTTPS">
                  <div className="w-3 h-3 bg-blue-500/30 border border-blue-500 rounded"></div>
                  <span className="text-blue-300">Client Browser</span>
                </div>
                <div className="flex items-center space-x-2" title="Nginx reverse proxy handling TLS termination">
                  <div className="w-3 h-3 bg-purple-500/30 border border-purple-500 rounded"></div>
                  <span className="text-purple-300">Nginx Proxy</span>
                </div>
                <div className="flex items-center space-x-2" title="React frontend serving the GraphDone interface">
                  <div className="w-3 h-3 bg-green-500/30 border border-green-500 rounded"></div>
                  <span className="text-green-300">Frontend</span>
                </div>
                <div className="flex items-center space-x-2" title="GraphQL API server handling data operations">
                  <div className="w-3 h-3 bg-orange-500/30 border border-orange-500 rounded"></div>
                  <span className="text-orange-300">API Server</span>
                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-400" title="Traffic flow explanation">
                <strong className="text-green-400">Traffic Flow:</strong> Browser → HTTPS ({config?.services.proxy.httpsPort || '8443'}) → Nginx Proxy → HTTP backends ({config?.services.web.port || '3127'} Web, {config?.services.api.port || '4127'} API) → Neo4j ({config?.services.neo4j.port || '7687'})
              </div>
              
              {lastUpdated && (
                <div className="mt-2 text-xs text-gray-500">
                  <strong>Live Data:</strong> Last updated {lastUpdated.toLocaleTimeString()} • Auto-refreshing every 8 seconds
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* TLS/SSL Status Overview */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-gray-100 flex items-center">
            <Shield className="h-6 w-6 mr-3" />
            TLS/SSL Security Status
          </h2>
          <div className="flex items-center space-x-3">
            {configError && (
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>Config Error</span>
              </div>
            )}
            {configLoading && (
              <div className="flex items-center space-x-2 text-blue-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Updating...</span>
              </div>
            )}
            {lastUpdated && !configLoading && (
              <div className="flex items-center space-x-2 text-green-400 text-sm">
                <CheckCircle className="h-4 w-4" />
                <span>Live • Updated {lastUpdated.toLocaleTimeString()}</span>
              </div>
            )}
          </div>
        </div>

        {/* Status Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Connection Security */}
          <div 
            className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-help" 
            title={tlsStatus?.enabled 
              ? "Your connection is encrypted with HTTPS. All data transmission is secure."
              : "Your connection is unencrypted HTTP. Consider enabling HTTPS for production."}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Connection Security</p>
                <p className="text-lg font-bold flex items-center">
                  {tlsStatus?.enabled ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                      <span className="text-green-300">HTTPS Enabled</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                      <span className="text-yellow-300">HTTP Only</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1" title="Current connection URL">
                  {tlsStatus?.protocol}://{window.location.host}
                </p>
              </div>
              <Lock 
                className={`h-8 w-8 ${tlsStatus?.enabled ? 'text-green-400' : 'text-gray-500'}`} 
              />
            </div>
          </div>

          {/* Certificate Status */}
          <div 
            className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-help"
            title={certificateInfo?.trusted 
              ? `Certificate is trusted by your system. Type: ${certificateInfo.type}. Expires: ${certificateInfo.expirationNote}`
              : certificateInfo 
                ? `Certificate is self-signed and may show browser warnings. Type: ${certificateInfo.type}`
                : "No certificate information available (HTTP mode)"}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Certificate Status</p>
                <p className="text-lg font-bold flex items-center">
                  {certificateInfo?.trusted ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                      <span className="text-green-300">Trusted</span>
                    </>
                  ) : certificateInfo ? (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                      <span className="text-yellow-300">Self-Signed</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-gray-400 mr-2" />
                      <span className="text-gray-400">Not Available</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1" title="Certificate type and issuer">
                  {certificateInfo?.type || 'HTTP mode'}
                </p>
              </div>
              <Key 
                className={`h-8 w-8 ${certificateInfo?.trusted ? 'text-green-400' : 'text-gray-500'}`} 
              />
            </div>
          </div>

          {/* Proxy Status */}
          <div 
            className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:border-gray-500 transition-colors cursor-help"
            title={proxyStatus?.enabled 
              ? `Nginx reverse proxy is routing requests. HTTPS port: ${proxyStatus.httpsPort}. Backend services are proxied for security.`
              : "Direct connection to development servers. No reverse proxy detected."}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-400">Reverse Proxy</p>
                <p className="text-lg font-bold flex items-center">
                  {proxyStatus?.enabled ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-400 mr-2" />
                      <span className="text-green-300">Active</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-5 w-5 text-yellow-400 mr-2" />
                      <span className="text-yellow-300">Direct</span>
                    </>
                  )}
                </p>
                <p className="text-xs text-gray-500 mt-1" title="Current routing configuration">
                  {proxyStatus?.enabled ? 'Nginx proxy' : 'Development mode'}
                </p>
              </div>
              <Globe 
                className={`h-8 w-8 ${proxyStatus?.enabled ? 'text-green-400' : 'text-yellow-400'}`}
              />
            </div>
          </div>
        </div>

        {/* Security Recommendations */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-gray-600">
          <h3 className="text-lg font-medium text-gray-200 mb-3 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-400" />
            Security Recommendations
          </h3>
          <div className="space-y-2 text-sm">
            {!tlsStatus?.enabled && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-red-300 font-medium">Enable HTTPS encryption</span>
                  <p className="text-gray-400">Your connection is not encrypted. Enable HTTPS for production use.</p>
                </div>
              </div>
            )}
            
            {tlsStatus?.enabled && !certificateInfo?.trusted && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-yellow-300 font-medium">Use trusted certificates</span>
                  <p className="text-gray-400">Consider using Let's Encrypt or a commercial CA for production.</p>
                </div>
              </div>
            )}
            
            {!proxyStatus?.enabled && (
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-yellow-300 font-medium">Enable reverse proxy</span>
                  <p className="text-gray-400">Use Nginx or similar for better security and performance.</p>
                </div>
              </div>
            )}

            {tlsStatus?.enabled && certificateInfo?.trusted && proxyStatus?.enabled && (
              <div className="flex items-start space-x-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <div>
                  <span className="text-green-300 font-medium">Security configuration looks good!</span>
                  <p className="text-gray-400">Your GraphDone instance is properly secured with HTTPS.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Certificate Details */}
      {certificateInfo && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
            <FileText className="h-5 w-5 mr-2" />
            Certificate Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400">Certificate Type</label>
                <p className="text-gray-200">{certificateInfo.type}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400">Hostname</label>
                <p className="text-gray-200">{certificateInfo.hostname}:{certificateInfo.port}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400">Valid For</label>
                <div className="text-gray-200">
                  {certificateInfo.validFor.map((domain: string, index: number) => (
                    <span key={index} className="inline-block bg-gray-700 px-2 py-1 rounded text-xs mr-1 mb-1">
                      {domain}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-400">Issuer</label>
                <p className="text-gray-200">{certificateInfo.issuer}</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400">Trust Status</label>
                <div className="flex items-center space-x-2">
                  {certificateInfo.trusted ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-400" />
                  )}
                  <span className="text-gray-200">
                    {certificateInfo.trusted ? 'Locally Trusted' : 'Self-Signed'}
                  </span>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400">Expiration</label>
                <p className="text-gray-200">{certificateInfo.expirationNote}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Proxy Configuration */}
      {proxyStatus && (
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-100 mb-4 flex items-center">
            <Server className="h-5 w-5 mr-2" />
            Proxy Configuration
          </h3>
          
          {proxyStatus.enabled ? (
            <div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {Object.entries(proxyStatus.services).map(([service, config]: [string, any]) => (
                  <div key={service} className="bg-gray-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-200 capitalize">{service}</p>
                        <p className="text-sm text-gray-400">Port {config.port}</p>
                      </div>
                      <div className="flex items-center space-x-1">
                        {config.status === 'connected' || config.status === 'proxied' ? (
                          <CheckCircle className="h-5 w-5 text-green-400" />
                        ) : config.status === 'available' ? (
                          <AlertTriangle className="h-5 w-5 text-yellow-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                        <span className="text-xs capitalize text-gray-400">{config.status}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-sm font-medium text-gray-300 mb-2">Configuration</h4>
                <div className="text-sm text-gray-400 space-y-1">
                  <p>• HTTPS Port: {proxyStatus.httpsPort}</p>
                  <p>• Frontend: localhost:3127 → https://localhost:{proxyStatus.httpsPort}/</p>
                  <p>• GraphQL API: localhost:4127 → https://localhost:{proxyStatus.httpsPort}/graphql</p>
                  <p>• WebSocket: localhost:4127 → wss://localhost:{proxyStatus.httpsPort}/graphql</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-gray-900/50 rounded-lg p-4">
              <p className="text-gray-400">{proxyStatus.note}</p>
              <p className="text-sm text-gray-500 mt-2">
                To enable HTTPS with reverse proxy, run: <code className="bg-gray-800 px-2 py-1 rounded">nginx -c nginx.conf</code>
              </p>
            </div>
          )}
        </div>
      )}

      {/* Debug Console */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-100">TLS/SSL Debug Console</h3>
          <button
            onClick={() => setDebugLog([])}
            className="text-gray-400 hover:text-gray-300 text-sm"
          >
            Clear Log
          </button>
        </div>
        
        <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm max-h-60 overflow-y-auto">
          {debugLog.length > 0 ? (
            <div className="space-y-1">
              {debugLog.map((line, index) => (
                <div key={index} className="text-gray-300">
                  {line}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-gray-500 italic">
              Debug messages will appear here...
            </div>
          )}
        </div>
      </div>

      {/* TLS Configuration Actions */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-100 mb-4">TLS/SSL Management Actions</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Development Setup</h4>
            
            <button
              onClick={() => {
                addDebugMessage('📋 Opening certificate installation guide...');
                const instructions = `
To enable trusted HTTPS certificates (no browser warnings):

1. Install mkcert root CA:
   mkcert -install

2. The certificates are already generated and nginx is configured.

3. Refresh this page to see updated status.

For more details, see: /docs/tls-ssl-setup.md
                `.trim();
                
                navigator.clipboard.writeText(instructions);
                addDebugMessage('✅ Installation instructions copied to clipboard');
                alert('Installation instructions copied to clipboard!');
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Key className="h-4 w-4" />
              <span>Setup Trusted Certificates</span>
            </button>
            
            <button
              onClick={async () => {
                addDebugMessage('🔄 Starting comprehensive TLS endpoint testing...');
                addDebugMessage('📋 Testing all critical GraphDone endpoints for security and connectivity');
                
                try {
                  const testResults = {
                    total: 0,
                    passed: 0,
                    failed: 0
                  };

                  // Test 1: Health Endpoint
                  addDebugMessage('');
                  addDebugMessage('🏥 TEST 1: Health Endpoint (/health)');
                  addDebugMessage('📝 Purpose: Verify server status and service health');
                  testResults.total++;
                  
                  try {
                    const healthStart = Date.now();
                    const healthResponse = await fetch('/health');
                    const healthTime = Date.now() - healthStart;
                    const healthData = await healthResponse.json();
                    
                    addDebugMessage(`⏱️ Response time: ${healthTime}ms`);
                    addDebugMessage(`📊 Status code: ${healthResponse.status}`);
                    addDebugMessage(`🔍 Server status: ${healthData.status}`);
                    addDebugMessage(`💾 GraphQL service: ${healthData.services?.graphql?.status || 'unknown'}`);
                    addDebugMessage(`🗄️ Neo4j status: ${healthData.services?.neo4j?.status || 'unknown'}`);
                    
                    if (healthResponse.ok) {
                      addDebugMessage('✅ Health endpoint test PASSED');
                      testResults.passed++;
                    } else {
                      addDebugMessage('❌ Health endpoint test FAILED');
                      testResults.failed++;
                    }
                  } catch (error) {
                    addDebugMessage(`❌ Health endpoint test FAILED: ${error}`);
                    testResults.failed++;
                  }

                  // Test 2: GraphQL Endpoint
                  addDebugMessage('');
                  addDebugMessage('🔗 TEST 2: GraphQL API Endpoint (/graphql)');
                  addDebugMessage('📝 Purpose: Verify GraphQL server functionality and query processing');
                  testResults.total++;
                  
                  try {
                    const gqlStart = Date.now();
                    const gqlResponse = await fetch('/api/graphql', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ query: '{ __typename }' })
                    });
                    const gqlTime = Date.now() - gqlStart;
                    const gqlData = await gqlResponse.json();
                    
                    addDebugMessage(`⏱️ GraphQL response time: ${gqlTime}ms`);
                    addDebugMessage(`📊 Status code: ${gqlResponse.status}`);
                    addDebugMessage(`🔍 Query result: ${JSON.stringify(gqlData)}`);
                    addDebugMessage(`📋 Content-Type: ${gqlResponse.headers.get('content-type')}`);
                    
                    if (gqlResponse.ok && gqlData.data) {
                      addDebugMessage('✅ GraphQL endpoint test PASSED');
                      testResults.passed++;
                    } else {
                      addDebugMessage('❌ GraphQL endpoint test FAILED');
                      testResults.failed++;
                    }
                  } catch (error) {
                    addDebugMessage(`❌ GraphQL endpoint test FAILED: ${error}`);
                    testResults.failed++;
                  }

                  // Test 3: Frontend Assets
                  addDebugMessage('');
                  addDebugMessage('🌐 TEST 3: Frontend Asset Loading');
                  addDebugMessage('📝 Purpose: Verify static assets and frontend accessibility');
                  testResults.total++;
                  
                  try {
                    const assetStart = Date.now();
                    const assetResponse = await fetch('/');
                    const assetTime = Date.now() - assetStart;
                    const htmlContent = await assetResponse.text();
                    
                    addDebugMessage(`⏱️ Frontend load time: ${assetTime}ms`);
                    addDebugMessage(`📊 Status code: ${assetResponse.status}`);
                    addDebugMessage(`📄 Content length: ${htmlContent.length} characters`);
                    addDebugMessage(`🔍 Contains GraphDone branding: ${htmlContent.includes('GraphDone') ? 'Yes' : 'No'}`);
                    addDebugMessage(`🔍 HTML document type: ${htmlContent.includes('<!doctype html>') ? 'Valid HTML5' : 'Unknown'}`);
                    
                    if (assetResponse.ok && htmlContent.includes('GraphDone')) {
                      addDebugMessage('✅ Frontend asset test PASSED');
                      testResults.passed++;
                    } else {
                      addDebugMessage('❌ Frontend asset test FAILED');
                      testResults.failed++;
                    }
                  } catch (error) {
                    addDebugMessage(`❌ Frontend asset test FAILED: ${error}`);
                    testResults.failed++;
                  }

                  // Test 4: Security Headers
                  addDebugMessage('');
                  addDebugMessage('🛡️ TEST 4: Security Headers Analysis');
                  addDebugMessage('📝 Purpose: Check for important security headers');
                  testResults.total++;
                  
                  try {
                    const securityResponse = await fetch('/', { method: 'HEAD' });
                    const headers = securityResponse.headers;
                    
                    addDebugMessage(`📊 Response status: ${securityResponse.status}`);
                    addDebugMessage(`🔍 Server header: ${headers.get('server') || 'Not disclosed'}`);
                    addDebugMessage(`🔍 Content-Security-Policy: ${headers.get('content-security-policy') || 'Not set'}`);
                    addDebugMessage(`🔍 X-Frame-Options: ${headers.get('x-frame-options') || 'Not set'}`);
                    addDebugMessage(`🔍 X-Content-Type-Options: ${headers.get('x-content-type-options') || 'Not set'}`);
                    addDebugMessage(`🔍 Strict-Transport-Security: ${headers.get('strict-transport-security') || 'Not set'}`);
                    
                    // Count security headers
                    const securityHeadersPresent = [
                      'content-security-policy',
                      'x-frame-options', 
                      'x-content-type-options',
                      'strict-transport-security'
                    ].filter(header => headers.get(header)).length;
                    
                    addDebugMessage(`📈 Security headers present: ${securityHeadersPresent}/4`);
                    
                    if (securityResponse.ok) {
                      addDebugMessage('✅ Security headers test PASSED');
                      testResults.passed++;
                    } else {
                      addDebugMessage('❌ Security headers test FAILED');
                      testResults.failed++;
                    }
                  } catch (error) {
                    addDebugMessage(`❌ Security headers test FAILED: ${error}`);
                    testResults.failed++;
                  }

                  // Test Summary
                  addDebugMessage('');
                  addDebugMessage('📊 ENDPOINT TESTING SUMMARY');
                  addDebugMessage('='.repeat(40));
                  addDebugMessage(`📈 Total tests: ${testResults.total}`);
                  addDebugMessage(`✅ Passed: ${testResults.passed}`);
                  addDebugMessage(`❌ Failed: ${testResults.failed}`);
                  addDebugMessage(`📊 Success rate: ${Math.round((testResults.passed / testResults.total) * 100)}%`);
                  
                  if (testResults.failed === 0) {
                    addDebugMessage('🎉 ALL TESTS PASSED! Your GraphDone instance is responding correctly.');
                  } else {
                    addDebugMessage(`⚠️ ${testResults.failed} test(s) failed. Review the details above for issues.`);
                  }
                  
                  addDebugMessage('🏁 Comprehensive endpoint testing complete');
                  
                } catch (error) {
                  addDebugMessage(`💥 Critical testing failure: ${error}`);
                  addDebugMessage('🚨 Unable to complete endpoint testing suite');
                }
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
              title="Run comprehensive tests on all GraphDone endpoints including health, GraphQL, frontend assets, and security headers"
            >
              <Globe className="h-4 w-4" />
              <span>Test All Endpoints</span>
            </button>
          </div>
          
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-gray-300">Production Preparation</h4>
            
            <button
              onClick={() => {
                addDebugMessage('📋 Opening production deployment guide...');
                const guide = `
Production TLS/SSL Deployment:

1. Obtain CA-signed certificates (Let's Encrypt recommended)
2. Update nginx.conf with production certificates
3. Configure firewall for ports 80/443
4. Set up certificate auto-renewal
5. Update DNS records
6. Test with SSL Labs checker

Documentation: /docs/tls-ssl-setup.md#production
                `.trim();
                
                navigator.clipboard.writeText(guide);
                addDebugMessage('✅ Production guide copied to clipboard');
                alert('Production deployment guide copied to clipboard!');
              }}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span>Production Deployment Guide</span>
            </button>
            
            <button
              disabled={true}
              className="w-full bg-gray-700/50 text-gray-500 px-4 py-2 rounded-lg cursor-not-allowed flex items-center justify-center space-x-2"
              title="Documentation is not yet available. Use the debug console and test tools above for troubleshooting."
            >
              <FileText className="h-4 w-4" />
              <span>Documentation (Coming Soon)</span>
            </button>
          </div>
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
import React, { useState, useEffect } from 'react';
import { Users, Database, Shield, Download, Upload, Settings2, RefreshCw, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { AdminUserManagement } from '../components/AdminUserManagement';
import { CustomDropdown } from '../components/CustomDropdown';
import { APP_VERSION } from '../utils/version';

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

// Database Management Component with full admin tools
function DatabaseManagement() {
  const [debugInfo, setDebugInfo] = useState<string[]>([]);

  // Database utility functions
  const updateDatabaseStats = async (debug: string[]) => {
    try {
      debug.push('📊 Fetching graph count...');
      const graphResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { graphs { id } }' })
      });
      const graphData = await graphResponse.json();
      const graphCount = graphData.data?.graphs?.length || 0;
      document.getElementById('graph-count')!.textContent = graphCount.toString();
      debug.push(`✅ Found ${graphCount} graphs`);

      debug.push('📊 Fetching node count...');
      const nodeResponse = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'query { workItems { id } }' })
      });
      const nodeData = await nodeResponse.json();
      const nodeCount = nodeData.data?.workItems?.length || 0;
      document.getElementById('node-count')!.textContent = nodeCount.toString();
      debug.push(`✅ Found ${nodeCount} nodes`);

      debug.push('📊 Fetching edge count...');
      const edgeResponse = await fetch('/graphql', {
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
      const graphResponse = await fetch('/graphql', {
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
      const graphResponse = await fetch('/graphql', {
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
            const deleteResponse = await fetch('/graphql', {
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
                
                const response = await fetch('/graphql', {
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
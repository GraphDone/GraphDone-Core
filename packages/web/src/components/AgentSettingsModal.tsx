import { useState } from 'react';
import { X, Plus, Trash2, Server, Save, Copy, Check, Download, ExternalLink } from 'lucide-react';

interface MCPServer {
  id: string;
  name: string;
  command: string;
  args: string[];
  env: Record<string, string>;
  enabled: boolean;
  description: string;
}

interface AgentSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AgentSettingsModal({ isOpen, onClose }: AgentSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'mcp' | 'general'>('mcp');
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([
    {
      id: 'graphdone-mcp',
      name: 'GraphDone MCP Server',
      command: 'node',
      args: ['packages/mcp-server/dist/index.js'],
      env: {
        NEO4J_URI: 'bolt://localhost:7687',
        NEO4J_USER: 'neo4j',
        NEO4J_PASSWORD: 'graphdone_password'
      },
      enabled: true,
      description: '🤖 Control your GraphDone graph with natural language through Claude Code! Ask Claude to browse nodes, create tasks, manage relationships, and analyze your project graph.'
    }
  ]);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const downloadSetupScript = () => {
    const scriptContent = `#!/bin/bash

# GraphDone MCP Server Quick Setup
# This script sets up the MCP server for Claude Code integration

set -e

echo "========================================="
echo "   GraphDone MCP Server Setup"
echo "========================================="
echo

# Check if we're in the GraphDone project directory
if [[ ! -f "package.json" ]] || ! grep -q "graphdone" package.json; then
    echo "Error: Please run this script from the GraphDone project root directory."
    exit 1
fi

# Install dependencies and build
echo "Installing dependencies..."
npm install

echo "Building MCP server..."
npm run build --filter=@graphdone/mcp-server

# Get the absolute path to the built MCP server
MCP_PATH="$(pwd)/packages/mcp-server/dist/index.js"
NODE_PATH="$(which node)"

echo "MCP server built successfully!"
echo "Path: $MCP_PATH"
echo

# Configure with Claude Code
echo "========================================="
echo "   Claude Code Configuration"
echo "========================================="
echo

if command -v claude >/dev/null 2>&1; then
    echo "Configuring MCP server with Claude Code..."
    if claude mcp add graphdone "$NODE_PATH" "$MCP_PATH" \\
        --env "NEO4J_URI=\${NEO4J_URI:-bolt://localhost:7687}" \\
        --env "NEO4J_USER=\${NEO4J_USER:-neo4j}" \\
        --env "NEO4J_PASSWORD=\${NEO4J_PASSWORD:-graphdone_password}"; then
        echo "✓ MCP server configured successfully!"
        echo "You can now use MCP tools in Claude Code"
    else
        echo "✗ Failed to configure MCP server automatically"
        echo "Please use manual configuration below"
    fi
else
    echo "Claude CLI not found. Please install Claude Code first."
    echo "Using manual configuration..."
fi

echo
echo "========================================="
echo "   Manual Configuration (if needed)"
echo "========================================="
echo
echo "If automatic setup failed, use this command:"
echo
echo "claude mcp add graphdone \\"$NODE_PATH\\" \\"$MCP_PATH\\" \\\\"
echo "  --env \\"NEO4J_URI=bolt://localhost:7687\\" \\\\"
echo "  --env \\"NEO4J_USER=neo4j\\" \\\\"
echo "  --env \\"NEO4J_PASSWORD=graphdone_password\\""
echo
echo "Or add this to your Claude Code settings file:"
echo
echo "{"
echo "  \\"mcpServers\\": {"
echo "    \\"graphdone\\": {"
echo "      \\"command\\": \\"$NODE_PATH\\","
echo "      \\"args\\": [\\"$MCP_PATH\\"],"
echo "      \\"env\\": {"
echo "        \\"NEO4J_URI\\": \\"bolt://localhost:7687\\","
echo "        \\"NEO4J_USER\\": \\"neo4j\\","
echo "        \\"NEO4J_PASSWORD\\": \\"graphdone_password\\""
echo "      }"
echo "    }"
echo "  }"
echo "}"
echo
echo "========================================="
echo "   Next Steps"
echo "========================================="
echo "1. Make sure Neo4j is running (docker-compose up -d postgres)"
echo "2. Restart Claude Code completely"
echo "3. Verify setup by typing '/mcp' in Claude Code"
echo "4. Available tools: browse_graph, create_node, update_node, etc."
echo
echo "Setup complete!"
`;

    const blob = new Blob([scriptContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'setup-graphdone-mcp.sh';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const runSetupCommand = async () => {
    try {
      // In a real implementation, this could trigger a server endpoint
      // that runs the setup script. For now, we'll show instructions.
      alert('To run setup automatically, use the terminal command:\n\n./scripts/setup-mcp.sh\n\nThis will automatically configure the MCP server using the claude mcp command.');
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Setup command failed:', error);
    }
  };

  const generateClaudeConfig = () => {
    const config = {
      mcpServers: mcpServers.reduce((acc, server) => {
        if (server.enabled) {
          acc[server.id] = {
            command: server.command,
            args: server.args,
            env: server.env
          };
        }
        return acc;
      }, {} as Record<string, { command: string; args: string[]; env: Record<string, string> }>)
    };
    return JSON.stringify(config, null, 2);
  };

  const copyConfigToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(generateClaudeConfig());
      setCopiedConfig(true);
      setTimeout(() => setCopiedConfig(false), 2000);
    } catch (err) {
      console.error('Failed to copy config:', err);
    }
  };

  const addMcpServer = () => {
    const newServer: MCPServer = {
      id: `mcp-server-${Date.now()}`,
      name: 'New MCP Server',
      command: 'node',
      args: ['path/to/server.js'],
      env: {},
      enabled: true,
      description: 'Custom MCP server'
    };
    setMcpServers([...mcpServers, newServer]);
  };

  const updateMcpServer = (id: string, updates: Partial<MCPServer>) => {
    setMcpServers(servers => servers.map(server => 
      server.id === id ? { ...server, ...updates } : server
    ));
  };

  const deleteMcpServer = (id: string) => {
    setMcpServers(servers => servers.filter(server => server.id !== id));
  };

  const updateServerArgs = (id: string, args: string) => {
    const argsArray = args.split('\n').filter(line => line.trim());
    updateMcpServer(id, { args: argsArray });
  };

  const updateServerEnv = (id: string, envString: string) => {
    try {
      const env = envString.split('\n').reduce((acc, line) => {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          acc[key.trim()] = valueParts.join('=').trim();
        }
        return acc;
      }, {} as Record<string, string>);
      updateMcpServer(id, { env });
    } catch (err) {
      console.error('Invalid environment format:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
      <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-xl font-semibold text-gray-100">AI & Agent Settings</h2>
            <p className="text-sm text-gray-400 mt-1">Configure MCP servers and agent preferences</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700">
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('mcp')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'mcp'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              <Server className="h-4 w-4 inline mr-2" />
              MCP Servers
            </button>
            <button
              onClick={() => setActiveTab('general')}
              className={`py-3 px-4 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'general'
                  ? 'border-green-500 text-green-400'
                  : 'border-transparent text-gray-400 hover:text-gray-300'
              }`}
            >
              General
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeTab === 'mcp' && (
            <div className="p-6 space-y-6">
              {/* Info Box */}
              <div className="bg-blue-900 border border-blue-700 rounded-lg p-4">
                <h3 className="font-medium text-blue-300 mb-2">Model Context Protocol (MCP)</h3>
                <p className="text-blue-400 text-sm mb-3">
                  MCP servers allow Claude and other AI assistants to interact with your GraphDone instance. 
                  Use the setup script for automatic configuration with `claude mcp add`, or manually configure below.
                </p>
                <div className="flex items-center space-x-2 flex-wrap">
                  <button
                    onClick={copyConfigToClipboard}
                    className="btn btn-secondary btn-sm"
                  >
                    {copiedConfig ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 mr-1" />
                        Copy Claude Config
                      </>
                    )}
                  </button>
                  <button
                    onClick={downloadSetupScript}
                    className="btn btn-secondary btn-sm"
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Download Setup Script
                  </button>
                  <button
                    onClick={runSetupCommand}
                    className="btn btn-primary btn-sm"
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Run Setup
                  </button>
                </div>
              </div>

              {/* MCP Servers */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-gray-100">MCP Servers</h3>
                  <button
                    onClick={addMcpServer}
                    className="btn btn-primary btn-sm"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Server
                  </button>
                </div>

                {mcpServers.map((server) => (
                  <div key={server.id} className="bg-gray-700 border border-gray-600 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center space-x-3">
                        <input
                          type="checkbox"
                          checked={server.enabled}
                          onChange={(e) => updateMcpServer(server.id, { enabled: e.target.checked })}
                          className="w-4 h-4 text-green-600 bg-gray-600 border-gray-500 rounded focus:ring-green-500"
                        />
                        <div>
                          <input
                            type="text"
                            value={server.name}
                            onChange={(e) => updateMcpServer(server.id, { name: e.target.value })}
                            className="bg-transparent text-gray-100 font-medium text-lg border-none focus:ring-0 p-0"
                          />
                          <p className="text-sm text-gray-400">{server.description}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => deleteMcpServer(server.id)}
                        className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Command</label>
                        <input
                          type="text"
                          value={server.command}
                          onChange={(e) => updateMcpServer(server.id, { command: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Description</label>
                        <input
                          type="text"
                          value={server.description}
                          onChange={(e) => updateMcpServer(server.id, { description: e.target.value })}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Arguments (one per line)</label>
                        <textarea
                          value={server.args.join('\n')}
                          onChange={(e) => updateServerArgs(server.id, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-2 focus:ring-green-500"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">Environment Variables (KEY=value)</label>
                        <textarea
                          value={Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join('\n')}
                          onChange={(e) => updateServerEnv(server.id, e.target.value)}
                          rows={3}
                          className="w-full px-3 py-2 bg-gray-600 border border-gray-500 rounded-md text-gray-100 focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {mcpServers.length === 0 && (
                  <div className="text-center py-8">
                    <Server className="h-12 w-12 mx-auto text-gray-400 mb-3" />
                    <p className="text-gray-400">No MCP servers configured</p>
                    <button
                      onClick={addMcpServer}
                      className="btn btn-primary mt-3"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add First Server
                    </button>
                  </div>
                )}
              </div>

              {/* Configuration Preview */}
              {mcpServers.some(s => s.enabled) && (
                <div>
                  <h3 className="text-lg font-medium text-gray-100 mb-3">Claude Code Configuration</h3>
                  <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
                    <pre className="text-sm text-gray-300 overflow-x-auto">
                      {generateClaudeConfig()}
                    </pre>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Copy this configuration to your Claude Code settings file or use the "Copy Claude Config" button above.
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="p-6">
              <div className="text-center py-12">
                <h3 className="text-lg font-medium text-gray-100 mb-2">General Agent Settings</h3>
                <p className="text-gray-400">
                  Additional agent configuration options will be available here.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="btn btn-secondary"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="btn btn-primary"
          >
            <Save className="h-4 w-4 mr-2" />
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
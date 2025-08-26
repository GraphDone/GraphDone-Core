# GraphDone MCP Server

🤖 **Control your GraphDone graph with natural language through Claude Code!**

This MCP (Model Context Protocol) server acts as a bridge between Claude Code and your GraphDone graph database. Instead of clicking through UIs or writing complex queries, just ask Claude to:

- *"Show me all active tasks"*
- *"Create a new epic for mobile development"*  
- *"What's blocking the user authentication feature?"*
- *"Add a dependency between task A and task B"*

## What You Get

Transform how you interact with your project management graph:

- 🔍 **Smart Browsing**: Query nodes by type, status, contributor, priority, or search terms
- ➕ **Easy Creation**: Create tasks, epics, bugs, and features through conversation
- ✏️ **Quick Updates**: Modify status, assignments, and properties instantly
- 🔗 **Relationship Management**: Add or remove dependencies and connections
- 🛤️ **Path Analysis**: Find how work items connect and detect circular dependencies
- 📊 **Detailed Insights**: Get comprehensive information about any work item

## Available Tools

### browse_graph
Query the graph structure with various filters:
- `all_nodes`: Get all nodes (with limit)
- `by_type`: Filter by node type
- `by_status`: Filter by node status
- `by_contributor`: Filter by contributor ID
- `by_priority`: Filter by minimum priority threshold
- `dependencies`: Get dependencies and dependents for a specific node
- `search`: Search nodes by title/description

### create_node
Create a new node in the graph with specified properties.

### update_node
Update an existing node's properties.

### delete_node
Delete a node and all its relationships.

### create_edge
Create a relationship between two nodes.

### delete_edge
Delete a specific relationship between two nodes.

### get_node_details
Get comprehensive information about a node including all relationships and contributors.

### find_path
Find the shortest path between two nodes.

### detect_cycles
Detect circular dependencies in the graph.

## Configuration

Set these environment variables:
- `NEO4J_URI`: Neo4j database URI (default: bolt://localhost:7687)
- `NEO4J_USER`: Database username (default: neo4j)
- `NEO4J_PASSWORD`: Database password (default: graphdone_password)

## 🚀 Quick Setup (Recommended)

**One command does it all:**

```bash
./scripts/setup-mcp.sh
```

This friendly setup script will:
- ✅ Check that you have Node.js installed
- 🔨 Build the MCP server automatically  
- 🔗 Configure Claude Code to use it
- 📋 Show you exactly what to do next
- 🛡️ Create backups of your settings (just in case)

**Total setup time: Under 2 minutes!**

## ✨ How to Use After Setup

Once configured, just talk to Claude Code naturally:

| What you say | What Claude does |
|-------------|------------------|
| "Show me all tasks in progress" | Uses `browse_graph` to filter by status |
| "Create a bug report for login issues" | Uses `create_node` to add a new bug |
| "What depends on the database migration?" | Uses `browse_graph` to find dependencies |
| "Mark task ABC as completed" | Uses `update_node` to change status |
| "Connect feature X to epic Y" | Uses `create_edge` to add relationship |

**No commands to remember - just describe what you want!**

## 🔧 Manual Setup (If Needed)

If the automatic setup doesn't work, you can configure manually:

**Option 1: Use the Claude CLI**
```bash
claude mcp add graphdone "$(which node)" "$(pwd)/packages/mcp-server/dist/index.js" \
  --env "NEO4J_URI=bolt://localhost:7687" \
  --env "NEO4J_USER=neo4j" \
  --env "NEO4J_PASSWORD=graphdone_password"
```

**Option 2: Edit Claude Code settings file directly**

Find your Claude Code settings file:
- **Linux**: `~/.config/claude-code/config.json`
- **macOS**: `~/Library/Application Support/claude-code/config.json`  
- **Windows**: `%APPDATA%/claude-code/config.json`

Add this configuration:
```json
{
  "mcpServers": {
    "graphdone": {
      "command": "node",
      "args": ["path/to/packages/mcp-server/dist/index.js"],
      "env": {
        "NEO4J_URI": "bolt://localhost:7687",
        "NEO4J_USER": "neo4j",
        "NEO4J_PASSWORD": "graphdone_password"
      }
    }
  }
}
```

## 🚨 Troubleshooting

**MCP server not appearing in Claude Code?**
- Run `claude mcp list` to check if it's registered
- Make sure Claude Code is fully restarted
- Verify the file path in your configuration

**Getting connection errors?**
- Check that Neo4j is running: `docker-compose up -d`
- Test the server health: `curl http://localhost:3128/health`
- Verify your database password is correct

**Setup script failed?**
- Make sure you're in the GraphDone project root directory
- Check that Node.js and npm are installed: `node --version && npm --version`
- Run `npm install` first if dependencies are missing

## Development

```bash
npm run build    # Build TypeScript
npm run dev      # Development with watch mode
npm run test     # Run tests
npm run lint     # Lint code
```
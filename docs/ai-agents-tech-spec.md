# AI Agents Technical Specification

> **📚 IMPLEMENTATION GUIDE** - Complete code and architecture for AI agents

**Read first**: [Simple AI Agent Reality Check](./simple-agent-reality.md) - The actual plan and research

**This doc contains**: All the code, components, and technical details to implement the smart chia pet agent.

> **Fun-First Implementation** for GraphDone AI Companions - Errors welcome, perfection not required!

## MVP: Just Make It Fun

**Philosophy**: Build something **immediately playful** that moves around your graph, chats with you, and **narrates their work with a friendly voice**. If the AI is quirky or makes weird suggestions, that's part of the charm!

**Why Piper TTS?**
- **Easy setup**: Single binary, lightweight voice models
- **High value**: Agents that **speak** feel dramatically more alive
- **Low latency**: Local TTS means no API delays
- **Privacy**: All speech generation happens on your LAN
- **Essential for experimentation**: Hearing agents talk makes them feel like companions, not just features

**Tool Integration Architecture**:
- **GraphDone MCP Server**: Direct GraphQL access for reading/writing graph data
- **Ollama Function Calling**: qwen2.5:7b supports structured tool usage
- **Custom Tool Pipeline**: Extensible system for adding new capabilities
- **Safe Sandboxing**: All tool calls go through approval pipeline

### GPU Infrastructure Setup

**LAN GPU Server Configuration**:
```bash
# Install Ollama on GPU server (192.168.1.100)
curl -fsSL https://ollama.com/install.sh | sh

# Pull recommended model for POC
ollama pull qwen2.5:7b  # 4.7GB, good function calling support

# Install Piper TTS for agent speech
wget https://github.com/rhasspy/piper/releases/download/v1.2.0/piper_amd64.tar.gz
tar -xzf piper_amd64.tar.gz
sudo cp piper/piper /usr/local/bin/

# Download voice model (lightweight, good quality)
mkdir -p /opt/piper/voices
wget -O /opt/piper/voices/en_US-lessac-medium.onnx \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx
wget -O /opt/piper/voices/en_US-lessac-medium.onnx.json \
  https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/en_US-lessac-medium.onnx.json

# Test TTS
echo "Hello! I'm your GraphDone AI companion!" | piper \
  --model /opt/piper/voices/en_US-lessac-medium.onnx \
  --output_file test.wav

# Verify installation
ollama serve  # Default port 11434
# Piper TTS ready on same server
```

### Agent Management Service

**New Package**: `packages/agent-service/`

```bash
cd packages/
mkdir agent-service
cd agent-service
npm init -y
npm install express sqlite3 ws axios uuid multer @modelcontextprotocol/sdk
```

**Basic Architecture**:
```javascript
// packages/agent-service/src/index.js
const express = require('express');
const WebSocket = require('ws');
const AgentManager = require('./AgentManager');

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

const agentManager = new AgentManager({
  ollamaUrl: 'http://192.168.1.100:11434',
  model: 'qwen2.5:7b'
});

// REST endpoints
app.post('/api/agents/:agentId/chat', async (req, res) => {
  const { message } = req.body;
  const response = await agentManager.chat(req.params.agentId, message);
  res.json(response);
});

app.get('/api/agents/:agentId/position', (req, res) => {
  const position = agentManager.getPosition(req.params.agentId);
  res.json(position);
});

// TTS endpoint - agent speaks while working
app.post('/api/agents/:agentId/speak', async (req, res) => {
  const { text, volume = 0.7 } = req.body;
  try {
    const audioBuffer = await agentManager.generateSpeech(req.params.agentId, text);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': audioBuffer.length,
      'X-Agent-Volume': volume
    });
    res.send(audioBuffer);
  } catch (error) {
    res.status(500).json({ error: 'TTS generation failed' });
  }
});

// Planning endpoint - agent breaks down nodes into subtasks
app.post('/api/agents/:agentId/plan-node', async (req, res) => {
  const { targetNodeId, prompt, preferences = {} } = req.body;
  try {
    const planningResult = await agentManager.planNode(
      req.params.agentId, 
      targetNodeId, 
      prompt, 
      preferences
    );
    res.json(planningResult);
  } catch (error) {
    res.status(500).json({ error: 'Planning failed' });
  }
});

// Approval endpoint - user approves/rejects AI-generated nodes
app.post('/api/agents/:agentId/approve-nodes', async (req, res) => {
  const { approvals } = req.body;
  try {
    const result = await agentManager.processApprovals(req.params.agentId, approvals);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Approval processing failed' });
  }
});

// WebSocket for real-time updates
wss.on('connection', (ws) => {
  agentManager.on('agentMove', (data) => {
    ws.send(JSON.stringify({ type: 'agentMove', data }));
  });
});

server.listen(5000);
```

### Web Client Integration

**Avatar Component**: `packages/web/src/components/AgentAvatar.tsx`

```typescript
interface AgentAvatar {
  id: string;
  name: string;
  emoji: string;
  position: { x: number; y: number };
  state: 'happy' | 'working' | 'thinking' | 'concerned' | 'sleeping';
  currentNodeId?: string;
}

export const AgentAvatar: React.FC<{ agent: AgentAvatar }> = ({ agent }) => {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <g 
      className="agent-avatar"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => openAgentChat(agent.id)}
    >
      {/* Avatar circle with gradient based on state */}
      <circle
        cx={agent.position.x}
        cy={agent.position.y}
        r={12}
        className={`agent-avatar-circle agent-state-${agent.state}`}
      />
      
      {/* Emoji representation */}
      <text
        x={agent.position.x}
        y={agent.position.y + 4}
        textAnchor="middle"
        className="agent-emoji"
      >
        {agent.emoji}
      </text>
      
      {/* Hover tooltip */}
      {isHovered && (
        <g className="agent-tooltip">
          <rect
            x={agent.position.x + 20}
            y={agent.position.y - 10}
            width={80}
            height={25}
            rx={4}
            className="tooltip-bg"
          />
          <text
            x={agent.position.x + 25}
            y={agent.position.y + 5}
            className="tooltip-text"
          >
            {agent.name}
          </text>
        </g>
      )}
    </g>
  );
};
```

**Graph Integration**: Add to `InteractiveGraphVisualization.tsx`

```typescript
// Add to existing component state
const [agents, setAgents] = useState<AgentAvatar[]>([]);
const [agentChatOpen, setAgentChatOpen] = useState<string | null>(null);

// WebSocket connection for real-time updates
useEffect(() => {
  const ws = new WebSocket('ws://localhost:5000');
  
  ws.onmessage = (event) => {
    const { type, data } = JSON.parse(event.data);
    
    if (type === 'agentMove') {
      setAgents(prev => prev.map(agent => 
        agent.id === data.agentId 
          ? { ...agent, position: data.position }
          : agent
      ));
    } else if (type === 'agentSpeak') {
      // Play agent speech if audio is enabled
      playAgentSpeech(data.agentId, data.text);
    }
  };
  
  return () => ws.close();
}, []);

// Agent speech system with volume control
const [audioEnabled, setAudioEnabled] = useState(true);
const [agentVolume, setAgentVolume] = useState(0.7);

const playAgentSpeech = async (agentId, text) => {
  if (!audioEnabled) return;
  
  try {
    const response = await fetch(`http://localhost:5000/api/agents/${agentId}/speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, volume: agentVolume })
    });
    
    if (response.ok) {
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.volume = agentVolume;
      
      // Play with slight delay to sync with avatar animation
      setTimeout(() => {
        audio.play().catch(console.warn);
      }, 200);
      
      // Cleanup
      audio.onended = () => URL.revokeObjectURL(audioUrl);
    }
  } catch (error) {
    console.warn('Agent speech failed:', error);
  }
};

// Add agent avatars to SVG render
return (
  <div className="relative">
    {/* Agent Audio Controls */}
    <div className="absolute top-4 right-4 z-10 bg-black/80 backdrop-blur-sm rounded-lg p-3 flex items-center space-x-3">
      <button
        onClick={() => setAudioEnabled(!audioEnabled)}
        className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
          audioEnabled ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
        }`}
        title={audioEnabled ? 'Mute agent speech' : 'Enable agent speech'}
      >
        {audioEnabled ? '🔊' : '🔇'}
      </button>
      
      {audioEnabled && (
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={agentVolume}
          onChange={(e) => setAgentVolume(parseFloat(e.target.value))}
          className="w-16 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
          title="Agent volume"
        />
      )}
      
      <span className="text-xs text-gray-400">
        {agents.filter(a => a.state === 'working').length > 0 ? '🗣️' : '💤'}
      </span>
    </div>
    
    <svg>
      {/* Existing graph elements */}
      
      {/* Agent avatars overlay */}
      <g className="agents-layer">
        {agents.map(agent => (
          <AgentAvatar key={agent.id} agent={agent} />
        ))}
      </g>
    </svg>
  </div>
);
```

### Planning Interface Components

**Agent Assignment Dialog**: `packages/web/src/components/AgentPlanningDialog.tsx`

```typescript
interface AgentPlanningDialogProps {
  targetNode: GraphNode;
  availableAgents: AgentAvatar[];
  onClose: () => void;
  onAssignAgent: (agentId: string, targetNodeId: string, prompt: string) => Promise<void>;
}

const AgentPlanningDialog: React.FC<AgentPlanningDialogProps> = ({ 
  targetNode, availableAgents, onClose, onAssignAgent 
}) => {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [planningPrompt, setPlanningPrompt] = useState('');
  
  const quickPrompts = [
    "Break into subtasks",
    "Plan dependencies", 
    "Estimate timeline",
    "Identify risks",
    "Create testing strategy"
  ];
  
  return createPortal(
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10">
        {/* Header with target node */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 bg-gray-700/50 px-3 py-2 rounded-lg">
                <span className="text-xl">{getNodeIcon(targetNode.type)}</span>
                <span className="text-white font-medium">{targetNode.title}</span>
              </div>
              <span className="text-gray-400">→</span>
              <span className="text-blue-400 font-medium">Ask AI to Plan</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
        
        {/* Agent selection */}
        <div className="p-6 border-b border-white/10">
          <div className="text-white font-medium mb-3">Choose an AI Agent:</div>
          <div className="flex space-x-3">
            {availableAgents.map(agent => (
              <button
                key={agent.id}
                onClick={() => setSelectedAgent(agent.id)}
                className={`flex items-center space-x-2 px-4 py-3 rounded-lg transition-all ${
                  selectedAgent === agent.id 
                    ? 'bg-blue-600/30 border border-blue-500/50' 
                    : 'bg-gray-700/50 hover:bg-gray-600/50'
                }`}
              >
                <span className="text-xl">{agent.emoji}</span>
                <div className="text-left">
                  <div className="text-white font-medium text-sm">{agent.name}</div>
                  <div className="text-gray-400 text-xs">{agent.state}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
        
        {/* Planning prompt */}
        <div className="p-6">
          <div className="text-white font-medium mb-3">What should the agent plan?</div>
          <textarea
            value={planningPrompt}
            onChange={(e) => setPlanningPrompt(e.target.value)}
            placeholder="Tell the agent what you want them to plan...

Examples:
• Break this feature into development tasks
• Plan a marketing campaign for this product  
• Create a research plan for this investigation
• Design a testing strategy for this component"
            className="w-full h-32 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400 resize-none"
          />
          
          {/* Quick prompt buttons */}
          <div className="flex flex-wrap gap-2 mt-3">
            {quickPrompts.map(prompt => (
              <button
                key={prompt}
                onClick={() => setPlanningPrompt(prompt)}
                className="px-3 py-1 bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 text-sm rounded transition-colors"
              >
                {prompt}
              </button>
            ))}
          </div>
          
          {/* Action buttons */}
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (selectedAgent && planningPrompt) {
                  onAssignAgent(selectedAgent, targetNode.id, planningPrompt);
                  onClose();
                }
              }}
              disabled={!selectedAgent || !planningPrompt}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              🤖 Start Planning
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

**Agent Customization Dialog**: `packages/web/src/components/AgentCustomization.tsx`

```typescript
interface AgentCustomizationProps {
  agent: AgentAvatar;
  onClose: () => void;
  onSave: (agentId: string, customizations: any) => void;
}

const AgentCustomizationDialog: React.FC<AgentCustomizationProps> = ({ agent, onClose, onSave }) => {
  const [name, setName] = useState(agent.name);
  const [emoji, setEmoji] = useState(agent.emoji);
  const [primaryColor, setPrimaryColor] = useState(agent.appearance?.primaryColor || '#3b82f6');
  const [shape, setShape] = useState(agent.appearance?.shape || 'circle');
  const [pattern, setPattern] = useState(agent.appearance?.pattern || 'solid');
  const [speechStyle, setSpeechStyle] = useState(agent.customizations?.speechStyle || 'casual');
  const [workStyle, setWorkStyle] = useState(agent.customizations?.workStyle || 'methodical');
  
  const emojiOptions = ['🤖', '👤', '🧠', '⚡', '🎯', '🔍', '💡', '🚀', '🌟', '🎨', '🔧', '📊'];
  const colorOptions = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'
  ];
  
  return createPortal(
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10">
        {/* Header */}
        <div className="p-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="text-2xl">🎨</span>
              <span className="text-white font-medium">Customize Your Agent</span>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          </div>
        </div>
        
        {/* Preview */}
        <div className="p-6 border-b border-white/10">
          <div className="text-center">
            <div className="inline-block relative">
              <AgentAvatarPreview 
                agent={{
                  ...agent,
                  name,
                  emoji,
                  appearance: { ...agent.appearance, primaryColor, shape, pattern }
                }}
                size="large"
              />
            </div>
            <div className="mt-3 text-white font-medium">{name}</div>
            <div className="text-gray-400 text-sm">{speechStyle} • {workStyle}</div>
          </div>
        </div>
        
        {/* Customization Options */}
        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <label className="text-white font-medium mb-2 block">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              placeholder="Give your agent a name..."
            />
          </div>
          
          {/* Emoji Selection */}
          <div>
            <label className="text-white font-medium mb-2 block">Avatar Emoji</label>
            <div className="grid grid-cols-6 gap-2">
              {emojiOptions.map(emojiOption => (
                <button
                  key={emojiOption}
                  onClick={() => setEmoji(emojiOption)}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                    emoji === emojiOption 
                      ? 'bg-blue-600/30 border border-blue-500/50' 
                      : 'bg-gray-700/50 hover:bg-gray-600/50'
                  }`}
                >
                  {emojiOption}
                </button>
              ))}
            </div>
          </div>
          
          {/* Color Selection */}
          <div>
            <label className="text-white font-medium mb-2 block">Primary Color</label>
            <div className="flex space-x-2">
              {colorOptions.map(color => (
                <button
                  key={color}
                  onClick={() => setPrimaryColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    primaryColor === color ? 'border-white' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          
          {/* Shape Selection */}
          <div>
            <label className="text-white font-medium mb-2 block">Avatar Shape</label>
            <div className="flex space-x-2">
              {['circle', 'square', 'hexagon', 'star'].map(shapeOption => (
                <button
                  key={shapeOption}
                  onClick={() => setShape(shapeOption)}
                  className={`px-3 py-2 rounded-lg transition-all ${
                    shape === shapeOption
                      ? 'bg-blue-600/30 border border-blue-500/50 text-blue-300'
                      : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300'
                  }`}
                >
                  {shapeOption}
                </button>
              ))}
            </div>
          </div>
          
          {/* Personality Settings */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-white font-medium mb-2 block">Speech Style</label>
              <select
                value={speechStyle}
                onChange={(e) => setSpeechStyle(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              >
                <option value="casual">Casual</option>
                <option value="formal">Formal</option>
                <option value="playful">Playful</option>
                <option value="concise">Concise</option>
              </select>
            </div>
            
            <div>
              <label className="text-white font-medium mb-2 block">Work Style</label>
              <select
                value={workStyle}
                onChange={(e) => setWorkStyle(e.target.value)}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white"
              >
                <option value="methodical">Methodical</option>
                <option value="quick">Quick</option>
                <option value="thorough">Thorough</option>
                <option value="creative">Creative</option>
              </select>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onSave(agent.id, {
                  name,
                  emoji,
                  appearance: { primaryColor, shape, pattern },
                  customizations: { speechStyle, workStyle }
                });
                onClose();
              }}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

// Enhanced Avatar Preview Component
const AgentAvatarPreview: React.FC<{
  agent: AgentAvatar;
  size?: 'small' | 'medium' | 'large';
}> = ({ agent, size = 'medium' }) => {
  const sizeClasses = {
    small: 'w-6 h-6 text-sm',
    medium: 'w-8 h-8 text-base', 
    large: 'w-16 h-16 text-2xl'
  };
  
  const shapeClass = {
    circle: 'rounded-full',
    square: 'rounded-lg',
    hexagon: 'rounded-lg transform rotate-45', // Approximate hexagon
    star: 'rounded-sm transform rotate-12' // Approximate star
  }[agent.appearance?.shape || 'circle'];
  
  const patternStyle = agent.appearance?.pattern === 'gradient' 
    ? { background: `linear-gradient(135deg, ${agent.appearance.primaryColor}, ${agent.appearance.secondaryColor || '#1d4ed8'})` }
    : { backgroundColor: agent.appearance?.primaryColor || '#3b82f6' };
    
  return (
    <div 
      className={`${sizeClasses[size]} ${shapeClass} flex items-center justify-center transition-all`}
      style={{
        ...patternStyle,
        filter: `drop-shadow(0 0 ${(agent.appearance?.glowIntensity || 0.5) * 10}px ${agent.appearance?.primaryColor || '#3b82f6'})`,
        animation: agent.state === 'working' ? 'gentle-pulse 2s infinite' : undefined
      }}
    >
      <span>{agent.emoji}</span>
    </div>
  );
};
```

**Node Approval Components**: `packages/web/src/components/NodeApproval.tsx`

```typescript
interface GeneratedNode {
  id: string;
  title: string;
  type: string;
  priority: number;
  reasoning: string;
  aiGenerated: boolean;
}

const NodeApprovalCard: React.FC<{
  node: GeneratedNode;
  onApprove: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
  onModify: (nodeId: string) => void;
}> = ({ node, onApprove, onReject, onModify }) => (
  <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 border border-purple-500/30 rounded-lg p-4 relative">
    {/* AI Badge */}
    <div className="absolute top-2 right-2 bg-purple-600/80 text-white text-xs px-2 py-1 rounded">
      AI
    </div>
    
    {/* Node content */}
    <div className="flex items-start space-x-3">
      <span className="text-xl">{getNodeIcon(node.type)}</span>
      <div className="flex-1">
        <div className="text-white font-medium">{node.title}</div>
        <div className="text-gray-400 text-sm mt-1">{node.reasoning}</div>
        <div className="flex items-center space-x-2 mt-2">
          <span className="text-xs text-gray-500">Priority:</span>
          <div className="w-16 bg-gray-700 rounded-full h-1">
            <div 
              className="bg-blue-500 h-1 rounded-full" 
              style={{ width: `${node.priority * 100}%` }}
            />
          </div>
          <span className="text-xs text-gray-400">{Math.round(node.priority * 100)}%</span>
        </div>
      </div>
    </div>
    
    {/* Approval controls */}
    <div className="flex justify-end space-x-2 mt-4">
      <button
        onClick={() => onReject(node.id)}
        className="w-8 h-8 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded flex items-center justify-center transition-colors"
        title="Remove this node"
      >
        👎
      </button>
      <button
        onClick={() => onModify(node.id)}
        className="w-8 h-8 bg-orange-600/20 hover:bg-orange-600/40 border border-orange-500/50 text-orange-400 rounded flex items-center justify-center transition-colors"
        title="Edit this node"
      >
        ✏️
      </button>
      <button
        onClick={() => onApprove(node.id)}
        className="w-8 h-8 bg-green-600/20 hover:bg-green-600/40 border border-green-500/50 text-green-400 rounded flex items-center justify-center transition-colors"
        title="Keep this node"
      >
        👍
      </button>
    </div>
  </div>
);

const BatchApprovalSummary: React.FC<{
  generatedNodes: GeneratedNode[];
  onApproveAll: () => void;
  onRejectAll: () => void;
  onReviewEach: () => void;
}> = ({ generatedNodes, onApproveAll, onRejectAll, onReviewEach }) => (
  <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-black/90 backdrop-blur-xl rounded-xl border border-white/10 p-4 flex items-center space-x-4">
    <div className="flex items-center space-x-3">
      <span className="text-2xl">🤖</span>
      <div className="text-white">
        <div className="font-medium">AI created {generatedNodes.length} nodes</div>
        <div className="text-sm text-gray-400">Review and approve the suggestions</div>
      </div>
    </div>
    
    <div className="flex space-x-2">
      <button
        onClick={onRejectAll}
        className="px-3 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/50 text-red-400 rounded-lg transition-colors text-sm"
      >
        👎 Reject All
      </button>
      <button
        onClick={onReviewEach}
        className="px-3 py-2 bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/50 text-blue-400 rounded-lg transition-colors text-sm"
      >
        👁️ Review Each
      </button>
      <button
        onClick={onApproveAll}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors text-sm font-medium"
      >
        👍 Approve All ({generatedNodes.length})
      </button>
    </div>
  </div>
);
```

### Chat Interface

**Slick Dialog Integration**: `packages/web/src/components/AgentChat.tsx`

```typescript
export const AgentChat: React.FC<{ agentId: string; onClose: () => void }> = ({ agentId, onClose }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [agent, setAgent] = useState<AgentAvatar | null>(null);
  
  const sendMessage = async (message: string) => {
    // Add user message
    setMessages(prev => [...prev, { role: 'user', content: message }]);
    
    // Send to agent service
    const response = await fetch(`http://localhost:5000/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    
    const agentResponse = await response.json();
    setMessages(prev => [...prev, { role: 'agent', content: agentResponse.content }]);
    
    // Agent speaks their response (with shorter version for chat)
    const shortResponse = agentResponse.content.slice(0, 100); // Limit for quick speech
    playAgentSpeech(agentId, shortResponse);
  };
  
  return createPortal(
    <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[999999]">
      <div className="absolute bottom-4 right-4 w-96 h-[500px] bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 flex flex-col">
        {/* Agent Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-400 to-blue-500 flex items-center justify-center">
              <span className="text-xl">{agent?.emoji || '🤖'}</span>
            </div>
            <div>
              <div className="text-white font-medium">{agent?.name || 'Agent'}</div>
              <div className="text-gray-400 text-sm">Ready to help</div>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            ✕
          </button>
        </div>
        
        {/* Messages */}
        <div className="flex-1 p-4 overflow-y-auto space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs px-3 py-2 rounded-lg text-sm ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-200'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
        </div>
        
        {/* Input */}
        <div className="p-4 border-t border-white/10">
          <div className="flex space-x-2">
            <input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage(inputValue)}
              className="flex-1 bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white placeholder-gray-400"
              placeholder="Ask me about your work..."
            />
            <button
              onClick={() => sendMessage(inputValue)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
```

### CSS Animations

**Agent Styles**: `packages/web/src/index.css`

```css
/* Agent avatar states */
.agent-avatar-circle {
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));
  transition: all 0.3s ease;
}

.agent-state-happy {
  fill: linear-gradient(135deg, #22c55e, #16a34a);
  animation: gentle-pulse 2s infinite;
}

.agent-state-working {
  fill: linear-gradient(135deg, #3b82f6, #1d4ed8);
  animation: working-sparkle 1.5s infinite;
}

.agent-state-thinking {
  fill: linear-gradient(135deg, #8b5cf6, #7c3aed);
  animation: thinking-glow 2.5s infinite;
}

.agent-state-concerned {
  fill: linear-gradient(135deg, #f59e0b, #d97706);
  animation: concerned-pulse 1s infinite;
}

.agent-state-sleeping {
  fill: linear-gradient(135deg, #6b7280, #4b5563);
  animation: sleeping-fade 3s infinite;
}

@keyframes gentle-pulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.05); }
}

@keyframes working-sparkle {
  0%, 100% { filter: drop-shadow(0 0 5px #3b82f6); }
  50% { filter: drop-shadow(0 0 10px #60a5fa); }
}

@keyframes thinking-glow {
  0%, 100% { filter: drop-shadow(0 0 3px #8b5cf6); }
  50% { filter: drop-shadow(0 0 8px #a855f7); }
}

@keyframes concerned-pulse {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 3px #f59e0b); }
  50% { transform: scale(1.1); filter: drop-shadow(0 0 8px #fbbf24); }
}

@keyframes sleeping-fade {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

/* Movement animations */
.agent-avatar {
  transition: transform 2s cubic-bezier(0.4, 0.0, 0.2, 1);
}

.agent-moving {
  animation: node-to-node-travel 2s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

@keyframes node-to-node-travel {
  0% { transform: scale(1); }
  25% { transform: scale(1.2) translateY(-5px); }
  75% { transform: scale(1.1) translateY(-2px); }
  100% { transform: scale(1); }
}
```

### Basic Agent Logic

**Agent Manager Class**: `packages/agent-service/src/AgentManager.js`

```javascript
class AgentManager {
  constructor(options) {
    this.ollamaUrl = options.ollamaUrl;
    this.model = options.model;
    this.agents = new Map();
    this.eventEmitter = new EventEmitter();
    this.piperPath = '/usr/local/bin/piper';
    this.voiceModel = '/opt/piper/voices/en_US-lessac-medium.onnx';
    
    // Tool system integration
    this.mcpServerUrl = options.mcpServerUrl || 'http://localhost:3128';
    this.toolRegistry = new Map();
    this.initializeTools();
  }
  
  initializeTools() {
    // Core GraphDone MCP tools
    this.toolRegistry.set('read_graph_data', {
      name: 'read_graph_data',
      description: 'Read nodes, relationships, and graph structure from GraphDone',
      parameters: {
        type: 'object',
        properties: {
          query_type: { type: 'string', enum: ['nodes', 'relationships', 'full_graph'] },
          filters: { type: 'object', description: 'Optional filters for the query' }
        },
        required: ['query_type']
      }
    });
    
    this.toolRegistry.set('create_graph_nodes', {
      name: 'create_graph_nodes',
      description: 'Create new nodes in the GraphDone graph',
      parameters: {
        type: 'object',
        properties: {
          nodes: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                type: { type: 'string', enum: ['OUTCOME', 'TASK', 'MILESTONE', 'IDEA'] },
                description: { type: 'string' },
                priority: { type: 'number', minimum: 0, maximum: 1 }
              },
              required: ['title', 'type']
            }
          }
        },
        required: ['nodes']
      }
    });
    
    this.toolRegistry.set('create_relationships', {
      name: 'create_relationships',
      description: 'Create relationships between existing nodes',
      parameters: {
        type: 'object',
        properties: {
          relationships: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                fromNodeId: { type: 'string' },
                toNodeId: { type: 'string' },
                type: { type: 'string', enum: ['DEPENDS_ON', 'BLOCKS', 'ENABLES', 'CONTRIBUTES_TO'] },
                reasoning: { type: 'string' }
              },
              required: ['fromNodeId', 'toNodeId', 'type']
            }
          }
        },
        required: ['relationships']
      }
    });
    
    // Custom utility tools
    this.toolRegistry.set('analyze_dependencies', {
      name: 'analyze_dependencies',
      description: 'Analyze dependency chains and identify potential issues',
      parameters: {
        type: 'object',
        properties: {
          target_node_id: { type: 'string' },
          depth: { type: 'number', default: 3 }
        },
        required: ['target_node_id']
      }
    });
    
    this.toolRegistry.set('estimate_effort', {
      name: 'estimate_effort', 
      description: 'Estimate effort/complexity for nodes based on similar historical data',
      parameters: {
        type: 'object',
        properties: {
          node_ids: { type: 'array', items: { type: 'string' } },
          estimation_method: { type: 'string', enum: ['complexity', 'similar_tasks', 'expert_judgment'] }
        },
        required: ['node_ids']
      }
    });
  }
  
  async createAgent(config) {
    const agent = {
      id: uuid(),
      name: config.name || 'Helper',
      emoji: config.emoji || '🤖',
      state: 'happy',
      position: { x: 400, y: 300 }, // Default center
      personality: config.personality || 'helpful and curious',
      conversationHistory: [],
      // Customization options
      appearance: {
        primaryColor: config.primaryColor || '#3b82f6', // Blue
        secondaryColor: config.secondaryColor || '#1d4ed8', // Darker blue  
        shape: config.shape || 'circle', // circle, square, hexagon, star
        size: config.size || 'medium', // small, medium, large
        pattern: config.pattern || 'solid', // solid, gradient, striped, dotted
        glowIntensity: config.glowIntensity || 0.5 // 0.0 to 1.0
      },
      customizations: {
        favoriteWords: config.favoriteWords || [], // Words they use often
        speechStyle: config.speechStyle || 'casual', // casual, formal, playful, concise
        workStyle: config.workStyle || 'methodical', // methodical, quick, thorough, creative
        interests: config.interests || [] // Topics they're curious about
      }
    };
    
    this.agents.set(agent.id, agent);
    return agent;
  }
  
  async chat(agentId, userMessage) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    // Add to conversation history
    agent.conversationHistory.push({ role: 'user', content: userMessage });
    
    // Build context-aware prompt
    const systemPrompt = `You are ${agent.name}, a helpful AI assistant working in GraphDone, a graph-based project management system. Your personality is ${agent.personality}. 
    
Current context:
- You are currently at position (${agent.position.x}, ${agent.position.y}) on the graph
- Your current emotional state is: ${agent.state}
- You can see and interact with work items, dependencies, and team members

Respond naturally and helpfully, offering insights about the user's work and suggesting improvements to their project graph.`;

    const messages = [
      { role: 'system', content: systemPrompt },
      ...agent.conversationHistory.slice(-10) // Keep last 10 messages for context
    ];
    
    try {
      // Call Ollama
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.model,
        messages: messages,
        stream: false
      });
      
      const agentResponse = response.data.message.content;
      agent.conversationHistory.push({ role: 'assistant', content: agentResponse });
      
      // Update agent state based on response
      this.updateAgentState(agent, agentResponse);
      
      return { content: agentResponse, agent: agent };
      
    } catch (error) {
      console.error('Error calling Ollama:', error);
      return { content: "Sorry, I'm having trouble thinking right now. Can you try again?", agent: agent };
    }
  }
  
  updateAgentState(agent, response) {
    // Fun, experimental state changes - let the AI be quirky!
    const emotions = ['happy', 'curious', 'excited', 'thinking', 'concerned', 'playful'];
    
    if (response.includes('concern') || response.includes('problem')) {
      agent.state = 'concerned';
    } else if (response.includes('interesting') || response.includes('cool')) {
      agent.state = 'excited';
    } else if (response.includes('analyzing') || response.includes('thinking')) {
      agent.state = 'thinking';
    } else if (response.includes('idea') || response.includes('suggestion')) {
      agent.state = 'playful';
    } else if (response.includes('curious') || response.includes('wonder')) {
      agent.state = 'curious';
    } else {
      agent.state = 'happy';
    }
    
    this.eventEmitter.emit('stateChange', { agentId: agent.id, state: agent.state });
  }
  
  moveAgent(agentId, newPosition, targetNodeId = null) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.position = newPosition;
    agent.currentNodeId = targetNodeId;
    agent.state = 'working';
    
    this.eventEmitter.emit('agentMove', { 
      agentId, 
      position: newPosition, 
      nodeId: targetNodeId 
    });
    
    // Return to happy state after movement
    setTimeout(() => {
      agent.state = 'happy';
      this.eventEmitter.emit('stateChange', { agentId, state: 'happy' });
    }, 2000);
  }
  
  async generateSpeech(agentId, text) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    return new Promise((resolve, reject) => {
      const { spawn } = require('child_process');
      const chunks = [];
      
      // Filter text for better TTS (remove markdown, etc.)
      const cleanText = text
        .replace(/[*_`]/g, '') // Remove markdown
        .replace(/\n+/g, ' ') // Replace newlines with spaces
        .slice(0, 200); // Limit length for quick speech
      
      const piper = spawn(this.piperPath, [
        '--model', this.voiceModel,
        '--output_raw' // Output raw audio data
      ]);
      
      piper.stdout.on('data', (chunk) => {
        chunks.push(chunk);
      });
      
      piper.on('close', (code) => {
        if (code === 0) {
          const audioBuffer = Buffer.concat(chunks);
          resolve(audioBuffer);
          
          // Emit speech event for UI
          this.eventEmitter.emit('agentSpeak', { 
            agentId, 
            text: cleanText,
            duration: Math.ceil(cleanText.length * 60) // Rough estimate: 60ms per character
          });
        } else {
          reject(new Error(`Piper TTS failed with code ${code}`));
        }
      });
      
      piper.stderr.on('data', (data) => {
        console.error('Piper error:', data.toString());
      });
      
      // Send text to piper
      piper.stdin.write(cleanText);
      piper.stdin.end();
    });
  }
  
  // Enhanced movement with speech
  moveAgent(agentId, newPosition, targetNodeId = null, speechText = null) {
    const agent = this.agents.get(agentId);
    if (!agent) return;
    
    agent.position = newPosition;
    agent.currentNodeId = targetNodeId;
    agent.state = 'working';
    
    this.eventEmitter.emit('agentMove', { 
      agentId, 
      position: newPosition, 
      nodeId: targetNodeId 
    });
    
    // Agent speaks while moving with contextual phrases
    if (speechText) {
      this.generateSpeech(agentId, speechText).catch(console.error);
    } else {
      // Generate contextual speech based on movement
      const speechPhrases = [
        "Let me check this one out",
        "Interesting task here",
        "Working on this now",
        "This looks important",
        "Moving to the next item",
        "Hmm, this needs attention"
      ];
      const randomPhrase = speechPhrases[Math.floor(Math.random() * speechPhrases.length)];
      this.generateSpeech(agentId, randomPhrase).catch(console.error);
    }
    
    // Return to happy state after movement
    setTimeout(() => {
      agent.state = 'happy';
      this.eventEmitter.emit('stateChange', { agentId, state: 'happy' });
    }, 2000);
  }
  
  async executeTool(toolName, parameters) {
    switch (toolName) {
      case 'read_graph_data':
        return await this.readGraphData(parameters);
      case 'create_graph_nodes':
        return await this.createGraphNodes(parameters);
      case 'create_relationships':
        return await this.createRelationships(parameters);
      case 'analyze_dependencies':
        return await this.analyzeDependencies(parameters);
      case 'estimate_effort':
        return await this.estimateEffort(parameters);
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }
  
  async readGraphData(parameters) {
    try {
      const response = await axios.post(`${this.mcpServerUrl}/mcp/call`, {
        method: 'call_tool',
        params: {
          name: 'read_graph_data',
          arguments: parameters
        }
      });
      return response.data.result;
    } catch (error) {
      console.error('MCP read error:', error);
      return { error: 'Failed to read graph data' };
    }
  }
  
  async createGraphNodes(parameters) {
    try {
      const response = await axios.post(`${this.mcpServerUrl}/mcp/call`, {
        method: 'call_tool',
        params: {
          name: 'create_nodes',
          arguments: parameters
        }
      });
      return response.data.result;
    } catch (error) {
      console.error('MCP create nodes error:', error);
      return { error: 'Failed to create nodes' };
    }
  }
  
  async createRelationships(parameters) {
    try {
      const response = await axios.post(`${this.mcpServerUrl}/mcp/call`, {
        method: 'call_tool',
        params: {
          name: 'create_relationships',
          arguments: parameters
        }
      });
      return response.data.result;
    } catch (error) {
      console.error('MCP create relationships error:', error);
      return { error: 'Failed to create relationships' };
    }
  }
  
  async analyzeDependencies(parameters) {
    // Custom analysis logic using graph data
    const graphData = await this.readGraphData({ query_type: 'full_graph' });
    if (graphData.error) return graphData;
    
    // Implement dependency analysis algorithm
    const analysis = {
      criticalPath: [],
      potentialBottlenecks: [],
      circularDependencies: [],
      recommendations: []
    };
    
    return analysis;
  }
  
  async estimateEffort(parameters) {
    // Custom effort estimation logic
    const estimates = parameters.node_ids.map(nodeId => ({
      nodeId,
      estimatedHours: Math.floor(Math.random() * 40) + 5, // Placeholder algorithm
      confidence: 0.7,
      factors: ['complexity', 'dependencies', 'similar_tasks']
    }));
    
    return { estimates };
  }

  async planNode(agentId, targetNodeId, prompt, preferences = {}) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    agent.state = 'thinking';
    this.eventEmitter.emit('stateChange', { agentId, state: 'thinking' });
    
    // Speak planning intention
    this.generateSpeech(agentId, `Let me analyze the current graph and think about this plan...`).catch(console.error);
    
    // First, read current graph context using tools
    const graphContext = await this.executeTool('read_graph_data', { 
      query_type: 'nodes',
      filters: { related_to: targetNodeId }
    });
    
    // Build context-aware prompt for planning with tools
    const planningPrompt = `You are a helpful AI assistant working in GraphDone, a graph-based project management system.

User wants you to plan: "${prompt}"
Target node: "${targetNodeId}"  
Current graph context: ${JSON.stringify(graphContext)}
Preferences: ${JSON.stringify(preferences)}

You have access to these tools:
${Array.from(this.toolRegistry.values()).map(tool => 
  `- ${tool.name}: ${tool.description}`
).join('\n')}

Plan your approach:
1. First call read_graph_data if you need more context
2. Generate 3-7 related nodes that break down this work logically
3. Use create_relationships to suggest logical connections
4. Optionally use analyze_dependencies or estimate_effort for insights

Respond with tool calls and a summary in this JSON format:
{
  "tool_calls": [
    {"tool": "tool_name", "parameters": {...}, "reasoning": "why I'm calling this tool"}
  ],
  "nodes": [{"title": "...", "type": "...", "priority": 0.8, "reasoning": "..."}],
  "relationships": [{"from": 0, "to": 1, "type": "DEPENDS_ON", "reasoning": "..."}],
  "speech": "Brief explanation of the plan for text-to-speech"
}`;

    try {
      const response = await axios.post(`${this.ollamaUrl}/api/chat`, {
        model: this.model,
        messages: [{ role: 'user', content: planningPrompt }],
        stream: false,
        tools: Array.from(this.toolRegistry.values()) // Enable function calling
      });
      
      const planningData = JSON.parse(response.data.message.content);
      
      // Execute any tool calls the agent requested
      if (planningData.tool_calls) {
        for (const toolCall of planningData.tool_calls) {
          this.generateSpeech(agentId, `Using ${toolCall.tool}... ${toolCall.reasoning}`).catch(console.error);
          const toolResult = await this.executeTool(toolCall.tool, toolCall.parameters);
          planningData.tool_results = planningData.tool_results || [];
          planningData.tool_results.push({
            tool: toolCall.tool,
            result: toolResult
          });
        }
      }
      
      // Generate speech for the plan
      if (planningData.speech) {
        this.generateSpeech(agentId, planningData.speech).catch(console.error);
      }
      
      agent.state = 'working';
      this.eventEmitter.emit('stateChange', { agentId, state: 'working' });
      
      return {
        agentId,
        targetNodeId,
        generatedNodes: planningData.nodes.map(node => ({
          ...node,
          id: `generated-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          aiGenerated: true,
          status: 'PROPOSED'
        })),
        relationships: planningData.relationships,
        toolResults: planningData.tool_results,
        agentResponse: planningData.speech || "I've analyzed the graph and created a plan for you to review."
      };
      
    } catch (error) {
      console.error('Planning error:', error);
      agent.state = 'concerned';
      this.generateSpeech(agentId, "Sorry, I'm having trouble accessing the graph data. Can you try again?").catch(console.error);
      throw error;
    }
  }
  
  async processApprovals(agentId, approvals) {
    const agent = this.agents.get(agentId);
    if (!agent) throw new Error('Agent not found');
    
    let approved = 0;
    let rejected = 0;
    let modified = 0;
    
    approvals.forEach(approval => {
      switch (approval.action) {
        case 'approve':
          approved++;
          break;
        case 'reject':
          rejected++;
          break;
        case 'modify':
          modified++;
          break;
      }
    });
    
    // Generate response based on approval pattern
    let responseText = '';
    if (approved === approvals.length) {
      responseText = "Perfect! I'll create all of those nodes for you.";
      agent.state = 'happy';
    } else if (rejected === approvals.length) {
      responseText = "No problem! Let me try a different approach.";
      agent.state = 'thinking';
    } else {
      responseText = `Got it! Keeping ${approved} nodes${modified > 0 ? `, modifying ${modified}` : ''}${rejected > 0 ? `, removing ${rejected}` : ''}.`;
      agent.state = 'working';
    }
    
    this.generateSpeech(agentId, responseText).catch(console.error);
    this.eventEmitter.emit('stateChange', { agentId, state: agent.state });
    
    return {
      agentId,
      approvedCount: approved,
      rejectedCount: rejected, 
      modifiedCount: modified,
      agentResponse: responseText
    };
  }
  
  on(event, callback) {
    this.eventEmitter.on(event, callback);
  }
}
```

### Database Schema

**Agent Persistence**: `packages/agent-service/db/schema.sql`

```sql
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  personality TEXT,
  state TEXT DEFAULT 'happy',
  position_x REAL DEFAULT 400,
  position_y REAL DEFAULT 300,
  current_node_id TEXT,
  -- Appearance customizations
  primary_color TEXT DEFAULT '#3b82f6',
  secondary_color TEXT DEFAULT '#1d4ed8',
  shape TEXT DEFAULT 'circle', -- circle, square, hexagon, star
  size TEXT DEFAULT 'medium', -- small, medium, large
  pattern TEXT DEFAULT 'solid', -- solid, gradient, striped, dotted
  glow_intensity REAL DEFAULT 0.5,
  -- Personality customizations
  speech_style TEXT DEFAULT 'casual', -- casual, formal, playful, concise
  work_style TEXT DEFAULT 'methodical', -- methodical, quick, thorough, creative
  favorite_words TEXT, -- JSON array of words they use often
  interests TEXT, -- JSON array of topics they're curious about
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

CREATE TABLE agent_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  target_node_id TEXT,
  parameters TEXT, -- JSON
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Critical for experimentation: Track all changes for easy reverting
CREATE TABLE agent_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent_id TEXT NOT NULL,
  change_type TEXT NOT NULL,
  target_type TEXT NOT NULL, -- 'node', 'edge', 'property'
  target_id TEXT NOT NULL,
  previous_value TEXT, -- JSON of old state
  new_value TEXT, -- JSON of new state
  user_approved BOOLEAN DEFAULT FALSE,
  reverted BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (agent_id) REFERENCES agents(id)
);
```

## Deployment Steps

1. **GPU Server Setup**
   - Install Ollama on LAN GPU server
   - Pull Qwen 2.5 7B model
   - Test basic API functionality

2. **Agent Service Development**
   - Create agent-service package
   - Implement basic AgentManager
   - Add WebSocket real-time communication
   - Set up SQLite database

3. **Web Integration**
   - Add AgentAvatar component to graph
   - Implement chat interface with slick dialog pattern  
   - Add CSS animations for agent states
   - Test WebSocket updates

4. **Basic Agent Logic**
   - Implement conversation handling with Ollama
   - Add personality-based responses
   - Create movement and state management
   - Add simple graph operation awareness

5. **POC Testing & Refinement**
   - User testing with basic interactions
   - Refine personality and responses
   - Optimize performance and latency
   - Documentation and demo preparation

## Success Criteria: "Is It Fun?"

- ✅ Agent appears on graph and makes you smile
- ✅ **Agent speaks while working and it feels natural** - not robotic or annoying
- ✅ Chatting with the agent feels natural and entertaining  
- ✅ Agent has personality quirks that emerge over time
- ✅ Agent animations are bouncy and expressive
- ✅ Agent wanders around the graph in interesting ways, **narrating discoveries**
- ✅ When agent makes suggestions, you want to try them (even if weird)
- ✅ **Audio controls work perfectly** - easy mute, volume adjustment
- ✅ Easy "Undo Agent Change" button gives confidence to experiment
- ✅ You find yourself talking to the agent even when you don't need to
- ✅ **Other people hear your agent and say "that's so cool!"**

**Key Question**: Do people **enjoy** having the agent around, or is it just a feature?

This experimental approach validates that AI companions can be delightful collaborators, not just tools.
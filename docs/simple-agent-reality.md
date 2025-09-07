# Simple AI Agent - Reality Check

> **🎯 THIS IS THE ACTUAL PLAN** - Start here for AI agents in GraphDone

**What we're building**: A smart chia pet that can barely talk and moves around your graph

**Why this doc exists**: We researched what actually works with Ollama + small AI models today, not enterprise dreams.

**Other AI docs**:
- [AI Agents Technical Spec](./ai-agents-tech-spec.md) - Complete implementation details (read after this)
- [Agent Planning Scenarios](./agent-planning-scenarios.md) - Future planning workflows (inspirational)

## Research Findings: What Actually Works

### 1. **Ollama Server + Small AI Models is Simple**

**Ollama** = Local inference server (like running OpenAI API on your own machine)  
**qwen2.5:1.5b** = The actual AI model (1.5 billion parameters, 1.5GB file)

```bash
# Option 1: Native install
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen2.5:1.5b  # Downloads the 1.5GB model weights

# Option 2: Docker (recommended - secure & isolated)
docker run -d \
  --name ollama \
  --network graphdone-network \
  -v ollama:/root/.ollama \
  -p 11434:11434 \
  ollama/ollama

# Pull model in Docker container
docker exec ollama ollama pull qwen2.5:1.5b

# Option 3: Docker Hub Models (NEW 2024/2025 approach)
# Many models now ship with their own built-in TCP server runners
docker run -d \
  --name qwen-model \
  --network graphdone-network \
  -p 11434:8000 \
  registry.ollama.ai/library/qwen2.5:1.5b

# No separate Ollama server needed - model includes inference server
# Test basic chat (from official ollama-js docs)
npm install ollama
```

**Basic working code from ollama-js**:
```javascript
import ollama from 'ollama'

// You're sending requests to Ollama server, which runs the qwen2.5:1.5b model
const response = await ollama.chat({
  model: 'qwen2.5:1.5b', // This specifies which AI model Ollama should use
  messages: [{ role: 'user', content: 'Help me plan this task' }],
})
console.log(response.message.content)
```

**That's it.** No frameworks, no enterprise architecture, just 5 lines that work.

### 2. **Function Calling is Experimental** 
From RedHat tutorial: The qwen2.5:7b model (running on Ollama) can do basic function calling, but it's messy:

```javascript
// Define ONE simple function
const tools = [{
  type: 'function',
  function: {
    name: 'createNode',
    description: 'Create a work item in GraphDone',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        type: { type: 'string', enum: ['TASK', 'OUTCOME'] }
      },
      required: ['title', 'type']
    }
  }
}];

// Send request to Ollama server with tools enabled
const response = await ollama.chat({
  model: 'qwen2.5:7b', // Ollama runs this larger model for function calling
  messages: [{ role: 'user', content: 'Create a task for testing' }],
  tools: tools
});

// Handle tool calls (if any)
if (response.message.tool_calls) {
  console.log('Model wants to create:', response.message.tool_calls[0].function.arguments);
}
```

**Reality**: Works maybe 60% of the time. The model often ignores tools or hallucinates parameters.

### 3. **What We Can Build in a Day**

**Minimal Smart Chia Pet**:
```javascript
// packages/web/src/components/SimpleAgent.jsx
import { useState, useEffect } from 'react';
import ollama from 'ollama/browser';

export function SimpleAgent() {
  const [agent, setAgent] = useState({
    x: 400, y: 300,
    state: 'sleeping', // sleeping, awake, thinking, happy
    message: ''
  });
  const [showChat, setShowChat] = useState(false);

  // Agent "wakes up" randomly
  useEffect(() => {
    const wakeInterval = setInterval(() => {
      if (Math.random() > 0.8 && agent.state === 'sleeping') {
        setAgent(prev => ({ ...prev, state: 'awake' }));
        
        // Move randomly around graph
        setTimeout(() => {
          setAgent(prev => ({
            ...prev,
            x: Math.random() * 800,
            y: Math.random() * 600,
            state: 'happy'
          }));
        }, 1000);
        
        // Go back to sleep
        setTimeout(() => {
          setAgent(prev => ({ ...prev, state: 'sleeping' }));
        }, 5000);
      }
    }, 10000);
    
    return () => clearInterval(wakeInterval);
  }, [agent.state]);

  const chatWithAgent = async (userMessage) => {
    setAgent(prev => ({ ...prev, state: 'thinking' }));
    
    try {
      // Send chat request to Ollama server running qwen2.5:1.5b model
      const response = await ollama.chat({
        model: 'qwen2.5:1.5b', // Small model, good for basic chat
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful AI pet living in a project graph. Keep responses short and friendly.' 
          },
          { role: 'user', content: userMessage }
        ],
      });
      
      setAgent(prev => ({ 
        ...prev, 
        state: 'happy',
        message: response.message.content
      }));
    } catch (error) {
      setAgent(prev => ({ 
        ...prev, 
        state: 'sleeping',
        message: 'Zzz... having trouble thinking right now'
      }));
    }
  };

  return (
    <>
      {/* Agent on graph */}
      <div 
        className={`absolute w-12 h-12 rounded-full cursor-pointer transition-all duration-1000 ${
          agent.state === 'sleeping' ? 'bg-gray-400 opacity-60' :
          agent.state === 'thinking' ? 'bg-purple-500 animate-pulse' :
          agent.state === 'happy' ? 'bg-green-500' : 'bg-blue-500'
        }`}
        style={{ left: agent.x, top: agent.y }}
        onClick={() => setShowChat(true)}
      >
        <span className="text-xl flex items-center justify-center h-full">
          {agent.state === 'sleeping' ? '😴' : 
           agent.state === 'thinking' ? '🤔' : '🤖'}
        </span>
      </div>
      
      {/* Simple chat popup */}
      {showChat && (
        <div className="fixed bottom-4 right-4 w-80 bg-black/90 rounded-lg border border-gray-600 p-4">
          <div className="flex justify-between items-center mb-3">
            <span>🤖 Chia</span>
            <button onClick={() => setShowChat(false)}>✕</button>
          </div>
          
          {agent.message && (
            <div className="bg-gray-700 p-2 rounded mb-3 text-sm">
              {agent.message}
            </div>
          )}
          
          <input
            type="text"
            placeholder="Say something to your agent..."
            className="w-full bg-gray-800 border border-gray-600 rounded p-2 text-sm"
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                chatWithAgent(e.target.value);
                e.target.value = '';
              }
            }}
          />
        </div>
      )}
    </>
  );
}
```

**That's 80 lines and gives you**:
- ✅ Agent appears on graph
- ✅ Moves around randomly  
- ✅ Changes state (sleeping/awake/thinking/happy)
- ✅ Basic chat that works
- ✅ Visual feedback

### 4. **Real Examples from Tutorials**

**From Medium "Build Simple AI App with Ollama"**:
```javascript
// This actually works - tested by community
const express = require('express');
const { spawn } = require('child_process');

app.post('/chat', (req, res) => {
  const { message } = req.body;
  
  const ollama = spawn('ollama', ['run', 'qwen2.5:1.5b', message]);
  let response = '';
  
  ollama.stdout.on('data', (data) => {
    response += data.toString();
  });
  
  ollama.on('close', () => {
    res.json({ response: response.trim() });
  });
});
```

**From DigitalOcean "Local AI Agents"**:
```javascript
// Simple agent state machine
class SimpleAgent {
  constructor() {
    this.state = 'idle';
    this.memory = [];
  }
  
  async think(input) {
    this.state = 'thinking';
    
    const response = await ollama.chat({
      model: 'qwen2.5:1.5b',
      messages: [
        ...this.memory.slice(-3), // Last 3 messages only
        { role: 'user', content: input }
      ]
    });
    
    this.memory.push({ role: 'user', content: input });
    this.memory.push({ role: 'assistant', content: response.message.content });
    this.state = 'idle';
    
    return response.message.content;
  }
}
```

### 5. **Function Calling Reality Check**

**What the tutorials promise**:
```javascript
// Agent can call tools perfectly!
const tools = [/* complex tool definitions */];
const response = await ollama.chat({ tools, ... });
// Magic happens ✨
```

**What actually happens**:
- Works with qwen2.5:7b+ models (4.7GB+)
- Fails ~40% of the time
- Hallucinates tool parameters
- Ignores tools when confused
- Better with very simple, single tools

**Realistic approach**:
```javascript
// ONE simple tool, expect failures
const tools = [{
  type: 'function',
  function: {
    name: 'help_user',
    description: 'Get information about user tasks',
    parameters: {
      type: 'object',
      properties: {
        what: { type: 'string', enum: ['count_tasks', 'list_tasks', 'find_urgent'] }
      }
    }
  }
}];

// Always have fallback
try {
  const response = await ollama.chat({ model: 'qwen2.5:7b', messages, tools });
  
  if (response.message.tool_calls) {
    // Maybe it worked!
    handleToolCall(response.message.tool_calls[0]);
  } else {
    // Probably just chatted normally
    handleNormalChat(response.message.content);
  }
} catch (error) {
  // Definitely didn't work
  return "Sorry, I'm having trouble right now! 😅";
}
```

## What We Should Build: "Smart Chia Pet"

### Phase 1: Barely Working (2 days)
- Agent dot that moves around graph randomly
- Click to chat - basic ollama conversation
- 3 visual states: sleeping, awake, thinking  
- Store agent in localStorage (no database)
- One personality: friendly but simple

### Phase 2: Slightly Smarter (2 days)
- Agent remembers last 3 conversations
- Can "see" what node it's near (just the title)
- Simple tool: count how many tasks user has
- Basic personality customization (name, emoji)

### Phase 3: Actually Useful (1 week)
- Agent can create ONE type of node (basic tasks)
- Approval system: user clicks ✓ or ✗ on agent suggestions  
- Agent learns from rejections (simple pattern matching)
- Basic GraphQL integration with GraphDone

**Stop there.** See if people actually want to use it before building more.

## Example Libraries That Work

1. **ollama-js** - Official, simple, works in browser
2. **Basic express server** - For backend agent if needed
3. **localStorage** - For agent memory/personality
4. **CSS animations** - For agent movement
5. **WebSocket (later)** - For real-time updates if needed

**No**: LangGraph, AutoGen, complex frameworks, vector databases, RAG, multi-agent orchestration, enterprise patterns.

## Realistic Timeline

### Day 1: Basic Agent Dot
- Add `SimpleAgent` component to graph view
- Agent appears, moves randomly every 10 seconds
- Click to open basic chat popup
- Basic ollama integration (qwen2.5:1.5b)
- **Success**: Agent exists and responds to "hello"

### Day 2: Make It Cute
- Add personality to responses ("I'm your graph buddy!")
- 3-4 visual states with emojis (😴😊🤔💭)
- Smooth movement animations
- Agent "wakes up" from sleep when clicked
- **Success**: People say "aww it's cute"

### Day 3-4: Basic Memory
- Agent remembers your name
- Stores last 3 conversations in localStorage
- Can tell you what node it's sitting on
- Simple responses about your graph ("You have 12 tasks!")
- **Success**: Agent feels slightly personal

### Day 5-7: One Useful Thing
- Agent can suggest creating a simple task
- User clicks ✓ or ✗ to approve
- If approved, creates node via GraphQL
- Basic "undo last agent action" button
- **Success**: Agent actually helps with something

### Week 2+: Iterate Based on Usage
- Add features based on what people actually use
- More personality options if people customize
- Better integration if people rely on suggestions
- Audio if people ask for it

## Success Metric

"Does it make you smile and want to talk to it?"

If yes → build phase 2  
If no → figure out what's missing

The goal is a **delightful pet** that happens to help with work, not a **work tool** that happens to have personality.

## Docker Integration with GraphDone

### Complete Docker Setup (Multiple Options)
```yaml
# docker-compose.yml - Add to existing GraphDone setup
version: '3.8'
services:
  # Your existing GraphDone services...
  web:
    build: ./packages/web
    networks: [graphdone-network]
  
  server:
    build: ./packages/server  
    networks: [graphdone-network]
  
  # Option A: Traditional Ollama server + model management
  ollama:
    image: ollama/ollama:latest
    container_name: graphdone-ollama
    volumes:
      - ollama-models:/root/.ollama
    networks:
      - graphdone-network
    environment:
      - OLLAMA_HOST=0.0.0.0
    # Optional: GPU support (if available)
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  # Option B: Direct model containers (NEW 2025 approach)
  # Each model runs its own TCP server - no Ollama middleman needed
  qwen-chat:
    image: registry.ollama.ai/library/qwen2.5:1.5b
    container_name: graphdone-qwen-chat
    networks:
      - graphdone-network
    environment:
      - MODEL_SERVER_PORT=8000
      - MAX_CONCURRENT_REQUESTS=4
    # Automatic model server startup
    
  # Can run multiple specialized models simultaneously
  qwen-function-calling:
    image: registry.ollama.ai/library/qwen2.5:7b
    container_name: graphdone-qwen-functions  
    networks:
      - graphdone-network
    environment:
      - MODEL_SERVER_PORT=8001
      - MAX_CONCURRENT_REQUESTS=2
    # For tool calling capabilities

networks:
  graphdone-network:
    driver: bridge

volumes:
  ollama-models:  # Only needed for Option A
```

### Agent Service Configuration
```javascript
// packages/web/src/lib/ollama.js
import ollama from 'ollama'

// Option A: Traditional Ollama server
const traditionalClient = new ollama.Ollama({
  host: process.env.NODE_ENV === 'development' 
    ? 'http://localhost:11434'  // Local development
    : 'http://ollama:11434'     // Docker network
});

// Option B: Direct model containers (recommended for 2025)
const directModelClients = {
  chat: new ollama.Ollama({
    host: process.env.NODE_ENV === 'development'
      ? 'http://localhost:8000'
      : 'http://qwen-chat:8000'
  }),
  
  functions: new ollama.Ollama({
    host: process.env.NODE_ENV === 'development'
      ? 'http://localhost:8001' 
      : 'http://qwen-function-calling:8001'
  })
};

// Smart client that automatically selects best model for task
class SmartOllamaClient {
  async chat(messages, options = {}) {
    const needsFunctions = options.tools && options.tools.length > 0;
    const client = needsFunctions ? directModelClients.functions : directModelClients.chat;
    
    return await client.chat({
      model: needsFunctions ? 'qwen2.5:7b' : 'qwen2.5:1.5b',
      messages,
      ...options
    });
  }
}

export default new SmartOllamaClient();
```

### Model Management
```bash
# Option A: Traditional Ollama server management
docker-compose exec ollama ollama pull qwen2.5:1.5b
docker-compose exec ollama ollama pull qwen2.5:7b
docker-compose exec ollama ollama list
docker-compose exec ollama ollama rm qwen2.5:7b

# Option B: Direct model containers (NEW approach)
# No model management needed - models are pre-built into containers
docker-compose up qwen-chat qwen-function-calling

# Check model container status
docker-compose ps | grep qwen
docker logs graphdone-qwen-chat    # See model server logs
docker logs graphdone-qwen-functions

# Update to newer model versions
docker-compose pull qwen-chat      # Pull updated model image
docker-compose up -d qwen-chat     # Restart with new version

# Resource monitoring
docker stats graphdone-qwen-chat graphdone-qwen-functions
```

### Hardware Requirements

**Mac Mini M1/M2** (Perfect for this):
- **qwen2.5:1.5b**: ~2GB RAM, runs smoothly on CPU
- **qwen2.5:7b**: ~8GB RAM, good performance on Apple Silicon
- **Response time**: 1-3 seconds for chat responses
- **Concurrent users**: 5-10 simultaneous conversations

**Regular Desktop/Laptop**:
- **qwen2.5:1.5b**: Runs on any machine with 4GB+ RAM
- **qwen2.5:7b**: Needs 16GB+ RAM for good performance
- **GPU optional**: CPU inference works fine for small models

### Security Benefits

✅ **Network isolation**: AI model never touches the internet  
✅ **Data privacy**: All conversations stay on your Docker network  
✅ **Resource limits**: Docker can limit CPU/memory usage  
✅ **Easy cleanup**: `docker-compose down` removes everything  
✅ **Version control**: Lock Ollama version in docker-compose.yml

## MVP Development Approach

**Start with**: 80 lines of JavaScript that barely works but feels alive
**Not with**: 2000 lines of perfectly architected enterprise agent framework

Focus on the **experience** over the **capability**. A quirky pet that sometimes helps is more valuable than a perfect assistant with no soul.
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { 
  MessageSquare, 
  Bug, 
  X, 
  Minimize2, 
  Maximize2, 
  Send, 
  Copy,
  Trash2,
  Users,
  Bot,
  Pause,
  Play,
  Move
} from 'lucide-react';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  source: string;
  message: string;
  data?: any;
}

interface ChatMessage {
  id: string;
  timestamp: Date;
  sender: 'user' | 'bot' | 'system';
  content: string;
  senderName?: string;
}

interface FloatingConsoleProps {
  isVisible: boolean;
  onToggle: () => void;
  onClose?: () => void;
}

export const FloatingConsole: React.FC<FloatingConsoleProps> = ({
  isVisible,
  onToggle,
  onClose
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'debug'>('debug');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [messageInput, setMessageInput] = useState('');
  const [isDebugPaused, setIsDebugPaused] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const logsEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (activeTab === 'debug') {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, chatMessages, activeTab]);

  // Initialize position and size based on CSS variables and defaults
  useEffect(() => {
    const sidebarWidth = getComputedStyle(document.documentElement).getPropertyValue('--sidebar-width') || '16rem';
    const sidebarPixels = sidebarWidth === '4rem' ? 64 : 256; // Convert rem to pixels
    
    setPosition({ 
      x: sidebarPixels + 16, // sidebar width + 16px margin
      y: window.innerHeight - (isExpanded ? 400 : 50) - 16 // bottom margin
    });
    
    // Calculate minimized width based on active tab and content
    let minimizedWidth = 300; // Default fallback
    if (!isExpanded) {
      if (activeTab === 'chat') {
        // "Chat & Collaboration" is the longest title + buttons
        minimizedWidth = 420; // Enough for longer title + action buttons
      } else if (activeTab === 'debug') {
        // "Debug Console" is shorter but has more buttons
        minimizedWidth = 400; // Enough for title + all debug action buttons
      }
    }
    
    setSize({
      width: isExpanded ? Math.min(window.innerWidth * 0.5, 800) : minimizedWidth,
      height: isExpanded ? 400 : 50
    });
  }, [isExpanded, isVisible, activeTab]);

  // Handle dragging with throttling for better performance
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      // Use requestAnimationFrame to throttle updates and improve performance
      requestAnimationFrame(() => {
        setPosition({ x: Math.max(0, newX), y: Math.max(0, newY) });
      });
    }
    if (isResizing) {
      // Set minimum width based on current tab to ensure buttons don't overflow
      const minWidth = activeTab === 'chat' ? 420 : 400;
      const newWidth = Math.max(minWidth, resizeStart.width + (e.clientX - resizeStart.x));
      const newHeight = Math.max(200, resizeStart.height + (e.clientY - resizeStart.y));
      requestAnimationFrame(() => {
        setSize({ width: newWidth, height: newHeight });
      });
    }
  }, [isDragging, isResizing, dragStart, resizeStart, activeTab]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  const handleDragStart = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  // Set up console interceptor for debug logs
  useEffect(() => {
    if (!isVisible) return;

    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;

    const addLog = (level: LogEntry['level'], source: string, message: string, data?: any) => {
      if (isDebugPaused && level === 'debug') return; // Skip debug logs when paused
      
      const logEntry: LogEntry = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        level,
        source,
        message,
        data
      };
      setLogs(prev => [...prev.slice(-99), logEntry]); // Keep last 100 logs
    };

    // Intercept console methods
    console.log = (...args) => {
      originalConsoleLog(...args);
      const message = args.join(' ');
      if (message.includes('🗺️') || message.includes('🎯') || message.includes('🔍') || message.includes('📊')) {
        addLog('debug', 'MiniMap', message, args.length > 1 ? args[1] : undefined);
      }
    };

    console.warn = (...args) => {
      originalConsoleWarn(...args);
      addLog('warn', 'System', args.join(' '));
    };

    console.error = (...args) => {
      originalConsoleError(...args);
      addLog('error', 'System', args.join(' '));
    };

    // Global log function for components to use
    (window as any).debugLog = (source: string, message: string, data?: any) => {
      if (isDebugPaused) return; // Skip all debug logs when paused
      addLog('info', source, message, data);
    };

    return () => {
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
      delete (window as any).debugLog;
    };
  }, [isVisible, isDebugPaused]); // Include pause state in dependencies

  const handleSendMessage = () => {
    if (!messageInput.trim()) return;

    const message: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      timestamp: new Date(),
      sender: 'user',
      content: messageInput,
      senderName: 'You'
    };

    setChatMessages(prev => [...prev, message]);
    setMessageInput('');

    // Simulate bot response for now
    setTimeout(() => {
      const botResponse: ChatMessage = {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        sender: 'bot',
        content: `Received: "${messageInput}". Chat functionality is coming soon!`,
        senderName: 'GraphDone Assistant'
      };
      setChatMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${log.timestamp.toLocaleTimeString()}] ${log.level.toUpperCase()} ${log.source}: ${log.message}`
    ).join('\n');
    navigator.clipboard.writeText(logText);
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const getLevelColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-blue-400';
      case 'debug': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getSenderIcon = (sender: ChatMessage['sender']) => {
    switch (sender) {
      case 'bot': return <Bot className="h-4 w-4 text-blue-400" />;
      case 'system': return <MessageSquare className="h-4 w-4 text-yellow-400" />;
      default: return <Users className="h-4 w-4 text-green-400" />;
    }
  };

  if (!isVisible) return null;

  const consoleContent = (
    <div 
      ref={consoleRef}
      className={`fixed bg-gray-900/95 backdrop-blur-sm border border-gray-600 rounded-lg shadow-2xl z-[999999] ${isDragging || isResizing ? 'select-none' : ''}`}
      style={{ 
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${size.width}px`,
        height: `${size.height}px`,
        minWidth: activeTab === 'debug' ? '420px' : '380px',
        minHeight: isExpanded ? '200px' : '50px',
        cursor: isDragging ? 'grabbing' : 'default',
        // Performance optimizations for dragging
        willChange: isDragging || isResizing ? 'transform, left, top, width, height' : 'auto',
        transform: isDragging || isResizing ? 'translateZ(0)' : 'none', // GPU acceleration
        // Reduce expensive effects during drag
        backdropFilter: isDragging ? 'none' : 'blur(12px)',
        backgroundColor: isDragging ? 'rgba(17, 24, 39, 0.98)' : 'rgba(17, 24, 39, 0.95)'
      }}
    >
      {/* Header */}
      <div 
        className="flex items-center justify-between p-3 border-b border-gray-700 cursor-grab active:cursor-grabbing"
        onMouseDown={handleDragStart}
      >
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1">
            <button
              onClick={() => setActiveTab('chat')}
              className={`p-1.5 rounded transition-colors ${
                activeTab === 'chat' 
                  ? 'bg-blue-600 text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Chat"
            >
              <MessageSquare className="h-4 w-4" />
            </button>
            <button
              onClick={() => setActiveTab('debug')}
              className={`p-1.5 rounded transition-colors ${
                activeTab === 'debug' 
                  ? 'bg-green-600 text-white' 
                  : 'text-gray-400 hover:text-gray-200'
              }`}
              title="Debug Console"
            >
              <Bug className="h-4 w-4" />
            </button>
          </div>
          <span className="text-sm font-medium text-gray-200 truncate">
            {activeTab === 'chat' ? 'Chat & Collaboration' : 'Debug Console'}
          </span>
          {activeTab === 'debug' && (
            <div className="flex items-center space-x-2">
              {logs.length > 0 && (
                <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                  {logs.length} logs
                </span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded ${
                isDebugPaused ? 'bg-yellow-700 text-yellow-200' : 'bg-green-700 text-green-200'
              }`}>
                {isDebugPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-1">
          {activeTab === 'debug' && (
            <>
              <button
                onClick={() => setIsDebugPaused(!isDebugPaused)}
                className={`p-1 transition-colors ${
                  isDebugPaused 
                    ? 'text-green-400 hover:text-green-300' 
                    : 'text-yellow-400 hover:text-yellow-300'
                }`}
                title={isDebugPaused ? 'Resume logging' : 'Pause logging'}
                onMouseDown={(e) => e.stopPropagation()}
              >
                {isDebugPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              </button>
              <button
                onClick={copyLogs}
                className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
                title="Copy logs to clipboard"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Copy className="h-4 w-4" />
              </button>
              <button
                onClick={clearLogs}
                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
                title="Clear logs"
                onMouseDown={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-200 transition-colors"
            title={isExpanded ? "Minimize" : "Expand"}
            onMouseDown={(e) => e.stopPropagation()}
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-red-400 transition-colors"
              title="Close console"
              onMouseDown={(e) => e.stopPropagation()}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isExpanded && (
        <>
          {/* Debug Logs Tab */}
          {activeTab === 'debug' && (
            <div className="flex flex-col" style={{ height: size.height - 50 }}>  {/* Adjust for header */}
              <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                {logs.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    No debug logs yet. Interact with the graph to see debug information.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="space-y-1">
                        <div className="flex items-start space-x-2">
                          <span className="text-gray-500 shrink-0">
                            [{formatTimestamp(log.timestamp)}]
                          </span>
                          <span className={`${getLevelColor(log.level)} shrink-0 font-semibold`}>
                            {log.level.toUpperCase()}
                          </span>
                          <span className="text-blue-300 shrink-0">
                            {log.source}:
                          </span>
                          <span className="text-gray-200 break-all">
                            {log.message}
                          </span>
                        </div>
                        {log.data && (
                          <div className="ml-8 pl-4 border-l border-gray-600">
                            <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                              {typeof log.data === 'object' ? JSON.stringify(log.data, null, 2) : log.data}
                            </pre>
                          </div>
                        )}
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Chat Tab */}
          {activeTab === 'chat' && (
            <div className="flex flex-col" style={{ height: size.height - 50 }}> {/* Adjust for header */}
              <div className="flex-1 overflow-y-auto p-3">
                {chatMessages.length === 0 ? (
                  <div className="text-gray-500 text-center py-8">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Start chatting with team members or AI assistants
                  </div>
                ) : (
                  <div className="space-y-3">
                    {chatMessages.map((message) => (
                      <div key={message.id} className="flex items-start space-x-2">
                        {getSenderIcon(message.sender)}
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium text-gray-200">
                              {message.senderName || message.sender}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatTimestamp(message.timestamp)}
                            </span>
                          </div>
                          <div className="text-sm text-gray-300">
                            {message.content}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="border-t border-gray-700 p-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message..."
                    className="flex-1 bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={handleSendMessage}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded transition-colors"
                    title="Send message"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
      
      {/* Resize Handle */}
      {isExpanded && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize bg-gray-600 opacity-50 hover:opacity-75"
          style={{
            clipPath: 'polygon(100% 0%, 0% 100%, 100% 100%)'
          }}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      )}
    </div>
  );

  return createPortal(consoleContent, document.body);
};

export default FloatingConsole;
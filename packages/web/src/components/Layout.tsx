import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, Bot, BarChart3, Settings, Menu, Server, Globe, Shield, Users } from 'lucide-react';
import { UserSelector } from './UserSelector';
import { GraphSelector } from './GraphSelector';
import { useAuth } from '../contexts/AuthContext';
import { McpHealthIndicator } from './McpHealthIndicator';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const { currentTeam, currentUser } = useAuth();

  const navigation = [
    { name: 'Workspace', href: '/', icon: Globe, description: 'Main work' },
    { name: 'Ontology', href: '/ontology', icon: Brain, description: 'Node schemas' },
    { name: 'AI & Agents', href: '/agents', icon: Bot, description: 'AI collaboration' },
    { name: 'Analytics', href: '/analytics', icon: BarChart3, description: 'Priority insights' },
    { name: 'Settings', href: '/settings', icon: Settings, description: 'User preferences' },
    { name: 'Admin', href: '/admin', icon: Shield, description: 'System administration', restricted: currentUser?.role !== 'ADMIN' },
    { name: 'System', href: '/backend', icon: Server, description: 'Backend status', restricted: currentUser?.role === 'VIEWER' || currentUser?.role === 'GUEST' },
  ];

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Mobile menu button */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-300 hover:bg-gray-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <h1 className="ml-3 text-xl font-bold text-green-400">GraphDone</h1>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0
          fixed inset-y-0 left-0 z-50 w-64 bg-gray-800 border-r border-gray-700
          transform transition-transform duration-200 ease-in-out
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className="flex items-center h-16 px-6 border-b border-gray-700">
              <img src="/favicon.svg" alt="GraphDone Logo" className="h-8 w-8" />
              <span className="ml-3 text-xl font-bold text-green-300">GraphDone</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-6 space-y-2">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                const isRestricted = item.restricted;
                
                if (isRestricted) {
                  const restrictionMessage = item.name === 'Admin' 
                    ? 'Admin access required'
                    : item.name === 'System' 
                    ? 'User or Admin access required'
                    : 'Access restricted';
                  
                  return (
                    <div
                      key={item.name}
                      className="flex items-center px-3 py-3 rounded-lg transition-colors group cursor-not-allowed opacity-50"
                      title={`${item.description} (${restrictionMessage})`}
                    >
                      <Icon className="h-5 w-5 mr-3 flex-shrink-0 text-gray-500" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-500">{item.name}</div>
                        <div className="text-xs text-gray-600 truncate">
                          {restrictionMessage}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center px-3 py-3 rounded-lg transition-colors group
                      ${isActive
                        ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                        : 'text-gray-300 hover:bg-gray-700'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                    title={item.description}
                  >
                    <Icon className="h-5 w-5 mr-3 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium">{item.name}</div>
                      <div className="text-xs text-gray-400 truncate group-hover:text-gray-300">
                        {item.description}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Graph Selector */}
            <div className="border-t border-gray-700">
              <GraphSelector />
            </div>

            {/* Guest Mode Indicator */}
            {currentUser?.role === 'GUEST' && (
              <div className="border-t border-gray-700 p-4">
                <div className="bg-purple-900/30 border border-purple-500/30 rounded-lg p-3">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-purple-400" />
                    <span className="text-sm font-medium text-purple-300">Guest Mode</span>
                  </div>
                  <p className="text-xs text-purple-200 mt-1">
                    Read-only demo access. Create an account to save your work.
                  </p>
                </div>
              </div>
            )}

            {/* User Selector */}
            <div className="border-t border-gray-700">
              <UserSelector />
            </div>

            {/* Footer with MCP Status */}
            <div className="p-4 border-t border-gray-700">
              {/* MCP Health Indicator */}
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs text-gray-400">MCP Server</span>
                <McpHealthIndicator showDetails={false} />
              </div>
              
              {currentTeam && (
                <div className="mb-2">
                  <p className="text-xs text-gray-300 font-medium">{currentTeam.name}</p>
                  <p className="text-xs text-gray-500">{currentTeam.memberCount} members</p>
                </div>
              )}
              <p className="text-xs text-gray-400">
                v0.2.1-alpha
              </p>
              <p className="text-xs text-gray-500 mt-1">
                For teams who think differently
              </p>
            </div>
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-gray-600 bg-opacity-75 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0">
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
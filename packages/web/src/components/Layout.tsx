import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Brain, Bot, BarChart3, Settings, Menu, Server, Globe, Shield, Users, Terminal } from 'lucide-react';
import { UserSelector } from './UserSelector';
import { GraphSelector } from './GraphSelector';
import { useAuth } from '../contexts/AuthContext';
import { McpHealthIndicator } from './McpHealthIndicator';
import FloatingConsole from './FloatingConsole';
import { TlsStatusIndicator, TlsSecurityBanner } from './TlsStatusIndicator';
import { APP_VERSION } from '../utils/version';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = React.useState(false);
  const [showFloatingConsole, setShowFloatingConsole] = React.useState(false);
  const desktopSidebarCollapsed = true; // Zen mode permanently on
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
    <div 
      className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden"
      style={{
        '--sidebar-width': desktopSidebarCollapsed ? '4rem' : '16rem'
      } as React.CSSProperties}
    >
      {/* Tropical lagoon light scattering background animation - zen mode everywhere */}
      <div className="lagoon-caustics">
        <div className="caustic-layer caustic-layer-1"></div>
        <div className="caustic-layer caustic-layer-2"></div>
        <div className="caustic-layer caustic-layer-3"></div>
        <div className="caustic-layer caustic-layer-4"></div>
        <div className="caustic-layer caustic-layer-5"></div>
        <div className="caustic-layer caustic-layer-6"></div>
        <div className="caustic-layer caustic-layer-7"></div>
        <div className="caustic-layer caustic-layer-8"></div>
        <div className="caustic-layer caustic-layer-9"></div>
        <div className="caustic-layer caustic-layer-10"></div>
        <div className="lagoon-shimmer lagoon-shimmer-1"></div>
        <div className="lagoon-shimmer lagoon-shimmer-2"></div>
        <div className="lagoon-shimmer lagoon-shimmer-3"></div>
        <div className="lagoon-shimmer lagoon-shimmer-4"></div>
        <div className="lagoon-shimmer lagoon-shimmer-5"></div>
        <div className="lagoon-shimmer lagoon-shimmer-6"></div>
        <div className="lagoon-shimmer lagoon-shimmer-7"></div>
        <div className="lagoon-shimmer lagoon-shimmer-8"></div>
        <div className="lagoon-shimmer lagoon-shimmer-9"></div>
        <div className="lagoon-shimmer lagoon-shimmer-10"></div>
      </div>
      
      {/* Mobile menu button */}
      <div className="lg:hidden relative z-30">
        <div className="flex items-center justify-between bg-gray-800/90 backdrop-blur-sm px-4 py-2 border-b border-gray-700/50">
          <div className="flex items-center">
            <button
              type="button"
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-300 hover:bg-gray-700"
              onClick={() => setSidebarOpen(!sidebarOpen)}
            >
              <Menu className="h-6 w-6" aria-hidden="true" />
            </button>
            <Link to="/" className="ml-3 text-xl font-bold text-green-400 hover:text-green-300 transition-colors">
              GraphDone
            </Link>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0 lg:static lg:inset-0
          fixed inset-y-0 left-0 z-50 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50
          transform transition-all duration-200 ease-in-out
          ${desktopSidebarCollapsed ? 'lg:w-16' : 'w-64'}
        `}>
          <div className="flex flex-col h-full">
            {/* Logo */}
            <div className={`flex items-center h-16 px-6 border-b border-gray-700 ${desktopSidebarCollapsed ? 'lg:justify-center lg:px-4' : ''}`}>
              <img src="/favicon.svg" alt="GraphDone Logo" className="h-8 w-8" />
              {!desktopSidebarCollapsed && (
                <Link to="/" className="ml-3 text-xl font-bold text-green-300 hover:text-green-400 transition-colors">
                  GraphDone
                </Link>
              )}
            </div>

            {/* Navigation Buttons - Section 2 */}
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
                      className={`
                        flex items-center px-3 py-3 rounded-lg transition-colors group cursor-not-allowed opacity-50 relative
                        ${desktopSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                      `}
                      title={desktopSidebarCollapsed ? `${item.name}: ${restrictionMessage}` : `${item.description} (${restrictionMessage})`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0 text-gray-500" />
                      {!desktopSidebarCollapsed && (
                        <div className="flex-1 min-w-0 ml-3">
                          <div className="text-sm font-medium text-gray-500">{item.name}</div>
                          <div className="text-xs text-gray-600 truncate">
                            {restrictionMessage}
                          </div>
                        </div>
                      )}
                      {/* Tooltip for collapsed mode */}
                      {desktopSidebarCollapsed && (
                        <div className="hidden lg:group-hover:block absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded shadow-lg text-sm whitespace-nowrap z-50">
                          <div className="font-medium text-gray-500">{item.name}</div>
                          <div className="text-xs text-gray-600">{restrictionMessage}</div>
                        </div>
                      )}
                    </div>
                  );
                }
                
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      flex items-center px-3 py-3 rounded-lg transition-colors group relative
                      ${desktopSidebarCollapsed ? 'lg:justify-center lg:px-2' : ''}
                      ${isActive
                        ? 'bg-green-900/30 text-green-300 border border-green-500/30'
                        : 'text-gray-300 hover:bg-gray-700'
                      }
                    `}
                    onClick={() => setSidebarOpen(false)}
                    title={desktopSidebarCollapsed ? `${item.name}: ${item.description}` : item.description}
                  >
                    <Icon className="h-5 w-5 flex-shrink-0" />
                    {!desktopSidebarCollapsed && (
                      <>
                        <div className="flex-1 min-w-0 ml-3">
                          <div className="text-sm font-medium">{item.name}</div>
                          <div className="text-xs text-gray-400 truncate group-hover:text-gray-300">
                            {item.description}
                          </div>
                        </div>
                      </>
                    )}
                    {/* Tooltip for collapsed mode */}
                    {desktopSidebarCollapsed && (
                      <div className="hidden lg:group-hover:block absolute left-full top-1/2 transform -translate-y-1/2 ml-2 px-2 py-1 bg-gray-800 border border-gray-600 rounded shadow-lg text-sm whitespace-nowrap z-50">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-gray-400">{item.description}</div>
                      </div>
                    )}
                  </Link>
                );
              })}
            </nav>

            {/* Graph Selector */}
            {!desktopSidebarCollapsed && (
              <div className="border-t border-gray-700">
                <GraphSelector />
              </div>
            )}

            {/* Guest Mode Indicator */}
            {currentUser?.role === 'GUEST' && !desktopSidebarCollapsed && (
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
            {!desktopSidebarCollapsed && (
              <div className="border-t border-gray-700">
                <UserSelector />
              </div>
            )}

            {/* Status Section - Section 3 */}
            <div className={`p-4 border-t border-gray-700 ${desktopSidebarCollapsed ? 'lg:px-2' : ''}`}>
              {!desktopSidebarCollapsed ? (
                <>
                  {/* MCP Health Indicator */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">MCP Server</span>
                    <McpHealthIndicator showDetails={false} />
                  </div>
                </>
              ) : (
                <div className="flex justify-center">
                  <McpHealthIndicator showDetails={false} />
                </div>
              )}
            </div>
            
            {/* Console & Tools Section - Section 4 */}
            <div className={`p-4 border-t border-gray-700/50 ${desktopSidebarCollapsed ? 'lg:px-2' : ''}`}>
              {!desktopSidebarCollapsed ? (
                <>
                  {/* Debug Console Toggle */}
                  <div className="mb-3">
                    <button
                      onClick={() => setShowFloatingConsole(!showFloatingConsole)}
                      className="w-full flex items-center justify-between p-2 text-sm text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200"
                      title="Toggle Debug/Chat Console"
                    >
                      <span className="flex items-center">
                        <Terminal className="h-4 w-4 mr-2 text-green-400" />
                        <span>Debug Console</span>
                      </span>
                      {showFloatingConsole && (
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                      )}
                    </button>
                  </div>
                  
                  {currentTeam && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-300 font-medium">{currentTeam.name}</p>
                      <p className="text-xs text-gray-500">
                        {currentTeam.memberCount || 0} members
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    v{APP_VERSION}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    For teams who think differently
                  </p>
                </>
              ) : (
                <div className="flex justify-center">
                  <button
                    onClick={() => setShowFloatingConsole(!showFloatingConsole)}
                    className="p-2 text-gray-300 hover:text-white hover:bg-gray-700/50 rounded-lg transition-all duration-200 relative"
                    title="Toggle Debug/Chat Console"
                  >
                    <Terminal className="h-4 w-4 text-green-400" />
                    {showFloatingConsole && (
                      <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                    )}
                  </button>
                </div>
              )}
            </div>
            
            {/* Footer Info Section */}
            <div className={`p-4 border-t border-gray-700/30 ${desktopSidebarCollapsed ? 'lg:px-2' : ''}`}>
              {!desktopSidebarCollapsed && (
                <>
                  {currentTeam && (
                    <div className="mb-2">
                      <p className="text-xs text-gray-300 font-medium">{currentTeam.name}</p>
                      <p className="text-xs text-gray-500">
                        {currentTeam.memberCount || 0} members
                      </p>
                    </div>
                  )}
                  <p className="text-xs text-gray-400">
                    v{APP_VERSION}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    For teams who think differently
                  </p>
                </>
              )}
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
        <div className="flex-1 flex flex-col min-w-0 relative z-20">
          <main className="flex-1 select-none">
            {children}
          </main>
        </div>
      </div>
      
      {/* Global Floating Console */}
      <FloatingConsole
        isVisible={showFloatingConsole}
        onToggle={() => setShowFloatingConsole(!showFloatingConsole)}
        onClose={() => setShowFloatingConsole(false)}
      />
      
      {/* TLS/SSL Status Indicator */}
      <TlsStatusIndicator />
    </div>
  );
}
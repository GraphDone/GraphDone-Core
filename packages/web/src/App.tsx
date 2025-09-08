import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Workspace } from './pages/Workspace';
import { Ontology } from './pages/Ontology';
import { Agents } from './pages/Agents';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Admin } from './pages/Admin';
import { Backend } from './pages/Backend';
import { LoginForm } from './pages/LoginForm';
import { Signup } from './pages/Signup';
import { InteractiveGraphVisualization } from './components/InteractiveGraphVisualization';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GraphProvider } from './contexts/GraphContext';
import { NotificationProvider } from './contexts/NotificationContext';

function AuthenticatedApp() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    // Maintain consistent structure during initial load to prevent DOM flash
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Tropical lagoon light scattering background animation - consistent with main app */}
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
        <div className="max-w-4xl w-full relative z-10">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center mb-4">
              <img src="/favicon.svg" alt="GraphDone Logo" className="h-12 w-12" />
              <span className="ml-3 text-3xl font-bold text-gray-100">GraphDone</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-gray-300">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span>Initializing...</span>
            </div>
          </div>
          
          {/* Loading Feature Highlights */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg p-6 h-64 hover:border-green-500/30 transition-all duration-300">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center mb-4 shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Graph Engine</h3>
                <p className="text-gray-300 text-sm leading-relaxed">Advanced dependency mapping with real-time priority calculation and collaborative workflows</p>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg p-6 h-64 hover:border-blue-500/30 transition-all duration-300">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-4 shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">Team Collaboration</h3>
                <p className="text-gray-300 text-sm leading-relaxed">Democratic prioritization where ideas flow from periphery to center based on community validation</p>
              </div>
            </div>

            <div className="bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 rounded-lg p-6 h-64 hover:border-purple-500/30 transition-all duration-300">
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-4 shadow-lg">
                  <svg className="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-white mb-2">AI Integration</h3>
                <p className="text-gray-300 text-sm leading-relaxed">Human and AI agents collaborate as peers through the same graph interface and API</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/" element={<LoginForm />} />
        <Route path="/login" element={<LoginForm />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <NotificationProvider>
      <GraphProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Workspace />} />
            <Route path="/workspace" element={<Workspace />} />
            <Route path="/ontology" element={<Ontology />} />
            <Route path="/agents" element={<Agents />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/backend" element={<Backend />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </GraphProvider>
    </NotificationProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthenticatedApp />
    </AuthProvider>
  );
}

export default App;
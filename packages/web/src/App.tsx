import { Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Workspace } from './pages/Workspace';
import { Ontology } from './pages/Ontology';
import { Agents } from './pages/Agents';
import { Analytics } from './pages/Analytics';
import { Settings } from './pages/Settings';
import { Backend } from './pages/Backend';
import { Login } from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { GraphProvider } from './contexts/GraphContext';

function AuthenticatedApp() {
  const { isAuthenticated, isInitializing } = useAuth();

  if (isInitializing) {
    // Maintain consistent structure during initial load to prevent DOM flash
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
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
          
          {/* Maintain similar structure as login page to prevent flash */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 opacity-30">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 h-64"></div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 h-64"></div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 h-64"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return (
    <GraphProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Workspace />} />
          <Route path="/ontology" element={<Ontology />} />
          <Route path="/agents" element={<Agents />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/backend" element={<Backend />} />
        </Routes>
      </Layout>
    </GraphProvider>
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
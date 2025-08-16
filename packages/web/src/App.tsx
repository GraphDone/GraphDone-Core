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
  const { isAuthenticated } = useAuth();

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
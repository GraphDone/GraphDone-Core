import { useState, useEffect } from 'react';
import { Users, ArrowRight, Shield } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Team } from '../types/auth';
import { LoginSecurityDialog } from '../components/LoginSecurityDialog';

export function Login() {
  const { availableUsers, availableTeams, login } = useAuth();
  const navigate = useNavigate();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showSecurityDialog, setShowSecurityDialog] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  useEffect(() => {
    if (availableTeams.length > 0 && !selectedTeam) {
      setSelectedTeam(availableTeams[0]);
    }
  }, [availableTeams, selectedTeam]);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && selectedUser && !isLoggingIn) {
        handleLogin();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedUser, isLoggingIn]);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    const userTeam = availableTeams.find(t => t.id === user.team?.id);
    setSelectedTeam(userTeam || null);
  };

  const handleLogin = async () => {
    if (selectedUser && !isLoggingIn) {
      setIsLoggingIn(true);
      try {
        await login(selectedUser);
        navigate('/');
      } finally {
        setIsLoggingIn(false);
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-400 bg-purple-900 border-purple-700';
      case 'member': return 'text-green-400 bg-green-900 border-green-700';
      case 'viewer': return 'text-gray-400 bg-gray-700 border-gray-600';
      default: return 'text-gray-400 bg-gray-700 border-gray-600';
    }
  };

  const teamUsers = selectedTeam ? availableUsers.filter(u => u.team?.id === selectedTeam.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden select-none">
      {/* Static gradient background - optimized for all browsers */}
      <div className="lagoon-caustics"></div>
      <div className="max-w-4xl w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link to="/" className="inline-flex items-center justify-center mb-6 hover:opacity-80 transition-all duration-200 hover:scale-105">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-14 w-14" />
            <span className="ml-3 text-4xl font-bold bg-gradient-to-r from-green-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">GraphDone</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Welcome Back</h1>
          <p className="text-gray-400 text-lg">Select your user account to continue</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Team Selection */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-green-500/10 transition-all duration-300">
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-100">Select Team</h2>
            </div>
            
            <div className="space-y-3">
              {availableTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-green-500/50 ${
                    selectedTeam?.id === team.id
                      ? 'border-green-500/50 bg-green-900/30 shadow-lg shadow-green-500/20'
                      : 'border-gray-600/50 hover:border-green-500/30 hover:bg-gray-700/50 hover:shadow-lg'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                      {team.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-100">{team.name}</div>
                      <div className="text-sm text-gray-400">{team.memberCount} members</div>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-sm text-gray-300 mt-2 ml-13">{team.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* User Selection */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-blue-500/10 transition-all duration-300">
            <div className="flex items-center mb-4">
              <div className="w-5 h-5 bg-blue-600 rounded-full mr-2"></div>
              <h2 className="text-lg font-semibold text-gray-100">
                {selectedTeam ? `${selectedTeam.name} Members` : 'Select a Team First'}
              </h2>
            </div>

            {selectedTeam ? (
              <div className="space-y-3">
                {teamUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
                      selectedUser?.id === user.id
                        ? 'border-blue-500/50 bg-blue-900/30 shadow-lg shadow-blue-500/20'
                        : 'border-gray-600/50 hover:border-blue-500/30 hover:bg-gray-700/50 hover:shadow-lg'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-100">{user.name}</div>
                        <div className="text-sm text-gray-400">{user.email}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full border ${getRoleColor(user.role)}`}>
                        {user.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Please select a team to see available users</p>
              </div>
            )}
          </div>

          {/* Login Action */}
          <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-6 shadow-2xl hover:shadow-purple-500/10 transition-all duration-300">
            <h2 className="text-lg font-semibold text-gray-100 mb-4">Continue as</h2>
            
            {selectedUser ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {selectedUser.avatar || selectedUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-100">{selectedUser.name}</div>
                      <div className="text-sm text-gray-400">{selectedUser.email}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-400">Team:</span>
                      <div className="font-medium text-gray-100">{selectedTeam?.name}</div>
                    </div>
                    <div>
                      <span className="text-gray-400">Role:</span>
                      <div className={`inline-block px-2 py-1 rounded-full text-xs ${getRoleColor(selectedUser.role)}`}>
                        {selectedUser.role}
                      </div>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleLogin}
                  disabled={isLoggingIn}
                  className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
                >
                  {isLoggingIn ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Logging in...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue to GraphDone</span>
                      <ArrowRight className="h-5 w-5" />
                    </>
                  )}
                </button>

                <div className="text-xs text-gray-400 text-center">
                  By continuing, you agree to access graphs and data available to your team and role.
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <div className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <p>Select a user to continue</p>
              </div>
            )}
          </div>
        </div>

        {/* Security & Demo Notice */}
        <div className="mt-8 text-center space-y-4">
          <div className="inline-flex items-center px-4 py-2 bg-yellow-900 border border-yellow-700 rounded-lg text-sm text-yellow-300">
            <span className="mr-2">⚡</span>
            Demo Mode: This is a placeholder authentication system for development
          </div>
          
          <div className="flex items-center justify-center">
            <button
              onClick={() => setShowSecurityDialog(true)}
              className="inline-flex items-center px-3 py-2 text-sm text-green-400 hover:text-green-300 hover:bg-gray-800 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <Shield className="h-4 w-4 mr-2" />
              How we protect your login
            </button>
          </div>
        </div>

        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-300">
            Don't have an account?{' '}
            <Link to="/signup" className="text-green-400 hover:text-green-300 font-medium">
              Create one now
            </Link>
          </p>
        </div>
      </div>

      {/* Security Dialog */}
      <LoginSecurityDialog 
        isOpen={showSecurityDialog} 
        onClose={() => setShowSecurityDialog(false)} 
      />
    </div>
  );
}
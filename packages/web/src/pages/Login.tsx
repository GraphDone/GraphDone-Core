import { useState } from 'react';
import { Network, Users, ArrowRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { User, Team } from '../types/auth';

export function Login() {
  const { availableUsers, availableTeams, login } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const handleUserSelect = (user: User) => {
    setSelectedUser(user);
    const userTeam = availableTeams.find(t => t.id === user.teamId);
    setSelectedTeam(userTeam || null);
  };

  const handleLogin = () => {
    if (selectedUser) {
      login(selectedUser);
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

  const teamUsers = selectedTeam ? availableUsers.filter(u => u.teamId === selectedTeam.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Network className="h-12 w-12 text-blue-600" />
            <span className="ml-3 text-3xl font-bold text-gray-100">GraphDone</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Welcome Back</h1>
          <p className="text-gray-300">Select your user account to continue</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Selection */}
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-100">Select Team</h2>
            </div>
            
            <div className="space-y-3">
              {availableTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedTeam?.id === team.id
                      ? 'border-green-500 bg-green-900'
                      : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
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
                    className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                      selectedUser?.id === user.id
                        ? 'border-green-500 bg-green-900'
                        : 'border-gray-600 hover:border-gray-500 hover:bg-gray-700'
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
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
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
                  className="w-full btn btn-primary flex items-center justify-center space-x-2"
                >
                  <span>Continue to GraphDone</span>
                  <ArrowRight className="h-4 w-4" />
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

        {/* Demo Notice */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-yellow-900 border border-yellow-700 rounded-lg text-sm text-yellow-300">
            <span className="mr-2">⚡</span>
            Demo Mode: This is a placeholder authentication system for development
          </div>
        </div>
      </div>
    </div>
  );
}
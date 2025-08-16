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
      case 'admin': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'member': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'viewer': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const teamUsers = selectedTeam ? availableUsers.filter(u => u.teamId === selectedTeam.id) : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Network className="h-12 w-12 text-blue-600" />
            <span className="ml-3 text-3xl font-bold text-gray-900">GraphDone</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Select your user account to continue</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Team Selection */}
          <div className="card p-6">
            <div className="flex items-center mb-4">
              <Users className="h-5 w-5 text-gray-600 mr-2" />
              <h2 className="text-lg font-semibold text-gray-900">Select Team</h2>
            </div>
            
            <div className="space-y-3">
              {availableTeams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeam(team)}
                  className={`w-full p-3 rounded-lg border-2 text-left transition-all ${
                    selectedTeam?.id === team.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white font-medium">
                      {team.name.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{team.name}</div>
                      <div className="text-sm text-gray-500">{team.memberCount} members</div>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-sm text-gray-600 mt-2 ml-13">{team.description}</p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* User Selection */}
          <div className="card p-6">
            <div className="flex items-center mb-4">
              <div className="w-5 h-5 bg-blue-600 rounded-full mr-2"></div>
              <h2 className="text-lg font-semibold text-gray-900">
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
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full border ${getRoleColor(user.role)}`}>
                        {user.role}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Please select a team to see available users</p>
              </div>
            )}
          </div>

          {/* Login Action */}
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Continue as</h2>
            
            {selectedUser ? (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-medium">
                      {selectedUser.avatar || selectedUser.name.charAt(0)}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{selectedUser.name}</div>
                      <div className="text-sm text-gray-500">{selectedUser.email}</div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-500">Team:</span>
                      <div className="font-medium">{selectedTeam?.name}</div>
                    </div>
                    <div>
                      <span className="text-gray-500">Role:</span>
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

                <div className="text-xs text-gray-500 text-center">
                  By continuing, you agree to access graphs and data available to your team and role.
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mx-auto mb-3">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <p>Select a user to continue</p>
              </div>
            )}
          </div>
        </div>

        {/* Demo Notice */}
        <div className="mt-8 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="mr-2">⚡</span>
            Demo Mode: This is a placeholder authentication system for development
          </div>
        </div>
      </div>
    </div>
  );
}
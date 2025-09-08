import { useState, useRef, useEffect } from 'react';
import { ChevronDown, User, Users, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function UserSelector() {
  const { currentUser, currentTeam, availableUsers, availableTeams, switchUser, switchTeam, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'teams'>('users');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserSelect = (userId: string) => {
    switchUser(userId);
    setIsOpen(false);
  };

  const handleTeamSelect = (teamId: string) => {
    switchTeam(teamId);
    setIsOpen(false);
  };

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  if (!currentUser) return null;

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-purple-300 bg-purple-900';
      case 'ADMIN': return 'text-purple-300 bg-purple-900';
      case 'member': return 'text-blue-300 bg-blue-900';
      case 'viewer': return 'text-gray-300 bg-gray-700';
      case 'VIEWER': return 'text-gray-300 bg-gray-700';
      default: return 'text-gray-300 bg-gray-700';
    }
  };

  const currentTeamUsers = availableUsers.filter(user => user.team?.id === currentTeam?.id);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* User selector button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-3 w-full p-3 text-left hover:bg-gray-700 rounded-lg transition-colors"
      >
        <div className="flex-shrink-0">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
            {currentUser.avatar || currentUser.name.charAt(0)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-100 truncate">
            {currentUser.name}
          </div>
          <div className="text-xs text-gray-400 truncate">
            {currentTeam?.name} • {currentUser.role}
          </div>
        </div>
        
        <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-gray-800 border border-gray-700 rounded-lg shadow-lg z-50 max-h-96 overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-600">
            <button
              onClick={() => setActiveTab('users')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'users'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                  : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
              }`}
            >
              <User className="h-4 w-4 inline mr-2" />
              Users
            </button>
            <button
              onClick={() => setActiveTab('teams')}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === 'teams'
                  ? 'text-blue-400 border-b-2 border-blue-400 bg-gray-700'
                  : 'text-gray-300 hover:text-gray-100 hover:bg-gray-700'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Teams
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {activeTab === 'users' && (
              <div className="p-2">
                <div className="text-xs font-medium text-gray-400 px-2 py-1 uppercase tracking-wide">
                  {currentTeam?.name} Members
                </div>
                {currentTeamUsers.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleUserSelect(user.id)}
                    className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left transition-colors ${
                      user.id === currentUser.id
                        ? 'bg-blue-900 text-blue-100'
                        : 'hover:bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {user.avatar || user.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{user.name}</div>
                      <div className="text-xs text-gray-400 truncate">{user.email}</div>
                    </div>
                    <div className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                      {user.role}
                    </div>
                    {user.id === currentUser.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </button>
                ))}
                
                {/* Other team users */}
                {availableUsers.filter(user => user.team?.id !== currentTeam?.id).length > 0 && (
                  <>
                    <div className="text-xs font-medium text-gray-400 px-2 py-1 mt-3 uppercase tracking-wide border-t border-gray-600 pt-3">
                      Other Teams
                    </div>
                    {availableUsers
                      .filter(user => user.team?.id !== currentTeam?.id)
                      .map((user) => {
                        const userTeam = availableTeams.find(t => t.id === user.team?.id);
                        return (
                          <button
                            key={user.id}
                            onClick={() => handleUserSelect(user.id)}
                            className="w-full flex items-center space-x-3 p-2 rounded-lg text-left hover:bg-gray-700 text-gray-100 transition-colors"
                          >
                            <div className="flex-shrink-0">
                              <div className="w-6 h-6 bg-gradient-to-br from-gray-400 to-gray-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                                {user.avatar || user.name.charAt(0)}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{user.name}</div>
                              <div className="text-xs text-gray-400 truncate">{userTeam?.name}</div>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded-full ${getRoleColor(user.role)}`}>
                              {user.role}
                            </div>
                          </button>
                        );
                      })}
                  </>
                )}
              </div>
            )}

            {activeTab === 'teams' && (
              <div className="p-2">
                {availableTeams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team.id)}
                    className={`w-full flex items-center space-x-3 p-2 rounded-lg text-left transition-colors ${
                      team.id === currentTeam?.id
                        ? 'bg-blue-900 text-blue-100'
                        : 'hover:bg-gray-700 text-gray-100'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className="w-6 h-6 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center text-white text-xs font-medium">
                        {team.name.charAt(0)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{team.name}</div>
                      <div className="text-xs text-gray-400 truncate">
                        {team.memberCount} members • {team.description}
                      </div>
                    </div>
                    {team.id === currentTeam?.id && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Logout button */}
          <div className="border-t border-gray-600 p-2">
            <button
              onClick={handleLogout}
              className="w-full flex items-center space-x-3 p-2 rounded-lg text-left hover:bg-red-900 text-red-400 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
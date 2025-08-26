import { useState } from 'react';
import { useQuery, useMutation, gql } from '@apollo/client';
import { Users, Crown, Settings, Eye, UserCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const GET_USERS = gql`
  query GetUsers {
    users {
      id
      email
      username
      name
      role
      isActive
      isEmailVerified
      lastLogin
      createdAt
      team {
        id
        name
      }
    }
  }
`;

const UPDATE_USER_ROLE = gql`
  mutation UpdateUserRole($userId: String!, $role: UserRole!) {
    updateUserRole(userId: $userId, role: $role) {
      id
      email
      username
      name
      role
    }
  }
`;

const ROLE_HIERARCHY = [
  { value: 'NODE_WATCHER', label: 'Node Watcher', icon: Eye, color: 'text-gray-400', description: 'Read-only access' },
  { value: 'CONNECTOR', label: 'Connector', icon: Users, color: 'text-blue-400', description: 'Can work on tasks' },
  { value: 'ORIGIN_NODE', label: 'Origin Node', icon: UserCheck, color: 'text-green-400', description: 'Task creators' },
  { value: 'PATH_KEEPER', label: 'Path Keeper', icon: Settings, color: 'text-purple-400', description: 'Project maintainers' },
  { value: 'GRAPH_MASTER', label: 'Graph Master', icon: Crown, color: 'text-yellow-400', description: 'System administrators' }
];

export function UserManagement() {
  const { currentUser } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  
  const { data, loading, refetch } = useQuery(GET_USERS);
  const [updateUserRole] = useMutation(UPDATE_USER_ROLE, {
    onCompleted: () => {
      refetch();
      setSelectedUsers(new Set());
    }
  });

  // Check if user can manage roles
  const canManageRoles = currentUser && ['PATH_KEEPER', 'GRAPH_MASTER'].includes(currentUser.role);
  const canPromoteToMaster = currentUser?.role === 'GRAPH_MASTER';

  if (!canManageRoles) {
    return (
      <div className="p-8 text-center">
        <Crown className="h-16 w-16 text-gray-600 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-300 mb-2">Access Restricted</h2>
        <p className="text-gray-400">You need PATH_KEEPER or GRAPH_MASTER role to manage users.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto"></div>
        <p className="text-gray-400 mt-4">Loading users...</p>
      </div>
    );
  }

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    await updateUserRole({
      variables: { userId, role: newRole }
    });
  };

  const getRoleInfo = (role: string) => {
    return ROLE_HIERARCHY.find(r => r.value === role) || ROLE_HIERARCHY[0];
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100 mb-2">User Management</h1>
        <p className="text-gray-400">Manage user roles and permissions in the graph network</p>
      </div>

      {/* Role Legend */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 mb-6">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Role Hierarchy</h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {ROLE_HIERARCHY.map((role) => {
            const IconComponent = role.icon;
            return (
              <div key={role.value} className="flex items-center space-x-2">
                <IconComponent className={`h-4 w-4 ${role.color}`} />
                <div>
                  <div className={`text-sm font-medium ${role.color}`}>{role.label}</div>
                  <div className="text-xs text-gray-400">{role.description}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Users List */}
      <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Current Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {data?.users?.map((user: any) => {
                const roleInfo = getRoleInfo(user.role);
                const IconComponent = roleInfo.icon;
                
                return (
                  <tr key={user.id} className="hover:bg-gray-700">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                          {user.name.charAt(0)}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-100">{user.name}</div>
                          <div className="text-sm text-gray-400">{user.email}</div>
                          <div className="text-xs text-gray-500">@{user.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <IconComponent className={`h-4 w-4 ${roleInfo.color}`} />
                        <span className={`text-sm font-medium ${roleInfo.color}`}>
                          {roleInfo.label}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'
                        }`}>
                          {user.isActive ? 'Active' : 'Inactive'}
                        </span>
                        {user.isEmailVerified ? (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-900 text-blue-300">
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-yellow-900 text-yellow-300">
                            Unverified
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleUpdate(user.id, e.target.value)}
                          className="bg-gray-700 border border-gray-600 text-gray-100 text-sm rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
                          disabled={user.id === currentUser?.id} // Can't change own role
                        >
                          {ROLE_HIERARCHY.map((role) => (
                            <option 
                              key={role.value} 
                              value={role.value}
                              disabled={role.value === 'GRAPH_MASTER' && !canPromoteToMaster}
                            >
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 bg-gray-800 border border-gray-700 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-200 mb-3">Quick Promotions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="btn btn-secondary">
            <Users className="h-4 w-4 mr-2" />
            Promote to Connector
          </button>
          <button className="btn btn-secondary">
            <UserCheck className="h-4 w-4 mr-2" />
            Grant Origin Node
          </button>
          <button className="btn btn-secondary">
            <Settings className="h-4 w-4 mr-2" />
            Make Path Keeper
          </button>
        </div>
      </div>
    </div>
  );
}
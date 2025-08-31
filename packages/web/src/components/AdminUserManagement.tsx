import React, { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { 
  Users, 
  Edit3, 
  Key, 
  Shield, 
  XCircle, 
  Search,
  RotateCw,
  AlertTriangle,
  Trash2,
  Plus,
  UserCheck,
  UserX,
  Crown,
  Settings,
  Eye,
  Settings2
} from 'lucide-react';
import { CheckCircle } from '../constants/workItemConstants';
import { GET_ALL_USERS, UPDATE_USER_ROLE, RESET_USER_PASSWORD, DELETE_USER, CREATE_USER, UPDATE_USER_STATUS } from '../lib/queries';
import { CustomDropdown } from './CustomDropdown';

interface User {
  id: string;
  email: string;
  username: string;
  name: string;
  role: string;
  isActive: boolean;
  isEmailVerified: boolean;
  deactivationDate?: string;
  createdAt: string;
  updatedAt: string;
}

export function AdminUserManagement() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [newRole, setNewRole] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{userId: string, email: string} | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string, tempPassword?: string} | null>(null);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    email: '',
    username: '',
    name: '',
    password: '',
    role: 'VIEWER'
  });

  const { data, loading, error, refetch } = useQuery(GET_ALL_USERS);
  const [updateUserRole] = useMutation(UPDATE_USER_ROLE);
  const [resetPassword] = useMutation(RESET_USER_PASSWORD);
  const [deleteUser] = useMutation(DELETE_USER);
  const [createUser] = useMutation(CREATE_USER);
  const [updateUserStatus] = useMutation(UPDATE_USER_STATUS);

  const ROLE_HIERARCHY = [
    { value: 'GUEST', label: 'Guest', icon: Eye, color: 'text-purple-400', description: 'Anonymous demo access (read-only)' },
    { value: 'VIEWER', label: 'Viewer', icon: Eye, color: 'text-gray-400', description: 'Can view, vote, comment, and interact but cannot modify nodes' },
    { value: 'USER', label: 'User', icon: Users, color: 'text-blue-400', description: 'Can create and work on tasks' },
    { value: 'ADMIN', label: 'Admin', icon: Crown, color: 'text-yellow-400', description: 'Full system administration access' }
  ];

  const roles = ROLE_HIERARCHY.map(role => ({
    value: role.value,
    label: role.label,
    description: role.description
  }));

  const users = data?.users || [];

  const filteredUsers = users.filter((user: User) => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = selectedRole === '' || user.role === selectedRole;
    return matchesSearch && matchesRole;
  });

  // Count admin users to determine if delete should be disabled
  const adminCount = users.filter((user: User) => user.role === 'ADMIN').length;
  
  const canDeleteUser = (user: User) => {
    if (user.role === 'ADMIN' && adminCount <= 1) {
      return false; // Can't delete the last admin
    }
    return true;
  };

  const canDeactivateUser = (user: User) => {
    if (user.role === 'ADMIN' && adminCount <= 1 && user.isActive) {
      return false; // Can't deactivate the last active admin
    }
    return true;
  };

  const handleRoleUpdate = async (userId: string, role: string) => {
    try {
      await updateUserRole({
        variables: { userId, role }
      });
      setEditingUser(null);
      refetch();
    } catch (error) {
      console.error('Failed to update user role:', error);
    }
  };

  const handlePasswordReset = async (userId: string, email: string) => {
    try {
      const result = await resetPassword({
        variables: { userId }
      });
      
      if (result.data?.resetUserPassword?.tempPassword) {
        setNotification({
          type: 'success',
          message: `Password reset successful for ${email}`,
          tempPassword: result.data.resetUserPassword.tempPassword
        });
      }
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to reset password. Please try again.'
      });
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmation || deleteConfirmText !== 'Goodbye') {
      return;
    }

    try {
      await deleteUser({
        variables: { userId: deleteConfirmation.userId }
      });
      
      setDeleteConfirmation(null);
      setDeleteConfirmText('');
      refetch();
      setNotification({
        type: 'success',
        message: 'User account deleted successfully. Their work contributions have been preserved and remain with their teams.'
      });
    } catch (error: any) {
      console.error('Failed to delete user:', error);
      setNotification({
        type: 'error',
        message: error.message || 'Failed to delete user. Please try again.'
      });
    }
  };

  const startDeleteProcess = (userId: string, email: string) => {
    setDeleteConfirmation({ userId, email });
    setDeleteConfirmText('');
  };

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.username || !newUser.name || !newUser.password) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields.'
      });
      return;
    }

    try {
      await createUser({
        variables: {
          input: {
            email: newUser.email,
            username: newUser.username,
            name: newUser.name,
            password: newUser.password,
            role: newUser.role
          }
        }
      });
      
      setNotification({
        type: 'success',
        message: `User ${newUser.email} created successfully.`
      });
      setShowCreateUser(false);
      setNewUser({
        email: '',
        username: '',
        name: '',
        password: '',
        role: 'VIEWER'
      });
      refetch();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || 'Failed to create user.'
      });
    }
  };

  const handleToggleActive = async (userId: string, currentlyActive: boolean, email: string) => {
    try {
      await updateUserStatus({
        variables: {
          userId,
          isActive: !currentlyActive
        }
      });
      
      setNotification({
        type: 'success',
        message: `User ${email} ${currentlyActive ? 'deactivated' : 'activated'} successfully.`
      });
      refetch();
    } catch (error: any) {
      setNotification({
        type: 'error',
        message: error.message || `Failed to ${currentlyActive ? 'deactivate' : 'activate'} user.`
      });
    }
  };

  const getRoleInfo = (role: string) => {
    return ROLE_HIERARCHY.find(r => r.value === role) || ROLE_HIERARCHY[0];
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return 'bg-yellow-900 text-yellow-300';
      case 'USER': return 'bg-blue-900 text-blue-300';
      case 'VIEWER': return 'bg-gray-900 text-gray-300';
      case 'GUEST': return 'bg-purple-900 text-purple-300';
      default: return 'bg-gray-900 text-gray-300';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-300 flex items-center">
          <RotateCw className="h-5 w-5 animate-spin mr-2" />
          Loading users...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-6 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-red-300 mb-2">Error Loading Users</h3>
          <p className="text-red-200 mb-4">{error.message}</p>
          <button 
            onClick={() => refetch()} 
            className="btn btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 px-6 py-8">
      {/* Header */}
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

      {/* Controls */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        {/* Create User Button */}
        <div>
          <button
            onClick={() => setShowCreateUser(true)}
            className="inline-flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search users by email, username, or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
          />
        </div>

        {/* Role Filter */}
        <div className="w-full sm:w-48">
          <CustomDropdown
            options={[
              { value: '', label: 'All Roles' },
              ...roles.map(role => ({
                value: role.value,
                label: role.label,
                description: role.description
              }))
            ]}
            value={selectedRole}
            onChange={setSelectedRole}
            placeholder="All Roles"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="flex-1 bg-gray-800 border border-gray-700 rounded-lg overflow-hidden flex flex-col min-h-0">
        <div className="px-6 py-4 border-b border-gray-700 flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-100 flex items-center">
            <Users className="h-5 w-5 mr-2" />
            User Management ({filteredUsers.length} users)
          </h2>
        </div>

        <div className="flex-1 overflow-auto">
          <table className="min-w-full divide-y divide-gray-700">
            <thead className="bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-gray-800 divide-y divide-gray-700">
              {filteredUsers.map((user: User) => (
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
                    {editingUser === user.id ? (
                      <div className="flex items-center space-x-2">
                        <select
                          value={newRole}
                          onChange={(e) => setNewRole(e.target.value)}
                          className="px-2 py-1 bg-gray-700 border border-gray-600 rounded text-xs text-gray-100 focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                          autoFocus
                        >
                          {roles.map(role => (
                            <option key={role.value} value={role.value}>{role.label}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleRoleUpdate(user.id, newRole)}
                          className="p-1 text-green-400 hover:text-green-300"
                          title="Save"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="p-1 text-gray-400 hover:text-gray-300"
                          title="Cancel"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {(() => {
                          const roleInfo = getRoleInfo(user.role);
                          const IconComponent = roleInfo.icon;
                          return (
                            <>
                              <IconComponent className={`h-4 w-4 ${roleInfo.color}`} />
                              <span className={`text-sm font-medium ${roleInfo.color}`}>
                                {roleInfo.label}
                              </span>
                            </>
                          );
                        })()}
                        <button
                          onClick={() => {
                            setEditingUser(user.id);
                            setNewRole(user.role);
                          }}
                          className="p-1 text-gray-400 hover:text-yellow-400"
                          title="Edit role"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                    <div className="flex flex-col space-y-1">
                      <div>
                        <span className="text-xs text-gray-500">Created: </span>
                        <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                      </div>
                      {user.deactivationDate && (
                        <div>
                          <span className="text-xs text-gray-500">Deactivated: </span>
                          <span className="text-orange-300">{new Date(user.deactivationDate).toLocaleDateString()}</span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center space-x-1 justify-end">
                      <button
                        onClick={() => canDeactivateUser(user) && handleToggleActive(user.id, user.isActive, user.email)}
                        disabled={!canDeactivateUser(user)}
                        className={`inline-flex items-center px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 ${
                          !canDeactivateUser(user)
                            ? 'border-gray-600 text-gray-500 cursor-not-allowed'
                            : user.isActive
                              ? 'border-orange-600 text-orange-300 hover:text-orange-100 hover:bg-orange-900/20 focus:ring-orange-500'
                              : 'border-green-600 text-green-300 hover:text-green-100 hover:bg-green-900/20 focus:ring-green-500'
                        }`}
                        title={
                          !canDeactivateUser(user)
                            ? "Cannot deactivate the last admin user"
                            : user.isActive
                              ? "Deactivate user"
                              : "Activate user"
                        }
                      >
                        {user.isActive ? (
                          <>
                            <UserX className="h-3 w-3 mr-1" />
                            Deactivate
                          </>
                        ) : (
                          <>
                            <UserCheck className="h-3 w-3 mr-1" />
                            Activate
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => handlePasswordReset(user.id, user.email)}
                        className="inline-flex items-center px-2 py-1 border border-gray-600 rounded text-xs text-gray-300 hover:text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                        title="Reset password"
                      >
                        <Key className="h-3 w-3 mr-1" />
                        Reset
                      </button>
                      <button
                        onClick={() => canDeleteUser(user) && startDeleteProcess(user.id, user.email)}
                        disabled={!canDeleteUser(user)}
                        className={`inline-flex items-center px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 ${
                          canDeleteUser(user)
                            ? 'border-red-600 text-red-300 hover:text-red-100 hover:bg-red-900/20 focus:ring-red-500'
                            : 'border-gray-600 text-gray-500 cursor-not-allowed'
                        }`}
                        title={canDeleteUser(user) ? "Delete user" : "Cannot delete the last admin user"}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">No users found matching your criteria.</p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <AlertTriangle className="h-6 w-6 text-red-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-100">Delete User</h3>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">
                You are about to permanently delete the user:
              </p>
              <p className="text-white font-medium bg-gray-900 px-3 py-2 rounded">
                {deleteConfirmation.email}
              </p>
            </div>

            <div className="mb-6">
              <p className="text-gray-300 mb-2">
                This will permanently remove the user account and their access to the system.
              </p>
              <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-3">
                <p className="text-green-300 text-sm">
                  ✓ Work items and contributions will be <strong>preserved</strong> and remain attributed to their teams and projects.
                </p>
              </div>
              <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 mb-4">
                <p className="text-red-300 text-sm">
                  ✗ User account, login access, and personal settings will be <strong>permanently deleted</strong>.
                </p>
              </div>
              <p className="text-yellow-300 font-medium mb-3">
                To confirm deletion, type <span className="bg-gray-900 px-2 py-1 rounded font-mono">Goodbye</span> below:
              </p>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type 'Goodbye' to confirm"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoFocus
              />
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setDeleteConfirmation(null);
                  setDeleteConfirmText('');
                }}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteUser}
                disabled={deleteConfirmText !== 'Goodbye'}
                className={`flex-1 px-4 py-2 rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-red-500 ${
                  deleteConfirmText === 'Goodbye'
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'
                }`}
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notification Modal */}
      {notification && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              {notification.type === 'success' ? (
                <CheckCircle className="h-6 w-6 text-green-400 mr-3" />
              ) : (
                <XCircle className="h-6 w-6 text-red-400 mr-3" />
              )}
              <h3 className="text-lg font-semibold text-gray-100">
                {notification.type === 'success' ? 'Success' : 'Error'}
              </h3>
            </div>
            
            <div className="mb-4">
              <p className="text-gray-300 mb-2">{notification.message}</p>
              {notification.tempPassword && (
                <div className="bg-gray-900 border border-gray-600 rounded-lg p-4 mt-4">
                  <p className="text-yellow-300 font-medium mb-2">Temporary Password:</p>
                  <p className="text-white font-mono text-lg bg-gray-800 px-3 py-2 rounded border">
                    {notification.tempPassword}
                  </p>
                  <p className="text-gray-400 text-sm mt-2">
                    Please share this with the user securely. They will be required to change it on next login.
                  </p>
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setNotification(null)}
                className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-300 hover:text-gray-100 hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUser && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center mb-4">
              <Plus className="h-6 w-6 text-green-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-100">Create New User</h3>
            </div>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="user@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Username *</label>
                <input
                  type="text"
                  value={newUser.username}
                  onChange={(e) => setNewUser(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="username"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Full Name *</label>
                <input
                  type="text"
                  value={newUser.name}
                  onChange={(e) => setNewUser(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Full Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Initial Password *</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser(prev => ({ ...prev, password: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Initial password"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
                <CustomDropdown
                  options={roles.map(role => ({
                    value: role.value,
                    label: role.label,
                    description: role.description
                  }))}
                  value={newUser.role}
                  onChange={(value) => setNewUser(prev => ({ ...prev, role: value }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => {
                  setShowCreateUser(false);
                  setNewUser({
                    email: '',
                    username: '',
                    name: '',
                    password: '',
                    role: 'VIEWER'
                  });
                }}
                className="flex-1 px-4 py-2 border border-gray-600 rounded-lg text-gray-300 hover:text-gray-100 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateUser}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                Create User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
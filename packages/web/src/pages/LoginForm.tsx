import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { Eye, EyeOff, ArrowRight, Mail, Lock } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LOGIN_MUTATION = gql`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      token
      user {
        id
        email
        username
        name
        avatar
        role
        isActive
        isEmailVerified
        lastLogin
        team {
          id
          name
          description
        }
      }
    }
  }
`;

export function LoginForm() {
  const navigate = useNavigate();
  const { login: setAuthUser } = useAuth();
  
  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});


  const [login, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      setAuthUser(data.login.user, data.login.token);
      navigate('/');
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    }
  });

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.emailOrUsername) {
      newErrors.emailOrUsername = 'Email or username is required';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await login({
      variables: {
        input: {
          emailOrUsername: formData.emailOrUsername,
          password: formData.password
        }
      }
    });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    
    // Clear error for this field
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  // const getRoleDisplayName = (role: string) => {
  //   switch (role) {
  //     case 'NODE_WATCHER': return 'Node Watcher';
  //     case 'CONNECTOR': return 'Connector';
  //     case 'ORIGIN_NODE': return 'Origin Node';
  //     case 'PATH_KEEPER': return 'Path Keeper';
  //     case 'GRAPH_MASTER': return 'Graph Master';
  //     default: return role;
  //   }
  // };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4 hover:opacity-80 transition-opacity">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-12 w-12" />
            <span className="ml-3 text-3xl font-bold text-gray-100">GraphDone</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Welcome Back</h1>
          <p className="text-gray-300">Enter your credentials to access the graph</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800 border border-gray-700 rounded-lg p-6 space-y-4">
          {/* Email/Username Field */}
          <div>
            <label htmlFor="emailOrUsername" className="block text-sm font-medium text-gray-300 mb-1">
              Email or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                id="emailOrUsername"
                name="emailOrUsername"
                value={formData.emailOrUsername}
                onChange={handleChange}
                className={`w-full pl-10 pr-3 py-2 bg-gray-700 border rounded-lg text-gray-100 focus:outline-none focus:ring-2 ${
                  errors.emailOrUsername ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-green-500'
                }`}
                placeholder="john@example.com or johndoe"
              />
            </div>
            {errors.emailOrUsername && <p className="mt-1 text-xs text-red-400">{errors.emailOrUsername}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full pl-10 pr-10 py-2 bg-gray-700 border rounded-lg text-gray-100 focus:outline-none focus:ring-2 ${
                  errors.password ? 'border-red-500 focus:ring-red-500' : 'border-gray-600 focus:ring-green-500'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-300"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-xs text-red-400">{errors.password}</p>}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-green-600 shadow-sm focus:border-green-300 focus:ring focus:ring-green-200 focus:ring-opacity-50"
              />
              <span className="ml-2 text-sm text-gray-300">Remember me</span>
            </label>
            <Link to="/forgot-password" className="text-sm text-green-400 hover:text-green-300">
              Forgot password?
            </Link>
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg">
              <p className="text-sm text-red-300">{errors.submit}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn btn-primary flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>


        {/* Signup Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-300">
            Don't have an account?{' '}
            <Link to="/signup" className="text-green-400 hover:text-green-300 font-medium">
              Create one now
            </Link>
          </p>
        </div>

        {/* Role Hierarchy Information */}
        <div className="mt-8 p-4 bg-gray-800 border border-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Graph Roles</h3>
          <div className="space-y-2 text-xs text-gray-400">
            <div className="flex justify-between">
              <span className="text-gray-300">Node Watcher</span>
              <span>Read-only access</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-300">Connector</span>
              <span>Can work on tasks</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-300">Origin Node</span>
              <span>Task creators</span>
            </div>
            <div className="flex justify-between">
              <span className="text-purple-300">Path Keeper</span>
              <span>Project maintainers</span>
            </div>
            <div className="flex justify-between">
              <span className="text-yellow-300">Graph Master</span>
              <span>System administrators</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
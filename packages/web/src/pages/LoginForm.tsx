import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, gql } from '@apollo/client';
import { Eye, EyeOff, ArrowRight, Mail, Lock, Users } from 'lucide-react';
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

const GUEST_LOGIN_MUTATION = gql`
  mutation GuestLogin {
    guestLogin {
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
        team {
          id
          name
          description
        }
      }
    }
  }
`;

const DEVELOPMENT_INFO_QUERY = gql`
  query DevelopmentInfo {
    developmentInfo {
      isDevelopment
      hasDefaultCredentials
      defaultAccounts {
        username
        password
        role
        description
      }
    }
  }
`;

const GET_SYSTEM_SETTINGS = gql`
  query GetSystemSettings {
    systemSettings {
      allowAnonymousGuest
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

  // Check if guest access is enabled
  const { data: systemSettings } = useQuery(GET_SYSTEM_SETTINGS);
  const isGuestEnabled = systemSettings?.systemSettings?.allowAnonymousGuest ?? true;

  // Check for development mode and default credentials
  const { data: devInfo } = useQuery(DEVELOPMENT_INFO_QUERY);
  const showDefaultCredentials = devInfo?.developmentInfo?.hasDefaultCredentials ?? false;
  const defaultAccounts = devInfo?.developmentInfo?.defaultAccounts ?? [];

  const [login, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      setAuthUser(data.login.user, data.login.token);
      navigate('/');
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    }
  });

  const [guestLogin, { loading: guestLoading }] = useMutation(GUEST_LOGIN_MUTATION, {
    onCompleted: (data) => {
      setAuthUser(data.guestLogin.user, data.guestLogin.token);
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

  const handleGuestLogin = async () => {
    await guestLogin();
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

  const fillDefaultCredentials = async (username: string, password: string) => {
    setFormData({
      emailOrUsername: username,
      password: password
    });
    setErrors({});
    
    // Auto-submit for better UX
    await login({
      variables: {
        input: {
          emailOrUsername: username,
          password: password
        }
      }
    });
  };


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
      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/" className="flex items-center justify-center mb-4 hover:opacity-80 transition-opacity">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-12 w-12" />
            <span className="ml-3 text-3xl font-bold text-gray-100">GraphDone</span>
          </Link>
          <h1 className="text-2xl font-bold text-gray-100 mb-2">Welcome Back</h1>
          <p className="text-gray-300">Enter your credentials to join the team</p>
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
            disabled={loading || guestLoading}
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

          {/* Guest Mode Button */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGuestLogin}
            disabled={!isGuestEnabled || loading || guestLoading}
            className={`w-full btn flex items-center justify-center space-x-2 disabled:cursor-not-allowed ${
              isGuestEnabled 
                ? 'btn-secondary disabled:opacity-50' 
                : 'btn-secondary opacity-50 cursor-not-allowed'
            }`}
            title={!isGuestEnabled ? "Guest access has been disabled by the administrator" : undefined}
          >
            {guestLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Entering Guest Mode...</span>
              </>
            ) : (
              <>
                <Users className="h-4 w-4" />
                <span>Continue as Guest</span>
              </>
            )}
          </button>

          {/* Guest Mode Info */}
          {isGuestEnabled ? (
            <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
              <p className="text-xs text-blue-300 text-center">
                <strong>Guest Mode:</strong> Explore GraphDone with read-only access. No account required.
              </p>
            </div>
          ) : (
            <div className="p-3 bg-gray-800/50 border border-gray-600 rounded-lg">
              <p className="text-xs text-gray-400 text-center">
                Guest access has been disabled by the system administrator.
              </p>
            </div>
          )}
        </form>

        {/* Development Mode - Default Credentials */}
        {showDefaultCredentials && (
          <div className="mt-6">
            <div className="bg-amber-900/20 border border-amber-400/30 rounded-lg p-4 backdrop-blur-sm">
              <div className="flex items-center mb-3">
                <div className="w-2 h-2 bg-amber-400 rounded-full animate-pulse mr-2"></div>
                <h3 className="text-sm font-medium text-amber-300">Development Mode - Default Accounts</h3>
              </div>
              <p className="text-xs text-amber-200/80 mb-3">
                Quick access for testing. Please change these passwords in production!
              </p>
              <div className="space-y-2">
                {defaultAccounts.map((account: any) => (
                  <button
                    key={account.username}
                    onClick={() => fillDefaultCredentials(account.username, account.password)}
                    className="w-full text-left p-3 bg-amber-800/20 hover:bg-amber-700/30 border border-amber-400/20 hover:border-amber-400/40 rounded transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-amber-300 font-medium">{account.username}</span>
                          <span className="text-xs px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-full border border-amber-400/30">
                            {account.role}
                          </span>
                        </div>
                        <p className="text-xs text-amber-200/70 mt-1">{account.description}</p>
                        <p className="text-xs text-amber-200/50 mt-1">Password: {account.password}</p>
                      </div>
                      <div className="text-amber-400 group-hover:text-amber-300 opacity-60 group-hover:opacity-100 transition-all">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

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
    </div>
  );
}
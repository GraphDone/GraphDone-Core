import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, gql } from '@apollo/client';
import { Eye, EyeOff, ArrowRight, Mail, Lock, Users, Github } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';

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
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      const errorMessages: Record<string, string> = {
        google: 'Google authentication failed. Please try again.',
        linkedin: 'LinkedIn authentication failed. Please try again.',
        github: 'GitHub authentication failed. Please try again.',
      };
      setErrors({ submit: errorMessages[error] || 'OAuth authentication failed. Please try again.' });
    } else if (token) {
      localStorage.setItem('token', token);
      window.location.href = '/';
    }
  }, [searchParams]);

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
      {/* Static gradient background - optimized for all browsers */}
      <div className="lagoon-caustics"></div>
      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link to="/" className="inline-flex items-center justify-center mb-6 hover:opacity-80 transition-all duration-200 hover:scale-105">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-14 w-14" />
            <span className="ml-3 text-4xl font-bold bg-gradient-to-r from-green-300 via-blue-300 to-purple-300 bg-clip-text text-transparent">GraphDone</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Welcome Back</h1>
          <p className="text-gray-400 text-lg">Enter your credentials to join the team</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Social Login Buttons */}
          <div className="grid grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/google`}
              className="group relative flex items-center justify-center px-5 py-4 bg-gray-700/50 hover:bg-gray-600/60 backdrop-blur-sm border-2 border-gray-600/50 hover:border-blue-500/50 rounded-xl transition-all duration-300 hover:scale-[1.05] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
            >
              <svg className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
              </svg>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-500/0 via-purple-500/0 to-blue-500/0 group-hover:from-blue-500/10 group-hover:via-purple-500/10 group-hover:to-blue-500/10 transition-all duration-300"></div>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/linkedin`}
              className="group relative flex items-center justify-center px-5 py-4 bg-gray-700/50 hover:bg-gray-600/60 backdrop-blur-sm border-2 border-gray-600/50 hover:border-blue-400/60 rounded-xl transition-all duration-300 hover:scale-[1.05] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/30"
            >
              <svg className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-blue-600/0 to-blue-600/0 group-hover:from-blue-600/10 group-hover:to-blue-600/10 transition-all duration-300"></div>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/github`}
              className="group relative flex items-center justify-center px-5 py-4 bg-gray-700/50 hover:bg-gray-600/60 backdrop-blur-sm border-2 border-gray-600/50 hover:border-gray-400/60 rounded-xl transition-all duration-300 hover:scale-[1.05] hover:-translate-y-0.5 hover:shadow-xl hover:shadow-purple-500/30"
            >
              <Github className="h-6 w-6 text-gray-100 transition-transform duration-300 group-hover:scale-110 group-hover:text-white" />
              <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-purple-500/0 to-purple-500/0 group-hover:from-purple-500/10 group-hover:to-purple-500/10 transition-all duration-300"></div>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">or sign in with email</span>
            </div>
          </div>

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
                autoFocus
                className={`w-full pl-10 pr-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.emailOrUsername ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-green-500/50 focus:border-green-500/50'
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
                className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.password ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-green-500/50 focus:border-green-500/50'
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
            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-green-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Signing in...</span>
              </>
            ) : (
              <>
                <span>Sign In</span>
                <ArrowRight className="h-5 w-5" />
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
            className="w-full bg-gray-700/80 hover:bg-gray-600/80 backdrop-blur-sm text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-gray-500/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
            title={!isGuestEnabled ? "Guest access has been disabled by the administrator" : undefined}
          >
            {guestLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Entering Guest Mode...</span>
              </>
            ) : (
              <>
                <Users className="h-5 w-5" />
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
      
      {/* TLS/SSL Status Indicator */}
      <TlsStatusIndicator />
    </div>
  );
}
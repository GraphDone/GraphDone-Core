import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, gql } from '@apollo/client';
import { Eye, EyeOff, ArrowRight, Mail, Lock, Users, Github, Zap, Check, CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';
import { GuestModeDialog } from '../components/GuestModeDialog';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { isValidEmail } from '../utils/validation';

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

export function Signin() {
  const navigate = useNavigate();
  const { login: setAuthUser } = useAuth();
  const [searchParams] = useSearchParams();

  const [formData, setFormData] = useState({
    emailOrUsername: '',
    password: '',
    magicLinkEmail: ''
  });

  const [showPassword, setShowPassword] = useState(false);
  const [useMagicLink, setUseMagicLink] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [magicLinkLoading, setMagicLinkLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [rememberMe, setRememberMe] = useState(false);
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [magicLinkEmailValid, setMagicLinkEmailValid] = useState<boolean | null>(null);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [lockoutTime, setLockoutTime] = useState<Date | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showGuestInfo, setShowGuestInfo] = useState(false);

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      const errorMessages: Record<string, { title: string; message: string; action: string }> = {
        google: {
          title: 'Google Sign-In Failed',
          message: 'Unable to authenticate with Google. This may be due to popup blockers, permissions, or account restrictions.',
          action: 'Check your popup blocker settings and try again. Ensure third-party cookies are enabled.'
        },
        linkedin: {
          title: 'LinkedIn Sign-In Failed',
          message: 'Unable to authenticate with LinkedIn. Connection may have been cancelled or blocked.',
          action: 'Try again and ensure you approve the LinkedIn authorization prompt.'
        },
        github: {
          title: 'GitHub Sign-In Failed',
          message: 'Unable to authenticate with GitHub. This may be due to permissions or network issues.',
          action: 'Check your GitHub account settings and try again.'
        },
        invalid_magic_link: {
          title: 'Invalid Magic Link',
          message: 'This magic link is not valid or has already been used.',
          action: 'Request a new magic link below.'
        },
        expired_magic_link: {
          title: 'Expired Magic Link',
          message: 'This magic link has expired. Links are valid for 15 minutes.',
          action: 'Request a new magic link below.'
        },
        magic_link_failed: {
          title: 'Magic Link Failed',
          message: 'Magic link authentication failed. The link may be invalid or expired.',
          action: 'Request a new magic link below.'
        },
      };
      const errorDetail = errorMessages[error];
      if (errorDetail) {
        setErrors({ 
          submit: errorDetail.message,
          submitTitle: errorDetail.title,
          submitAction: errorDetail.action
        });
      } else {
        setErrors({ submit: 'Authentication failed. Please try again.' });
      }
    } else if (token) {
      localStorage.setItem('authToken', token);
      window.history.replaceState({}, '', '/login');
      window.location.reload();
    }

    const savedUsername = localStorage.getItem('rememberedUsername');
    if (savedUsername) {
      setFormData(prev => ({ ...prev, emailOrUsername: savedUsername }));
      setRememberMe(true);
    }

    const storedAttempts = localStorage.getItem('loginAttempts');
    const storedLockout = localStorage.getItem('lockoutTime');
    if (storedAttempts) setLoginAttempts(parseInt(storedAttempts));
    if (storedLockout) setLockoutTime(new Date(storedLockout));
  }, [searchParams]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(prev => prev - 1), 1000);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [resendCooldown]);

  useEffect(() => {
    if (lockoutTime && new Date() < lockoutTime) {
      const timer = setInterval(() => {
        if (new Date() >= lockoutTime) {
          setLockoutTime(null);
          setLoginAttempts(0);
          localStorage.removeItem('lockoutTime');
          localStorage.removeItem('loginAttempts');
        }
      }, 1000);
      return () => clearInterval(timer);
    }
    return undefined;
  }, [lockoutTime]);

  // Check if guest access is enabled
  const { data: systemSettings } = useQuery(GET_SYSTEM_SETTINGS);
  const isGuestEnabled = systemSettings?.systemSettings?.allowAnonymousGuest ?? true;

  // Check for development mode and default credentials
  const { data: devInfo } = useQuery(DEVELOPMENT_INFO_QUERY);
  const showDefaultCredentials = devInfo?.developmentInfo?.hasDefaultCredentials ?? false;
  const defaultAccounts = devInfo?.developmentInfo?.defaultAccounts ?? [];

  const [login, { loading }] = useMutation(LOGIN_MUTATION, {
    onCompleted: (data) => {
      if (!data.login.user.isEmailVerified) {
        setErrors({
          submit: 'Please verify your email before logging in. Check your inbox for the verification link.'
        });
        return;
      }
      setLoginAttempts(0);
      localStorage.removeItem('loginAttempts');
      localStorage.removeItem('lockoutTime');
      setAuthUser(data.login.user, data.login.token);
      navigate('/');
    },
    onError: (error) => {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      localStorage.setItem('loginAttempts', newAttempts.toString());
      
      if (newAttempts >= 5) {
        const lockout = new Date(Date.now() + 15 * 60 * 1000);
        setLockoutTime(lockout);
        localStorage.setItem('lockoutTime', lockout.toISOString());
        setErrors({ submit: 'Too many failed attempts. Account locked for 15 minutes.' });
      } else {
        setErrors({ submit: error.message });
      }
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

    if (rememberMe) {
      localStorage.setItem('rememberedUsername', formData.emailOrUsername);
    } else {
      localStorage.removeItem('rememberedUsername');
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

    if (name === 'magicLinkEmail') {
      if (value.length === 0) {
        setMagicLinkEmailValid(null);
      } else {
        setMagicLinkEmailValid(isValidEmail(value));
      }
    }

    if (name === 'emailOrUsername') {
      if (value.length === 0) {
        setEmailValid(null);
      } else if (value.includes('@')) {
        setEmailValid(isValidEmail(value));
      } else {
        setEmailValid(null);
      }
    }

    // Clear error for this field
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const fillDefaultCredentials = async (username: string, password: string) => {
    setFormData({
      ...formData,
      emailOrUsername: username,
      password: password
    });
    setErrors({});

    await login({
      variables: {
        input: {
          emailOrUsername: username,
          password: password
        }
      }
    });
  };

  const handleMagicLinkRequest = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.magicLinkEmail) {
      setErrors({ magicLinkEmail: 'Email is required' });
      return;
    }

    if (!isValidEmail(formData.magicLinkEmail)) {
      setErrors({ magicLinkEmail: 'Please enter a valid email address' });
      return;
    }

    setMagicLinkLoading(true);
    setErrors({});

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4127';
      const response = await fetch(`${apiUrl}/auth/magic-link/request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: formData.magicLinkEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.userExists === false) {
          setErrors({ magicLinkEmail: 'This email is not registered in our system.' });
        } else {
          setMagicLinkSent(true);
          setResendCooldown(60);
        }
      } else if (response.status === 429 && data.rateLimitExceeded) {
        setErrors({
          rateLimitError: data.message || 'Too many requests. Please try again later.',
          rateLimitRetryAfter: data.retryAfter
        });
      } else {
        setErrors({ submit: data.error || 'Failed to send magic link' });
      }
    } catch {
      setErrors({ submit: 'Failed to send magic link. Please try again.' });
    } finally {
      setMagicLinkLoading(false);
    }
  };

  const handleResendMagicLink = async () => {
    setMagicLinkSent(false);
    setResendCooldown(0);
    await handleMagicLinkRequest({ preventDefault: () => {} } as React.FormEvent);
  };


  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Static gradient background - optimized for all browsers */}
      <div className="lagoon-caustics"></div>
      <div className="max-w-md w-full relative z-10">
        {/* Header */}
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link to="/" className="inline-flex items-center justify-center mb-6 hover:opacity-90 transition-all duration-300 hover:scale-105 group">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-16 w-16 drop-shadow-lg group-hover:drop-shadow-2xl transition-all duration-300" />
            <span className="ml-4 text-5xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">GraphDone</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Welcome Back</h1>
          <p className="text-gray-400 text-lg">Enter your credentials to join the team</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Social Login Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/google`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign in with Google"
            >
              <svg className="h-5 w-5 transition-all duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
              </svg>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign in with Google
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/linkedin`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign in with LinkedIn"
            >
              <svg className="h-5 w-5 transition-all duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="#60A5FA">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign in with LinkedIn
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/github`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign in with GitHub"
            >
              <Github className="h-5 w-5 text-gray-300 transition-all duration-200 group-hover:scale-110" />
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign in with GitHub
              </span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">Or sign in with your credentials</span>
            </div>
          </div>

          {/* Sign In Method Toggle */}
          <div className="flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => {
                setUseMagicLink(false);
                setMagicLinkSent(false);
                setErrors({});
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                !useMagicLink
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
              }`}
            >
              <Lock className="h-4 w-4 inline mr-1" />
              Password
            </button>
            <button
              type="button"
              onClick={() => {
                setUseMagicLink(true);
                setMagicLinkSent(false);
                setErrors({});
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                useMagicLink
                  ? 'bg-gradient-to-r from-teal-600 to-cyan-600 text-white shadow-lg shadow-teal-500/30'
                  : 'bg-gray-700/50 text-gray-400 hover:bg-gray-600/50 hover:text-gray-300'
              }`}
            >
              <Zap className="h-4 w-4 inline mr-1" />
              Passwordless
            </button>
          </div>

          {/* Magic Link Form */}
          {useMagicLink ? (
            magicLinkSent ? (
              <div className="p-6 bg-teal-900/20 border border-teal-500/30 rounded-xl space-y-4">
                <div className="flex items-center justify-center mb-3">
                  <Mail className="h-8 w-8 text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-teal-300 text-center mb-2">Check Your Email!</h3>
                <p className="text-sm text-teal-200/80 text-center mb-4">
                  We've sent a magic link to <strong>{formData.magicLinkEmail}</strong>
                </p>
                <div className="space-y-2">
                  <p className="text-xs text-teal-300/60 text-center">
                    📧 Email typically arrives within 1-2 minutes
                  </p>
                  <p className="text-xs text-teal-300/60 text-center">
                    🔒 The link expires in 15 minutes
                  </p>
                  <p className="text-xs text-teal-300/60 text-center">
                    📂 Don't see it? Check your spam folder after 3 minutes
                  </p>
                </div>
                
                <div className="pt-4 border-t border-teal-500/20 space-y-2">
                  <button
                    type="button"
                    onClick={handleResendMagicLink}
                    disabled={resendCooldown > 0}
                    className="w-full px-4 py-2 bg-teal-700/30 hover:bg-teal-600/40 border border-teal-500/30 text-teal-300 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Magic Link'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMagicLinkSent(false);
                      setFormData({ ...formData, magicLinkEmail: '' });
                      setResendCooldown(0);
                    }}
                    className="w-full text-sm text-teal-400 hover:text-teal-300"
                  >
                    Try a different email
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <label htmlFor="magicLinkEmail" className="block text-sm font-medium text-gray-300 mb-1">
                    Email Address
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Mail className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                      type="email"
                      id="magicLinkEmail"
                      name="magicLinkEmail"
                      value={formData.magicLinkEmail}
                      onChange={handleChange}
                      autoComplete="email"
                      autoFocus
                      className={`w-full pl-10 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                        magicLinkEmailValid === false
                          ? 'pr-10 border-red-500/50 focus:ring-red-500/50'
                          : magicLinkEmailValid === true
                          ? 'pr-10 border-teal-500/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                          : errors.magicLinkEmail
                          ? 'pr-4 border-red-500/50 focus:ring-red-500/50'
                          : 'pr-4 border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                      }`}
                      placeholder="john@example.com"
                    />
                    {magicLinkEmailValid !== null && (
                      <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                        {magicLinkEmailValid ? (
                          <CheckCircle className="h-5 w-5 text-teal-400" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-400" />
                        )}
                      </div>
                    )}
                  </div>
                  {errors.magicLinkEmail && (
                    <div className="mt-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                      <p className="text-sm text-amber-300 font-medium mb-2">
                        ⚠️ Account Not Found
                      </p>
                      <p className="text-xs text-amber-200/80 mb-3">
                        We couldn't find an account with <strong>{formData.magicLinkEmail}</strong>
                      </p>
                      <Link
                        to="/signup"
                        className="inline-flex items-center text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
                      >
                        Create a new account →
                      </Link>
                    </div>
                  )}

                  {/* Rate Limit Error */}
                  {errors.rateLimitError && (
                    <div className="mt-3 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                      <div className="flex items-start space-x-2">
                        <Shield className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <p className="text-sm text-red-300 font-medium mb-2">
                            🛡️ Rate Limit Exceeded
                          </p>
                          <p className="text-xs text-red-200/80 mb-2">
                            {errors.rateLimitError}
                          </p>
                          {errors.rateLimitRetryAfter && (
                            <p className="text-xs text-red-300/60">
                              Please try again in {Math.ceil(parseInt(errors.rateLimitRetryAfter) / 60)} minute{Math.ceil(parseInt(errors.rateLimitRetryAfter) / 60) !== 1 ? 's' : ''}.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleMagicLinkRequest}
                  disabled={magicLinkLoading || !!errors.rateLimitError}
                  className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 hover:border-teal-300 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
                >
                  {magicLinkLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Sending Link...</span>
                    </>
                  ) : (
                    <>
                      <Mail className="h-5 w-5" />
                      <span>Send Link</span>
                    </>
                  )}
                </button>

                <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                  <p className="text-xs text-blue-300 text-center">
                    We'll email you a secure link to sign in. No password needed.
                  </p>
                </div>
              </>
            )
          ) : (
            <>
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
                autoComplete="username"
                autoFocus
                aria-label="Email address or username"
                aria-describedby={errors.emailOrUsername ? "emailOrUsername-error" : undefined}
                aria-invalid={!!errors.emailOrUsername}
                className={`w-full pl-10 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                  emailValid === false
                    ? 'pr-10 border-red-500/50 focus:ring-red-500/50'
                    : emailValid === true
                    ? 'pr-10 border-teal-500/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                    : errors.emailOrUsername
                    ? 'pr-4 border-red-500/50 focus:ring-red-500/50'
                    : 'pr-4 border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                }`}
                placeholder="john@example.com or johndoe"
              />
              {emailValid !== null && (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {emailValid ? (
                    <CheckCircle className="h-5 w-5 text-teal-400" aria-label="Valid email format" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" aria-label="Invalid email format" />
                  )}
                </div>
              )}
            </div>
            {errors.emailOrUsername && <p id="emailOrUsername-error" className="mt-1 text-xs text-red-400" role="alert">{errors.emailOrUsername}</p>}
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
                autoComplete="current-password"
                aria-label="Password"
                aria-describedby={errors.password ? "password-error" : undefined}
                aria-invalid={!!errors.password}
                className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                  errors.password ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-300"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p id="password-error" className="mt-1 text-xs text-red-400" role="alert">{errors.password}</p>}
          </div>

          {/* Remember Me & Forgot Password */}
          <div className="flex items-center justify-between">
            <label className="flex items-center cursor-pointer group">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-5 h-5 rounded border-2 border-gray-600 bg-gray-700/50 peer-checked:border-teal-500 peer-focus:ring-2 peer-focus:ring-teal-500/50 transition-all duration-200 group-hover:border-gray-500 flex items-center justify-center">
                  {rememberMe && (
                    <Check className="h-4 w-4 text-teal-500" strokeWidth={3} />
                  )}
                </div>
              </div>
              <span className="ml-3 text-sm text-gray-300 group-hover:text-gray-100 transition-colors">
                Remember me
              </span>
            </label>
            <Link to="/forgot-password" className="text-sm text-teal-400 hover:text-teal-300 transition-colors">
              Forgot password?
            </Link>
          </div>

          {/* Rate Limiting Warning */}
          {loginAttempts >= 3 && loginAttempts < 5 && !lockoutTime && (
            <div className="p-3 bg-orange-900/20 border border-orange-500/30 rounded-lg">
              <div className="flex items-start space-x-2">
                <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-orange-300 font-medium">
                    ⚠️ Multiple failed attempts detected
                  </p>
                  <p className="text-xs text-orange-200/80 mt-1">
                    Account will be temporarily locked after {5 - loginAttempts} more failed {5 - loginAttempts === 1 ? 'attempt' : 'attempts'}.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Account Lockout Notice */}
          {lockoutTime && new Date() < lockoutTime && (
            <div className="p-3 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-start space-x-2">
                <Shield className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-red-300 font-medium">
                    🔒 Account Temporarily Locked
                  </p>
                  <p className="text-xs text-red-200/80 mt-1">
                    Too many failed login attempts. Please wait {Math.ceil((lockoutTime.getTime() - Date.now()) / 60000)} minutes before trying again.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Submit Error */}
          {errors.submit && !lockoutTime && (
            <div className="p-3 bg-red-900 border border-red-700 rounded-lg">
              {errors.submitTitle && (
                <p className="text-sm text-red-300 font-semibold mb-1">{errors.submitTitle}</p>
              )}
              <p className="text-sm text-red-300">{errors.submit}</p>
              {errors.submitAction && (
                <p className="text-xs text-red-200/70 mt-2">💡 {errors.submitAction}</p>
              )}
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading || guestLoading}
            className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 hover:border-teal-300 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
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

            </>
          )}

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
            onClick={() => setShowGuestInfo(true)}
            disabled={!isGuestEnabled || loading || guestLoading || magicLinkLoading || (lockoutTime !== null && new Date() < lockoutTime)}
            className="w-full bg-[#da70d6]/20 hover:bg-[#da70d6]/30 backdrop-blur-sm border border-[#da70d6]/30 hover:border-[#da70d6]/50 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-[#da70d6]/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
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

          {/* Guest Mode Dialog */}
          <GuestModeDialog 
            isOpen={showGuestInfo}
            onClose={() => setShowGuestInfo(false)}
            onConfirm={handleGuestLogin}
          />

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
                {defaultAccounts.map((account: { username: string; password: string; role: string; description: string }) => (
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
            <Link to="/signup" className="text-teal-400 hover:text-teal-300 font-medium">
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
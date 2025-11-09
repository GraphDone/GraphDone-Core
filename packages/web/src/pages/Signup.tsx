import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, gql } from '@apollo/client';
import { Eye, EyeOff, ArrowRight, CheckCircle, XCircle, Github } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';

const SIGNUP_MUTATION = gql`
  mutation Signup($input: SignupInput!) {
    signup(input: $input) {
      token
      user {
        id
        email
        username
        name
        role
        isEmailVerified
      }
    }
  }
`;

const CHECK_AVAILABILITY = gql`
  query CheckAvailability($email: String, $username: String) {
    checkAvailability(email: $email, username: $username) {
      success
      message
    }
  }
`;

export function Signup() {
  const navigate = useNavigate();
  const { login: setAuthUser } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    name: ''
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isChecking, setIsChecking] = useState<Record<string, boolean>>({});
  const [availability, setAvailability] = useState<Record<string, boolean>>({});
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const [signup, { loading }] = useMutation(SIGNUP_MUTATION, {
    onCompleted: (data) => {
      // Store token in localStorage
      localStorage.setItem('authToken', data.signup.token);
      localStorage.setItem('currentUser', JSON.stringify(data.signup.user));
      
      // Navigate to main app
      navigate('/');
    },
    onError: (error) => {
      setErrors({ submit: error.message });
    }
  });

  const checkAvailability = async (field: 'email' | 'username', value: string) => {
    if (!value) return;
    
    setIsChecking({ ...isChecking, [field]: true });
    
    try {
      const response = await fetch('/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: CHECK_AVAILABILITY,
          variables: { [field]: value }
        })
      });
      
      const data = await response.json();
      if (data.data?.checkAvailability) {
        setAvailability({
          ...availability,
          [field]: data.data.checkAvailability.success
        });
        
        if (!data.data.checkAvailability.success) {
          setErrors({
            ...errors,
            [field]: data.data.checkAvailability.message
          });
        } else {
          const newErrors = { ...errors };
          delete newErrors[field];
          setErrors(newErrors);
        }
      }
    } finally {
      setIsChecking({ ...isChecking, [field]: false });
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    // Username validation
    if (!formData.username) {
      newErrors.username = 'Username is required';
    } else if (formData.username.length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (!/^[a-zA-Z0-9_-]+$/.test(formData.username)) {
      newErrors.username = 'Username can only contain letters, numbers, _ and -';
    }
    
    // Name validation
    if (!formData.name) {
      newErrors.name = 'Name is required';
    }
    
    // Password validation
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    }
    
    // Confirm password validation
    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    await signup({
      variables: {
        input: {
          email: formData.email,
          username: formData.username,
          password: formData.password,
          name: formData.name
        }
      }
    });
  };

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });

    if (name === 'email') {
      if (value.length === 0) {
        setEmailValid(null);
      } else {
        setEmailValid(isValidEmail(value));
      }
    }

    // Clear error for this field
    if (errors[name]) {
      const newErrors = { ...errors };
      delete newErrors[name];
      setErrors(newErrors);
    }
  };

  const handleBlur = (field: 'email' | 'username') => {
    if (formData[field]) {
      checkAvailability(field, formData[field]);
    }
  };

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !loading && !Object.values(isChecking).some(checking => checking)) {
        handleSubmit(e as any);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [formData, loading, isChecking]);

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.length >= 12) strength++;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z\d]/.test(password)) strength++;
    
    if (strength <= 2) return { label: 'Weak', color: 'bg-red-500' };
    if (strength <= 3) return { label: 'Medium', color: 'bg-yellow-500' };
    return { label: 'Strong', color: 'bg-green-500' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

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
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Create Your Account</h1>
          <p className="text-gray-400 text-lg">Join the decentralized project management revolution</p>
        </div>

        {/* Signup Form */}
        <form onSubmit={handleSubmit} className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          {/* Social Signup Buttons */}
          <div className="grid grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/google`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign up with Google"
            >
              <svg className="h-5 w-5 transition-all duration-200 group-hover:scale-110" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M5.266 9.765A7.077 7.077 0 0 1 12 4.909c1.69 0 3.218.6 4.418 1.582L19.91 3C17.782 1.145 15.055 0 12 0 7.27 0 3.198 2.698 1.24 6.65l4.026 3.115Z"/>
                <path fill="#34A853" d="M16.04 18.013c-1.09.703-2.474 1.078-4.04 1.078a7.077 7.077 0 0 1-6.723-4.823l-4.04 3.067A11.965 11.965 0 0 0 12 24c2.933 0 5.735-1.043 7.834-3l-3.793-2.987Z"/>
                <path fill="#4A90E2" d="M19.834 21c2.195-2.048 3.62-5.096 3.62-9 0-.71-.109-1.473-.272-2.182H12v4.637h6.436c-.317 1.559-1.17 2.766-2.395 3.558L19.834 21Z"/>
                <path fill="#FBBC05" d="M5.277 14.268A7.12 7.12 0 0 1 4.909 12c0-.782.125-1.533.357-2.235L1.24 6.65A11.934 11.934 0 0 0 0 12c0 1.92.445 3.73 1.237 5.335l4.04-3.067Z"/>
              </svg>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign up with Google
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/linkedin`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign up with LinkedIn"
            >
              <svg className="h-5 w-5 transition-all duration-200 group-hover:scale-110" viewBox="0 0 24 24" fill="#60A5FA">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign up with LinkedIn
              </span>
            </button>

            <button
              type="button"
              onClick={() => window.location.href = `${import.meta.env.VITE_API_URL || 'https://localhost:4128'}/auth/github`}
              className="group relative flex items-center justify-center p-3 bg-gray-700/50 hover:bg-gray-600/80 backdrop-blur-sm border border-gray-600/50 hover:border-teal-500 hover:shadow-lg hover:shadow-teal-500/30 rounded-lg transition-all duration-200"
              aria-label="Sign up with GitHub"
            >
              <Github className="h-5 w-5 text-gray-300 transition-all duration-200 group-hover:scale-110" />
              <span className="absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-teal-400 text-xs opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                Sign up with GitHub
              </span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-600" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-gray-800 text-gray-400">Or sign up with your credentials</span>
            </div>
          </div>

          {/* Name Field */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              autoFocus
              className={`w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                errors.name ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
              }`}
              placeholder="John Doe"
            />
            {errors.name && <p className="mt-1 text-xs text-red-400">{errors.name}</p>}
          </div>

          {/* Email Field */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
              Email Address
            </label>
            <div className="relative">
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur('email')}
                className={`w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 pr-10 transition-all ${
                  emailValid === false
                    ? 'border-red-500/50 focus:ring-red-500/50'
                    : emailValid === true
                    ? 'border-teal-500/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                    : errors.email
                    ? 'border-red-500/50 focus:ring-red-500/50'
                    : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                }`}
                placeholder="john@example.com"
              />
              {isChecking.email ? (
                <div className="absolute right-2 top-2.5 w-5 h-5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                </div>
              ) : emailValid !== null ? (
                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                  {emailValid ? (
                    <CheckCircle className="h-5 w-5 text-teal-400" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-400" />
                  )}
                </div>
              ) : availability.email && !isChecking.email ? (
                <CheckCircle className="absolute right-2 top-2.5 w-5 h-5 text-teal-500" />
              ) : null}
            </div>
            {errors.email && <p className="mt-1 text-xs text-red-400">{errors.email}</p>}
          </div>

          {/* Username Field */}
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-1">
              Username
            </label>
            <div className="relative">
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                onBlur={() => handleBlur('username')}
                className={`w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 pr-10 transition-all ${
                  errors.username ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                }`}
                placeholder="johndoe"
              />
              {isChecking.username && (
                <div className="absolute right-2 top-2.5 w-5 h-5">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-500"></div>
                </div>
              )}
              {availability.username && !isChecking.username && (
                <CheckCircle className="absolute right-2 top-2.5 w-5 h-5 text-teal-500" />
              )}
            </div>
            {errors.username && <p className="mt-1 text-xs text-red-400">{errors.username}</p>}
          </div>

          {/* Password Field */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 pr-12 transition-all ${
                  errors.password ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
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
            
            {/* Password Strength Indicator */}
            {formData.password && (
              <div className="mt-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-gray-400">Password strength:</span>
                  <span className="text-gray-300">{passwordStrength.label}</span>
                </div>
                <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                    style={{ 
                      width: passwordStrength.label === 'Weak' ? '33%' : 
                             passwordStrength.label === 'Medium' ? '66%' : '100%' 
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Confirm Password Field */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                className={`w-full px-4 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 pr-12 transition-all ${
                  errors.confirmPassword ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-2 top-2.5 text-gray-400 hover:text-gray-300"
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.confirmPassword && <p className="mt-1 text-xs text-red-400">{errors.confirmPassword}</p>}
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
            disabled={loading || Object.keys(isChecking).some(key => isChecking[key])}
            className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 hover:border-teal-300 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>Creating Account...</span>
              </>
            ) : (
              <>
                <span>Create Account</span>
                <ArrowRight className="h-5 w-5" />
              </>
            )}
          </button>

          {/* Terms */}
          <p className="text-xs text-gray-400 text-center">
            By creating an account, you agree to participate in the decentralized graph network
            and contribute to the collective intelligence.
          </p>
        </form>


        {/* Login Link */}
        <div className="mt-6 text-center">
          <p className="text-gray-300">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-400 hover:text-teal-300 font-medium">
              Sign in
            </Link>
          </p>
        </div>

        {/* Role Information */}
        <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-lg">
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Your Journey Begins as a Viewer</h3>
          <p className="text-xs text-gray-400">
            All new members start with read-only access. As you contribute and demonstrate value,
            the community may elevate your role to User or even Admin.
          </p>
        </div>
      </div>
      
      {/* TLS/SSL Status Indicator */}
      <TlsStatusIndicator />
    </div>
  );
}
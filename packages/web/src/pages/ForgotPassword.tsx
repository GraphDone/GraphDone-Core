import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, XCircle, Github } from 'lucide-react';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [userExists, setUserExists] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const [emailValid, setEmailValid] = useState<boolean | null>(null);

  const isValidEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4127';
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetSent(true);
        setUserExists(data.userExists);
      } else {
        setError(data.error || 'Failed to send reset link');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      setError('Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
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
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Reset Password</h1>
          <p className="text-gray-400 text-lg">Enter your email to receive a reset link</p>
        </div>

        {/* Reset Form */}
        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
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
              <span className="px-2 bg-gray-800 text-gray-400">Or reset your password</span>
            </div>
          </div>

          {resetSent ? (
            userExists ? (
              <div className="p-6 bg-teal-900/20 border border-teal-500/30 rounded-xl">
                <div className="flex items-center justify-center mb-3">
                  <CheckCircle className="h-12 w-12 text-teal-400" />
                </div>
                <h3 className="text-lg font-semibold text-teal-300 text-center mb-2">Check Your Email!</h3>
                <p className="text-sm text-teal-200/80 text-center mb-4">
                  We've sent a password reset link to <strong>{email}</strong>
                </p>
                <p className="text-xs text-teal-300/60 text-center mb-4">
                  Click the link in the email to reset your password. The link expires in 1 hour.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setResetSent(false);
                    setEmail('');
                    setUserExists(null);
                  }}
                  className="mt-2 w-full text-sm text-teal-400 hover:text-teal-300 transition-colors"
                >
                  Try a different email
                </button>
              </div>
            ) : (
              <div className="p-6 bg-red-900/20 border border-red-500/30 rounded-xl">
                <div className="flex items-center justify-center mb-3">
                  <XCircle className="h-12 w-12 text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-red-300 text-center mb-2">Email Not Found</h3>
                <p className="text-sm text-red-200/80 text-center mb-4">
                  The email <strong>{email}</strong> is not registered in our system.
                </p>
                <p className="text-xs text-red-300/60 text-center mb-4">
                  Please check the email address or create a new account.
                </p>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => {
                      setResetSent(false);
                      setEmail('');
                      setUserExists(null);
                    }}
                    className="mt-2 w-full text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Try a different email
                  </button>
                  <Link
                    to="/signup"
                    className="block w-full text-center text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Create a new account
                  </Link>
                </div>
              </div>
            )
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={email}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEmail(value);
                      setError('');
                      if (value.length === 0) {
                        setEmailValid(null);
                      } else {
                        setEmailValid(isValidEmail(value));
                      }
                    }}
                    autoFocus
                    className={`w-full pl-10 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                      emailValid === false
                        ? 'pr-10 border-red-500/50 focus:ring-red-500/50'
                        : emailValid === true
                        ? 'pr-10 border-teal-500/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                        : error
                        ? 'pr-4 border-red-500/50 focus:ring-red-500/50'
                        : 'pr-4 border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                    }`}
                    placeholder="john@example.com"
                  />
                  {emailValid !== null && (
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                      {emailValid ? (
                        <CheckCircle className="h-5 w-5 text-teal-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  )}
                </div>
                {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 hover:border-teal-300 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Sending Link...</span>
                  </>
                ) : (
                  <>
                    <Mail className="h-5 w-5" />
                    <span>Send Reset Link</span>
                  </>
                )}
              </button>

              {/* Info */}
              <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                <p className="text-xs text-blue-300 text-center">
                  We'll send you a secure link to reset your password. Check your spam folder if you don't see it.
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Back to Login */}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-gray-300 hover:text-teal-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Link>
        </div>

        {/* Help Text */}
        <div className="mt-8 p-4 bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl shadow-lg">
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Need Help?</h3>
          <p className="text-xs text-gray-400">
            If you're having trouble resetting your password, contact your team administrator or reach out to support.
          </p>
        </div>
      </div>

      {/* TLS/SSL Status Indicator */}
      <TlsStatusIndicator />
    </div>
  );
}

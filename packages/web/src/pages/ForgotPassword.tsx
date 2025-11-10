import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, CheckCircle, XCircle, Shield } from 'lucide-react';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';
import { CodeCaptcha } from '../components/CodeCaptcha';
import { isValidEmail } from '../utils/validation';

export function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [error, setError] = useState('');
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [rateLimitError, setRateLimitError] = useState('');
  const [rateLimitRetryAfter, setRateLimitRetryAfter] = useState<number | null>(null);
  const [captchaPayload, setCaptchaPayload] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email) {
      setError('Email is required');
      return;
    }

    if (!isValidEmail(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError('');
    setRateLimitError('');
    setRateLimitRetryAfter(null);

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4127';
      const response = await fetch(`${apiUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, captchaPayload }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.userExists === false) {
          setError('This email is not registered in our system.');
        } else {
          setResetSent(true);
        }
      } else if (response.status === 429 && data.rateLimitExceeded) {
        setRateLimitError(data.message || 'Too many requests. Please try again later.');
        setRateLimitRetryAfter(data.retryAfter || null);
      } else {
        setError(data.error || 'Failed to send reset link');
      }
    } catch {
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
          {resetSent ? (
            <div className="p-6 bg-teal-900/20 border border-teal-500/30 rounded-xl">
              <div className="flex items-center justify-center mb-3">
                <CheckCircle className="h-12 w-12 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-teal-300 text-center mb-2">Check Your Email!</h3>
              <p className="text-sm text-teal-200/80 text-center mb-4">
                If an account exists for <strong>{email}</strong>, you'll receive a password reset link shortly.
              </p>
              <p className="text-xs text-teal-300/60 text-center mb-4">
                Click the link in the email to reset your password. The link expires in 1 hour. If you don't receive an email, please check your spam folder or verify the email address.
              </p>
              <button
                type="button"
                onClick={() => {
                  setResetSent(false);
                  setEmail('');
                }}
                className="mt-2 w-full text-sm text-teal-400 hover:text-teal-300 transition-colors"
              >
                Try a different email
              </button>
            </div>
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
                    autoComplete="email"
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
                {error && (
                  <div className="mt-3 p-4 bg-amber-900/20 border border-amber-500/30 rounded-xl">
                    <p className="text-sm text-amber-300 font-medium mb-2">
                      ⚠️ Account Not Found
                    </p>
                    <p className="text-xs text-amber-200/80 mb-3">
                      We couldn't find an account with <strong>{email}</strong>
                    </p>
                    <Link
                      to="/signup"
                      className="inline-flex items-center text-sm text-teal-400 hover:text-teal-300 font-medium transition-colors"
                    >
                      Create a new account →
                    </Link>
                  </div>
                )}
                {rateLimitError && (
                  <div className="mt-3 p-4 bg-red-900/20 border border-red-500/30 rounded-xl">
                    <div className="flex items-start space-x-2">
                      <Shield className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm text-red-300 font-medium mb-2">
                          🛡️ Rate Limit Exceeded
                        </p>
                        <p className="text-xs text-red-200/80 mb-2">
                          {rateLimitError}
                        </p>
                        {rateLimitRetryAfter && (
                          <p className="text-xs text-red-300/60">
                            Please try again in {Math.ceil(rateLimitRetryAfter / 60)} minute{Math.ceil(rateLimitRetryAfter / 60) !== 1 ? 's' : ''}.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* CAPTCHA */}
              <CodeCaptcha
                onVerified={(code) => setCaptchaPayload(code)}
                onError={() => setCaptchaPayload('')}
              />

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !!rateLimitError || !captchaPayload}
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

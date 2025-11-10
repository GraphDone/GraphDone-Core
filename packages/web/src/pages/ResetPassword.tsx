import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, ArrowLeft } from 'lucide-react';
import { TlsStatusIndicator } from '../components/TlsStatusIndicator';
import { CodeCaptcha } from '../components/CodeCaptcha';
import { PasswordRequirements } from '../components/PasswordRequirements';
import { validatePassword, getPasswordStrength } from '../utils/validation';

export function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState('');
  const [passwordsMatch, setPasswordsMatch] = useState<boolean | null>(null);
  const [captchaPayload, setCaptchaPayload] = useState<string>('');

  useEffect(() => {
    if (!token) {
      navigate('/login?error=invalid_reset_link');
    }
  }, [token, navigate]);

  const passwordStrength = getPasswordStrength(password);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validatePassword(password);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4127';
      const response = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword: password, captchaPayload }),
      });

      const data = await response.json();

      if (response.ok) {
        setResetComplete(true);
        setTimeout(() => {
          navigate('/login');
        }, 3000);
      } else {
        setError(data.error || 'Failed to reset password');
      }
    } catch {
      setError('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="lagoon-caustics"></div>
      <div className="max-w-md w-full relative z-10">
        <div className="text-center mb-8 animate-in fade-in slide-in-from-top-4 duration-500">
          <Link to="/" className="inline-flex items-center justify-center mb-6 hover:opacity-90 transition-all duration-300 hover:scale-105 group">
            <img src="/favicon.svg" alt="GraphDone Logo" className="h-16 w-16 drop-shadow-lg group-hover:drop-shadow-2xl transition-all duration-300" />
            <span className="ml-4 text-5xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent drop-shadow-2xl tracking-tight">GraphDone</span>
          </Link>
          <h1 className="text-3xl font-bold text-gray-100 mb-3">Set New Password</h1>
          <p className="text-gray-400 text-lg">Choose a strong password for your account</p>
        </div>

        <div className="bg-gray-800/50 backdrop-blur-xl border border-gray-700/50 rounded-2xl p-8 space-y-5 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-700">
          {resetComplete ? (
            <div className="p-6 bg-teal-900/20 border border-teal-500/30 rounded-xl">
              <div className="flex items-center justify-center mb-3">
                <CheckCircle className="h-12 w-12 text-teal-400" />
              </div>
              <h3 className="text-lg font-semibold text-teal-300 text-center mb-2">Password Reset Successful!</h3>
              <p className="text-sm text-teal-200/80 text-center mb-4">
                Your password has been updated successfully.
              </p>
              <p className="text-xs text-teal-300/60 text-center">
                Redirecting to login page...
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="relative">
                <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-1">
                  New Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    id="password"
                    name="password"
                    value={password}
                    onChange={(e) => {
                      const newPassword = e.target.value;
                      setPassword(newPassword);
                      setError('');
                      if (confirmPassword) {
                        setPasswordsMatch(newPassword === confirmPassword);
                      }
                    }}
                    autoComplete="new-password"
                    autoFocus
                    className={`w-full pl-10 pr-12 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                      error ? 'border-red-500/50 focus:ring-red-500/50' : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                    }`}
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {password && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-400">Password strength:</span>
                      <span className="text-gray-300">{passwordStrength.label}</span>
                    </div>
                    <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: passwordStrength.width }}
                      />
                    </div>
                  </div>
                )}

                <PasswordRequirements password={password} />
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-300 mb-1">
                  Confirm Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={confirmPassword}
                    onChange={(e) => {
                      const newConfirmPassword = e.target.value;
                      setConfirmPassword(newConfirmPassword);
                      setError('');
                      if (password && newConfirmPassword) {
                        setPasswordsMatch(password === newConfirmPassword);
                      } else {
                        setPasswordsMatch(null);
                      }
                    }}
                    autoComplete="new-password"
                    className={`w-full pl-10 pr-16 py-3 bg-gray-700/50 backdrop-blur-sm border rounded-xl text-gray-100 focus:outline-none focus:ring-2 transition-all ${
                      passwordsMatch === false
                        ? 'border-red-500/50 focus:ring-red-500/50'
                        : passwordsMatch === true
                        ? 'border-teal-500/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                        : error
                        ? 'border-red-500/50 focus:ring-red-500/50'
                        : 'border-gray-600/50 focus:ring-teal-500/50 focus:border-teal-500/50'
                    }`}
                    placeholder="••••••••"
                  />
                  {passwordsMatch !== null && confirmPassword && (
                    <div className="absolute inset-y-0 right-12 flex items-center pointer-events-none">
                      {passwordsMatch ? (
                        <CheckCircle className="h-5 w-5 text-teal-400" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-400" />
                      )}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-300"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
                {passwordsMatch === false && confirmPassword && !error && (
                  <p className="mt-1 text-xs text-red-400">Passwords do not match</p>
                )}
                {passwordsMatch === true && confirmPassword && (
                  <p className="mt-1 text-xs text-teal-400">Passwords match!</p>
                )}
              </div>

              {/* CAPTCHA */}
              <CodeCaptcha
                onVerified={(code) => setCaptchaPayload(code)}
                onError={() => setCaptchaPayload('')}
              />

              <button
                type="submit"
                disabled={loading || !captchaPayload}
                className="w-full bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 border border-teal-400/50 hover:border-teal-300 text-white font-semibold py-4 px-6 rounded-xl transition-all duration-200 hover:scale-[1.02] hover:-translate-y-0.5 hover:shadow-lg hover:shadow-teal-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:translate-y-0 flex items-center justify-center space-x-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5" />
                    <span>Reset Password</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="inline-flex items-center text-gray-300 hover:text-teal-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to login
          </Link>
        </div>
      </div>

      <TlsStatusIndicator />
    </div>
  );
}

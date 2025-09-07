import React from 'react';
import { createPortal } from 'react-dom';
import { X, Shield, Lock, Database, AlertTriangle } from 'lucide-react';

interface LoginSecurityDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginSecurityDialog({ isOpen, onClose }: LoginSecurityDialogProps) {
  if (!isOpen) return null;

  return createPortal(
    <div 
      className="fixed inset-0 z-[999999999] flex items-center justify-center p-4"
      style={{ 
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(4px)',
        pointerEvents: 'all'
      }}
      onClick={onClose}
    >
      <div 
        className="bg-gray-800 border border-gray-700 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-green-900 rounded-full flex items-center justify-center">
              <Shield className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">🔒 How We Protect Your Account</h2>
              <p className="text-sm text-gray-400">GraphDone authentication security practices</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Password Security */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Lock className="h-4 w-4 text-green-400" />
              </div>
              <div>
                <h3 className="font-semibold text-green-400 mb-1">✓ Secure Password Handling</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Your passwords are never stored in plain text. We use industry-standard bcrypt hashing 
                  with 10 rounds of salt, making it computationally infeasible to reverse.
                </p>
                <div className="bg-gray-900 border border-gray-600 rounded p-3 text-xs font-mono text-gray-400">
                  your-password → bcrypt.hash(password, 10) → $2b$10$encrypted-hash-never-reversible
                </div>
              </div>
            </div>
          </div>

          {/* Database Security */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <Database className="h-4 w-4 text-blue-400" />
              </div>
              <div>
                <h3 className="font-semibold text-blue-400 mb-1">✓ Secure Database Storage</h3>
                <p className="text-sm text-gray-300 mb-2">
                  Authentication data is stored in a local SQLite database with restricted file permissions (600). 
                  Password hashes are never exposed through our API responses.
                </p>
                <ul className="text-xs text-gray-400 space-y-1 ml-4">
                  <li>• Local file-based storage (no network exposure)</li>
                  <li>• Restricted file permissions (owner read/write only)</li>
                  <li>• API responses always exclude password hashes</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Current Limitations */}
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-orange-900 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                <AlertTriangle className="h-4 w-4 text-orange-400" />
              </div>
              <div>
                <h3 className="font-semibold text-orange-400 mb-1">⚠ Security Enhancements In Progress</h3>
                <p className="text-sm text-gray-300 mb-2">
                  We're actively implementing additional security measures:
                </p>
                <ul className="text-sm text-gray-300 space-y-1 ml-4">
                  <li>• <span className="text-orange-400">Rate limiting</span> - Preventing brute force login attempts</li>
                  <li>• <span className="text-orange-400">Account lockout</span> - Temporary locks after failed attempts</li>
                  <li>• <span className="text-orange-400">Login history</span> - Track and monitor access patterns</li>
                  <li>• <span className="text-orange-400">Encryption at rest</span> - Database file encryption</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Development Notice */}
          <div className="bg-yellow-900 border border-yellow-700 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="text-yellow-400 flex-shrink-0 mt-0.5">⚡</div>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-1">Development Environment</h3>
                <p className="text-sm text-yellow-200">
                  This is a development environment with demo users. In production, default passwords 
                  will be disabled and stronger security measures will be enforced.
                </p>
              </div>
            </div>
          </div>

          {/* Password Requirements */}
          <div className="bg-gray-900 border border-gray-600 rounded-lg p-4">
            <h3 className="font-semibold text-gray-100 mb-2">Password Requirements</h3>
            <ul className="text-sm text-gray-300 space-y-1">
              <li>• Minimum 8 characters (enforced during signup)</li>
              <li>• Mix of uppercase, lowercase, numbers, and symbols recommended</li>
              <li>• Password confirmation required</li>
              <li>• Strength meter provides real-time feedback</li>
            </ul>
          </div>

          {/* Data Protection */}
          <div className="text-xs text-gray-400 border-t border-gray-700 pt-4">
            <p>
              <strong className="text-gray-300">Privacy Commitment:</strong> We never log, store, or transmit your actual passwords. 
              Only salted, irreversibly hashed representations are maintained for authentication purposes. 
              Your privacy and security are our top priority.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-700 p-6 bg-gray-750">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              Questions about security? Check our{' '}
              <a href="/docs/security" className="text-green-400 hover:text-green-300">
                security documentation
              </a>
            </div>
            <button
              onClick={onClose}
              className="btn btn-primary text-sm"
            >
              Got it, thanks
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
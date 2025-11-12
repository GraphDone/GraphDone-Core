import { createPortal } from 'react-dom';
import { X, Users, AlertCircle, Clock, Lock, Eye } from 'lucide-react';
import { useState, useEffect } from 'react';
import { CodeCaptcha } from './CodeCaptcha';

interface GuestModeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function GuestModeDialog({ isOpen, onClose, onConfirm }: GuestModeDialogProps) {
  const [guestCaptchaVerified, setGuestCaptchaVerified] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setGuestCaptchaVerified(false);
    }
  }, [isOpen]);

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
        className="bg-gray-800 border border-gray-700 rounded-2xl shadow-2xl max-w-lg w-full"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-purple-900/50 rounded-full flex items-center justify-center">
              <Users className="h-5 w-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-100">Continue as Guest?</h2>
              <p className="text-sm text-gray-400">Read-only exploration mode</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="p-4 bg-purple-900/20 border border-purple-500/30 rounded-lg">
            <p className="text-sm text-purple-200 mb-3">
              Guest mode lets you explore GraphDone without creating an account. Perfect for trying out the platform!
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-100">What you can do:</h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Eye className="h-4 w-4 text-teal-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300">View public graphs and work items</p>
              </div>
              <div className="flex items-start space-x-3">
                <Eye className="h-4 w-4 text-teal-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300">Explore graph visualizations and relationships</p>
              </div>
              <div className="flex items-start space-x-3">
                <Eye className="h-4 w-4 text-teal-400 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-300">Navigate between different views</p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-gray-100 flex items-center">
              <AlertCircle className="h-4 w-4 text-orange-400 mr-2" />
              Limitations:
            </h3>
            <div className="space-y-2">
              <div className="flex items-start space-x-3">
                <Lock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">Cannot create or edit work items</p>
              </div>
              <div className="flex items-start space-x-3">
                <Lock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">Cannot manage graphs or relationships</p>
              </div>
              <div className="flex items-start space-x-3">
                <Clock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">Session expires after 24 hours</p>
              </div>
              <div className="flex items-start space-x-3">
                <Lock className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-gray-400">No preferences or progress saved</p>
              </div>
            </div>
          </div>

          {/* CAPTCHA Verification */}
          <div>
            <CodeCaptcha
              onVerified={() => setGuestCaptchaVerified(true)}
              className="w-full"
            />
          </div>

          <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
            <p className="text-xs text-blue-300">
              💡 <strong>Tip:</strong> Create a free account to unlock full features including editing, collaboration, and persistent workspace!
            </p>
          </div>
        </div>

        <div className="border-t border-gray-700 p-6 bg-gray-750 flex items-center justify-between gap-3 rounded-b-2xl">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700/50 hover:bg-gray-600/80 border border-gray-600/50 text-gray-300 font-medium rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            disabled={!guestCaptchaVerified}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 border border-purple-400/50 text-white font-semibold rounded-xl transition-all hover:scale-[1.02] hover:shadow-lg hover:shadow-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:from-gray-700 disabled:to-gray-600 disabled:border-gray-600"
          >
            Continue as Guest
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

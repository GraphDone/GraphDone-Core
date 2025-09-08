import React from 'react';
import { Shield, ShieldOff, AlertTriangle } from 'lucide-react';

interface TlsStatusIndicatorProps {
  className?: string;
}

export function TlsStatusIndicator({ className = '' }: TlsStatusIndicatorProps) {
  // Detect if we're running over HTTPS
  const isSecure = window.location.protocol === 'https:';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // Don't show anything if we're on HTTPS (secure)
  if (isSecure) {
    return null;
  }

  return (
    <div className={`fixed top-4 right-4 z-50 ${className}`}>
      <div className={`
        flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg border backdrop-blur-sm
        ${isLocalhost 
          ? 'bg-yellow-500/90 border-yellow-600 text-yellow-900' 
          : 'bg-red-500/90 border-red-600 text-red-100'
        }
      `}>
        {isLocalhost ? (
          <>
            <AlertTriangle size={16} />
            <span className="text-sm font-medium">Development Mode (HTTP)</span>
          </>
        ) : (
          <>
            <ShieldOff size={16} />
            <span className="text-sm font-medium">Insecure Connection (HTTP)</span>
          </>
        )}
      </div>
    </div>
  );
}

// For authenticated users, show a more prominent security status
export function TlsSecurityBanner({ className = '' }: TlsStatusIndicatorProps) {
  const isSecure = window.location.protocol === 'https:';
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  if (isSecure) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <Shield size={14} className="text-green-400" />
        <span className="text-xs text-green-400">Secure Connection</span>
      </div>
    );
  }

  if (isLocalhost) {
    return (
      <div className={`flex items-center gap-2 ${className}`}>
        <AlertTriangle size={14} className="text-yellow-400" />
        <span className="text-xs text-yellow-400">Development Mode</span>
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <ShieldOff size={14} className="text-red-400" />
      <span className="text-xs text-red-400">Insecure Connection</span>
    </div>
  );
}
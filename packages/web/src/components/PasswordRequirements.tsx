import { Check, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface PasswordRequirementsProps {
  password: string;
  showAll?: boolean;
}

export function PasswordRequirements({ password, showAll = false }: PasswordRequirementsProps) {
  const [showBox, setShowBox] = useState(true);

  const requirements = [
    {
      label: '8+ characters',
      met: password.length >= 8,
      test: (pwd: string) => pwd.length >= 8
    },
    {
      label: 'Uppercase letter (A-Z)',
      met: /[A-Z]/.test(password),
      test: (pwd: string) => /[A-Z]/.test(pwd)
    },
    {
      label: 'Lowercase letter (a-z)',
      met: /[a-z]/.test(password),
      test: (pwd: string) => /[a-z]/.test(pwd)
    },
    {
      label: 'Number (0-9)',
      met: /[0-9]/.test(password),
      test: (pwd: string) => /[0-9]/.test(pwd)
    },
    {
      label: 'Special character (!@#$%^&*)',
      met: /[^a-zA-Z0-9]/.test(password),
      test: (pwd: string) => /[^a-zA-Z0-9]/.test(pwd),
      optional: true
    }
  ];

  const allRequiredMet = requirements
    .filter(req => !req.optional)
    .every(req => req.met);

  useEffect(() => {
    if (allRequiredMet && password) {
      const timer = setTimeout(() => {
        setShowBox(false);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (password) {
      setShowBox(true);
    }
    return undefined;
  }, [allRequiredMet, password]);

  if (!password) return null;
  if (!showBox) return null;

  return (
    <div className="absolute left-full ml-4 top-0 w-56 p-3 bg-gray-800/95 backdrop-blur-xl border border-gray-700/50 rounded-xl shadow-2xl z-50">
      <p className="text-xs font-semibold text-gray-300 mb-2">Password Requirements</p>
      <ul className="space-y-1.5">
        {requirements.map((req, index) => (
          <li key={index} className="flex items-center space-x-2 text-xs">
            {password ? (
              req.met ? (
                <Check className="h-3.5 w-3.5 text-teal-400 flex-shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
              )
            ) : (
              <div className="h-3.5 w-3.5 rounded-full border border-gray-500 flex-shrink-0" />
            )}
            <span className={`${
              password
                ? req.met
                  ? 'text-teal-400'
                  : 'text-gray-400'
                : 'text-gray-400'
            }`}>
              {req.label}
              {req.optional && <span className="text-gray-500 ml-1">(recommended)</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

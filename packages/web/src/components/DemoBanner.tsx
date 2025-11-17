/**
 * Demo Mode Banner
 *
 * Displays a prominent banner when running in demo mode to inform users about:
 * - Session limitations
 * - Daily reset schedule
 * - Data persistence
 */

import { useState } from 'react';
import { BUILD_TAG } from '../utils/version';

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export function DemoBanner() {
  const [dismissed, setDismissed] = useState(false);

  // Don't render if not in demo mode or if dismissed
  if (!DEMO_MODE || dismissed) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-amber-500 via-orange-500 to-amber-500 text-white shadow-lg border-b-2 border-amber-600">
      <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between flex-wrap">
          <div className="w-0 flex-1 flex items-center">
            <span className="flex p-2 rounded-lg bg-amber-600">
              <svg
                className="h-6 w-6 text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </span>
            <div className="ml-3 font-medium">
              <p className="text-sm sm:text-base">
                <span className="font-bold">Demo Mode:</span> You're using a shared demo instance.
                <span className="hidden sm:inline ml-2">
                  • Your data is isolated and secure • 2-hour session timeout • Resets daily at 2 AM UTC
                </span>
              </p>
              <p className="text-xs sm:hidden mt-1 opacity-90">
                Session timeout: 2 hours • Daily reset at 2 AM UTC
              </p>
              <p className="text-xs mt-1 opacity-75 font-mono">
                Build: {BUILD_TAG}
              </p>
            </div>
          </div>
          <div className="flex-shrink-0 sm:ml-3 flex items-center space-x-2">
            <a
              href="https://graphdone.com"
              className="hidden sm:block px-4 py-1.5 rounded-md bg-white text-amber-600 text-sm font-semibold hover:bg-amber-50 transition-colors shadow-sm"
            >
              Get Full Access
            </a>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              className="flex p-1.5 rounded-md hover:bg-amber-600 focus:outline-none focus:ring-2 focus:ring-white transition-colors"
              aria-label="Dismiss demo banner"
            >
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

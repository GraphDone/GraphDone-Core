/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  safelist: [
    // Gradient hover classes for ALL work item types (from central workItemConstants) - 20% opacity
    // TASK (green-500)
    'hover:from-green-500/20', 'hover:to-green-500/20',
    // BUG (red-500)
    'hover:from-red-500/20', 'hover:to-red-500/20',
    // FEATURE (sky-500)
    'hover:from-sky-500/20', 'hover:to-sky-500/20',
    // EPIC (fuchsia-500)
    'hover:from-fuchsia-500/20', 'hover:to-fuchsia-500/20',
    // MILESTONE (orange-500)
    'hover:from-orange-500/20', 'hover:to-orange-500/20',
    // OUTCOME (indigo-500)
    'hover:from-indigo-500/20', 'hover:to-indigo-500/20',
    // IDEA (yellow-500)
    'hover:from-yellow-500/20', 'hover:to-yellow-500/20',
    // RESEARCH (teal-500)
    'hover:from-teal-500/20', 'hover:to-teal-500/20',
    // DEFAULT (gray-500)
    'hover:from-gray-500/20', 'hover:to-gray-500/20',
    // Border left hover classes for cards/dashboard
    'hover:border-l-fuchsia-300/60', 'hover:border-l-orange-300/60', 'hover:border-l-indigo-300/60',
    'hover:border-l-green-300/60', 'hover:border-l-red-300/60', 'hover:border-l-sky-300/60',
    'hover:border-l-yellow-300/60', 'hover:border-l-teal-300/60', 'hover:border-l-gray-300/60'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        'graph': {
          'center': '#3b82f6',
          'inner': '#60a5fa',
          'outer': '#93c5fd',
          'periphery': '#dbeafe'
        }
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        }
      }
    },
  },
  plugins: [],
}
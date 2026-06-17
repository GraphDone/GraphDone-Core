import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  CreditCard, Network, MoreHorizontal, LayoutDashboard, Table, Columns,
  GanttChartSquare, CalendarDays, Activity, Brain, Settings as SettingsIcon,
  Shield, Server, Bot, BarChart3, LogOut, UserCircle,
} from 'lucide-react';
import { useViewMode, ViewMode } from '../contexts/ViewModeContext';
import { useAuth } from '../contexts/AuthContext';

/**
 * The app-wide mobile footer. Present on every page so navigation is consistent:
 * List and Graph jump to the workspace in that view; More opens a sheet with the
 * remaining views and the other pages. Desktop/tablet keep their own chrome.
 */
export function MobileBottomNav() {
  const { viewMode, setViewMode } = useViewMode();
  const { currentUser, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const onWorkspace = location.pathname === '/' || location.pathname === '/workspace';
  const goView = (m: ViewMode) => {
    setViewMode(m);
    if (!onWorkspace) navigate('/');
    setMoreOpen(false);
  };

  const VIEWS: { mode: ViewMode; label: string; Icon: typeof Table }[] = [
    { mode: 'dashboard', label: 'Dashboard', Icon: LayoutDashboard },
    { mode: 'table', label: 'Table', Icon: Table },
    { mode: 'kanban', label: 'Board', Icon: Columns },
    { mode: 'gantt', label: 'Gantt', Icon: GanttChartSquare },
    { mode: 'calendar', label: 'Calendar', Icon: CalendarDays },
    { mode: 'activity', label: 'Activity', Icon: Activity },
  ];

  const role = currentUser?.role;
  const PAGES = [
    { href: '/ontology', label: 'Ontology', Icon: Brain, show: true },
    { href: '/agents', label: 'AI & Agents', Icon: Bot, show: true },
    { href: '/analytics', label: 'Analytics', Icon: BarChart3, show: true },
    { href: '/settings', label: 'Settings', Icon: SettingsIcon, show: true },
    { href: '/admin', label: 'Admin', Icon: Shield, show: role === 'ADMIN' },
    { href: '/backend', label: 'System', Icon: Server, show: role !== 'VIEWER' && role !== 'GUEST' },
  ].filter((p) => p.show);

  const tabActive = (active: boolean) =>
    `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 min-h-[3.25rem] transition-colors ${
      active ? 'text-green-400' : 'text-gray-400 hover:text-gray-200'
    }`;

  return (
    <>
      <nav
        data-testid="mobile-bottom-nav"
        className="md:hidden flex-shrink-0 relative z-30 flex items-stretch border-t border-gray-700/60 bg-gray-900/95 backdrop-blur-md pb-safe"
      >
        <button onClick={() => goView('cards')} className={tabActive(onWorkspace && viewMode === 'cards')}>
          <CreditCard className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[11px] font-medium">List</span>
        </button>
        <button onClick={() => goView('graph')} className={tabActive(onWorkspace && viewMode === 'graph')}>
          <Network className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[11px] font-medium">Graph</span>
        </button>
        <button
          onClick={() => setMoreOpen(true)}
          className={tabActive(moreOpen || (onWorkspace && !['cards', 'graph'].includes(viewMode)) || !onWorkspace)}
        >
          <MoreHorizontal className="h-5 w-5" strokeWidth={1.75} />
          <span className="text-[11px] font-medium">More</span>
        </button>
      </nav>

      {moreOpen && createPortal(
        <div
          className="md:hidden fixed inset-0 z-[100] flex flex-col justify-end"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            data-testid="mobile-more-sheet"
            className="relative bg-gray-900 border-t border-gray-700 rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-600" />
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">Views</h3>
            <div className="grid grid-cols-3 gap-2 mb-4">
              {VIEWS.map(({ mode, label, Icon }) => (
                <button
                  key={mode}
                  onClick={() => goView(mode)}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition-colors ${
                    onWorkspace && viewMode === mode
                      ? 'bg-green-600/20 border-green-500/40 text-green-300'
                      : 'bg-gray-800/60 border-gray-700/60 text-gray-300 active:bg-gray-700'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2 px-1">Go to</h3>
            <div className="grid grid-cols-3 gap-2">
              {PAGES.map(({ href, label, Icon }) => (
                <button
                  key={href}
                  onClick={() => { navigate(href); setMoreOpen(false); }}
                  className={`flex flex-col items-center justify-center gap-1.5 py-4 rounded-xl border transition-colors ${
                    location.pathname === href
                      ? 'bg-green-600/20 border-green-500/40 text-green-300'
                      : 'bg-gray-800/60 border-gray-700/60 text-gray-300 active:bg-gray-700'
                  }`}
                >
                  <Icon className="h-6 w-6" strokeWidth={1.5} />
                  <span className="text-xs font-medium text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>

            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mt-4 mb-2 px-1">Account</h3>
            <div className="flex items-center justify-between gap-2 rounded-xl border border-gray-700/60 bg-gray-800/60 p-3">
              <div className="flex items-center gap-2 min-w-0">
                <UserCircle className="h-7 w-7 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-100 truncate">{currentUser?.name || currentUser?.username || 'Account'}</div>
                  {currentUser?.role && <div className="text-[11px] text-gray-400">{currentUser.role}</div>}
                </div>
              </div>
              <button
                onClick={() => { logout(); setMoreOpen(false); }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-300 text-sm font-medium active:bg-red-600/40 flex-shrink-0"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}

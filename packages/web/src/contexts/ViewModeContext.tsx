import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ViewMode = 'graph' | 'dashboard' | 'table' | 'cards' | 'kanban' | 'gantt' | 'calendar' | 'activity';

interface ViewModeContextType {
  viewMode: ViewMode;
  setViewMode: (m: ViewMode) => void;
}

const ViewModeContext = createContext<ViewModeContextType | undefined>(undefined);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'graph';
    const saved = window.localStorage.getItem('graphdone:viewMode');
    if (saved) return saved as ViewMode;
    // Phones land on the readable card list, not the graph.
    return window.matchMedia('(max-width: 767px)').matches ? 'cards' : 'graph';
  });

  useEffect(() => {
    try { window.localStorage.setItem('graphdone:viewMode', viewMode); } catch { /* private mode */ }
  }, [viewMode]);

  return (
    <ViewModeContext.Provider value={{ viewMode, setViewMode }}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within a ViewModeProvider');
  return ctx;
}

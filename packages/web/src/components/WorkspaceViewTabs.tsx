import { useState } from 'react';
import {
  Activity,
  CalendarDays,
  Columns,
  CreditCard,
  GanttChartSquare,
  LayoutDashboard,
  Network,
  Table,
} from 'lucide-react';
import type { ViewMode } from '../contexts/ViewModeContext';

const views = [
  { id: 'graph', name: 'Graph', icon: Network },
  { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard },
  { id: 'table', name: 'Table', icon: Table },
  { id: 'cards', name: 'Card', icon: CreditCard },
  { id: 'kanban', name: 'Kanban', icon: Columns },
  { id: 'gantt', name: 'Gantt', icon: GanttChartSquare },
  { id: 'calendar', name: 'Calendar', icon: CalendarDays },
  { id: 'activity', name: 'Activity', icon: Activity },
] as const;

export function WorkspaceViewTabs({
  value,
  onChange,
}: {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
}) {
  const [tooltip, setTooltip] = useState<ViewMode | null>(null);
  return (
    <div
      className="workspace-view-switcher"
      role="group"
      aria-label="Workspace views"
    >
      {views.map(({ id, name, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className="workspace-view-tab"
          aria-label={name}
          aria-pressed={value === id}
          aria-describedby={tooltip === id ? `workspace-view-${id}` : undefined}
          onClick={() => onChange(id)}
          onMouseEnter={() => setTooltip(id)}
          onMouseLeave={event => {
            if (document.activeElement !== event.currentTarget)
              setTooltip(null);
          }}
          onFocus={() => setTooltip(id)}
          onBlur={() => setTooltip(null)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setTooltip(null);
            }
          }}
        >
          <Icon aria-hidden="true" strokeWidth={2.25} />
          {tooltip === id && (
            <span
              role="tooltip"
              id={`workspace-view-${id}`}
              className="workspace-view-tooltip"
            >
              {name}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

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
  const [hovered, setHovered] = useState<ViewMode | null>(null);
  const [focused, setFocused] = useState<ViewMode | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const tooltip = dismissed ? null : (hovered ?? focused);
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
          onMouseEnter={() => {
            setHovered(id);
            setDismissed(false);
          }}
          onMouseLeave={() => setHovered(null)}
          onFocus={() => {
            setFocused(id);
            setHovered(null);
            setDismissed(false);
          }}
          onBlur={() => setFocused(null)}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setDismissed(true);
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

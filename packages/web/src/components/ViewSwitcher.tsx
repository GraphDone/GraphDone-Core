import React from 'react';
import { 
  BarChart3, 
  Table, 
  Grid3X3, 
  Kanban,
  Calendar
} from 'lucide-react';

export type ViewType = 'dashboard' | 'table' | 'cards' | 'kanban' | 'timeline';

interface ViewSwitcherProps {
  currentView: ViewType;
  onViewChange: (view: ViewType) => void;
  className?: string;
}

const viewOptions = [
  {
    id: 'dashboard' as const,
    name: 'Dashboard',
    icon: BarChart3,
    description: 'Analytics and overview'
  },
  {
    id: 'table' as const,
    name: 'Table',
    icon: Table,
    description: 'Detailed list view'
  },
  {
    id: 'cards' as const,
    name: 'Cards',
    icon: Grid3X3,
    description: 'Card-based layout'
  },
  {
    id: 'kanban' as const,
    name: 'Kanban',
    icon: Kanban,
    description: 'Board view by status'
  },
  {
    id: 'timeline' as const,
    name: 'Timeline',
    icon: Calendar,
    description: 'Chronological view'
  }
];

const ViewSwitcher: React.FC<ViewSwitcherProps> = ({ currentView, onViewChange, className = '' }) => {
  return (
    <div className={`flex bg-gray-700 rounded-lg p-1 ${className}`}>
      {viewOptions.map((option) => {
        const Icon = option.icon;
        const isActive = currentView === option.id;
        
        return (
          <button
            key={option.id}
            onClick={() => onViewChange(option.id)}
            className={`
              group relative flex items-center px-3 py-2 text-sm font-medium rounded-md transition-all duration-200
              ${isActive 
                ? 'bg-green-600 text-white shadow-md' 
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
              }
            `}
            title={option.description}
          >
            <Icon className={`h-4 w-4 mr-2 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`} />
            <span className="hidden sm:inline">{option.name}</span>
            
            {/* Tooltip for mobile */}
            <div className={`
              absolute -top-10 left-1/2 transform -translate-x-1/2 px-2 py-1 
              bg-gray-900 text-white text-xs rounded shadow-lg
              opacity-0 group-hover:opacity-100 transition-opacity duration-200
              pointer-events-none whitespace-nowrap z-10 sm:hidden
            `}>
              {option.name}
            </div>
          </button>
        );
      })}
    </div>
  );
};

export default ViewSwitcher;
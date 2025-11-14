import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORK_ITEM_TYPES } from '../constants/workItemConstants';

interface NodeType {
  value: string;
  label: string;
  description: string;
  emoji: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

interface WorkItemTypeSelectorProps {
  selectedType?: string;
  onTypeChange: (type: string) => void;
  placeholder?: string;
  className?: string;
}

// Convert centralized constants to NodeType format preserving enhanced styling
const nodeTypes: NodeType[] = Object.values(WORK_ITEM_TYPES).map(typeConfig => {
  const IconComponent = typeConfig.icon;
  return {
    value: typeConfig.value,
    label: typeConfig.label,
    description: typeConfig.description || '',
    emoji: '',
    icon: IconComponent ? <IconComponent className="h-4 w-4" /> : <div className="h-4 w-4" />,
    color: typeConfig.color,
    bgColor: `bg-${typeConfig.color.replace('text-', '')}-50 dark:bg-${typeConfig.color.replace('text-', '')}-900/20`,
    borderColor: `border-${typeConfig.color.replace('text-', '')}-200 dark:border-${typeConfig.color.replace('text-', '')}-700`
  };
});

export function WorkItemTypeSelector({
  selectedType = '',
  onTypeChange,
  placeholder = 'Select work item type',
  className = ''
}: WorkItemTypeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTypeSelect = (nodeType: NodeType) => {
    onTypeChange(nodeType.value);
    setIsOpen(false);
  };

  const selectedNodeType = nodeTypes.find(type => type.value === selectedType);

  return (
    <div className={className}>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-gray-800 border-2 border-gray-600 rounded-lg text-white transition-all duration-200 focus:!border-green-400 focus:outline-none text-sm"
        >
          <div className="flex items-center space-x-2">
            {selectedNodeType ? (
              <>
                <div className={`${selectedNodeType.color} text-base`}>
                  {selectedNodeType.icon}
                </div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100 text-xs">{selectedNodeType.label}</span>
                  <div className="text-[10px] text-gray-600 dark:text-gray-300">{selectedNodeType.description}</div>
                </div>
              </>
            ) : (
              <span className="text-gray-600 dark:text-gray-300 font-medium text-xs">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-400 transition-all duration-200 ${isOpen ? 'rotate-180 text-green-500' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-full bg-gray-800/95 backdrop-blur-xl rounded-xl border border-gray-600/30 shadow-2xl z-50 max-h-80 overflow-y-auto">
            <div className="p-2">
              {nodeTypes.map((nodeType, index) => (
                <button
                  key={nodeType.value}
                  type="button"
                  onClick={() => handleTypeSelect(nodeType)}
                  className={`w-full px-3 py-2.5 text-left transition-all duration-200 rounded-lg group ${
                    selectedType === nodeType.value
                      ? 'bg-gradient-to-r from-emerald-500/20 to-green-500/20 border-2 border-emerald-400/50 shadow-lg shadow-emerald-500/10'
                      : 'hover:bg-gray-700/50 border-2 border-transparent hover:border-gray-600/50'
                  } ${index !== 0 ? 'mt-1' : ''}`}
                >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className={`${nodeType.color} text-base transition-transform group-hover:scale-110`}>
                      {nodeType.icon}
                    </div>
                    <div>
                      <div className={`font-semibold text-xs ${
                        selectedType === nodeType.value
                          ? 'text-emerald-400'
                          : 'text-gray-100'
                      }`}>{nodeType.label}</div>
                      <div className={`text-[10px] mt-0.5 ${
                        selectedType === nodeType.value
                          ? 'text-emerald-300'
                          : 'text-gray-400'
                      }`}>
                        {nodeType.description}
                      </div>
                    </div>
                  </div>
                  {selectedType === nodeType.value && (
                    <div className="w-5 h-5 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center text-[10px] ml-1 flex-shrink-0 shadow-lg shadow-emerald-500/30 animate-in zoom-in duration-200">
                      ✓
                    </div>
                  )}
                </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Layers, Sparkles, ListTodo, AlertTriangle, Trophy, Target, Lightbulb, Microscope } from 'lucide-react';

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

interface NodeTypeSelectorProps {
  selectedType?: string;
  onTypeChange: (type: string) => void;
  placeholder?: string;
  className?: string;
}

const nodeTypes: NodeType[] = [
  // Strategic Level
  { 
    value: 'EPIC', 
    label: 'Epic', 
    description: 'Large initiative spanning multiple deliverables', 
    emoji: '🎯',
    icon: <Layers className="h-6 w-6" />,
    color: 'text-fuchsia-400',
    bgColor: 'bg-fuchsia-50 dark:bg-fuchsia-900/20',
    borderColor: 'border-fuchsia-200 dark:border-fuchsia-700'
  },
  { 
    value: 'MILESTONE', 
    label: 'Milestone', 
    description: 'Key project checkpoint', 
    emoji: '🏁',
    icon: <Trophy className="h-6 w-6" />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-900/20',
    borderColor: 'border-orange-200 dark:border-orange-700'
  },
  { 
    value: 'OUTCOME', 
    label: 'Outcome', 
    description: 'Expected result or deliverable', 
    emoji: '',
    icon: <Target className="h-6 w-6" />,
    color: 'text-indigo-400',
    bgColor: 'bg-indigo-50 dark:bg-indigo-900/20',
    borderColor: 'border-indigo-200 dark:border-indigo-700'
  },
  
  // Development Work
  { 
    value: 'FEATURE', 
    label: 'Feature', 
    description: 'New functionality or capability', 
    emoji: '⚡',
    icon: <Sparkles className="h-6 w-6" />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-50 dark:bg-sky-900/20',
    borderColor: 'border-sky-200 dark:border-sky-700'
  },
  { 
    value: 'TASK', 
    label: 'Task', 
    description: 'Specific work item to be completed', 
    emoji: '📝',
    icon: <ListTodo className="h-6 w-6" />,
    color: 'text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-900/20',
    borderColor: 'border-green-200 dark:border-green-700'
  },
  { 
    value: 'BUG', 
    label: 'Bug', 
    description: 'Software defect requiring resolution', 
    emoji: '🐛',
    icon: <AlertTriangle className="h-6 w-6" />,
    color: 'text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-900/20',
    borderColor: 'border-red-200 dark:border-red-700'
  },
  
  // Planning & Discovery
  { 
    value: 'IDEA', 
    label: 'Idea', 
    description: 'Concept or proposal for future development', 
    emoji: '',
    icon: <Lightbulb className="h-6 w-6" />,
    color: 'text-yellow-300',
    bgColor: 'bg-yellow-50 dark:bg-yellow-900/20',
    borderColor: 'border-yellow-200 dark:border-yellow-700'
  },
  { 
    value: 'RESEARCH', 
    label: 'Research', 
    description: 'Investigation or analysis work', 
    emoji: '',
    icon: <Microscope className="h-6 w-6" />,
    color: 'text-teal-400',
    bgColor: 'bg-teal-50 dark:bg-teal-900/20',
    borderColor: 'border-teal-200 dark:border-teal-700'
  }
];

export function NodeTypeSelector({
  selectedType = '',
  onTypeChange,
  placeholder = 'Select node type',
  className = ''
}: NodeTypeSelectorProps) {
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
          className="w-full flex items-center justify-between px-4 py-3.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm"
        >
          <div className="flex items-center space-x-3">
            {selectedNodeType ? (
              <>
                <div className={`${selectedNodeType.color} text-lg`}>
                  {selectedNodeType.icon}
                </div>
                <div>
                  <span className="font-semibold text-gray-900 dark:text-gray-100">{selectedNodeType.label}</span>
                  <div className="text-xs text-gray-600 dark:text-gray-300">{selectedNodeType.description}</div>
                </div>
              </>
            ) : (
              <span className="text-gray-600 dark:text-gray-300 font-medium">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-all duration-200 ${isOpen ? 'rotate-180 text-blue-500' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl z-50 max-h-80 overflow-y-auto backdrop-blur-sm">
            <div className="p-2">
              {nodeTypes.map((nodeType, index) => (
                <button
                  key={nodeType.value}
                  type="button"
                  onClick={() => handleTypeSelect(nodeType)}
                  className={`w-full px-3 py-3.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 rounded-lg group ${
                    selectedType === nodeType.value 
                      ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-200 dark:ring-blue-700' 
                      : 'hover:shadow-sm'
                  } ${index !== 0 ? 'mt-1' : ''}`}
                >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className={`${nodeType.color} text-lg`}>
                      {nodeType.icon}
                    </div>
                    <div>
                      <div className={`font-semibold ${
                        selectedType === nodeType.value 
                          ? 'text-blue-700 dark:text-blue-300' 
                          : 'text-gray-900 dark:text-gray-100'
                      }`}>{nodeType.label}</div>
                      <div className={`text-xs mt-1 ${
                        selectedType === nodeType.value 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-600 dark:text-gray-300'
                      }`}>
                        {nodeType.description}
                      </div>
                    </div>
                  </div>
                  {selectedType === nodeType.value && (
                    <div className="w-5 h-5 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs ml-2 flex-shrink-0 shadow-sm">
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
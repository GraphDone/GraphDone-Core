import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface NodeCategory {
  emoji: string;
  types: Array<{
    value: string;
    label: string;
    description: string;
  }>;
}

interface NodeCategorySelectorProps {
  selectedCategory?: string;
  selectedType?: string;
  onCategoryChange: (category: string) => void;
  onTypeChange: (type: string) => void;
  showTypeSelection?: boolean;
  placeholder?: string;
  className?: string;
}

const nodeCategories: Record<string, NodeCategory> = {
  'Strategic Planning': {
    emoji: '🎯',
    types: [
      { value: 'EPIC', label: 'Epic', description: 'Large initiative spanning multiple deliverables' },
      { value: 'PROJECT', label: 'Project', description: 'Temporary endeavor with specific deliverables' },
      { value: 'MILESTONE', label: 'Milestone', description: 'Key project checkpoint' },
      { value: 'GOAL', label: 'Goal', description: 'Target outcome or achievement' }
    ]
  },
  'Development Work': {
    emoji: '⚡',
    types: [
      { value: 'STORY', label: 'Story', description: 'General work item or requirement' },
      { value: 'FEATURE', label: 'Feature', description: 'New functionality or capability' },
      { value: 'TASK', label: 'Task', description: 'Specific work item to be completed' },
      { value: 'RESEARCH', label: 'Research', description: 'Information gathering and analysis' }
    ]
  },
  'Quality & Issues': {
    emoji: '🔍',
    types: [
      { value: 'BUG', label: 'Bug', description: 'Software defect requiring resolution' },
      { value: 'ISSUE', label: 'Issue', description: 'General problem or concern' },
      { value: 'HOTFIX', label: 'Hotfix', description: 'Urgent fix for critical issue' }
    ]
  },
  'Operations & Maintenance': {
    emoji: '🔧',
    types: [
      { value: 'MAINTENANCE', label: 'Maintenance', description: 'System upkeep and care' },
      { value: 'DEPLOYMENT', label: 'Deployment', description: 'Software release or rollout' },
      { value: 'MONITORING', label: 'Monitoring', description: 'System observation and alerting' }
    ]
  },
  'Documentation': {
    emoji: '📋',
    types: [
      { value: 'DOCUMENTATION', label: 'Documentation', description: 'Technical or process documentation' },
      { value: 'SPECIFICATION', label: 'Specification', description: 'Detailed requirements document' },
      { value: 'GUIDE', label: 'Guide', description: 'How-to or instructional content' }
    ]
  },
  'Testing & Validation': {
    emoji: '✅',
    types: [
      { value: 'TEST', label: 'Test', description: 'General testing activity' },
      { value: 'REVIEW', label: 'Review', description: 'General review activity' },
      { value: 'QA', label: 'QA', description: 'Quality assurance activity' }
    ]
  },
  'Business & Sales': {
    emoji: '💼',
    types: [
      { value: 'LEAD', label: 'Lead', description: 'Potential customer or prospect' },
      { value: 'OPPORTUNITY', label: 'Opportunity', description: 'Sales opportunity or deal' },
      { value: 'CONTRACT', label: 'Contract', description: 'Legal agreement or proposal' }
    ]
  },
  'Creative & Design': {
    emoji: '🎨',
    types: [
      { value: 'MOCKUP', label: 'Mockup', description: 'Visual design representation' },
      { value: 'PROTOTYPE', label: 'Prototype', description: 'Working model or proof of concept' },
      { value: 'UI_DESIGN', label: 'UI Design', description: 'User interface design work' }
    ]
  },
  'Support & Training': {
    emoji: '🎓',
    types: [
      { value: 'SUPPORT', label: 'Support', description: 'Customer or user assistance' },
      { value: 'TRAINING', label: 'Training', description: 'Learning and development activity' }
    ]
  },
  'Other': {
    emoji: '🔧',
    types: [
      { value: 'NOTE', label: 'Note', description: 'General note or observation' },
      { value: 'ACTION_ITEM', label: 'Action Item', description: 'Specific action to be taken' },
      { value: 'DECISION', label: 'Decision', description: 'Choice or determination to be made' }
    ]
  }
};

export function NodeCategorySelector({
  selectedCategory = '',
  selectedType = '',
  onCategoryChange,
  onTypeChange,
  showTypeSelection = false,
  placeholder = 'Select category...',
  className = ''
}: NodeCategorySelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const typeDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target as Node)) {
        setIsTypeDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCategorySelect = (categoryName: string) => {
    onCategoryChange(categoryName);
    setIsOpen(false);
    
    // Reset type selection when category changes
    if (selectedType && showTypeSelection) {
      onTypeChange('');
    }
    
    // Auto-open type dropdown popup after category selection
    if (showTypeSelection && categoryName) {
      setTimeout(() => setIsTypeDropdownOpen(true), 100);
    }
  };

  const handleTypeSelect = (typeValue: string) => {
    onTypeChange(typeValue);
    setIsTypeDropdownOpen(false);
  };

  const selectedCategoryData = selectedCategory ? nodeCategories[selectedCategory] : null;
  const selectedTypeData = selectedCategoryData?.types.find(t => t.value === selectedType);

  return (
    <div className={className}>
      {/* Single Selector Box */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors min-h-[60px]"
        >
          <div className="flex items-center space-x-2">
            {selectedCategory ? (
              <>
                <span className="text-lg">{nodeCategories[selectedCategory].emoji}</span>
                <span className="font-medium">{selectedCategory}</span>
              </>
            ) : (
              <span className="text-gray-500 dark:text-gray-400">{placeholder}</span>
            )}
          </div>
          <ChevronDown className={`h-5 w-5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-2 w-full bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl z-50 max-h-80 overflow-y-auto">
            {/* Clear Selection Option */}
            {selectedCategory && (
              <button
                type="button"
                onClick={() => handleCategorySelect('')}
                className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-b border-gray-200 dark:border-gray-600"
              >
                <div className="flex items-center space-x-2">
                  <X className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600 dark:text-gray-300">Clear selection</span>
                </div>
              </button>
            )}

            {/* Category Options */}
            {Object.entries(nodeCategories).map(([categoryName, category]) => (
              <button
                key={categoryName}
                type="button"
                onClick={() => handleCategorySelect(categoryName)}
                className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors ${
                  selectedCategory === categoryName 
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                    : 'text-gray-700 dark:text-gray-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{category.emoji}</span>
                  <div>
                    <div className="font-medium">{categoryName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {category.types.length} types available
                    </div>
                  </div>
                  {selectedCategory === categoryName && (
                    <div className="ml-auto w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs">
                      ✓
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Type Popup - Hidden until category selected */}
        {showTypeSelection && selectedCategory && (
          <div className="relative" ref={typeDropdownRef}>
            {isTypeDropdownOpen && (
              <>
                {/* Backdrop */}
                <div className="fixed inset-0 bg-black bg-opacity-25 z-40" onClick={() => setIsTypeDropdownOpen(false)}></div>
                
                {/* Popup positioned to the right */}
                <div className="absolute top-0 left-full ml-2 w-80 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-2xl z-50 max-h-96 overflow-y-auto">
                  {/* Header */}
                  <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                    <div className="flex items-center space-x-2">
                      <span className="text-lg">{selectedCategoryData?.emoji}</span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{selectedCategory}</span>
                    </div>
                  </div>

                  {/* Clear Selection Option */}
                  {selectedType && (
                    <button
                      type="button"
                      onClick={() => handleTypeSelect('')}
                      className="w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-b border-gray-200 dark:border-gray-600"
                    >
                      <div className="flex items-center space-x-2">
                        <X className="h-4 w-4 text-gray-400" />
                        <span className="text-gray-600 dark:text-gray-300">Clear selection</span>
                      </div>
                    </button>
                  )}

                  {/* Type Options */}
                  {selectedCategoryData?.types.map((nodeType) => (
                    <button
                      key={nodeType.value}
                      type="button"
                      onClick={() => handleTypeSelect(nodeType.value)}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
                        selectedType === nodeType.value 
                          ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{nodeType.label}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {nodeType.description}
                          </div>
                        </div>
                        {selectedType === nodeType.value && (
                          <div className="w-4 h-4 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs ml-2 flex-shrink-0">
                            ✓
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Selected Type Description - Below both dropdowns */}
      {selectedType && selectedTypeData && (
        <div className="mt-3 p-3 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200 dark:border-green-700 rounded-lg">
          <div className="flex items-start space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5 flex-shrink-0"></div>
            <div>
              <div className="text-sm font-medium text-green-800 dark:text-green-200">
                {selectedTypeData.label}
              </div>
              <div className="text-xs text-green-700 dark:text-green-300 mt-1">
                {selectedTypeData.description}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  description?: string;
}

interface CustomDropdownProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  showCheck?: boolean;
}

export function CustomDropdown({
  options,
  value,
  onChange,
  placeholder = "Select an option",
  className = "",
  disabled = false,
  showCheck = true
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(option => option.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          relative w-full px-4 py-2.5 text-left bg-gray-700 border border-gray-600 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent
          transition-colors duration-200
          ${disabled 
            ? 'opacity-50 cursor-not-allowed text-gray-500' 
            : 'text-gray-100 hover:bg-gray-600 cursor-pointer'
          }
        `}
      >
        <span className="block truncate">
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
          <ChevronDown 
            className={`h-4 w-4 text-gray-400 transition-transform duration-200 ${
              isOpen ? 'transform rotate-180' : ''
            }`} 
          />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-gray-700 border border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => handleSelect(option.value)}
              className={`
                relative w-full px-4 py-3 text-left hover:bg-gray-600 focus:outline-none focus:bg-gray-600
                transition-colors duration-150
                ${value === option.value ? 'bg-gray-600' : ''}
              `}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-100 truncate">
                    {option.label}
                  </div>
                  {option.description && (
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {option.description}
                    </div>
                  )}
                </div>
                {showCheck && value === option.value && (
                  <Check className="h-4 w-4 text-green-400 ml-2 flex-shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
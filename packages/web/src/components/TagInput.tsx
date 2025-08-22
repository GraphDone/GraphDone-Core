import React, { useState, KeyboardEvent } from 'react';
import { X, Plus, Tag } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
  disabled?: boolean;
}

export function TagInput({ 
  tags, 
  onChange, 
  placeholder = "Type and press comma to add tags", 
  maxTags = 5,
  disabled = false 
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);

  // High contrast color schemes for better visibility
  const tagColors = [
    { bg: 'bg-blue-500 dark:bg-blue-600', border: 'border-blue-600 dark:border-blue-500', text: 'text-white' },
    { bg: 'bg-green-500 dark:bg-green-600', border: 'border-green-600 dark:border-green-500', text: 'text-white' },
    { bg: 'bg-purple-500 dark:bg-purple-600', border: 'border-purple-600 dark:border-purple-500', text: 'text-white' },
    { bg: 'bg-orange-500 dark:bg-orange-600', border: 'border-orange-600 dark:border-orange-500', text: 'text-white' },
    { bg: 'bg-pink-500 dark:bg-pink-600', border: 'border-pink-600 dark:border-pink-500', text: 'text-white' },
  ];

  const getTagColor = (index: number) => {
    return tagColors[index % tagColors.length];
  };

  const addTags = (input: string) => {
    // Split by comma and process multiple tags
    const newTags = input.split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0 && tag.length <= 30);
    
    const uniqueNewTags = newTags.filter(tag => !tags.includes(tag));
    const availableSlots = maxTags - tags.length;
    const tagsToAdd = uniqueNewTags.slice(0, availableSlots);
    
    if (tagsToAdd.length > 0) {
      onChange([...tags, ...tagsToAdd]);
      setInputValue('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      e.preventDefault();
      addTags(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag if input is empty and backspace is pressed
      removeTag(tags[tags.length - 1]);
    } else if (e.key === 'Escape') {
      setInputValue('');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Auto-add tags when comma is typed
    if (value.includes(',')) {
      addTags(value);
    }
  };

  const handleAddClick = () => {
    if (inputValue.trim()) {
      addTags(inputValue);
    }
  };

  return (
    <div className="space-y-2">
      <div className={`
        min-h-[42px] border rounded-lg p-2 flex flex-wrap gap-1.5 items-center
        ${isInputFocused ? 'ring-2 ring-blue-500 border-blue-500' : 'border-gray-300 dark:border-gray-600'}
        ${disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed' : 'bg-white dark:bg-gray-800'}
        transition-all duration-200
      `}>
        {/* Existing tags */}
        {tags.map((tag, index) => {
          const color = getTagColor(index);
          return (
            <span
              key={index}
              className={`inline-flex items-center space-x-1 ${color.bg} ${color.text} text-xs font-medium px-2.5 py-1 rounded-full border ${color.border}`}
            >
              <Tag className="h-3 w-3" />
              <span>{tag}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:bg-white/20 rounded-full p-0.5 transition-colors"
                  title={`Remove ${tag}`}
                >
                  <X className="h-3 w-3 text-white" />
                </button>
              )}
            </span>
          );
        })}

        {/* Input field */}
        {!disabled && tags.length < maxTags && (
          <div className="flex items-center flex-1 min-w-[120px]">
            <input
              type="text"
              value={inputValue}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsInputFocused(true)}
              onBlur={() => setIsInputFocused(false)}
              placeholder={tags.length === 0 ? placeholder : "Continue typing..."}
              className="flex-1 outline-none bg-transparent text-gray-900 dark:text-white text-sm min-w-0"
              maxLength={100}
            />
            {inputValue.trim() && (
              <button
                type="button"
                onClick={handleAddClick}
                className="ml-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                title="Add tag"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Helper text */}
      <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
        <span>
          Use comma (,) to separate multiple tags
        </span>
        <span>
          {tags.length} of {maxTags}
        </span>
      </div>
    </div>
  );
}
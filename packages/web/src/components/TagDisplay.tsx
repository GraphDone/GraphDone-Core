import { Tag } from 'lucide-react';

interface TagDisplayProps {
  tags?: string[] | null;
  className?: string;
  compact?: boolean;
}

export function TagDisplay({ tags, className = '', compact = false }: TagDisplayProps) {
  if (!tags || tags.length === 0) return null;

  // Same color scheme as TagInput for consistency
  const tagColors = [
    { bg: 'bg-blue-500 dark:bg-blue-600', text: 'text-white' },
    { bg: 'bg-green-500 dark:bg-green-600', text: 'text-white' },
    { bg: 'bg-purple-500 dark:bg-purple-600', text: 'text-white' },
    { bg: 'bg-orange-500 dark:bg-orange-600', text: 'text-white' },
    { bg: 'bg-pink-500 dark:bg-pink-600', text: 'text-white' },
  ];

  const getTagColor = (index: number) => {
    return tagColors[index % tagColors.length];
  };

  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {tags.map((tag, index) => {
        const color = getTagColor(index);
        return (
          <span
            key={index}
            className={`inline-flex items-center ${color.bg} ${color.text} ${
              compact ? 'text-xs px-2 py-0.5' : 'text-xs px-2.5 py-1'
            } rounded-full font-medium`}
          >
            {!compact && <Tag className="h-3 w-3 mr-1" />}
            <span>{tag}</span>
          </span>
        );
      })}
    </div>
  );
}
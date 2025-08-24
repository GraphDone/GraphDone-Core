import React, { useState, useEffect } from 'react';

interface AnimatedPriorityProps {
  value: number; // Priority value between 0 and 1
  className?: string;
  duration?: number; // Animation duration in milliseconds (default: 3000)
  style?: React.CSSProperties;
  renderBar?: (animatedValue: number, animatedColor: string) => React.ReactNode;
}

export function AnimatedPriority({ value, className = '', duration = 3000, style, renderBar }: AnimatedPriorityProps) {
  const [displayValue, setDisplayValue] = useState(value);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (Math.abs(displayValue - value) < 0.01) return; // Skip if difference is tiny
    
    setIsAnimating(true);
    const startValue = displayValue;
    const endValue = value;
    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Use easeInOutCubic for smooth animation
      const easeInOutCubic = (t: number): number => {
        return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      };
      
      const easedProgress = easeInOutCubic(progress);
      const currentValue = startValue + (endValue - startValue) * easedProgress;
      
      setDisplayValue(currentValue);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(endValue);
        setIsAnimating(false);
      }
    };
    
    requestAnimationFrame(animate);
  }, [value, duration]);

  const percentage = Math.round(displayValue * 100);
  
  // Smooth color interpolation helper
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
      parseInt(result[1], 16),
      parseInt(result[2], 16),
      parseInt(result[3], 16)
    ] : [0, 0, 0];
  };

  const interpolateColor = (color1: [number, number, number], color2: [number, number, number], factor: number): string => {
    const r = Math.round(color1[0] + factor * (color2[0] - color1[0]));
    const g = Math.round(color1[1] + factor * (color2[1] - color1[1]));
    const b = Math.round(color1[2] + factor * (color2[2] - color1[2]));
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getAnimatedColor = (val: number): string => {
    // Define color stops: green -> blue -> yellow -> orange -> red
    const colors = [
      { threshold: 0.0, color: '#22c55e' }, // green-500
      { threshold: 0.2, color: '#3b82f6' }, // blue-500  
      { threshold: 0.4, color: '#eab308' }, // yellow-500
      { threshold: 0.6, color: '#f97316' }, // orange-500
      { threshold: 0.8, color: '#ef4444' }  // red-500
    ];

    // Find the two colors to interpolate between
    for (let i = 0; i < colors.length - 1; i++) {
      if (val >= colors[i].threshold && val <= colors[i + 1].threshold) {
        const factor = (val - colors[i].threshold) / (colors[i + 1].threshold - colors[i].threshold);
        const color1 = hexToRgb(colors[i].color);
        const color2 = hexToRgb(colors[i + 1].color);
        return interpolateColor(color1, color2, factor);
      }
    }

    // Handle edge cases
    if (val <= 0.0) return colors[0].color;
    return colors[colors.length - 1].color;
  };

  const getAnimatedTextColor = (val: number): string => {
    // Use the same interpolation for text colors but return as inline style
    return getAnimatedColor(val);
  };

  const animatedColor = getAnimatedColor(displayValue);
  const animatedTextColor = getAnimatedTextColor(displayValue);
  
  // Remove any existing color classes from className and use inline style
  const baseClassName = className.replace(/text-(?:red|orange|yellow|blue|green)-\d+/g, '');
  
  // Merge style with animated color
  const finalStyle = {
    ...style,
    color: animatedTextColor
  };
  
  if (renderBar) {
    return (
      <div className="flex items-center space-x-3">
        {renderBar(displayValue, animatedColor)}
        <div className="flex flex-col">
          <span className={baseClassName} style={finalStyle}>
            {percentage}%
          </span>
        </div>
      </div>
    );
  }
  
  return (
    <span className={baseClassName} style={finalStyle}>
      {percentage}%
    </span>
  );
}
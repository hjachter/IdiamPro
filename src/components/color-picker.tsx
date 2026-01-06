'use client';

import React from 'react';
import type { NodeColor } from '@/types';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ColorPickerProps {
  value?: NodeColor;
  onChange: (color: NodeColor | undefined) => void;
}

const COLORS: Array<{ value: NodeColor; label: string; cssVar: string }> = [
  { value: 'default', label: 'Default', cssVar: '' },
  { value: 'red', label: 'Red', cssVar: '--node-red' },
  { value: 'orange', label: 'Orange', cssVar: '--node-orange' },
  { value: 'yellow', label: 'Yellow', cssVar: '--node-yellow' },
  { value: 'green', label: 'Green', cssVar: '--node-green' },
  { value: 'blue', label: 'Blue', cssVar: '--node-blue' },
  { value: 'purple', label: 'Purple', cssVar: '--node-purple' },
  { value: 'pink', label: 'Pink', cssVar: '--node-pink' },
];

export function ColorPicker({ value = 'default', onChange }: ColorPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-2 p-2">
      {COLORS.map((color) => (
        <button
          key={color.value}
          onClick={() => {
            onChange(color.value === 'default' ? undefined : color.value);
          }}
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-md border-2 transition-all hover:scale-110',
            value === color.value ? 'border-primary' : 'border-transparent'
          )}
          style={{
            backgroundColor: color.cssVar ? `hsl(var(${color.cssVar}))` : 'transparent',
          }}
          title={color.label}
        >
          {value === color.value && (
            <Check className="h-4 w-4 text-white drop-shadow-md" />
          )}
        </button>
      ))}
    </div>
  );
}

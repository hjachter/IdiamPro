'use client';

import React from 'react';
import {
  FileText,
  Folder,
  FolderOpen,
  Home,
  Image as ImageIcon,
  Video,
  AudioWaveform,
  FileSpreadsheet,
  Database,
  AppWindow,
  StickyNote,
  FileJson,
  Youtube,
  Map,
  Brush,
  type LucideProps,
} from 'lucide-react';
import type { NodeType } from '@/types';
import { cn } from '@/lib/utils';

interface NodeIconProps extends LucideProps {
  type: NodeType;
  isChapter?: boolean;
  isCollapsed?: boolean;
}

// Color classes for different node types (Apple HIG-inspired)
const typeColorMap: Partial<Record<NodeType, string>> = {
  root: 'text-[hsl(var(--primary))]',
  chapter: 'text-[hsl(var(--node-chapter))]',
  document: 'text-muted-foreground',
  image: 'text-[hsl(var(--success))]',
  video: 'text-[hsl(var(--node-media))]',
  audio: 'text-[hsl(var(--warning))]',
  youtube: 'text-red-500',
  pdf: 'text-red-600 dark:text-red-400',
  spreadsheet: 'text-[hsl(var(--success))]',
  database: 'text-[hsl(var(--node-chapter))]',
  note: 'text-[hsl(var(--warning))]',
  map: 'text-[hsl(var(--success))]',
  canvas: 'text-purple-500',
};

const NodeIcon: React.FC<NodeIconProps> = ({ type, isChapter, isCollapsed, className, ...props }) => {
  const colorClass = isChapter
    ? 'text-[hsl(var(--node-chapter))]'
    : typeColorMap[type] || 'text-muted-foreground';

  const iconProps = {
    size: 16,
    className: cn("mx-1 shrink-0 transition-colors", colorClass, className),
    ...props,
  };

  if (isChapter) {
    return isCollapsed ? <Folder {...iconProps} /> : <FolderOpen {...iconProps} />;
  }

  const iconMap: Record<NodeType, React.ElementType> = {
    root: Home,
    chapter: Folder,
    document: FileText,
    image: ImageIcon,
    video: Video,
    audio: AudioWaveform,
    spreadsheet: FileSpreadsheet,
    database: Database,
    app: AppWindow,
    note: StickyNote,
    pdf: FileJson,
    youtube: Youtube,
    map: Map,
    canvas: Brush,
  };

  const Icon = iconMap[type] || FileText;
  return <Icon {...iconProps} />;
};

export default NodeIcon;

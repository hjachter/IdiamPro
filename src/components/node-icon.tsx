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
  IconProps,
} from 'lucide-react';
import type { NodeType } from '@/types';

interface NodeIconProps extends IconProps {
  type: NodeType;
  isChapter?: boolean;
  isCollapsed?: boolean;
}

const NodeIcon: React.FC<NodeIconProps> = ({ type, isChapter, isCollapsed, ...props }) => {
  const iconProps = { size: 16, className: "mx-1 shrink-0", ...props };

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
  };

  const Icon = iconMap[type] || FileText;
  return <Icon {...iconProps} />;
};

export default NodeIcon;

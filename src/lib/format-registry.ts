import {
  FileText,
  FileCode,
  Globe,
  FileSpreadsheet,
  Presentation,
  BookOpen,
  Network,
  MessageSquare,
  File,
  type LucideIcon,
} from 'lucide-react';

export type FormatCategory =
  | 'documents'
  | 'outliners'
  | 'note-apps'
  | 'mind-maps'
  | 'data'
  | 'presentations'
  | 'social';

export interface FormatDefinition {
  id: string;
  name: string;
  description: string;
  category: FormatCategory;
  extensions: string[];
  mimeTypes: string[];
  icon: LucideIcon;
  supportsExport: boolean;
  supportsImport: boolean;
  hasOptions?: boolean;
  platformSupport: {
    electron: boolean;
    capacitor: boolean;
    web: boolean;
  };
}

export const FORMAT_CATEGORY_LABELS: Record<FormatCategory, string> = {
  documents: 'Documents',
  outliners: 'Outliners',
  'note-apps': 'Note Apps',
  'mind-maps': 'Mind Maps',
  data: 'Data',
  presentations: 'Presentations',
  social: 'Social',
};

export const FORMAT_REGISTRY: Record<string, FormatDefinition> = {
  // Documents
  pdf: {
    id: 'pdf',
    name: 'PDF',
    description: 'Portable Document Format',
    category: 'documents',
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    icon: FileText,
    supportsExport: true,
    supportsImport: false, // Import handled separately via AI
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  markdown: {
    id: 'markdown',
    name: 'Markdown',
    description: 'Standard markdown with headings',
    category: 'documents',
    extensions: ['.md', '.markdown'],
    mimeTypes: ['text/markdown', 'text/x-markdown'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: true,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  'plain-text': {
    id: 'plain-text',
    name: 'Plain Text',
    description: 'Indented text structure',
    category: 'documents',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  html: {
    id: 'html',
    name: 'HTML Website',
    description: 'Self-contained webpage with collapsible sections',
    category: 'documents',
    extensions: ['.html', '.htm'],
    mimeTypes: ['text/html'],
    icon: Globe,
    supportsExport: true,
    supportsImport: true,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  docx: {
    id: 'docx',
    name: 'Word',
    description: 'Microsoft Word document',
    category: 'documents',
    extensions: ['.docx'],
    mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  latex: {
    id: 'latex',
    name: 'LaTeX',
    description: 'Academic document format',
    category: 'documents',
    extensions: ['.tex'],
    mimeTypes: ['application/x-latex', 'text/x-latex'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  epub: {
    id: 'epub',
    name: 'ePub',
    description: 'E-book format',
    category: 'documents',
    extensions: ['.epub'],
    mimeTypes: ['application/epub+zip'],
    icon: BookOpen,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  'blog-html': {
    id: 'blog-html',
    name: 'Blog Post',
    description: 'CMS-ready HTML',
    category: 'documents',
    extensions: ['.html'],
    mimeTypes: ['text/html'],
    icon: Globe,
    supportsExport: true,
    supportsImport: false,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  website: {
    id: 'website',
    name: 'Marketing Website',
    description: 'Professional website with hero, sections, and navigation',
    category: 'documents',
    extensions: ['.html'],
    mimeTypes: ['text/html'],
    icon: Globe,
    supportsExport: true,
    supportsImport: false,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },

  // Outliners
  opml: {
    id: 'opml',
    name: 'OPML',
    description: 'Standard outline interchange format',
    category: 'outliners',
    extensions: ['.opml', '.xml'],
    mimeTypes: ['text/x-opml', 'application/xml'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  json: {
    id: 'json',
    name: 'JSON',
    description: 'IdiamPro native format',
    category: 'outliners',
    extensions: ['.idm', '.json'],
    mimeTypes: ['application/json'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  'org-mode': {
    id: 'org-mode',
    name: 'Org-mode',
    description: 'Emacs org-mode format',
    category: 'outliners',
    extensions: ['.org'],
    mimeTypes: ['text/x-org'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  taskpaper: {
    id: 'taskpaper',
    name: 'TaskPaper',
    description: 'Plain text task format',
    category: 'outliners',
    extensions: ['.taskpaper', '.txt'],
    mimeTypes: ['text/plain'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  workflowy: {
    id: 'workflowy',
    name: 'Workflowy',
    description: 'Workflowy/Dynalist export',
    category: 'outliners',
    extensions: ['.opml', '.txt'],
    mimeTypes: ['text/x-opml', 'text/plain'],
    icon: FileText,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  omnioutliner: {
    id: 'omnioutliner',
    name: 'OmniOutliner',
    description: 'OmniOutliner OPML export',
    category: 'outliners',
    extensions: ['.opml'],
    mimeTypes: ['text/x-opml'],
    icon: FileText,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },

  // Note Apps
  obsidian: {
    id: 'obsidian',
    name: 'Obsidian',
    description: 'Markdown with [[wiki-links]]',
    category: 'note-apps',
    extensions: ['.md'],
    mimeTypes: ['text/markdown'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: true,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  notion: {
    id: 'notion',
    name: 'Notion',
    description: 'Notion-compatible export',
    category: 'note-apps',
    extensions: ['.md', '.csv'],
    mimeTypes: ['text/markdown', 'text/csv'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  evernote: {
    id: 'evernote',
    name: 'Evernote',
    description: 'ENEX format',
    category: 'note-apps',
    extensions: ['.enex'],
    mimeTypes: ['application/xml'],
    icon: FileText,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  roam: {
    id: 'roam',
    name: 'Roam Research',
    description: 'Roam JSON export',
    category: 'note-apps',
    extensions: ['.json'],
    mimeTypes: ['application/json'],
    icon: Network,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  logseq: {
    id: 'logseq',
    name: 'Logseq',
    description: 'Logseq markdown pages',
    category: 'note-apps',
    extensions: ['.md'],
    mimeTypes: ['text/markdown'],
    icon: FileCode,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  bear: {
    id: 'bear',
    name: 'Bear',
    description: 'Bear notes export',
    category: 'note-apps',
    extensions: ['.md', '.bear'],
    mimeTypes: ['text/markdown'],
    icon: FileText,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  onenote: {
    id: 'onenote',
    name: 'OneNote',
    description: 'OneNote export',
    category: 'note-apps',
    extensions: ['.one', '.onepkg'],
    mimeTypes: ['application/onenote'],
    icon: FileText,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: false, web: true },
  },

  // Mind Maps
  freemind: {
    id: 'freemind',
    name: 'FreeMind',
    description: 'FreeMind mind map (.mm)',
    category: 'mind-maps',
    extensions: ['.mm'],
    mimeTypes: ['application/x-freemind'],
    icon: Network,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  xmind: {
    id: 'xmind',
    name: 'XMind',
    description: 'XMind mind map',
    category: 'mind-maps',
    extensions: ['.xmind'],
    mimeTypes: ['application/x-xmind'],
    icon: Network,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: false, web: true },
  },

  // Data
  csv: {
    id: 'csv',
    name: 'CSV',
    description: 'Flattened tabular format',
    category: 'data',
    extensions: ['.csv'],
    mimeTypes: ['text/csv'],
    icon: FileSpreadsheet,
    supportsExport: true,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  'json-tree': {
    id: 'json-tree',
    name: 'JSON Tree',
    description: 'Hierarchical JSON structure',
    category: 'data',
    extensions: ['.json'],
    mimeTypes: ['application/json'],
    icon: FileCode,
    supportsExport: true,
    supportsImport: false,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  xml: {
    id: 'xml',
    name: 'XML',
    description: 'Generic XML structure',
    category: 'data',
    extensions: ['.xml'],
    mimeTypes: ['application/xml', 'text/xml'],
    icon: FileCode,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  yaml: {
    id: 'yaml',
    name: 'YAML',
    description: 'YAML hierarchies',
    category: 'data',
    extensions: ['.yaml', '.yml'],
    mimeTypes: ['application/x-yaml', 'text/yaml'],
    icon: FileCode,
    supportsExport: false,
    supportsImport: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },

  // Presentations
  revealjs: {
    id: 'revealjs',
    name: 'Reveal.js',
    description: 'HTML slide presentation',
    category: 'presentations',
    extensions: ['.html'],
    mimeTypes: ['text/html'],
    icon: Presentation,
    supportsExport: true,
    supportsImport: false,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
  teleprompter: {
    id: 'teleprompter',
    name: 'Teleprompter',
    description: 'Script format for video',
    category: 'presentations',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    icon: FileText,
    supportsExport: true,
    supportsImport: false,
    platformSupport: { electron: true, capacitor: true, web: true },
  },

  // Social
  'twitter-thread': {
    id: 'twitter-thread',
    name: 'Twitter/X Thread',
    description: 'Formatted thread posts',
    category: 'social',
    extensions: ['.txt'],
    mimeTypes: ['text/plain'],
    icon: MessageSquare,
    supportsExport: true,
    supportsImport: false,
    hasOptions: true,
    platformSupport: { electron: true, capacitor: true, web: true },
  },
};

// Helper functions

export function getFormatsByCategory(category: FormatCategory): FormatDefinition[] {
  return Object.values(FORMAT_REGISTRY).filter(f => f.category === category);
}

export function getExportFormats(): FormatDefinition[] {
  return Object.values(FORMAT_REGISTRY).filter(f => f.supportsExport);
}

export function getImportFormats(): FormatDefinition[] {
  return Object.values(FORMAT_REGISTRY).filter(f => f.supportsImport);
}

export function getFormatById(id: string): FormatDefinition | undefined {
  return FORMAT_REGISTRY[id];
}

export function detectFormatFromExtension(extension: string): FormatDefinition | null {
  const ext = extension.toLowerCase().startsWith('.') ? extension.toLowerCase() : `.${extension.toLowerCase()}`;

  for (const format of Object.values(FORMAT_REGISTRY)) {
    if (format.extensions.includes(ext)) {
      return format;
    }
  }
  return null;
}

export function detectFormatFromFile(file: File): FormatDefinition | null {
  // Try extension first
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const byExt = detectFormatFromExtension(ext);
  if (byExt) return byExt;

  // Try MIME type
  for (const format of Object.values(FORMAT_REGISTRY)) {
    if (format.mimeTypes.includes(file.type)) {
      return format;
    }
  }

  return null;
}

export function getFormatCategories(): FormatCategory[] {
  return ['documents', 'outliners', 'note-apps', 'mind-maps', 'data', 'presentations', 'social'];
}

export function getExportFormatsByCategory(): Record<FormatCategory, FormatDefinition[]> {
  const result: Record<FormatCategory, FormatDefinition[]> = {
    documents: [],
    outliners: [],
    'note-apps': [],
    'mind-maps': [],
    data: [],
    presentations: [],
    social: [],
  };

  for (const format of getExportFormats()) {
    result[format.category].push(format);
  }

  return result;
}

export function getImportFormatsByCategory(): Record<FormatCategory, FormatDefinition[]> {
  const result: Record<FormatCategory, FormatDefinition[]> = {
    documents: [],
    outliners: [],
    'note-apps': [],
    'mind-maps': [],
    data: [],
    presentations: [],
    social: [],
  };

  for (const format of getImportFormats()) {
    result[format.category].push(format);
  }

  return result;
}

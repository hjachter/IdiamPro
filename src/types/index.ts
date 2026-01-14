export type NodeType =
  | 'root'
  | 'chapter'
  | 'document'
  | 'note'
  | 'task'
  | 'link'
  | 'code'
  | 'quote'
  | 'date'
  | 'image'
  | 'video'
  | 'audio'
  | 'pdf'
  | 'youtube'
  | 'spreadsheet'
  | 'database'
  | 'app'
  | 'map'
  | 'canvas';

export type NodeColor =
  | 'default'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'blue'
  | 'purple'
  | 'pink';

export interface OutlineNode {
  id: string;
  name: string;
  content: string;
  type: NodeType;
  parentId: string | null;
  childrenIds: string[];
  isCollapsed?: boolean;
  prefix: string;

  // Metadata for enhanced features
  metadata?: {
    tags?: string[];           // Tags for organization
    color?: NodeColor;         // Visual color
    isPinned?: boolean;        // Pin to top
    isCompleted?: boolean;     // For task nodes
    codeLanguage?: string;     // For code nodes
    url?: string;              // For link nodes
    dueDate?: number;          // For date/task nodes (timestamp)
    createdAt?: number;        // Creation timestamp
    updatedAt?: number;        // Last modified timestamp
  };
}

export type NodeMap = Record<string, OutlineNode>;

export interface Outline {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: NodeMap;
  isGuide?: boolean;
  lastModified?: number; // Unix timestamp
}

export interface OutlineTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'work' | 'personal' | 'education' | 'custom';
  outline: Outline;
}

// ============================================
// AI SUBSCRIPTION & FEATURE FLAGS
// ============================================

export type SubscriptionPlan = 'FREE' | 'PREMIUM';

export interface AIFeatureFlags {
  enableAIContentGeneration: boolean;
  enableIngestExternalSource: boolean;
  enableSubtreeSummaries: boolean;      // future
  enableTeachMode: boolean;             // future
  enableConsistencyChecks: boolean;     // future
}

export interface AIConfig {
  plan: SubscriptionPlan;
  features: AIFeatureFlags;
}

// Context for node content generation
export interface NodeGenerationContext {
  nodeId: string;
  nodeName: string;
  ancestorPath: string[];  // Names of ancestors from root to parent
  existingContent: string;
}

// External source types for ingestion
export type ExternalSourceType = 'youtube' | 'pdf' | 'text' | 'web' | 'image' | 'doc' | 'audio' | 'video' | 'outline' | 'recording';

// Re-export recording types
export type {
  RecordingSession,
  TranscriptSegment,
  DiarizedTranscript,
  RecordingResult,
  TranscriptionOptions,
  TranscriptionResult,
} from './recording';

export interface ExternalSourceInput {
  type: ExternalSourceType;
  url?: string;
  content?: string;  // For direct text input or base64 file data
  fileName?: string;
  mimeType?: string; // For file uploads to determine processing method
}

// Preview structure for ingest operations
export interface IngestPreviewNode {
  name: string;
  parentPath: string;
  content: string;
}

export interface IngestPreviewModification {
  nodeId: string;
  nodeName: string;
  before: string;
  after: string;
}

export interface IngestPreview {
  nodesToAdd: IngestPreviewNode[];
  nodesToModify: IngestPreviewModification[];
  summary: string;
  rawOutlineData?: { rootNodeId: string; nodes: NodeMap };  // For applying changes
}

// Bulk research import (PREMIUM feature)
export interface BulkResearchSources {
  sources: ExternalSourceInput[];
  includeExistingContent: boolean;  // Whether to include current outline content in synthesis
  outlineName?: string;  // Optional name for regenerated outline
}

export interface BulkResearchResult {
  outline: Outline;
  summary: string;
  sourcesProcessed: number;
}

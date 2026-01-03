export type NodeType =
  | 'root'
  | 'chapter'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'spreadsheet'
  | 'database'
  | 'app'
  | 'note'
  | 'pdf'
  | 'youtube'
  | 'map'
  | 'canvas';

export interface OutlineNode {
  id: string;
  name: string;
  content: string;
  type: NodeType;
  parentId: string | null;
  childrenIds: string[];
  isCollapsed?: boolean;
  prefix: string;
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
export type ExternalSourceType = 'youtube' | 'pdf' | 'text';

export interface ExternalSourceInput {
  type: ExternalSourceType;
  url?: string;
  content?: string;  // For direct text input
  fileName?: string;
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

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

// Local AI (Ollama) settings
export type AIProvider = 'cloud' | 'local' | 'auto';

export interface LocalAISettings {
  provider: AIProvider;           // 'cloud' = always use Gemini, 'local' = always use Ollama, 'auto' = fallback to local on rate limit
  preferredModel?: string;        // e.g., 'llama3.2', 'mistral', etc.
  ollamaEndpoint?: string;        // Custom endpoint if not localhost:11434
}

// Context for node content generation
export interface NodeGenerationContext {
  nodeId: string;
  nodeName: string;
  ancestorPath: string[];  // Names of ancestors from root to parent
  existingContent: string;
  customPrompt?: string;  // Optional custom prompt for user-directed generation
  includeDiagram?: boolean;  // Whether to include Mermaid diagrams in generated content
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

// Merge strategy for combining multiple sources
export type MergeStrategy =
  | 'synthesize'      // Deep merge - find connections, combine related content (default)
  | 'separate'        // Keep each source as distinct section (unrelated topics)
  | 'architecture';   // Product architecture - intro describing relationships + separate sections

// Detail level for extraction - controls depth and granularity
export type ExtractionDetailLevel =
  | 'overview'        // High-level summary: key concepts only, 3 levels, synthesized prose
  | 'standard'        // Balanced: main points + supporting details, 4 levels
  | 'comprehensive';  // Full detail: ALL facts, examples, evidence, nuances, 5-6 levels, preserves granularity

// Bulk research import (PREMIUM feature)
export interface BulkResearchSources {
  sources: ExternalSourceInput[];
  includeExistingContent: boolean;  // Whether to include current outline content in synthesis
  outlineName?: string;  // Optional name for regenerated outline
  useBulletMode?: boolean;  // Use content-first bullet extraction approach
  mergeStrategy?: MergeStrategy;  // How to organize multiple sources
  targetOutlineId?: string;  // ID of outline to merge into (for pending recovery)
  detailLevel?: ExtractionDetailLevel;  // Controls extraction depth and granularity
  useLocalAI?: boolean;  // Force local Ollama processing (macOS only, no rate limits)
}

export interface BulkResearchResult {
  outline: Outline;
  summary: string;
  sourcesProcessed: number;
}

// ============================================
// PODCAST GENERATION
// ============================================

export type PodcastStyle = 'two-host' | 'narrator' | 'interview' | 'debate';
export type OpenAIVoice = 'alloy' | 'echo' | 'fable' | 'nova' | 'onyx' | 'shimmer';
export type PodcastLength = 'brief' | 'standard' | 'detailed';

export interface PodcastScriptSegment {
  speaker: string;
  voice: OpenAIVoice;
  text: string;
}

export interface PodcastConfig {
  style: PodcastStyle;
  length: PodcastLength;
  voices: Record<string, OpenAIVoice>;
  ttsModel: 'tts-1' | 'tts-1-hd';
}

export interface PodcastProgress {
  phase: 'script' | 'tts' | 'combining' | 'done' | 'error';
  message: string;
  segmentIndex?: number;
  totalSegments?: number;
  percent: number;
}

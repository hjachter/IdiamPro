export type NodeType =
  | 'root'
  | 'chapter'
  | 'document'
  | 'note'
  | 'task'
  | 'link'
  | 'outline-link'
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

  // Cross-outline link target (Phase 1). Only set on nodes whose `type` is
  // 'outline-link'. Points at another outline by ID; clicking the node
  // navigates to that outline. Phase 2 will add `linkedNodeId` to optionally
  // target a specific node inside the linked outline — left undefined here so
  // older app versions reading new files can simply ignore the field.
  linkedOutlineId?: string;

  // Metadata for enhanced features
  metadata?: {
    tags?: string[];           // Tags for organization
    color?: NodeColor;         // Visual color
    isCompleted?: boolean;     // For task nodes
    codeLanguage?: string;     // For code nodes
    url?: string;              // For link nodes
    dueDate?: number;          // For date/task nodes (timestamp)
    createdAt?: number;        // Creation timestamp
    updatedAt?: number;        // Last modified timestamp

    // LIVE BOOKS / transform-engine metadata (all optional, backward-compatible —
    // outlines saved before this feature simply omit these fields and load fine)
    userEdited?: boolean;      // Set when a human manually edits this node's content.
                               // Refresh auto-skips user-edited nodes unless explicitly overridden.
    transform?: NodeTransformRecord;  // Provenance of the last AI transform applied to this node
  };
}

// ============================================
// TRANSFORM ENGINE (LIVE BOOKS + future Translate)
// ============================================
//
// Generalized "AI transform of a node-subtree, with preview-and-approve".
// v1 implements only the 'refresh' transform (LIVE BOOKS: update a node's
// content against the latest information). The same engine is designed to
// host a future 'translate' transform (#52) without structural changes.

export type TransformKind = 'refresh' | 'translate';

// How a transform revises an existing node's content.
export type TransformUpdateMode =
  | 'merge'        // Default — revise in place, preserve still-accurate content, fold in new info
  | 'overwrite';   // Regenerate the node's content from scratch

// A single web/source citation stored ON the node so it persists and travels
// with the outline through the existing save / export path.
export interface TransformCitation {
  url: string;
  title?: string;
}

// Provenance recorded on a node after a transform is applied (Q4 + Q6).
export interface NodeTransformRecord {
  kind: TransformKind;
  model: string;             // Human-readable model that actually ran, e.g. "Gemini 2.5 Flash", "Claude", "Local (gemma4:e4b)"
  modelProvider: 'cloud' | 'local';
  refreshedAt: number;       // Timestamp the transform was applied
  citations: TransformCitation[];  // Web sources backing the refresh (may be empty for local/no-grounding)
  webGrounded: boolean;      // True if real live-web retrieval backed this refresh
}

// One proposed change for a single node, shown in the preview/approve dialog (Q2).
export interface NodeTransformProposal {
  nodeId: string;
  nodeName: string;
  ancestorPath: string[];
  beforeContent: string;
  afterContent: string;
  citations: TransformCitation[];
  changed: boolean;          // False if the AI determined the node is already up to date
  skipped: boolean;          // True if auto-skipped because the node was user-edited (Q5)
  skipReason?: string;
  error?: string;            // Per-node failure (kept non-fatal; node is just not changed)
}

// Options the user picks in the refresh dialog before the transform runs.
export interface TransformOptions {
  kind: TransformKind;
  updateMode: TransformUpdateMode;  // merge (default) | overwrite (Q7)
  includeUserEdited: Set<string>;   // Node IDs the user explicitly opted to refresh anyway (Q5 override)
  autoApply: boolean;               // Q2 — explicit opt-in only; default MUST be false
}

// The full preview returned by a transform run, before anything is applied.
export interface TransformPreview {
  kind: TransformKind;
  model: string;
  modelProvider: 'cloud' | 'local';
  webGrounded: boolean;
  webGroundingNote?: string;        // Honest note about live-web capability/limitation
  proposals: NodeTransformProposal[];
  totalScanned: number;
}

export type NodeMap = Record<string, OutlineNode>;

export interface Outline {
  id: string;
  name: string;
  rootNodeId: string;
  nodes: NodeMap;
  isGuide?: boolean;
  isSecondBrain?: boolean; // Reserved single outline — the user's personal knowledge base
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

export type SubscriptionPlan = 'FREE' | 'BASIC' | 'PREMIUM' | 'ACADEMIC';

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

// AI reasoning depth - controls how thoroughly the AI analyzes and responds
export type AIDepth = 'quick' | 'standard' | 'deep';

export type AITone = 'academic' | 'professional' | 'friendly' | 'storytelling';
export type AILevel = 'elementary' | 'high-school' | 'college' | 'graduate' | 'expert';

export const AI_TONE_CONFIG: Record<AITone, { label: string; description: string; icon: string }> = {
  academic: {
    label: 'Academic',
    description: 'Scholarly, formal, research-oriented',
    icon: '🎓',
  },
  professional: {
    label: 'Professional',
    description: 'Clear, business-appropriate, authoritative',
    icon: '💼',
  },
  friendly: {
    label: 'Friendly',
    description: 'Warm, conversational, easy to follow',
    icon: '😊',
  },
  storytelling: {
    label: 'Storytelling',
    description: 'Narrative-driven, engaging, vivid',
    icon: '📖',
  },
};

export const AI_LEVEL_CONFIG: Record<AILevel, { label: string; description: string; icon: string }> = {
  elementary: {
    label: 'Elementary',
    description: 'Simple words, short sentences (grades 3-5)',
    icon: '🧒',
  },
  'high-school': {
    label: 'High School',
    description: 'Clear explanations, moderate vocabulary',
    icon: '📚',
  },
  college: {
    label: 'College',
    description: 'Detailed analysis, domain terminology',
    icon: '🏛️',
  },
  graduate: {
    label: 'Graduate',
    description: 'Advanced concepts, technical depth',
    icon: '🔬',
  },
  expert: {
    label: 'Expert',
    description: 'Specialist-level, assumes deep knowledge',
    icon: '🧪',
  },
};

export const AI_DEPTH_CONFIG: Record<AIDepth, { label: string; description: string; icon: string }> = {
  quick: {
    label: 'Quick',
    description: 'Fast and concise',
    icon: '⚡',
  },
  standard: {
    label: 'Standard',
    description: 'Balanced quality and speed',
    icon: '⚖️',
  },
  deep: {
    label: 'Thorough',
    description: 'Slower but more complete',
    icon: '🧠',
  },
};

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
  diagramType?: string;  // Preferred diagram type: auto, flowchart, sequenceDiagram, mindmap, gantt, pie, classDiagram, stateDiagram, erDiagram
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

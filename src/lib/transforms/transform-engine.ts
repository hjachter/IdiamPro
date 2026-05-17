/**
 * Transform Engine — generalized "AI transform of a node-subtree, with
 * preview-and-approve".
 *
 * This is the reusable core. A *transform* takes a node + its context and
 * proposes new content for it (without applying anything). The engine here is
 * transform-agnostic: it walks the subtree, decides which nodes are eligible
 * (Q5 user-edited skip + per-node override), and applies an approved preview
 * back into the node map (Q2 + Q7 + Q4/Q6 provenance).
 *
 * v1 ships ONE transform: refresh (LIVE BOOKS). A future translate transform
 * (#52) plugs in by implementing the same NodeTransformer contract — no engine
 * changes required.
 */

import type {
  NodeMap,
  OutlineNode,
  NodeTransformProposal,
  TransformPreview,
  TransformOptions,
  TransformKind,
  NodeTransformRecord,
} from '@/types';

/**
 * Context handed to a transform for a single node.
 */
export interface TransformNodeContext {
  node: OutlineNode;
  ancestorPath: string[];
}

/**
 * The contract every transform implements. Refresh implements this now;
 * translate will implement the same shape later.
 */
export interface NodeTransformer {
  kind: TransformKind;
  /**
   * Produce a proposal for one node. MUST NOT mutate anything — it only
   * returns proposed content + citations. Per-node failure should be returned
   * as `error` on the proposal, never thrown (one bad node must not abort the
   * whole run).
   */
  transformNode(ctx: TransformNodeContext): Promise<{
    afterContent: string;
    citations: { url: string; title?: string }[];
    changed: boolean;
    error?: string;
    // Truthful provenance from the model that ACTUALLY ran for this node.
    model?: string;
    modelProvider?: 'cloud' | 'local';
    webGrounded?: boolean;
  }>;
}

/**
 * Collect the selected node plus ALL its descendants, depth-first (Q1 scope).
 * If the selected node is the root, this is the entire outline.
 */
export function collectSubtree(nodes: NodeMap, rootId: string): string[] {
  const out: string[] = [];
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    out.push(id);
    for (const childId of n.childrenIds || []) walk(childId);
  };
  walk(rootId);
  return out;
}

/**
 * Build the human-readable ancestor path (names from root down to the node's
 * parent) used to give the transform context.
 */
export function ancestorPathOf(nodes: NodeMap, nodeId: string): string[] {
  const path: string[] = [];
  let current = nodes[nodeId];
  while (current && current.parentId) {
    const parent = nodes[current.parentId];
    if (!parent) break;
    if (parent.type !== 'root') path.unshift(parent.name);
    current = parent;
  }
  return path;
}

/**
 * Decide whether a node should be auto-skipped because a human edited it
 * (Q5). The user can override per-node via options.includeUserEdited.
 */
function isSkippedForUserEdit(node: OutlineNode, options: TransformOptions): boolean {
  if (!node.metadata?.userEdited) return false;
  if (options.includeUserEdited.has(node.id)) return false;
  return true;
}

/**
 * Run a transform across a subtree and return a PREVIEW. Nothing is applied
 * here — the caller shows the preview and only applies it after approval.
 */
export async function runTransformPreview(
  nodes: NodeMap,
  rootNodeId: string,
  transformer: NodeTransformer,
  options: TransformOptions,
  meta: {
    model: string;
    modelProvider: 'cloud' | 'local';
    webGrounded: boolean;
    webGroundingNote?: string;
  }
): Promise<TransformPreview> {
  const ids = collectSubtree(nodes, rootNodeId);
  const proposals: NodeTransformProposal[] = [];
  // Adopt the true model attribution from the model that actually ran.
  let actualModel = meta.model;
  let actualProvider = meta.modelProvider;
  let actualGrounded = meta.webGrounded;
  let attributionLocked = false;

  for (const id of ids) {
    const node = nodes[id];
    if (!node) continue;
    // Root / structural-only nodes with no content are not transformed; they
    // are still counted as scanned for honest reporting.
    if (node.type === 'root') continue;
    // Binary node types carry no refreshable prose.
    if (node.type === 'canvas' || node.type === 'spreadsheet') continue;

    const ancestorPath = ancestorPathOf(nodes, id);

    if (isSkippedForUserEdit(node, options)) {
      proposals.push({
        nodeId: id,
        nodeName: node.name,
        ancestorPath,
        beforeContent: node.content || '',
        afterContent: node.content || '',
        citations: [],
        changed: false,
        skipped: true,
        skipReason: 'You manually edited this node — skipped to protect your changes.',
      });
      continue;
    }

    try {
      const result = await transformer.transformNode({ node, ancestorPath });
      // First node that actually ran tells us which model/provider/grounding
      // was truly used (covers cloud→local fallback).
      if (!attributionLocked && (result.model || result.modelProvider)) {
        if (result.model) actualModel = result.model;
        if (result.modelProvider) actualProvider = result.modelProvider;
        if (typeof result.webGrounded === 'boolean') actualGrounded = result.webGrounded;
        attributionLocked = true;
      }
      proposals.push({
        nodeId: id,
        nodeName: node.name,
        ancestorPath,
        beforeContent: node.content || '',
        afterContent: result.afterContent,
        citations: result.citations,
        changed: result.changed && !result.error,
        skipped: false,
        error: result.error,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      proposals.push({
        nodeId: id,
        nodeName: node.name,
        ancestorPath,
        beforeContent: node.content || '',
        afterContent: node.content || '',
        citations: [],
        changed: false,
        skipped: false,
        error: message,
      });
    }
  }

  return {
    kind: transformer.kind,
    model: actualModel,
    modelProvider: actualProvider,
    webGrounded: actualGrounded,
    webGroundingNote: meta.webGroundingNote,
    proposals,
    totalScanned: proposals.length,
  };
}

/**
 * Apply an approved preview back into a *copy* of the node map.
 *
 * Only the nodes whose IDs are in `approvedNodeIds` are changed. Each applied
 * node records transform provenance (Q4 citations + Q6 model attribution) and
 * is explicitly NOT marked userEdited (an AI refresh is not a manual edit, so
 * a future refresh can still update it).
 */
export function applyTransformPreview(
  nodes: NodeMap,
  preview: TransformPreview,
  approvedNodeIds: Set<string>
): { nodes: NodeMap; appliedCount: number } {
  const next: NodeMap = { ...nodes };
  let appliedCount = 0;

  for (const proposal of preview.proposals) {
    if (!approvedNodeIds.has(proposal.nodeId)) continue;
    if (proposal.skipped || proposal.error || !proposal.changed) continue;
    const existing = next[proposal.nodeId];
    if (!existing) continue;

    const record: NodeTransformRecord = {
      kind: preview.kind,
      model: preview.model,
      modelProvider: preview.modelProvider,
      refreshedAt: Date.now(),
      citations: proposal.citations,
      webGrounded: preview.webGrounded,
    };

    next[proposal.nodeId] = {
      ...existing,
      content: proposal.afterContent,
      metadata: {
        ...existing.metadata,
        updatedAt: Date.now(),
        // An AI refresh is not a manual edit — clear the flag so the node
        // stays eligible for future refreshes.
        userEdited: false,
        transform: record,
      },
    };
    appliedCount++;
  }

  return { nodes: next, appliedCount };
}

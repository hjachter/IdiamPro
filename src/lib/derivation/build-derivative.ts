// Derivative-outline builder (2026-06-10).
//
// Given an original outline + a transformed node map (the result the AI
// produced), construct a brand-new Outline object with a fresh ID, a
// suffixed name, and the `derivedFromOutlineId` / `derivationLabel` set so
// the sidebar can nest it under the parent and the in-outline banner can
// link back.
//
// The original outline is NEVER mutated by this helper.

import type { Outline, NodeMap, OutlineNode } from '@/types';

function uuid(): string {
  // Lightweight UUID — same shape as the rest of the app's uuidv4 calls.
  // Avoids a dep import in a pure-helper file. If the runtime has crypto,
  // use it; otherwise fall back to a Math.random-based ID.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as Crypto).randomUUID();
  }
  return 'xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

interface BuildDerivativeOptions {
  /** The outline the user just transformed. NOT mutated. */
  original: Outline;
  /** The transformed node map (already produced by the dialog/engine). */
  transformedNodes: NodeMap;
  /** Root node ID inside `transformedNodes` (usually original.rootNodeId
   *  for whole-outline transforms; may differ for subtree transforms — the
   *  caller decides). */
  transformedRootNodeId: string;
  /** User-editable label that becomes the name suffix. */
  derivationLabel: string;
}

/** Compose the new outline's name: "[Original Name] — [Label]". */
export function buildDerivativeName(originalName: string, label: string): string {
  const cleanLabel = (label || '').trim() || 'Modified';
  return `${originalName} — ${cleanLabel}`;
}

/**
 * Build a fresh Outline object representing the derivative.
 *
 * - New UUID
 * - Name = `[Original] — [Label]`
 * - `derivedFromOutlineId` = original.id
 * - `derivationLabel` = label
 * - `nodes` = a deep clone of `transformedNodes`, with the root node renamed
 *   to match the derivative's outline name so the in-app title and the
 *   root-node name stay in sync.
 *
 * Returns the new Outline. Does not touch disk. Does not touch the
 * original.
 */
export function buildDerivativeOutline(opts: BuildDerivativeOptions): Outline {
  const { original, transformedNodes, transformedRootNodeId, derivationLabel } = opts;
  const newName = buildDerivativeName(original.name, derivationLabel);
  const newId = uuid();

  // Deep-clone the node map so the new outline's nodes are independent of
  // the original AND of the transformed map handed in (defensive copy).
  const clonedNodes: NodeMap = {};
  for (const [id, node] of Object.entries(transformedNodes)) {
    clonedNodes[id] = {
      ...node,
      childrenIds: [...(node.childrenIds || [])],
      metadata: node.metadata ? { ...node.metadata } : undefined,
    };
  }

  // Sync the root node's name with the new outline name. The IdeaM file
  // format treats the root node's `name` as the display name within the
  // outline; the Outline.name is the sidebar/file name. They should match
  // for newly-created derivatives so nothing looks stale.
  const rootClone = clonedNodes[transformedRootNodeId];
  if (rootClone) {
    clonedNodes[transformedRootNodeId] = { ...rootClone, name: newName };
  }

  return {
    id: newId,
    name: newName,
    rootNodeId: transformedRootNodeId,
    nodes: clonedNodes,
    lastModified: Date.now(),
    derivedFromOutlineId: original.id,
    derivationLabel: (derivationLabel || '').trim() || 'Modified',
  };
}

/**
 * Apply a single-node content replacement (Reformat-with-AI style) to a
 * deep clone of the original outline's nodes, producing a new node map.
 * Pure helper — caller wraps the result with buildDerivativeOutline.
 */
export function cloneNodesWithSingleContent(
  originalNodes: NodeMap,
  nodeId: string,
  newContent: string,
): NodeMap {
  const cloned: NodeMap = {};
  for (const [id, node] of Object.entries(originalNodes)) {
    cloned[id] = {
      ...node,
      childrenIds: [...(node.childrenIds || [])],
      metadata: node.metadata ? { ...node.metadata } : undefined,
    };
  }
  const target = cloned[nodeId];
  if (target) {
    cloned[nodeId] = { ...target, content: newContent };
  }
  return cloned;
}

/**
 * Deep-clone an entire NodeMap. Used when a transform supplies a node map
 * that is the FULL new outline state (LIVE BOOKS / Translate engine output).
 */
export function deepCloneNodes(nodes: NodeMap): NodeMap {
  const out: NodeMap = {};
  for (const [id, node] of Object.entries(nodes)) {
    out[id] = {
      ...node,
      childrenIds: [...(node.childrenIds || [])],
      metadata: node.metadata ? { ...node.metadata } : undefined,
    };
  }
  return out;
}

// Re-export OutlineNode so consumers don't need a separate import.
export type { OutlineNode };

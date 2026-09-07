// ============================================================================
// compile-core / traverse — THE canonical outline-subtree traversal helpers.
// ----------------------------------------------------------------------------
// Phase 0 of the content-compiler architecture. Before this module, depth-first
// subtree walks were re-invented per pipeline (~6 copies: exporters, podcast,
// serializer, four AI flows, verifier, video, deck). One implementation now
// serves them all; behavior is byte-identical (golden-tested).
// ============================================================================

import { htmlToPlainText } from './clean-text';

/**
 * The minimal structural shape traversal needs. Both live OutlineNode maps and
 * serialized snapshots (SerializedNode) satisfy it.
 */
export interface TraversableNode {
  name?: string;
  content?: string;
  childrenIds?: string[];
}

export type TraversableNodeMap<T extends TraversableNode = TraversableNode> = Record<string, T>;

/**
 * Live child ids — children that actually exist in the map. (Formerly
 * duplicated privately in derive-slides and derive-deck.)
 */
export function liveChildIds(nodes: TraversableNodeMap, id: string): string[] {
  const node = nodes[id];
  if (!node) return [];
  return (node.childrenIds || []).filter((cid) => nodes[cid]);
}

/** Visitor return values: 'stop' aborts the whole walk; 'skip-children' skips
 *  this node's descendants; anything else continues normally. */
export type WalkControl = void | undefined | 'stop' | 'skip-children';

export interface WalkOptions {
  /** Do not visit nodes deeper than this (root = depth 0). */
  maxDepth?: number;
}

/**
 * Depth-first pre-order walk of a subtree. Semantics match the historical
 * BaseExporter.traverseDepthFirst exactly (including the maxDepth check
 * happening before the node lookup), extended with early-stop controls and a
 * cycle guard. On any well-formed (acyclic) outline the guard is inert; on a
 * corrupt cyclic map the walk terminates instead of hanging.
 */
export function walkSubtree<T extends TraversableNode>(
  nodes: TraversableNodeMap<T>,
  rootId: string,
  visit: (node: T, depth: number, path: string[]) => WalkControl,
  options: WalkOptions = {},
): void {
  const { maxDepth } = options;
  const seen = new Set<string>();
  let stopped = false;

  const walk = (nodeId: string, depth: number, path: string[]): void => {
    if (stopped) return;
    if (maxDepth !== undefined && depth > maxDepth) return;
    if (seen.has(nodeId)) return; // cycle guard (inert on real outlines)
    seen.add(nodeId);

    const node = nodes[nodeId];
    if (!node) return;

    const control = visit(node, depth, path);
    if (control === 'stop') {
      stopped = true;
      return;
    }
    if (control === 'skip-children') return;

    const children = node.childrenIds;
    if (children && children.length > 0) {
      const childPath = [...path, node.name ?? ''];
      for (const childId of children) {
        walk(childId, depth + 1, childPath);
        if (stopped) return;
      }
    }
  };

  walk(rootId, 0, []);
}

/**
 * Render a subtree as compact indented plain text for an AI prompt:
 *   - Node Name
 *     stripped content lines…
 * This is the one shared implementation of the identical private
 * "renderBranchForPrompt" copies in the YouTube / email / social / Instagram
 * flows and the verifier's "nodesToPlainText". Output is byte-identical to all
 * of them (they only differed by a TypeScript type name and the verifier's
 * cycle guard, which is inert on real outlines and now always on).
 */
export function renderSubtreeForPrompt(
  nodes: TraversableNodeMap,
  rootId: string,
): string {
  const lines: string[] = [];
  const seen = new Set<string>();
  const walk = (id: string, depth: number): void => {
    if (seen.has(id)) return; // guard against cycles
    seen.add(id);
    const n = nodes[id];
    if (!n) return;
    const indent = '  '.repeat(depth);
    if (n.name) lines.push(`${indent}- ${n.name}`);
    const body = htmlToPlainText(n.content || '', 'prompt');
    if (body) {
      for (const ln of body.split('\n')) {
        if (ln.trim()) lines.push(`${indent}  ${ln.trim()}`);
      }
    }
    for (const childId of n.childrenIds || []) walk(childId, depth + 1);
  };
  walk(rootId, 0);
  return lines.join('\n');
}

/**
 * Names along the path from the root to a node (inclusive). Formerly
 * BaseExporter.getNodePath; behavior identical.
 */
export function pathToNode(
  nodes: TraversableNodeMap,
  nodeId: string,
  rootId: string,
): string[] {
  const path: string[] = [];

  const findPath = (currentId: string, target: string, currentPath: string[]): boolean => {
    const node = nodes[currentId];
    if (!node) return false;

    if (currentId === target) {
      path.push(...currentPath, node.name ?? '');
      return true;
    }

    if (node.childrenIds) {
      for (const childId of node.childrenIds) {
        if (findPath(childId, target, [...currentPath, node.name ?? ''])) {
          return true;
        }
      }
    }

    return false;
  };

  findPath(rootId, nodeId, []);
  return path;
}

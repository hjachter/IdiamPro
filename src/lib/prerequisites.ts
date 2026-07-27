/**
 * PREREQUISITES — the first RELATIONAL metatag (project-management
 * infrastructure). A prerequisite is a structured dependency between two nodes
 * in the SAME outline: "task B depends on task A" means A must be Done before B
 * can start. Stored as `node.metadata.prerequisites` (an array of node IDs) so
 * the relationship is machine-readable (AI can query the dependency graph),
 * not a fragile text marker buried in the content prose.
 *
 * "Blocked" is a COMPUTED, surfaced indicator — never a stored status. A node
 * is blocked when it has at least one prerequisite whose status is not "Done".
 * We deliberately do NOT write the reserved "Blocked" status tag here: the
 * user's manually-set status is theirs to control; blocked-ness is shown
 * alongside it, never on top of it.
 */

import type { NodeMap, OutlineNode } from '@/types';
import { DONE_STATUS_LABEL } from './status-tags';

/** The prerequisite node IDs on a node (always an array, possibly empty). */
export function getPrerequisiteIds(node: OutlineNode | undefined): string[] {
  return node?.metadata?.prerequisites ?? [];
}

/** True when a node is considered "Done" (its reserved status tag is Done). */
export function isNodeDone(node: OutlineNode | undefined): boolean {
  return !!node?.metadata?.tags?.includes(DONE_STATUS_LABEL);
}

/**
 * Add a prerequisite (dependency) to a node.
 *
 * Guards against the obvious mistakes: a node can't depend on itself, and we
 * skip a prerequisite that's already present or points at a node that no
 * longer exists. Returns the same map unchanged when nothing needs to change,
 * so callers can compare by reference.
 */
export function addPrerequisiteToNode(
  nodes: NodeMap,
  nodeId: string,
  prerequisiteId: string
): NodeMap {
  const node = nodes[nodeId];
  if (!node) return nodes;
  if (prerequisiteId === nodeId) return nodes;           // no self-dependency
  if (!nodes[prerequisiteId]) return nodes;              // target must exist

  const existing = node.metadata?.prerequisites ?? [];
  if (existing.includes(prerequisiteId)) return nodes;   // already a prereq

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        prerequisites: [...existing, prerequisiteId],
      },
    },
  };
}

/**
 * Remove a prerequisite from a node. When the last one is removed the key is
 * dropped entirely (undefined) so a node with no dependencies serializes clean.
 */
export function removePrerequisiteFromNode(
  nodes: NodeMap,
  nodeId: string,
  prerequisiteId: string
): NodeMap {
  const node = nodes[nodeId];
  if (!node) return nodes;

  const existing = node.metadata?.prerequisites ?? [];
  if (!existing.includes(prerequisiteId)) return nodes;

  const next = existing.filter((id) => id !== prerequisiteId);
  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        prerequisites: next.length > 0 ? next : undefined,
      },
    },
  };
}

/**
 * The prerequisites of a node that are currently BLOCKING it — i.e. those
 * whose status is not "Done". Dangling IDs (prereq node deleted) are dropped.
 * An empty array means the node is not blocked.
 */
export function getBlockingPrerequisites(
  nodes: NodeMap,
  nodeId: string
): OutlineNode[] {
  const node = nodes[nodeId];
  if (!node) return [];
  return getPrerequisiteIds(node)
    .map((id) => nodes[id])
    .filter((prereq): prereq is OutlineNode => !!prereq && !isNodeDone(prereq));
}

/** True when a node has at least one not-yet-Done prerequisite. */
export function isNodeBlocked(nodes: NodeMap, nodeId: string): boolean {
  return getBlockingPrerequisites(nodes, nodeId).length > 0;
}

/**
 * The set of node IDs that are descendants of `nodeId` (plus the node itself).
 * Used by the prerequisite picker to hide a node's own subtree — depending on
 * your own child would create a trivial cycle.
 */
export function getSelfAndDescendantIds(
  nodes: NodeMap,
  nodeId: string
): Set<string> {
  const ids = new Set<string>([nodeId]);
  const stack = [...(nodes[nodeId]?.childrenIds ?? [])];
  while (stack.length) {
    const id = stack.pop();
    if (!id || ids.has(id)) continue;
    ids.add(id);
    const child = nodes[id];
    if (child?.childrenIds?.length) stack.push(...child.childrenIds);
  }
  return ids;
}

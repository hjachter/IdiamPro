// Client-side helpers for the Transform-outline-with-AI feature.
//
// Lives outside `src/ai/flows/` because Next.js's `'use server'` directive
// requires every export from a server-action file to be an async function —
// these pure helpers would have broken the dev server compile.
import type { NodeMap, OutlineNode } from '@/types';
import type { SerializedNode } from '@/ai/flows/transform-outline';

/**
 * Serialize a NodeMap subtree (root + descendants only) into the
 * SerializedNode shape the AI flow expects.
 */
export function serializeSubtree(
  nodes: NodeMap,
  rootId: string,
): { subtreeNodes: Record<string, SerializedNode>; count: number } {
  const out: Record<string, SerializedNode> = {};
  const walk = (id: string) => {
    const n = nodes[id];
    if (!n) return;
    out[id] = {
      id: n.id,
      name: n.name,
      content: n.content,
      type: n.type,
      parentId: n.parentId,
      childrenIds: [...(n.childrenIds || [])],
    };
    for (const childId of n.childrenIds || []) walk(childId);
  };
  walk(rootId);
  return { subtreeNodes: out, count: Object.keys(out).length };
}

/**
 * Take a NodeMap + a transformed subtree and produce a new NodeMap with the
 * subtree replaced. Preserves the original prefix on the root and re-uses
 * prefixes from the original where node IDs match. Nodes that previously
 * lived under rootId but no longer appear in the transformed subtree are
 * dropped — that's the "removed" set the AI returned.
 */
export function mergeTransformedSubtreeIntoOutline(
  originalNodes: NodeMap,
  transformed: Record<string, SerializedNode>,
  rootId: string,
): NodeMap {
  // Identify which IDs in the original belong to the subtree (root + descendants).
  const originalSubtreeIds = new Set<string>();
  const walk = (id: string) => {
    const n = originalNodes[id];
    if (!n) return;
    originalSubtreeIds.add(id);
    for (const childId of n.childrenIds || []) walk(childId);
  };
  walk(rootId);

  // Start from everything OUTSIDE the original subtree (untouched).
  const next: NodeMap = {};
  for (const [id, n] of Object.entries(originalNodes)) {
    if (!originalSubtreeIds.has(id)) next[id] = n;
  }

  // Merge in the transformed subtree, mapping serialized nodes back into
  // full OutlineNode shape by re-using the original node's fields where
  // possible (prefix, metadata) and falling back to defaults for new nodes.
  for (const [id, serialized] of Object.entries(transformed)) {
    const original = originalNodes[id];
    const fullNode: OutlineNode = original
      ? {
          ...original,
          name: serialized.name,
          content: serialized.content,
          type: serialized.type,
          parentId: serialized.parentId,
          childrenIds: serialized.childrenIds,
        }
      : {
          id,
          name: serialized.name,
          content: serialized.content,
          type: serialized.type,
          parentId: serialized.parentId,
          childrenIds: serialized.childrenIds,
          prefix: '',
          metadata: { createdAt: Date.now(), updatedAt: Date.now() },
        };
    next[id] = fullNode;
  }

  // Preserve the parentId on the subtree's root from the ORIGINAL node — the
  // AI doesn't know the subtree's place inside the larger outline, so we
  // restore that anchor regardless of what the AI put there.
  const originalRoot = originalNodes[rootId];
  if (originalRoot && next[rootId]) {
    next[rootId] = { ...next[rootId], parentId: originalRoot.parentId };
  }

  return next;
}

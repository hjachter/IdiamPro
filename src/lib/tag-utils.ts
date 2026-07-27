import type { NodeMap, OutlineNode } from '@/types';

/**
 * Add a tag to a node
 */
export function addTagToNode(
  nodes: NodeMap,
  nodeId: string,
  tag: string
): NodeMap {
  const node = nodes[nodeId];
  if (!node) return nodes;

  const existingTags = node.metadata?.tags || [];
  if (existingTags.includes(tag)) return nodes;

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        tags: [...existingTags, tag],
      },
    },
  };
}

/**
 * Remove a tag from a node
 */
export function removeTagFromNode(
  nodes: NodeMap,
  nodeId: string,
  tag: string
): NodeMap {
  const node = nodes[nodeId];
  if (!node) return nodes;

  const existingTags = node.metadata?.tags || [];
  const newTags = existingTags.filter(t => t !== tag);

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        tags: newTags.length > 0 ? newTags : undefined,
      },
    },
  };
}

/**
 * Get all unique tags from all nodes
 */
export function getAllTags(nodes: NodeMap): string[] {
  const tagSet = new Set<string>();

  Object.values(nodes).forEach(node => {
    if (node.metadata?.tags) {
      node.metadata.tags.forEach(tag => tagSet.add(tag));
    }
  });

  return Array.from(tagSet).sort();
}

/**
 * Get all node IDs that have the specified tags.
 *
 * matchMode:
 *  - 'any'  → node has AT LEAST ONE of the tags (OR). This is the natural
 *             "filter by tag(s)" behavior — the more tags you pick, the more
 *             you see. Used by the outline tag filter.
 *  - 'all'  → node has EVERY one of the tags (AND). The original behavior.
 */
export function filterNodesByTags(
  nodes: NodeMap,
  tags: string[],
  matchMode: 'any' | 'all' = 'all'
): string[] {
  if (tags.length === 0) return [];

  return Object.keys(nodes).filter(nodeId => {
    const node = nodes[nodeId];
    if (!node.metadata?.tags) return false;

    return matchMode === 'any'
      ? tags.some(tag => node.metadata?.tags?.includes(tag))
      : tags.every(tag => node.metadata?.tags?.includes(tag));
  });
}

/**
 * Compute the full set of node IDs that should remain VISIBLE when filtering
 * the outline to the given tags: every matching node, plus all of its
 * ancestors (so the match stays reachable in the tree — mirrors how text
 * search keeps matches in context), plus all of its descendants (so a matched
 * branch shows in full). Everything else can be hidden.
 *
 * Returns an empty set when no tags are selected (caller treats that as
 * "no filter — show everything").
 */
export function getTagFilterVisibleIds(
  nodes: NodeMap,
  tags: string[],
  matchMode: 'any' | 'all' = 'any'
): Set<string> {
  const visible = new Set<string>();
  if (tags.length === 0) return visible;

  const matchIds = filterNodesByTags(nodes, tags, matchMode);

  for (const id of matchIds) {
    visible.add(id);

    // Walk up to the root, adding every ancestor.
    let cur = nodes[id];
    while (cur && cur.parentId) {
      if (visible.has(cur.parentId)) break;
      visible.add(cur.parentId);
      cur = nodes[cur.parentId];
    }

    // Walk down, adding every descendant.
    const stack = [...(nodes[id]?.childrenIds || [])];
    while (stack.length) {
      const childId = stack.pop();
      if (!childId || visible.has(childId)) continue;
      visible.add(childId);
      const childNode = nodes[childId];
      if (childNode?.childrenIds?.length) stack.push(...childNode.childrenIds);
    }
  }

  return visible;
}

/**
 * Rename a tag across all nodes
 */
export function renameTag(
  nodes: NodeMap,
  oldTag: string,
  newTag: string
): NodeMap {
  let updatedNodes = { ...nodes };

  Object.keys(nodes).forEach(nodeId => {
    const node = nodes[nodeId];
    if (node.metadata?.tags?.includes(oldTag)) {
      const newTags = node.metadata.tags.map(tag =>
        tag === oldTag ? newTag : tag
      );

      updatedNodes = {
        ...updatedNodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            tags: newTags,
          },
        },
      };
    }
  });

  return updatedNodes;
}

/**
 * Get tag usage count (how many nodes use each tag)
 */
export function getTagUsageCounts(nodes: NodeMap): Record<string, number> {
  const counts: Record<string, number> = {};

  Object.values(nodes).forEach(node => {
    if (node.metadata?.tags) {
      node.metadata.tags.forEach(tag => {
        counts[tag] = (counts[tag] || 0) + 1;
      });
    }
  });

  return counts;
}

/**
 * Delete a tag from all nodes
 */
export function deleteTag(nodes: NodeMap, tag: string): NodeMap {
  let updatedNodes = { ...nodes };

  Object.keys(nodes).forEach(nodeId => {
    if (nodes[nodeId].metadata?.tags?.includes(tag)) {
      updatedNodes = removeTagFromNode(updatedNodes, nodeId, tag);
    }
  });

  return updatedNodes;
}

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
 * Get all node IDs that have the specified tags
 */
export function filterNodesByTags(
  nodes: NodeMap,
  tags: string[]
): string[] {
  if (tags.length === 0) return [];

  return Object.keys(nodes).filter(nodeId => {
    const node = nodes[nodeId];
    if (!node.metadata?.tags) return false;

    // Node must have ALL specified tags
    return tags.every(tag => node.metadata?.tags?.includes(tag));
  });
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

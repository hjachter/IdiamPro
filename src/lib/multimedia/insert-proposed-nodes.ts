/**
 * Multimedia AI — append a proposed sub-outline as children of a target
 * node in an existing NodeMap.
 *
 * This is the renderer-side equivalent of the AI-generated outline shape
 * coming out of `imageToOutlineAction`. It walks the proposed tree and
 * appends nodes under `targetNodeId`, recalculating prefixes.
 *
 * Pure helper: takes a NodeMap, returns a NEW NodeMap. The caller is
 * responsible for:
 *   • auto-snapshot before applying (outline-data-protection rule 2)
 *   • undo registration via markNextAction (outline-data-protection rule 1)
 *   • routing through the derivative flow when the user chose "Save as
 *     new outline" (outline-data-protection rule 3)
 */

import { v4 as uuidv4 } from 'uuid';
import type { NodeMap, OutlineNode } from '@/types';
import { recalculatePrefixesForBranch } from '@/lib/outline-utils';
import type { ImageToOutlineProposedNode } from '@/app/actions';

export interface InsertProposedOptions {
  /** When true, every inserted node records sourceImageId in metadata so
   *  the UI can show a small thumbnail next to the parent node and the
   *  user can open the original image. */
  sourceImageId?: string;
}

function buildNode(
  proposed: ImageToOutlineProposedNode,
  parentId: string,
  sourceImageId: string | undefined,
): OutlineNode {
  return {
    id: uuidv4(),
    name: (proposed.name || 'Untitled').slice(0, 200),
    content: proposed.content || '',
    type: 'document',
    parentId,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...(sourceImageId ? { sourceImageId } as Record<string, unknown> : {}),
    },
  };
}

/**
 * Append `proposedNodes` as children of `targetNodeId`. Returns a NEW
 * NodeMap plus the ID of the first new top-level node (useful for the
 * selection-jump after insert).
 */
export function insertProposedNodes(
  nodes: NodeMap,
  targetNodeId: string,
  proposedNodes: ImageToOutlineProposedNode[],
  options: InsertProposedOptions = {},
): { newNodes: NodeMap; firstInsertedId: string | null; totalInserted: number } {
  if (!nodes[targetNodeId]) {
    return { newNodes: nodes, firstInsertedId: null, totalInserted: 0 };
  }

  // Shallow-clone the map; we'll deep-update only the branches we touch.
  const next: NodeMap = {};
  for (const key of Object.keys(nodes)) {
    next[key] = { ...nodes[key], childrenIds: [...(nodes[key].childrenIds || [])] };
  }

  let totalInserted = 0;
  let firstInsertedId: string | null = null;

  const insertSubtree = (parentId: string, list: ImageToOutlineProposedNode[]) => {
    const parent = next[parentId];
    if (!parent) return;
    for (const proposed of list) {
      const node = buildNode(proposed, parentId, options.sourceImageId);
      next[node.id] = node;
      parent.childrenIds.push(node.id);
      totalInserted += 1;
      if (!firstInsertedId) firstInsertedId = node.id;
      // Recurse into children of THIS proposed node.
      if (proposed.children && proposed.children.length > 0) {
        insertSubtree(node.id, proposed.children);
      }
    }
  };

  insertSubtree(targetNodeId, proposedNodes);

  // The target itself may need to flip to 'chapter' if it now has children
  // and is currently a plain document. Match the convention used in addNode.
  const targetAfter = next[targetNodeId];
  if (targetAfter && targetAfter.type !== 'root' && (targetAfter.childrenIds.length || 0) > 0 && targetAfter.type === 'document') {
    next[targetNodeId] = { ...targetAfter, type: 'chapter', isCollapsed: false };
  }

  recalculatePrefixesForBranch(next, targetNodeId);

  return { newNodes: next, firstInsertedId, totalInserted };
}

/**
 * Stringify a node + its descendants into plain text — used to feed the
 * chapter context into the YouTube package generator.
 */
export function nodeSubtreeToText(nodes: NodeMap, rootId: string, maxChars = 8000): string {
  const lines: string[] = [];
  const walk = (id: string, depth: number) => {
    const n = nodes[id];
    if (!n) return;
    const indent = '  '.repeat(Math.max(0, depth));
    if (n.type !== 'root') {
      lines.push(`${indent}${n.name}`);
      if (n.content && n.content.trim()) {
        // Strip HTML tags for the AI context — the model doesn't need
        // markup, just the prose.
        const plain = n.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        if (plain) lines.push(`${indent}  ${plain}`);
      }
    }
    for (const childId of n.childrenIds || []) walk(childId, depth + 1);
  };
  walk(rootId, 0);
  const joined = lines.join('\n');
  return joined.length > maxChars ? joined.slice(0, maxChars) : joined;
}

import {
  addTagToNode,
  removeTagFromNode,
  getAllTags,
  filterNodesByTags,
  renameTag,
  deleteTag,
  getTagUsageCounts,
} from '@/lib/tag-utils';
import { makeNode, makeSimpleTree, resetIds } from '../helpers/fixtures';
import type { NodeMap } from '@/types';

beforeEach(() => {
  resetIds();
});

// Helper to build a NodeMap with tags
function nodesWithTags(): NodeMap {
  const { rootId, nodes } = makeSimpleTree(3);
  const [id1, id2, id3] = nodes[rootId].childrenIds;
  nodes[id1] = { ...nodes[id1], metadata: { tags: ['work', 'urgent'] } };
  nodes[id2] = { ...nodes[id2], metadata: { tags: ['work', 'review'] } };
  nodes[id3] = { ...nodes[id3], metadata: { tags: ['personal'] } };
  return nodes;
}

// ── addTagToNode ────────────────────────────────────────────────
describe('addTagToNode', () => {
  it('adds a tag to a node without existing tags', () => {
    const { rootId, nodes } = makeSimpleTree(1);
    const childId = nodes[rootId].childrenIds[0];
    const result = addTagToNode(nodes, childId, 'new-tag');
    expect(result[childId].metadata?.tags).toContain('new-tag');
  });

  it('appends to existing tags', () => {
    const nodes = nodesWithTags();
    const rootId = Object.keys(nodes).find(id => nodes[id].type === 'root')!;
    const childId = nodes[rootId].childrenIds[0];
    const result = addTagToNode(nodes, childId, 'extra');
    expect(result[childId].metadata?.tags).toEqual(['work', 'urgent', 'extra']);
  });

  it('does not duplicate existing tag', () => {
    const nodes = nodesWithTags();
    const rootId = Object.keys(nodes).find(id => nodes[id].type === 'root')!;
    const childId = nodes[rootId].childrenIds[0];
    const result = addTagToNode(nodes, childId, 'work');
    expect(result[childId].metadata?.tags).toEqual(['work', 'urgent']);
  });

  it('returns original nodes for invalid nodeId', () => {
    const { nodes } = makeSimpleTree(1);
    expect(addTagToNode(nodes, 'nonexistent', 'tag')).toBe(nodes);
  });
});

// ── removeTagFromNode ───────────────────────────────────────────
describe('removeTagFromNode', () => {
  it('removes a tag from a node', () => {
    const nodes = nodesWithTags();
    const rootId = Object.keys(nodes).find(id => nodes[id].type === 'root')!;
    const childId = nodes[rootId].childrenIds[0];
    const result = removeTagFromNode(nodes, childId, 'urgent');
    expect(result[childId].metadata?.tags).toEqual(['work']);
  });

  it('sets tags to undefined when last tag removed', () => {
    const nodes = nodesWithTags();
    const rootId = Object.keys(nodes).find(id => nodes[id].type === 'root')!;
    const childId = nodes[rootId].childrenIds[2]; // has only 'personal'
    const result = removeTagFromNode(nodes, childId, 'personal');
    expect(result[childId].metadata?.tags).toBeUndefined();
  });

  it('returns original nodes for invalid nodeId', () => {
    const { nodes } = makeSimpleTree(1);
    expect(removeTagFromNode(nodes, 'nonexistent', 'tag')).toBe(nodes);
  });
});

// ── getAllTags ───────────────────────────────────────────────────
describe('getAllTags', () => {
  it('returns sorted unique tags', () => {
    const nodes = nodesWithTags();
    expect(getAllTags(nodes)).toEqual(['personal', 'review', 'urgent', 'work']);
  });

  it('returns empty array when no tags exist', () => {
    const { nodes } = makeSimpleTree(2);
    expect(getAllTags(nodes)).toEqual([]);
  });
});

// ── filterNodesByTags ───────────────────────────────────────────
describe('filterNodesByTags', () => {
  it('returns nodes matching a single tag', () => {
    const nodes = nodesWithTags();
    const result = filterNodesByTags(nodes, ['work']);
    expect(result).toHaveLength(2);
  });

  it('uses AND logic for multiple tags', () => {
    const nodes = nodesWithTags();
    const result = filterNodesByTags(nodes, ['work', 'urgent']);
    expect(result).toHaveLength(1);
  });

  it('returns empty array for no matching tags', () => {
    const nodes = nodesWithTags();
    expect(filterNodesByTags(nodes, ['nonexistent'])).toEqual([]);
  });

  it('returns empty array for empty tag list', () => {
    const nodes = nodesWithTags();
    expect(filterNodesByTags(nodes, [])).toEqual([]);
  });
});

// ── renameTag ───────────────────────────────────────────────────
describe('renameTag', () => {
  it('renames tag across all nodes', () => {
    const nodes = nodesWithTags();
    const result = renameTag(nodes, 'work', 'job');
    const allTags = getAllTags(result);
    expect(allTags).toContain('job');
    expect(allTags).not.toContain('work');
  });

  it('does not affect nodes without the tag', () => {
    const nodes = nodesWithTags();
    const rootId = Object.keys(nodes).find(id => nodes[id].type === 'root')!;
    const thirdChildId = nodes[rootId].childrenIds[2];
    const result = renameTag(nodes, 'work', 'job');
    expect(result[thirdChildId].metadata?.tags).toEqual(['personal']);
  });
});

// ── deleteTag ───────────────────────────────────────────────────
describe('deleteTag', () => {
  it('removes tag from all nodes', () => {
    const nodes = nodesWithTags();
    const result = deleteTag(nodes, 'work');
    expect(getAllTags(result)).not.toContain('work');
  });

  it('preserves other tags', () => {
    const nodes = nodesWithTags();
    const result = deleteTag(nodes, 'work');
    expect(getAllTags(result)).toContain('urgent');
    expect(getAllTags(result)).toContain('personal');
  });
});

// ── getTagUsageCounts ───────────────────────────────────────────
describe('getTagUsageCounts', () => {
  it('returns correct counts', () => {
    const nodes = nodesWithTags();
    const counts = getTagUsageCounts(nodes);
    expect(counts['work']).toBe(2);
    expect(counts['urgent']).toBe(1);
    expect(counts['review']).toBe(1);
    expect(counts['personal']).toBe(1);
  });

  it('returns empty object when no tags', () => {
    const { nodes } = makeSimpleTree(2);
    expect(getTagUsageCounts(nodes)).toEqual({});
  });
});

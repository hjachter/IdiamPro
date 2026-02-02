import {
  calculateNodePrefix,
  addNode,
  addNodeAfter,
  removeNode,
  updateNode,
  moveNode,
  buildOutlineTreeString,
  parseMarkdownToNodes,
  generateMindmapFromSubtree,
  generateFlowchartFromSubtree,
} from '@/lib/outline-utils';
import { makeNode, makeSimpleTree, makeTwoLevelTree, resetIds } from '../helpers/fixtures';
import type { NodeMap } from '@/types';

beforeEach(() => {
  resetIds();
});

// ── calculateNodePrefix ─────────────────────────────────────────
describe('calculateNodePrefix', () => {
  it('returns empty string for root node', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    expect(calculateNodePrefix(nodes, rootId)).toBe('');
  });

  it('returns "1" for first child of root', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const firstChildId = nodes[rootId].childrenIds[0];
    expect(calculateNodePrefix(nodes, firstChildId)).toBe('1');
  });

  it('returns "2" for second child of root', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const secondChildId = nodes[rootId].childrenIds[1];
    expect(calculateNodePrefix(nodes, secondChildId)).toBe('2');
  });

  it('returns "1.1" for first grandchild', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[0];
    const docId = nodes[chapterId].childrenIds[0];
    expect(calculateNodePrefix(nodes, docId)).toBe('1.1');
  });

  it('returns "2.3" for third child of second chapter', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[1];
    const docId = nodes[chapterId].childrenIds[2];
    expect(calculateNodePrefix(nodes, docId)).toBe('2.3');
  });

  it('returns empty string for unknown nodeId', () => {
    const { nodes } = makeSimpleTree(1);
    expect(calculateNodePrefix(nodes, 'nonexistent')).toBe('');
  });
});

// ── addNode ─────────────────────────────────────────────────────
describe('addNode', () => {
  it('adds a child to the specified parent', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    const { newNodes, newNodeId } = addNode(nodes, rootId, 'document', 'New Child');
    expect(newNodes[rootId].childrenIds).toContain(newNodeId);
    expect(newNodes[newNodeId].parentId).toBe(rootId);
  });

  it('sets correct name and content on new node', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    const { newNodes, newNodeId } = addNode(nodes, rootId, 'document', 'My Node', 'Some content');
    expect(newNodes[newNodeId].name).toBe('My Node');
    expect(newNodes[newNodeId].content).toBe('Some content');
  });

  it('promotes parent to chapter type when adding child', () => {
    const { rootId, nodes } = makeSimpleTree(1);
    const childId = nodes[rootId].childrenIds[0];
    const { newNodes } = addNode(nodes, childId, 'document', 'Grandchild');
    expect(newNodes[childId].type).toBe('chapter');
  });

  it('does not promote root type to chapter', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    const { newNodes } = addNode(nodes, rootId, 'document', 'Child');
    expect(newNodes[rootId].type).toBe('root');
  });

  it('returns original nodes if parentId is invalid', () => {
    const { nodes } = makeSimpleTree(1);
    const { newNodes, newNodeId } = addNode(nodes, 'nonexistent', 'document', 'X');
    expect(newNodes).toBe(nodes);
    expect(newNodeId).toBe('');
  });

  it('recalculates prefixes after adding', () => {
    const { rootId, nodes } = makeSimpleTree(1);
    const { newNodes } = addNode(nodes, rootId, 'document', 'Second Child');
    const secondChildId = newNodes[rootId].childrenIds[1];
    expect(newNodes[secondChildId].prefix).toBe('2');
  });

  it('uncollpases parent node', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    nodes[rootId].isCollapsed = true;
    const { newNodes } = addNode(nodes, rootId, 'document', 'Child');
    expect(newNodes[rootId].isCollapsed).toBe(false);
  });
});

// ── addNodeAfter ────────────────────────────────────────────────
describe('addNodeAfter', () => {
  it('inserts new node after specified sibling', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const firstChildId = nodes[rootId].childrenIds[0];
    const { newNodes, newNodeId } = addNodeAfter(nodes, firstChildId, 'document', 'Inserted');
    const idx = newNodes[rootId].childrenIds.indexOf(newNodeId);
    expect(idx).toBe(1); // after index 0
  });

  it('sets correct parentId on inserted node', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const firstChildId = nodes[rootId].childrenIds[0];
    const { newNodes, newNodeId } = addNodeAfter(nodes, firstChildId, 'document', 'Inserted');
    expect(newNodes[newNodeId].parentId).toBe(rootId);
  });

  it('falls back to addNode if afterNode is root (no parent)', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    const { newNodes, newNodeId } = addNodeAfter(nodes, rootId, 'document', 'FallbackChild');
    expect(newNodes[rootId].childrenIds).toContain(newNodeId);
  });

  it('recalculates prefixes after insertion', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const firstChildId = nodes[rootId].childrenIds[0];
    const { newNodes } = addNodeAfter(nodes, firstChildId, 'document', 'Inserted');
    const lastChildId = newNodes[rootId].childrenIds[2];
    expect(newNodes[lastChildId].prefix).toBe('3');
  });
});

// ── removeNode ──────────────────────────────────────────────────
describe('removeNode', () => {
  it('removes a leaf node', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const childId = nodes[rootId].childrenIds[0];
    const result = removeNode(nodes, childId);
    expect(result[childId]).toBeUndefined();
    expect(result[rootId].childrenIds).not.toContain(childId);
  });

  it('removes entire subtree', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[0];
    const docIds = nodes[chapterId].childrenIds;
    const result = removeNode(nodes, chapterId);
    expect(result[chapterId]).toBeUndefined();
    docIds.forEach(id => expect(result[id]).toBeUndefined());
  });

  it('updates parent childrenIds', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const childId = nodes[rootId].childrenIds[1]; // middle child
    const result = removeNode(nodes, childId);
    expect(result[rootId].childrenIds).toHaveLength(2);
  });

  it('reverts parent type to document when last child removed', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[0];
    // Remove all docs from chapter
    let current = nodes;
    const docIds = [...nodes[chapterId].childrenIds];
    for (const docId of docIds) {
      current = removeNode(current, docId);
    }
    expect(current[chapterId].type).toBe('document');
  });

  it('returns original nodes for unknown nodeId', () => {
    const { nodes } = makeSimpleTree(1);
    expect(removeNode(nodes, 'nonexistent')).toBe(nodes);
  });
});

// ── updateNode ──────────────────────────────────────────────────
describe('updateNode', () => {
  it('partially merges updates', () => {
    const { rootId, nodes } = makeSimpleTree(1);
    const childId = nodes[rootId].childrenIds[0];
    const result = updateNode(nodes, childId, { name: 'Updated Name' });
    expect(result[childId].name).toBe('Updated Name');
    expect(result[childId].content).toBe(''); // unchanged
  });

  it('returns original nodes for invalid nodeId', () => {
    const { nodes } = makeSimpleTree(1);
    expect(updateNode(nodes, 'nonexistent', { name: 'X' })).toBe(nodes);
  });
});

// ── moveNode ────────────────────────────────────────────────────
describe('moveNode', () => {
  it('moves node before target', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const [id1, id2, id3] = nodes[rootId].childrenIds;
    const result = moveNode(nodes, id3, id1, 'before');
    expect(result).not.toBeNull();
    expect(result![rootId].childrenIds[0]).toBe(id3);
  });

  it('moves node after target', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const [id1, id2, id3] = nodes[rootId].childrenIds;
    const result = moveNode(nodes, id1, id3, 'after');
    expect(result).not.toBeNull();
    const children = result![rootId].childrenIds;
    expect(children[children.length - 1]).toBe(id1);
  });

  it('moves node inside target', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const [id1, id2] = nodes[rootId].childrenIds;
    const result = moveNode(nodes, id2, id1, 'inside');
    expect(result).not.toBeNull();
    expect(result![id1].childrenIds).toContain(id2);
    expect(result![id2].parentId).toBe(id1);
  });

  it('returns null for self-move', () => {
    const { rootId, nodes } = makeSimpleTree(1);
    const childId = nodes[rootId].childrenIds[0];
    expect(moveNode(nodes, childId, childId, 'before')).toBeNull();
  });

  it('returns null for circular move (move into own descendant)', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[0];
    const docId = nodes[chapterId].childrenIds[0];
    // Try to move chapter inside its own child doc
    expect(moveNode(nodes, chapterId, docId, 'inside')).toBeNull();
  });

  it('promotes target to chapter when moving inside', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const [id1, id2] = nodes[rootId].childrenIds;
    const result = moveNode(nodes, id2, id1, 'inside');
    expect(result![id1].type).toBe('chapter');
  });

  it('reverts old parent to document when last child moves away', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const chapterId = nodes[rootId].childrenIds[0];
    const docIds = [...nodes[chapterId].childrenIds];
    let current: NodeMap | null = nodes;
    // Move all docs out of chapter to root
    for (const docId of docIds) {
      current = moveNode(current!, docId, rootId, 'inside');
    }
    expect(current![chapterId].type).toBe('document');
  });
});

// ── buildOutlineTreeString ──────────────────────────────────────
describe('buildOutlineTreeString', () => {
  it('produces indented output for flat tree', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const result = buildOutlineTreeString(nodes, rootId);
    expect(result).toContain('- Child 1');
    expect(result).toContain('- Child 2');
    expect(result).toContain('- Child 3');
  });

  it('produces nested indentation for two-level tree', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const result = buildOutlineTreeString(nodes, rootId);
    expect(result).toContain('- Chapter 1');
    expect(result).toContain('  - Doc 1.1');
  });

  it('respects maxDepth limit', () => {
    const { rootId, nodes } = makeTwoLevelTree();
    const result = buildOutlineTreeString(nodes, rootId, 1);
    expect(result).toContain('- Chapter 1');
    expect(result).not.toContain('Doc 1.1');
  });

  it('returns empty string for empty root', () => {
    const { rootId, nodes } = makeSimpleTree(0);
    expect(buildOutlineTreeString(nodes, rootId)).toBe('');
  });
});

// ── parseMarkdownToNodes ────────────────────────────────────────
describe('parseMarkdownToNodes', () => {
  it('parses flat list of items', () => {
    const md = '- Item 1\n- Item 2\n- Item 3';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    expect(nodes[rootNodeId].childrenIds).toHaveLength(3);
    const firstChild = nodes[nodes[rootNodeId].childrenIds[0]];
    expect(firstChild.name).toBe('Item 1');
  });

  it('parses nested items', () => {
    const md = '- Parent\n  - Child 1\n  - Child 2';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    const parentId = nodes[rootNodeId].childrenIds[0];
    expect(nodes[parentId].childrenIds).toHaveLength(2);
  });

  it('splits "Name: Content" format', () => {
    const md = '- Title: Some description here';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    const childId = nodes[rootNodeId].childrenIds[0];
    expect(nodes[childId].name).toBe('Title');
    expect(nodes[childId].content).toBe('Some description here');
  });

  it('handles line without colon as name-only', () => {
    const md = '- Just a title without content';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    const childId = nodes[rootNodeId].childrenIds[0];
    expect(nodes[childId].name).toBe('Just a title without content');
    expect(nodes[childId].content).toBe('');
  });

  it('sets root node with topic', () => {
    const { rootNodeId, nodes } = parseMarkdownToNodes('- Item', 'My Topic');
    expect(nodes[rootNodeId].name).toBe('My Topic');
    expect(nodes[rootNodeId].type).toBe('root');
  });

  it('promotes parents to chapter type', () => {
    const md = '- Parent\n  - Child';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    const parentId = nodes[rootNodeId].childrenIds[0];
    expect(nodes[parentId].type).toBe('chapter');
  });

  it('ignores non-list lines', () => {
    const md = 'Some text\n# Header\n- Actual item\nmore text';
    const { rootNodeId, nodes } = parseMarkdownToNodes(md, 'Test');
    expect(nodes[rootNodeId].childrenIds).toHaveLength(1);
  });
});

// ── generateMindmapFromSubtree ──────────────────────────────────
describe('generateMindmapFromSubtree', () => {
  it('produces valid mindmap syntax', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const result = generateMindmapFromSubtree(nodes[rootId], nodes);
    expect(result).toMatch(/^mindmap\n/);
    expect(result).toContain('root((Root))');
  });

  it('includes children', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const result = generateMindmapFromSubtree(nodes[rootId], nodes);
    expect(result).toContain('Child 1');
    expect(result).toContain('Child 2');
  });

  it('sanitizes special characters', () => {
    const root = makeNode({ name: 'Test (root)', type: 'root' });
    const nodes: NodeMap = { [root.id]: root };
    root.childrenIds = [];
    const result = generateMindmapFromSubtree(root, nodes);
    // Parentheses should be removed
    expect(result).not.toContain('(root)');
    expect(result).toContain('Test root');
  });
});

// ── generateFlowchartFromSubtree ────────────────────────────────
describe('generateFlowchartFromSubtree', () => {
  it('produces valid flowchart syntax', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const result = generateFlowchartFromSubtree(nodes[rootId], nodes);
    expect(result).toMatch(/^flowchart TD\n/);
  });

  it('includes node definitions with names', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const result = generateFlowchartFromSubtree(nodes[rootId], nodes);
    expect(result).toContain('"Root"');
    expect(result).toContain('"Child 1"');
  });

  it('includes connections between parent and child', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const result = generateFlowchartFromSubtree(nodes[rootId], nodes);
    expect(result).toContain('-->');
  });

  it('sanitizes special characters in names', () => {
    const root = makeNode({ name: 'Node [test]', type: 'root' });
    const nodes: NodeMap = { [root.id]: root };
    root.childrenIds = [];
    const result = generateFlowchartFromSubtree(root, nodes);
    // Brackets should be removed
    expect(result).not.toContain('[test]');
  });
});

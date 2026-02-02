import type { OutlineNode, NodeMap, NodeType, Outline } from '@/types';

let idCounter = 0;

/** Reset the deterministic ID counter (call in beforeEach). */
export function resetIds() {
  idCounter = 0;
}

/** Generate a deterministic ID for testing. */
function nextId(): string {
  return `test-id-${++idCounter}`;
}

/** Create a minimal OutlineNode with optional overrides. */
export function makeNode(overrides: Partial<OutlineNode> = {}): OutlineNode {
  const id = overrides.id ?? nextId();
  return {
    id,
    name: 'Node',
    content: '',
    type: 'document' as NodeType,
    parentId: null,
    childrenIds: [],
    isCollapsed: false,
    prefix: '',
    ...overrides,
  };
}

/** Create a root node with N direct children. */
export function makeSimpleTree(childCount: number): { rootId: string; nodes: NodeMap } {
  const root = makeNode({ name: 'Root', type: 'root' });
  const nodes: NodeMap = { [root.id]: root };

  for (let i = 0; i < childCount; i++) {
    const child = makeNode({
      name: `Child ${i + 1}`,
      type: 'document',
      parentId: root.id,
      prefix: `${i + 1}`,
    });
    nodes[child.id] = child;
    root.childrenIds.push(child.id);
  }

  if (childCount > 0) {
    root.type = 'root'; // root stays root
  }

  return { rootId: root.id, nodes };
}

/** Create root -> 2 chapters, each with 3 documents. */
export function makeTwoLevelTree(): { rootId: string; nodes: NodeMap } {
  const root = makeNode({ name: 'Root', type: 'root' });
  const nodes: NodeMap = { [root.id]: root };

  for (let c = 0; c < 2; c++) {
    const chapter = makeNode({
      name: `Chapter ${c + 1}`,
      type: 'chapter',
      parentId: root.id,
      prefix: `${c + 1}`,
    });
    nodes[chapter.id] = chapter;
    root.childrenIds.push(chapter.id);

    for (let d = 0; d < 3; d++) {
      const doc = makeNode({
        name: `Doc ${c + 1}.${d + 1}`,
        type: 'document',
        parentId: chapter.id,
        prefix: `${c + 1}.${d + 1}`,
      });
      nodes[doc.id] = doc;
      chapter.childrenIds.push(doc.id);
    }
  }

  return { rootId: root.id, nodes };
}

/** Wrap a NodeMap + rootNodeId into an Outline object. */
export function makeOutline(nodes: NodeMap, rootNodeId: string, name?: string): Outline {
  return {
    id: nextId(),
    name: name ?? nodes[rootNodeId]?.name ?? 'Test Outline',
    rootNodeId,
    nodes,
  };
}

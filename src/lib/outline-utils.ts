'use client';

import { v4 as uuidv4 } from 'uuid';
import type { OutlineNode, NodeMap, NodeType } from '@/types';

function copyNodes(nodes: NodeMap): NodeMap {
  const newNodes: NodeMap = {};
  for (const key in nodes) {
    newNodes[key] = { ...nodes[key], childrenIds: [...(nodes[key].childrenIds || [])] };
  }
  return newNodes;
}

export function calculateNodePrefix(nodes: NodeMap, nodeId: string): string {
    const node = nodes[nodeId];
    if (!node || node.type === 'root' || !node.parentId) {
        return '';
    }

    const path: number[] = [];
    let currentNodeId: string | null = nodeId;

    while (currentNodeId) {
        const currentNode = nodes[currentNodeId];
        if (!currentNode || !currentNode.parentId) break;

        const parent = nodes[currentNode.parentId];
        if (!parent || !parent.childrenIds) break;

        const index = parent.childrenIds.indexOf(currentNodeId);
        path.unshift(index + 1);

        if (parent.type === 'root') break;
        currentNodeId = parent.id;
    }

    return path.join('.');
}


export function recalculatePrefixesForBranch(nodes: NodeMap, startNodeId: string): void {
  const queue: string[] = [startNodeId];
  while(queue.length > 0) {
    const currentId = queue.shift()!;
    const currentNode = nodes[currentId];
    if (!currentNode) continue;

    currentNode.prefix = calculateNodePrefix(nodes, currentId);

    if (currentNode.childrenIds) {
      queue.push(...currentNode.childrenIds);
    }
  }
}

export function addNode(
  originalNodes: NodeMap,
  parentId: string,
  type: NodeType = 'document',
  name: string = 'New Node',
  content: string = ''
): { newNodes: NodeMap, newNodeId: string } {
  const newNodes = copyNodes(originalNodes);
  const parentNode = newNodes[parentId];

  if (!parentNode) {
    return { newNodes: originalNodes, newNodeId: '' };
  }

  const newNodeId = uuidv4();

  const newParentNode = { ...parentNode, childrenIds: [...(parentNode.childrenIds || [])] };
  newParentNode.childrenIds.push(newNodeId);
  newParentNode.isCollapsed = false;

  const newNode: OutlineNode = {
    id: newNodeId,
    name,
    content,
    type,
    parentId,
    childrenIds: [],
    isCollapsed: false,
    prefix: ''
  };

  newNodes[newNodeId] = newNode;
  newNodes[parentId] = newParentNode;

  if (newParentNode.type !== 'root' && newParentNode.childrenIds.length > 0) {
    newParentNode.type = 'chapter';
  }

  recalculatePrefixesForBranch(newNodes, parentId);

  return { newNodes, newNodeId };
}

// Add a new node as a sibling AFTER the specified node
export function addNodeAfter(
  originalNodes: NodeMap,
  afterNodeId: string,
  type: NodeType = 'document',
  name: string = 'New Node',
  content: string = ''
): { newNodes: NodeMap, newNodeId: string } {
  const newNodes = copyNodes(originalNodes);
  const afterNode = newNodes[afterNodeId];

  if (!afterNode || !afterNode.parentId) {
    // If no parent (root node), add as child instead
    return addNode(originalNodes, afterNodeId, type, name, content);
  }

  const parentId = afterNode.parentId;
  const parentNode = newNodes[parentId];

  if (!parentNode) {
    return { newNodes: originalNodes, newNodeId: '' };
  }

  const newNodeId = uuidv4();

  const newParentNode = { ...parentNode, childrenIds: [...(parentNode.childrenIds || [])] };

  // Find position of afterNode and insert new node right after it
  const afterIndex = newParentNode.childrenIds.indexOf(afterNodeId);
  newParentNode.childrenIds.splice(afterIndex + 1, 0, newNodeId);

  const newNode: OutlineNode = {
    id: newNodeId,
    name,
    content,
    type,
    parentId,
    childrenIds: [],
    isCollapsed: false,
    prefix: ''
  };

  newNodes[newNodeId] = newNode;
  newNodes[parentId] = newParentNode;

  if (newParentNode.type !== 'root' && newParentNode.childrenIds.length > 0) {
    newParentNode.type = 'chapter';
  }

  recalculatePrefixesForBranch(newNodes, parentId);

  return { newNodes, newNodeId };
}


export function removeNode(originalNodes: NodeMap, nodeId: string): NodeMap {
  const newNodes = copyNodes(originalNodes);
  const nodeToRemove = newNodes[nodeId];
  if (!nodeToRemove) return originalNodes;

  const idsToDelete: string[] = [];
  const queue: string[] = [nodeId];
  while(queue.length > 0) {
    const currentId = queue.shift()!;
    idsToDelete.push(currentId);
    const currentNode = newNodes[currentId];
    if (currentNode && currentNode.childrenIds) {
      queue.push(...currentNode.childrenIds);
    }
  }

  const parentId = nodeToRemove.parentId;
  if (parentId) {
    const parent = { ...newNodes[parentId], childrenIds: [...newNodes[parentId].childrenIds] };
    if (parent) {
      parent.childrenIds = parent.childrenIds.filter(id => id !== nodeId);
      if (parent.childrenIds.length === 0 && parent.type !== 'root') {
        parent.type = 'document';
      }
      newNodes[parentId] = parent;
      recalculatePrefixesForBranch(newNodes, parentId);
    }
  }

  idsToDelete.forEach(id => {
    delete newNodes[id];
  });

  return newNodes;
}

export function updateNode(originalNodes: NodeMap, nodeId: string, updates: Partial<OutlineNode>): NodeMap {
  const newNodes = copyNodes(originalNodes);
  const existingNode = newNodes[nodeId];
  if (!existingNode) {
    return originalNodes;
  }

  newNodes[nodeId] = { ...existingNode, ...updates };

  return newNodes;
}


const isDescendant = (nodes: NodeMap, potentialDescendantId: string, potentialAncestorId: string): boolean => {
    if (!potentialDescendantId || !potentialAncestorId || !nodes[potentialDescendantId] || !nodes[potentialAncestorId]) return false;
    let currentId: string | null = nodes[potentialDescendantId]?.parentId ?? null;
    while (currentId) {
        if (currentId === potentialAncestorId) {
            return true;
        }
        currentId = nodes[currentId]?.parentId ?? null;
    }
    return false;
};

export function moveNode(
  originalNodes: NodeMap,
  draggedId: string,
  targetId: string,
  position: 'before' | 'after' | 'inside'
): NodeMap | null {
    if (draggedId === targetId || isDescendant(originalNodes, targetId, draggedId)) {
        return null;
    }

    const nodes = copyNodes(originalNodes);
    const draggedNode = { ...nodes[draggedId] };
    const targetNode = nodes[targetId];

    if (!draggedNode || !targetNode) return null;

    const oldParentId = draggedNode.parentId;

    if (oldParentId) {
        const oldParent = { ...nodes[oldParentId], childrenIds: [...nodes[oldParentId].childrenIds] };
        oldParent.childrenIds = oldParent.childrenIds.filter(id => id !== draggedId);
        if (oldParent.childrenIds.length === 0 && oldParent.type === 'chapter' && oldParent.type !== 'root') {
            oldParent.type = 'document';
        }
        nodes[oldParentId] = oldParent;
    }

    let newParentId: string | null = null;
    if (position === 'inside') {
        newParentId = targetId;
        const newParent = { ...nodes[newParentId], childrenIds: [...nodes[newParentId].childrenIds] };
        newParent.childrenIds.push(draggedId);
        draggedNode.parentId = newParentId;

        if (newParent.type !== 'root' && newParent.type !== 'chapter') {
            newParent.type = 'chapter';
        }
        newParent.isCollapsed = false;
        nodes[newParentId] = newParent;
    } else {
        newParentId = targetNode.parentId;
        if (!newParentId) return null;

        draggedNode.parentId = newParentId;
        const newParent = { ...nodes[newParentId], childrenIds: [...nodes[newParentId].childrenIds] };

        const targetIndex = newParent.childrenIds.indexOf(targetId);

        if (position === 'before') {
            newParent.childrenIds.splice(targetIndex, 0, draggedId);
        } else {
            newParent.childrenIds.splice(targetIndex + 1, 0, draggedId);
        }
        nodes[newParentId] = newParent;
    }

    nodes[draggedId] = draggedNode;

    if (oldParentId) {
      recalculatePrefixesForBranch(nodes, oldParentId);
    }
    if (newParentId && newParentId !== oldParentId) {
      recalculatePrefixesForBranch(nodes, newParentId);
    } else if (newParentId) {
      recalculatePrefixesForBranch(nodes, newParentId);
    }

    return nodes;
}

export function parseMarkdownToNodes(markdown: string, topic: string): { rootNodeId: string, nodes: NodeMap } {
  const lines = markdown.split('\n').filter(line => line.trim().startsWith('- '));
  const rootId = uuidv4();
  const nodes: NodeMap = {
    [rootId]: { id: rootId, name: topic, content: `This outline was generated by AI based on the topic: "${topic}".`, type: 'root', parentId: null, childrenIds: [], isCollapsed: false, prefix: '' }
  };
  const parentStack: string[] = [rootId];

  lines.forEach(line => {
    const indentation = line.search(/\S|$/);
    const level = Math.floor(indentation / 2);
    const name = line.trim().substring(2);

    while (level < parentStack.length - 1) {
      parentStack.pop();
    }
    const parentId = parentStack[parentStack.length - 1];

    const newNodeId = uuidv4();

    const parentNode = nodes[parentId];
    if (parentNode) {
      if(!parentNode.childrenIds) parentNode.childrenIds = [];
      parentNode.childrenIds.push(newNodeId);
      if (parentNode.type !== 'root') {
        parentNode.type = 'chapter';
      }
    }

    const newNode: OutlineNode = {
      id: newNodeId,
      name,
      content: '',
      type: 'document',
      parentId: parentId,
      childrenIds: [],
      isCollapsed: false,
      prefix: '',
    };

    nodes[newNodeId] = newNode;
    parentStack.push(newNodeId);
  });

  recalculatePrefixesForBranch(nodes, rootId);

  return { rootNodeId: rootId, nodes };
}

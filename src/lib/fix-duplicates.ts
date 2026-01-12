/**
 * Utility to detect and fix duplicate node IDs in outline childrenIds arrays
 */

import type { Outline, NodeMap } from '@/types';

export function findDuplicateChildren(nodes: NodeMap): { nodeId: string; duplicates: string[] }[] {
  const issues: { nodeId: string; duplicates: string[] }[] = [];

  for (const [nodeId, node] of Object.entries(nodes)) {
    if (!node.childrenIds || node.childrenIds.length === 0) continue;

    // Find duplicates in childrenIds
    const seen = new Set<string>();
    const duplicates: string[] = [];

    for (const childId of node.childrenIds) {
      if (seen.has(childId)) {
        duplicates.push(childId);
      } else {
        seen.add(childId);
      }
    }

    if (duplicates.length > 0) {
      issues.push({
        nodeId,
        duplicates: Array.from(new Set(duplicates)), // unique duplicates
      });
    }
  }

  return issues;
}

export function fixDuplicateChildren(outline: Outline): {
  fixed: boolean;
  outline: Outline;
  report: string[];
} {
  const report: string[] = [];
  const newNodes = { ...outline.nodes };
  let fixed = false;

  // Find issues
  const issues = findDuplicateChildren(newNodes);

  if (issues.length === 0) {
    return { fixed: false, outline, report: ['No duplicate children found.'] };
  }

  // Fix each issue
  for (const issue of issues) {
    const node = newNodes[issue.nodeId];
    const originalLength = node.childrenIds.length;

    // Remove duplicates while preserving order (keep first occurrence)
    const seen = new Set<string>();
    node.childrenIds = node.childrenIds.filter((childId) => {
      if (seen.has(childId)) {
        return false; // Remove duplicate
      }
      seen.add(childId);
      return true; // Keep first occurrence
    });

    const removedCount = originalLength - node.childrenIds.length;
    report.push(
      `Fixed node "${node.name}" (${issue.nodeId}): removed ${removedCount} duplicate(s) - ${issue.duplicates.join(', ')}`
    );
    fixed = true;
  }

  return {
    fixed,
    outline: { ...outline, nodes: newNodes },
    report,
  };
}

/**
 * Check an outline for duplicate children and log report
 */
export function checkOutlineIntegrity(outline: Outline): void {
  const issues = findDuplicateChildren(outline.nodes);

  if (issues.length === 0) {
    console.log(`✅ Outline "${outline.name}" has no duplicate children`);
    return;
  }

  console.warn(`⚠️  Outline "${outline.name}" has duplicate children:`);
  for (const issue of issues) {
    const node = outline.nodes[issue.nodeId];
    console.warn(
      `  - Node "${node.name}" (${issue.nodeId}) has duplicate children: ${issue.duplicates.join(', ')}`
    );
  }
}

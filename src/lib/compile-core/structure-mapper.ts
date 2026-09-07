// ============================================================================
// compile-core / structure-mapper — THE canonical "levels → roles" decision.
// ----------------------------------------------------------------------------
// Phase 0 of the content-compiler architecture. The "which outline levels
// become chapters / sections / leaves of the output" logic was previously
// written from scratch in the video-slide deriver, the deck deriver, and the
// website exporter, each with its own caps buried as constants. This module is
// the one shared enumerator; each format supplies only its parameters.
//
// The mapper is deliberately tiny: a capped, depth-limited, pre-order
// enumeration of a subtree with a role per unit. Formats keep their own
// presentation policy (what a "slide" or "section" looks like); the mapper
// only decides WHICH nodes participate, in WHAT order, with WHAT role.
// ============================================================================

import { liveChildIds, type TraversableNodeMap } from './traverse';

/** What part a node plays in a compiled output. */
export type CompileRole = 'chapter' | 'section' | 'leaf';

export interface StructureUnit {
  nodeId: string;
  /** Depth below the compile root (root itself = 0). */
  depth: number;
  role: CompileRole;
}

export interface StructureMapOptions {
  /**
   * Deepest level (below the root) that gets its own unit. 1 = direct children
   * only; large values = the full subtree. Default: unlimited.
   */
  maxDepth?: number;
  /** Hard cap on total units, the root included. Default: unlimited. */
  maxUnits?: number;
  /**
   * Per-level caps on how many children of a node are taken: childCaps[d]
   * limits the children enumerated under a node sitting at depth d.
   * (e.g. the deck takes at most `maxSections` children of the root and at
   * most 6 children of each section.) Default: no per-level caps.
   */
  childCaps?: number[];
}

/**
 * Enumerate the units of a compile subtree in reading (pre-order) order.
 * Role assignment: the root is the 'chapter'; a descendant with live children
 * is a 'section'; a childless descendant is a 'leaf'.
 */
export function mapStructure(
  nodes: TraversableNodeMap,
  rootId: string,
  options: StructureMapOptions = {},
): StructureUnit[] {
  const root = nodes[rootId];
  if (!root) return [];

  const maxDepth = options.maxDepth ?? Number.POSITIVE_INFINITY;
  const maxUnits = options.maxUnits ?? Number.POSITIVE_INFINITY;
  const childCaps = options.childCaps ?? [];

  const units: StructureUnit[] = [];

  const roleOf = (id: string, depth: number): CompileRole => {
    if (depth === 0) return 'chapter';
    return liveChildIds(nodes, id).length > 0 ? 'section' : 'leaf';
  };

  const push = (id: string, depth: number): boolean => {
    if (units.length >= maxUnits) return false;
    units.push({ nodeId: id, depth, role: roleOf(id, depth) });
    return true;
  };

  if (!push(rootId, 0)) return units;

  const walk = (parentId: string, parentDepth: number): void => {
    if (parentDepth >= maxDepth) return;
    let children = liveChildIds(nodes, parentId);
    const cap = childCaps[parentDepth];
    if (cap !== undefined) children = children.slice(0, cap);
    for (const childId of children) {
      if (units.length >= maxUnits) return;
      if (!push(childId, parentDepth + 1)) return;
      walk(childId, parentDepth + 1);
      if (units.length >= maxUnits) return;
    }
  };

  walk(rootId, 0);
  return units;
}

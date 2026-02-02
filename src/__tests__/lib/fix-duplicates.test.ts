import {
  findDuplicateChildren,
  fixDuplicateChildren,
  checkOutlineIntegrity,
} from '@/lib/fix-duplicates';
import { makeSimpleTree, makeOutline, resetIds } from '../helpers/fixtures';
import type { NodeMap } from '@/types';

beforeEach(() => {
  resetIds();
});

// ── findDuplicateChildren ───────────────────────────────────────
describe('findDuplicateChildren', () => {
  it('returns empty array for clean tree', () => {
    const { nodes } = makeSimpleTree(3);
    expect(findDuplicateChildren(nodes)).toEqual([]);
  });

  it('detects duplicate childrenIds', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const childId = nodes[rootId].childrenIds[0];
    // Introduce a duplicate
    nodes[rootId].childrenIds.push(childId);

    const issues = findDuplicateChildren(nodes);
    expect(issues).toHaveLength(1);
    expect(issues[0].nodeId).toBe(rootId);
    expect(issues[0].duplicates).toContain(childId);
  });

  it('detects duplicates in multiple nodes', () => {
    const { rootId, nodes } = makeSimpleTree(3);
    const [id1, id2] = nodes[rootId].childrenIds;
    // Add a child to id1 and duplicate it
    const child = nodes[id2]; // reuse for simplicity
    nodes[id1].childrenIds = [id2, id2]; // duplicate

    const issues = findDuplicateChildren(nodes);
    expect(issues.length).toBeGreaterThanOrEqual(1);
  });

  it('handles nodes with no children', () => {
    const { nodes } = makeSimpleTree(0);
    expect(findDuplicateChildren(nodes)).toEqual([]);
  });
});

// ── fixDuplicateChildren ────────────────────────────────────────
describe('fixDuplicateChildren', () => {
  it('returns unchanged outline when no duplicates', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const outline = makeOutline(nodes, rootId);
    const { fixed, report } = fixDuplicateChildren(outline);
    expect(fixed).toBe(false);
    expect(report).toContain('No duplicate children found.');
  });

  it('removes duplicates keeping first occurrence', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const childId = nodes[rootId].childrenIds[0];
    nodes[rootId].childrenIds.push(childId); // add duplicate
    const outline = makeOutline(nodes, rootId);

    const { fixed, outline: fixedOutline, report } = fixDuplicateChildren(outline);
    expect(fixed).toBe(true);
    expect(fixedOutline.nodes[rootId].childrenIds.filter(id => id === childId)).toHaveLength(1);
    expect(report.length).toBeGreaterThan(0);
    expect(report[0]).toContain('removed');
  });

  it('generates report with node names', () => {
    const { rootId, nodes } = makeSimpleTree(2);
    const childId = nodes[rootId].childrenIds[0];
    nodes[rootId].childrenIds.push(childId);
    const outline = makeOutline(nodes, rootId);

    const { report } = fixDuplicateChildren(outline);
    expect(report[0]).toContain('Root');
  });
});

// ── checkOutlineIntegrity ───────────────────────────────────────
describe('checkOutlineIntegrity', () => {
  it('logs success for clean outline', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rootId, nodes } = makeSimpleTree(2);
    const outline = makeOutline(nodes, rootId, 'TestOutline');
    checkOutlineIntegrity(outline);

    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('TestOutline'));
    expect(warnSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it('warns for outline with duplicates', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { rootId, nodes } = makeSimpleTree(2);
    const childId = nodes[rootId].childrenIds[0];
    nodes[rootId].childrenIds.push(childId);
    const outline = makeOutline(nodes, rootId, 'BadOutline');

    checkOutlineIntegrity(outline);

    expect(warnSpy).toHaveBeenCalled();
    expect(warnSpy.mock.calls[0][0]).toContain('BadOutline');

    logSpy.mockRestore();
    warnSpy.mockRestore();
  });
});

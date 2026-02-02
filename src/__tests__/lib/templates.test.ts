import { templates, createBlankOutline } from '@/lib/templates';
import type { Outline } from '@/types';

// ── createBlankOutline ──────────────────────────────────────────
describe('createBlankOutline', () => {
  it('creates outline with default name', () => {
    const outline = createBlankOutline();
    expect(outline.name).toBe('Untitled Outline');
  });

  it('creates outline with custom name', () => {
    const outline = createBlankOutline('My Outline');
    expect(outline.name).toBe('My Outline');
  });

  it('has a single root node', () => {
    const outline = createBlankOutline();
    const nodeIds = Object.keys(outline.nodes);
    expect(nodeIds).toHaveLength(1);
    expect(outline.nodes[outline.rootNodeId].type).toBe('root');
  });

  it('root node name matches outline name', () => {
    const outline = createBlankOutline('Test');
    expect(outline.nodes[outline.rootNodeId].name).toBe('Test');
  });

  it('root node has empty childrenIds', () => {
    const outline = createBlankOutline();
    expect(outline.nodes[outline.rootNodeId].childrenIds).toEqual([]);
  });

  it('has unique id and rootNodeId', () => {
    const outline = createBlankOutline();
    expect(outline.id).toBeTruthy();
    expect(outline.rootNodeId).toBeTruthy();
    expect(outline.id).not.toBe(outline.rootNodeId);
  });

  it('generates different IDs each call', () => {
    const a = createBlankOutline();
    const b = createBlankOutline();
    expect(a.id).not.toBe(b.id);
    expect(a.rootNodeId).not.toBe(b.rootNodeId);
  });
});

// ── templates array ─────────────────────────────────────────────
describe('templates', () => {
  it('has 14 templates', () => {
    expect(templates).toHaveLength(14);
  });

  it('all templates have unique IDs', () => {
    const ids = templates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates have required fields', () => {
    templates.forEach(t => {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.icon).toBeTruthy();
      expect(typeof t.create).toBe('function');
    });
  });
});

// ── parameterized template validation ───────────────────────────
describe.each(templates.map(t => [t.id, t]))('template "%s"', (_id, template) => {
  let outline: Outline;

  beforeEach(() => {
    outline = template.create();
  });

  it('produces a valid outline with id and name', () => {
    expect(outline.id).toBeTruthy();
    expect(outline.name).toBeTruthy();
    expect(outline.rootNodeId).toBeTruthy();
  });

  it('root node exists and has type "root"', () => {
    const root = outline.nodes[outline.rootNodeId];
    expect(root).toBeDefined();
    expect(root.type).toBe('root');
  });

  it('root node has null parentId', () => {
    expect(outline.nodes[outline.rootNodeId].parentId).toBeNull();
  });

  it('root has at least one child', () => {
    expect(outline.nodes[outline.rootNodeId].childrenIds.length).toBeGreaterThan(0);
  });

  it('all childrenIds reference existing nodes', () => {
    Object.values(outline.nodes).forEach(node => {
      node.childrenIds.forEach(childId => {
        expect(outline.nodes[childId]).toBeDefined();
      });
    });
  });

  it('all non-root nodes reference existing parent', () => {
    Object.values(outline.nodes).forEach(node => {
      if (node.type !== 'root' && node.parentId) {
        expect(outline.nodes[node.parentId]).toBeDefined();
      }
    });
  });

  it('parent-child relationship is bidirectional', () => {
    Object.values(outline.nodes).forEach(node => {
      if (node.parentId) {
        const parent = outline.nodes[node.parentId];
        expect(parent.childrenIds).toContain(node.id);
      }
    });
  });

  it('outline name is a non-empty string', () => {
    expect(outline.name).toBeTruthy();
    expect(typeof outline.name).toBe('string');
  });
});

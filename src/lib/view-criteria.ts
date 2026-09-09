// "Show Me" custom views — structured, visible, editable filter criteria.
//
// This is the criteria engine behind the natural-language view feature (P3).
// It EXTENDS the 1988 search-as-view-shaper lineage (see outline-search.tsx
// and outline-pro.tsx handleApplySearchView): criteria produce a set of
// matched node IDs, and the SAME compress-don't-hide reshape presents them —
// matches + ancestors unfold, every other branch is compressed but remains a
// visible, chevron-openable row. Nothing here ever hides or removes a node.
//
// Everything in this file is PURE LOCAL LOGIC — no AI, no network, no cost.
// The optional AI front-end (parse-view-criteria flow) only TRANSLATES a
// natural-language request into these same criterion rows; evaluation is
// always local, so the whole capability works on the free tier with manual
// rows.
//
// NOTE: types are defined locally (not in src/types/index.ts) because that
// file had in-flight edits when this feature landed (2026-09-09). They can be
// promoted later if other modules need them.

import type { NodeMap, OutlineNode, NodeType, TaskPriority, NodeColor } from '@/types';

// ---------------------------------------------------------------------------
// Criterion vocabulary — derived from what OutlineNode actually stores.
// ---------------------------------------------------------------------------

export type ViewField =
  | 'name'       // node title text
  | 'content'    // node body text (HTML stripped)
  | 'anyText'    // name OR content
  | 'tag'        // metadata.tags
  | 'type'       // NodeType ('task', 'note', …)
  | 'completed'  // metadata.isCompleted (tasks)
  | 'priority'   // metadata.priority (Low/Medium/High)
  | 'color'      // metadata.color
  | 'created'    // metadata.createdAt
  | 'updated'    // metadata.updatedAt
  | 'due'        // metadata.dueDate
  | 'branch';    // node sits under an ancestor whose name contains the value

export type ViewOperator =
  | 'contains'
  | 'not-contains'
  | 'is'
  | 'is-not'
  | 'on-or-after'   // dates: >= start of the given day
  | 'on-or-before'; // dates: <= end of the given day

export interface ViewCriterion {
  id: string;            // stable row id for React lists
  field: ViewField;
  operator: ViewOperator;
  value: string;         // text, tag, type, priority, color, 'yes'/'no', or YYYY-MM-DD
}

export type ViewMatchMode = 'all' | 'any'; // AND / OR across rows

// A saved, named view: a durable QUERY, not a snapshot. Re-opening a saved
// view re-evaluates its criteria against the outline's CURRENT nodes.
export interface SavedOutlineView {
  id: string;
  outlineId: string;
  name: string;
  matchMode: ViewMatchMode;
  criteria: ViewCriterion[];
  createdAt: number;
  updatedAt: number;
}

// Which operators make sense for each field (drives the row editor UI and
// the sanitizer that guards AI-produced criteria).
export const FIELD_OPERATORS: Record<ViewField, ViewOperator[]> = {
  name: ['contains', 'not-contains'],
  content: ['contains', 'not-contains'],
  anyText: ['contains', 'not-contains'],
  tag: ['is', 'is-not'],
  type: ['is', 'is-not'],
  completed: ['is'],
  priority: ['is', 'is-not'],
  color: ['is', 'is-not'],
  created: ['on-or-after', 'on-or-before'],
  updated: ['on-or-after', 'on-or-before'],
  due: ['on-or-after', 'on-or-before'],
  branch: ['contains'],
};

export const FIELD_LABELS: Record<ViewField, string> = {
  name: 'Item name',
  content: 'Item content',
  anyText: 'Name or content',
  tag: 'Tag',
  type: 'Item type',
  completed: 'Completed',
  priority: 'Priority',
  color: 'Color',
  created: 'Created date',
  updated: 'Updated date',
  due: 'Due date',
  branch: 'Under branch named',
};

export const OPERATOR_LABELS: Record<ViewOperator, string> = {
  contains: 'contains',
  'not-contains': 'does not contain',
  is: 'is',
  'is-not': 'is not',
  'on-or-after': 'on or after',
  'on-or-before': 'on or before',
};

export const PRIORITY_VALUES: TaskPriority[] = ['Low', 'Medium', 'High'];
export const COLOR_VALUES: NodeColor[] = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
// Common node types offered in the row editor (any valid NodeType string is
// accepted by the evaluator).
export const TYPE_VALUES: NodeType[] = ['task', 'note', 'chapter', 'document', 'link', 'code', 'quote', 'date', 'image'];

let rowCounter = 0;
export function newCriterionId(): string {
  rowCounter += 1;
  return `vc-${Date.now().toString(36)}-${rowCounter}`;
}

export function makeCriterion(field: ViewField = 'anyText'): ViewCriterion {
  return { id: newCriterionId(), field, operator: FIELD_OPERATORS[field][0], value: '' };
}

// ---------------------------------------------------------------------------
// Sanitizer — clamp an untrusted (e.g. AI-produced) criterion into the
// legal vocabulary. Returns null if the row can't be salvaged.
// ---------------------------------------------------------------------------

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function sanitizeCriterion(raw: unknown): ViewCriterion | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const field = typeof r.field === 'string' && (r.field as ViewField) in FIELD_OPERATORS
    ? (r.field as ViewField)
    : null;
  if (!field) return null;

  const legalOps = FIELD_OPERATORS[field];
  const operator = typeof r.operator === 'string' && legalOps.includes(r.operator as ViewOperator)
    ? (r.operator as ViewOperator)
    : legalOps[0];

  let value = typeof r.value === 'string' ? r.value.trim() : '';
  if (field === 'created' || field === 'updated' || field === 'due') {
    if (!DATE_RE.test(value)) return null;
  }
  if (field === 'completed') {
    value = /^(yes|true|done|completed)$/i.test(value) ? 'yes' : 'no';
  }
  if (field === 'priority') {
    const hit = PRIORITY_VALUES.find(p => p.toLowerCase() === value.toLowerCase());
    if (!hit) return null;
    value = hit;
  }
  if (field === 'color') {
    const hit = COLOR_VALUES.find(c => c === value.toLowerCase());
    if (!hit) return null;
    value = hit;
  }
  if (value.length === 0) return null;
  if (value.length > 200) value = value.slice(0, 200);

  return { id: newCriterionId(), field, operator, value };
}

// ---------------------------------------------------------------------------
// Evaluation — pure, synchronous, local.
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  if (!html) return '';
  if (typeof document !== 'undefined') {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
  return html.replace(/<[^>]*>/g, ' ');
}

function dayStart(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

function dayEnd(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime();
}

// Precompute the set of node IDs sitting under any branch whose NAME contains
// the given text (the branch node itself is included).
function branchMemberIds(nodes: NodeMap, needle: string): Set<string> {
  const members = new Set<string>();
  const lower = needle.toLowerCase();
  for (const node of Object.values(nodes)) {
    if (!node.name.toLowerCase().includes(lower)) continue;
    if (members.has(node.id)) continue;
    members.add(node.id);
    const stack = [...(node.childrenIds || [])];
    while (stack.length) {
      const id = stack.pop();
      if (!id || members.has(id)) continue;
      members.add(id);
      const child = nodes[id];
      if (child?.childrenIds?.length) stack.push(...child.childrenIds);
    }
  }
  return members;
}

function criterionMatches(
  node: OutlineNode,
  c: ViewCriterion,
  branchSets: Map<string, Set<string>>,
  contentCache: Map<string, string>,
): boolean {
  const v = c.value.toLowerCase();
  switch (c.field) {
    case 'name': {
      const hit = node.name.toLowerCase().includes(v);
      return c.operator === 'not-contains' ? !hit : hit;
    }
    case 'content': {
      let text = contentCache.get(node.id);
      if (text === undefined) {
        text = stripHtml(node.content || '').toLowerCase();
        contentCache.set(node.id, text);
      }
      const hit = text.includes(v);
      return c.operator === 'not-contains' ? !hit : hit;
    }
    case 'anyText': {
      let text = contentCache.get(node.id);
      if (text === undefined) {
        text = stripHtml(node.content || '').toLowerCase();
        contentCache.set(node.id, text);
      }
      const hit = node.name.toLowerCase().includes(v) || text.includes(v);
      return c.operator === 'not-contains' ? !hit : hit;
    }
    case 'tag': {
      const tags = (node.metadata?.tags || []).map(t => t.toLowerCase());
      const hit = tags.includes(v);
      return c.operator === 'is-not' ? !hit : hit;
    }
    case 'type': {
      const hit = node.type.toLowerCase() === v;
      return c.operator === 'is-not' ? !hit : hit;
    }
    case 'completed': {
      const done = node.metadata?.isCompleted === true;
      return c.value === 'yes' ? done : !done;
    }
    case 'priority': {
      const hit = (node.metadata?.priority || '').toLowerCase() === v;
      return c.operator === 'is-not' ? !hit : hit;
    }
    case 'color': {
      const hit = (node.metadata?.color || '').toLowerCase() === v;
      return c.operator === 'is-not' ? !hit : hit;
    }
    case 'created':
    case 'updated':
    case 'due': {
      const ts = c.field === 'created'
        ? node.metadata?.createdAt
        : c.field === 'updated'
          ? node.metadata?.updatedAt
          : node.metadata?.dueDate;
      if (typeof ts !== 'number') return false; // no data → no match
      return c.operator === 'on-or-after' ? ts >= dayStart(c.value) : ts <= dayEnd(c.value);
    }
    case 'branch': {
      const set = branchSets.get(c.value.toLowerCase());
      return set ? set.has(node.id) : false;
    }
    default:
      return false;
  }
}

/**
 * Evaluate criteria against the outline's nodes. Returns matched node IDs
 * (root excluded — the root always renders anyway). Empty criteria → [].
 */
export function evaluateViewCriteria(
  nodes: NodeMap,
  rootNodeId: string,
  criteria: ViewCriterion[],
  matchMode: ViewMatchMode,
): string[] {
  const usable = criteria.filter(c => c.value.trim().length > 0);
  if (usable.length === 0) return [];

  // Precompute branch membership sets once per distinct branch value.
  const branchSets = new Map<string, Set<string>>();
  for (const c of usable) {
    if (c.field === 'branch') {
      const key = c.value.toLowerCase();
      if (!branchSets.has(key)) branchSets.set(key, branchMemberIds(nodes, c.value));
    }
  }

  const contentCache = new Map<string, string>();
  const matched: string[] = [];
  for (const node of Object.values(nodes)) {
    if (node.id === rootNodeId) continue;
    const ok = matchMode === 'all'
      ? usable.every(c => criterionMatches(node, c, branchSets, contentCache))
      : usable.some(c => criterionMatches(node, c, branchSets, contentCache));
    if (ok) matched.push(node.id);
  }
  return matched;
}

/** Plain-English one-liner for a criterion (for tooltips / summaries). */
export function describeCriterion(c: ViewCriterion): string {
  return `${FIELD_LABELS[c.field]} ${OPERATOR_LABELS[c.operator]} "${c.value}"`;
}

// ---------------------------------------------------------------------------
// Saved views persistence — localStorage, alongside the app's other durable
// preferences. Views are durable queries: nothing about results is stored.
// ---------------------------------------------------------------------------

const SAVED_VIEWS_KEY = 'ideam-saved-views-v1';

function readAllViews(): SavedOutlineView[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SAVED_VIEWS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAllViews(views: SavedOutlineView[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(SAVED_VIEWS_KEY, JSON.stringify(views));
  } catch {
    // Storage full/unavailable — non-fatal; the in-session view still works.
  }
}

export function loadSavedViews(outlineId: string): SavedOutlineView[] {
  return readAllViews()
    .filter(v => v.outlineId === outlineId)
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Insert or update (by outlineId + name, case-insensitive). Returns the saved record. */
export function upsertSavedView(
  outlineId: string,
  name: string,
  matchMode: ViewMatchMode,
  criteria: ViewCriterion[],
): SavedOutlineView {
  const all = readAllViews();
  const now = Date.now();
  const existing = all.find(
    v => v.outlineId === outlineId && v.name.toLowerCase() === name.toLowerCase(),
  );
  if (existing) {
    existing.name = name;
    existing.matchMode = matchMode;
    existing.criteria = criteria;
    existing.updatedAt = now;
    writeAllViews(all);
    return existing;
  }
  const record: SavedOutlineView = {
    id: `view-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    outlineId,
    name,
    matchMode,
    criteria,
    createdAt: now,
    updatedAt: now,
  };
  all.push(record);
  writeAllViews(all);
  return record;
}

export function deleteSavedView(viewId: string): void {
  writeAllViews(readAllViews().filter(v => v.id !== viewId));
}

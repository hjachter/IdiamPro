'use client';

// Public, no-login "Try it live" demo of the IdeaM outliner.
//
// COST-SAFETY (hard rule): this page imports NO AI modules, NO server actions,
// NO entitlements, and NO storage-manager code. It is a fully standalone,
// browser-only outliner. An anonymous visitor therefore cannot trigger any
// paid AI network request from here — the code path simply does not exist.
// The real app's OutlinePro component is ~5,900 lines and deeply coupled to
// auth, server storage, and AI server actions, so reusing it directly would
// pull all of that machinery (and its cost surface) onto a public page. A
// clean, lightweight re-implementation of the two-pane outliner keeps the
// demo genuinely interactive while guaranteeing cost-safety by construction.
//
// Demo data lives ONLY in the browser under a clearly-namespaced localStorage
// key. Nothing is sent to any server.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { AmplifyMark } from '@/components/brand/amplify-mark';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  CornerDownRight,
  IndentIncrease,
  IndentDecrease,
  ArrowUp,
  ArrowDown,
  Trash2,
  RotateCcw,
  Sparkles,
  Lock,
  ArrowRight,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Minimal local data model (a friendly subset of the real app's OutlineNode).
// ---------------------------------------------------------------------------

interface DemoNode {
  id: string;
  name: string;
  content: string;
  parentId: string | null;
  childrenIds: string[];
  collapsed: boolean;
}

type DemoMap = Record<string, DemoNode>;

interface DemoOutline {
  rootId: string;
  nodes: DemoMap;
}

const STORAGE_KEY = 'ideam-try-sandbox-v1';

const uid = () => 'n_' + Math.random().toString(36).slice(2, 10);

// ---------------------------------------------------------------------------
// Pre-seeded sample outline — inviting, not empty.
// ---------------------------------------------------------------------------

function buildSampleOutline(): DemoOutline {
  const nodes: DemoMap = {};
  const make = (
    name: string,
    content: string,
    parentId: string | null,
    collapsed = false
  ): DemoNode => {
    const node: DemoNode = {
      id: uid(),
      name,
      content,
      parentId,
      childrenIds: [],
      collapsed,
    };
    nodes[node.id] = node;
    if (parentId) nodes[parentId].childrenIds.push(node.id);
    return node;
  };

  const root = make(
    'Plan a trip to Japan',
    'A 12-day first-time trip. Drag ideas around, split them into sub-points, and watch a vague plan turn into a real one. Click any line to write notes on the right.',
    null
  );

  const before = make('Before you go', 'The boring-but-critical stuff, up front.', root.id);
  make('Book flights (compare Tue/Wed departures)', 'Shoulder-season fares are noticeably cheaper. Aim for a Tuesday or Wednesday out.', before.id);
  make('Japan Rail Pass — worth it?', 'Only pays off if you do several long bullet-train hops. Map the route first, then decide.', before.id);
  make('Pocket wifi or eSIM', 'An eSIM is usually cheaper for one traveler; pocket wifi wins for a group.', before.id);

  const cities = make('Cities & days', 'Rough shape of the itinerary — reorder as you learn more.', root.id);
  const tokyo = make('Tokyo — 5 days', 'Base for the first half. Big, endless, worth the time.', cities.id);
  make('Shibuya & Shinjuku at night', 'The neon-and-crowds experience everyone pictures.', tokyo.id);
  make('teamLab Planets (book ahead!)', 'Timed tickets sell out. Buy the moment dates are set.', tokyo.id);
  make('Day trip: Kamakura', 'Big Buddha, coastal walk, easy train ride from the city.', tokyo.id);
  const kyoto = make('Kyoto — 4 days', 'The temples-and-tradition half of the trip.', cities.id);
  make('Fushimi Inari at sunrise', 'Go early to beat the crowds on the torii-gate path.', kyoto.id);
  make('Arashiyama bamboo grove', 'Pair it with the nearby monkey park for a half day.', kyoto.id);
  make('Osaka — 3 days', 'Food capital. Come hungry.', cities.id);

  const food = make('Food to try', "Don't overthink it — just eat well.", root.id, true);
  make('Proper tonkatsu', 'Crispy fried pork cutlet. Find a specialist, not a chain.', food.id);
  make('Conveyor-belt sushi', 'Fun, cheap, and genuinely good.', food.id);
  make('Convenience-store breakfast', 'Underrated. The egg sandwiches are famous for a reason.', food.id);

  const budget = make('Budget (rough)', 'Keep a running total here as plans firm up.', root.id, true);
  make('Flights: ~$1,100', '', budget.id);
  make('Lodging: ~$120/night', '', budget.id);
  make('Rail + transit: ~$350', '', budget.id);

  return { rootId: root.id, nodes };
}

// ---------------------------------------------------------------------------
// Persistence (browser-only).
// ---------------------------------------------------------------------------

function loadOutline(): DemoOutline {
  if (typeof window === 'undefined') return buildSampleOutline();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoOutline;
      if (parsed?.rootId && parsed?.nodes?.[parsed.rootId]) return parsed;
    }
  } catch {
    /* fall through to a fresh sample */
  }
  return buildSampleOutline();
}

function saveOutline(o: DemoOutline) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(o));
  } catch {
    /* storage full or blocked — demo still works in-memory */
  }
}

// ---------------------------------------------------------------------------
// The page.
// ---------------------------------------------------------------------------

export default function TryPage() {
  const [outline, setOutline] = useState<DemoOutline>(() => buildSampleOutline());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const editInputRef = useRef<HTMLInputElement | null>(null);

  // Load persisted (or sample) data after mount to avoid hydration mismatch.
  useEffect(() => {
    const loaded = loadOutline();
    setOutline(loaded);
    setSelectedId(loaded.rootId);
    setHydrated(true);
  }, []);

  // Persist on every change (after initial hydration).
  useEffect(() => {
    if (hydrated) saveOutline(outline);
  }, [outline, hydrated]);

  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const nodes = outline.nodes;
  const selected = selectedId ? nodes[selectedId] : null;

  // ---- mutation helpers (all pure, all local) ----

  const commit = useCallback((updater: (draft: DemoMap) => void, opts?: { select?: string }) => {
    setOutline((prev) => {
      const next: DemoMap = {};
      for (const k of Object.keys(prev.nodes)) next[k] = { ...prev.nodes[k], childrenIds: [...prev.nodes[k].childrenIds] };
      updater(next);
      return { rootId: prev.rootId, nodes: next };
    });
    if (opts?.select) setSelectedId(opts.select);
  }, []);

  const addSibling = useCallback((afterId: string) => {
    const node = nodes[afterId];
    if (!node || node.parentId === null) {
      // Root: add a top-level child instead.
      const child: DemoNode = { id: uid(), name: 'New idea', content: '', parentId: outline.rootId, childrenIds: [], collapsed: false };
      commit((d) => { d[child.id] = child; d[outline.rootId].childrenIds.push(child.id); }, { select: child.id });
      setEditingId(child.id);
      return;
    }
    const parent = nodes[node.parentId];
    const idx = parent.childrenIds.indexOf(afterId);
    const sib: DemoNode = { id: uid(), name: 'New idea', content: '', parentId: parent.id, childrenIds: [], collapsed: false };
    commit((d) => { d[sib.id] = sib; d[parent.id].childrenIds.splice(idx + 1, 0, sib.id); }, { select: sib.id });
    setEditingId(sib.id);
  }, [nodes, outline.rootId, commit]);

  const addChild = useCallback((parentId: string) => {
    const child: DemoNode = { id: uid(), name: 'New idea', content: '', parentId, childrenIds: [], collapsed: false };
    commit((d) => { d[child.id] = child; d[parentId].childrenIds.push(child.id); d[parentId].collapsed = false; }, { select: child.id });
    setEditingId(child.id);
  }, [commit]);

  const indent = useCallback((id: string) => {
    const node = nodes[id];
    if (!node || !node.parentId) return;
    const parent = nodes[node.parentId];
    const idx = parent.childrenIds.indexOf(id);
    if (idx <= 0) return; // no previous sibling to nest under
    const newParentId = parent.childrenIds[idx - 1];
    commit((d) => {
      d[parent.id].childrenIds.splice(idx, 1);
      d[newParentId].childrenIds.push(id);
      d[newParentId].collapsed = false;
      d[id].parentId = newParentId;
    });
  }, [nodes, commit]);

  const outdent = useCallback((id: string) => {
    const node = nodes[id];
    if (!node || !node.parentId) return;
    const parent = nodes[node.parentId];
    if (!parent.parentId) return; // already top level
    const grand = nodes[parent.parentId];
    const parentIdx = grand.childrenIds.indexOf(parent.id);
    const idx = parent.childrenIds.indexOf(id);
    commit((d) => {
      d[parent.id].childrenIds.splice(idx, 1);
      d[grand.id].childrenIds.splice(parentIdx + 1, 0, id);
      d[id].parentId = grand.id;
    });
  }, [nodes, commit]);

  const moveVertical = useCallback((id: string, dir: -1 | 1) => {
    const node = nodes[id];
    if (!node || !node.parentId) return;
    const parent = nodes[node.parentId];
    const idx = parent.childrenIds.indexOf(id);
    const swap = idx + dir;
    if (swap < 0 || swap >= parent.childrenIds.length) return;
    commit((d) => {
      const arr = d[parent.id].childrenIds;
      [arr[idx], arr[swap]] = [arr[swap], arr[idx]];
    });
  }, [nodes, commit]);

  const removeNode = useCallback((id: string) => {
    const node = nodes[id];
    if (!node || !node.parentId) return; // never delete the root
    const parentId = node.parentId;
    commit((d) => {
      const collectSubtree = (nid: string, acc: string[]) => {
        acc.push(nid);
        for (const c of d[nid].childrenIds) collectSubtree(c, acc);
        return acc;
      };
      const toRemove = collectSubtree(id, []);
      d[parentId].childrenIds = d[parentId].childrenIds.filter((c) => c !== id);
      for (const r of toRemove) delete d[r];
    });
    setSelectedId(parentId);
  }, [nodes, commit]);

  const rename = useCallback((id: string, name: string) => {
    commit((d) => { if (d[id]) d[id].name = name; });
  }, [commit]);

  const setContent = useCallback((id: string, content: string) => {
    commit((d) => { if (d[id]) d[id].content = content; });
  }, [commit]);

  const toggleCollapse = useCallback((id: string) => {
    commit((d) => { if (d[id]) d[id].collapsed = !d[id].collapsed; });
  }, [commit]);

  const setAllCollapsed = useCallback((collapsed: boolean) => {
    commit((d) => {
      for (const k of Object.keys(d)) {
        if (k !== outline.rootId && d[k].childrenIds.length > 0) d[k].collapsed = collapsed;
      }
    });
  }, [commit, outline.rootId]);

  const resetDemo = useCallback(() => {
    const fresh = buildSampleOutline();
    setOutline(fresh);
    setSelectedId(fresh.rootId);
    setEditingId(null);
  }, []);

  // ---- drag-reorder (drop a node to become a child of the target) ----
  const isDescendant = useCallback((ancestorId: string, maybeChildId: string): boolean => {
    let cur: string | null = maybeChildId;
    while (cur) {
      if (cur === ancestorId) return true;
      cur = nodes[cur]?.parentId ?? null;
    }
    return false;
  }, [nodes]);

  const handleDrop = useCallback((targetId: string) => {
    const id = dragId;
    setDragId(null);
    setDropTargetId(null);
    if (!id || id === targetId) return;
    const node = nodes[id];
    if (!node || !node.parentId) return; // root can't move
    if (isDescendant(id, targetId)) return; // can't drop into own subtree
    if (node.parentId === targetId) return; // already a child there
    commit((d) => {
      const oldParent = d[node.parentId as string];
      oldParent.childrenIds = oldParent.childrenIds.filter((c) => c !== id);
      d[targetId].childrenIds.push(id);
      d[targetId].collapsed = false;
      d[id].parentId = targetId;
    });
  }, [dragId, nodes, isDescendant, commit]);

  // ---- keyboard on a selected (non-editing) row ----
  const onRowKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (editingId) return;
    if (e.key === 'Enter') { e.preventDefault(); addSibling(id); }
    else if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); indent(id); }
    else if (e.key === 'Tab' && e.shiftKey) { e.preventDefault(); outdent(id); }
    else if (e.key === 'Backspace' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); removeNode(id); }
  }, [editingId, addSibling, indent, outdent, removeNode]);

  // ---- recursive tree render ----
  const renderNode = (id: string, depth: number): React.ReactNode => {
    const node = nodes[id];
    if (!node) return null;
    const hasChildren = node.childrenIds.length > 0;
    const isSelected = selectedId === id;
    const isEditing = editingId === id;
    const isRoot = node.parentId === null;
    const isDropTarget = dropTargetId === id;

    return (
      <div key={id}>
        <div
          role="treeitem"
          aria-selected={isSelected}
          tabIndex={isSelected ? 0 : -1}
          draggable={!isRoot && !isEditing}
          onDragStart={() => setDragId(id)}
          onDragOver={(e) => { e.preventDefault(); if (dragId && dragId !== id) setDropTargetId(id); }}
          onDragLeave={() => { if (dropTargetId === id) setDropTargetId(null); }}
          onDrop={(e) => { e.preventDefault(); handleDrop(id); }}
          onDragEnd={() => { setDragId(null); setDropTargetId(null); }}
          onClick={() => setSelectedId(id)}
          onDoubleClick={() => { setSelectedId(id); setEditingId(id); }}
          onKeyDown={(e) => onRowKeyDown(e, id)}
          className={[
            'group flex items-center gap-1.5 rounded-md pr-2 cursor-pointer select-none transition-colors',
            isSelected ? 'bg-blue-600/10 ring-1 ring-blue-600/40' : 'hover:bg-[#f1f5f9]',
            isDropTarget ? 'ring-2 ring-blue-600 bg-blue-600/5' : '',
          ].join(' ')}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          {/* collapse chevron */}
          <button
            type="button"
            aria-label={hasChildren ? (node.collapsed ? 'Expand' : 'Collapse') : 'No children'}
            onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleCollapse(id); }}
            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded ${hasChildren ? 'text-[#64748b] hover:bg-[#e2e8f0]' : 'text-transparent'}`}
          >
            {hasChildren ? (node.collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />) : <ChevronRight className="h-4 w-4" />}
          </button>

          {/* bullet */}
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isRoot ? 'bg-blue-600' : 'bg-[#94a3b8]'}`} />

          {/* label / inline editor */}
          {isEditing ? (
            <input
              ref={editInputRef}
              defaultValue={node.name}
              onClick={(e) => e.stopPropagation()}
              onBlur={(e) => { rename(id, e.target.value.trim() || 'Untitled'); setEditingId(null); }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); rename(id, (e.target as HTMLInputElement).value.trim() || 'Untitled'); setEditingId(null); }
                else if (e.key === 'Escape') { e.preventDefault(); setEditingId(null); }
              }}
              className="my-1 w-full rounded border border-blue-600/50 bg-white px-2 py-1 text-sm text-[#0b1533] outline-none focus:ring-2 focus:ring-blue-600/40"
            />
          ) : (
            <span className={`truncate py-1.5 text-sm ${isRoot ? 'font-bold text-[#0b1533]' : 'font-medium text-[#1e293b]'}`}>
              {node.name}
            </span>
          )}
        </div>

        {hasChildren && !node.collapsed && (
          <div role="group">
            {node.childrenIds.map((cid) => renderNode(cid, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const nodeCount = useMemo(() => Object.keys(nodes).length, [nodes]);

  // ---- Smart Tools nudge (no real AI — signup funnel only) ----
  const smartTools = ['Expand this into detail', 'Summarize the branch', 'Suggest sub-topics', 'Turn into a checklist'];

  return (
    <div className="flex h-screen flex-col bg-white text-[#0b1533]" style={{ fontFamily: 'var(--font-plex-sans), system-ui, sans-serif' }}>
      {/* ---- top bar: wordmark + sandbox note + Sign up free ---- */}
      <header className="flex shrink-0 items-center justify-between border-b border-[#dde5f2] px-4 py-3 sm:px-6">
        <Link href="/" aria-label="IdeaM home" className="flex items-center gap-2.5">
          <AmplifyMark className="h-9 w-9 rounded-xl shadow-lg shadow-blue-600/20" />
          <span className="text-xl font-extrabold tracking-tight">
            <span className="text-[#0b1533]">Idea</span><span className="text-blue-600">M</span>
          </span>
          <span className="ml-2 hidden rounded-full border border-[#cbd5e1] bg-[#f1f5f9] px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-[#475569] sm:inline">
            Live demo
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <Link href="/features" className="hidden text-sm text-[#475569] transition-colors hover:text-[#0b1533] sm:inline">
            Features
          </Link>
          <Link
            href="/signup"
            className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[#38bdf8] via-[#2563eb] to-[#4f46e5] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition-opacity hover:opacity-95"
          >
            Sign up free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* ---- toolbar ---- */}
      <div className="flex shrink-0 flex-wrap items-center gap-1 border-b border-[#eef2f7] bg-[#fafbfd] px-3 py-2">
        <ToolBtn icon={Plus} label="Add" onClick={() => selected && addSibling(selected.id)} />
        <ToolBtn icon={CornerDownRight} label="Add child" onClick={() => selected && addChild(selected.id)} />
        <Divider />
        <ToolBtn icon={IndentIncrease} label="Indent" onClick={() => selected && indent(selected.id)} />
        <ToolBtn icon={IndentDecrease} label="Outdent" onClick={() => selected && outdent(selected.id)} />
        <ToolBtn icon={ArrowUp} label="Up" onClick={() => selected && moveVertical(selected.id, -1)} />
        <ToolBtn icon={ArrowDown} label="Down" onClick={() => selected && moveVertical(selected.id, 1)} />
        <Divider />
        <ToolBtn icon={ChevronDown} label="Expand all" onClick={() => setAllCollapsed(false)} />
        <ToolBtn icon={ChevronRight} label="Collapse all" onClick={() => setAllCollapsed(true)} />
        <Divider />
        <ToolBtn
          icon={Trash2}
          label="Delete"
          disabled={!selected || selected.parentId === null}
          onClick={() => selected && removeNode(selected.id)}
        />
        <div className="ml-auto flex items-center gap-2">
          <span className="hidden text-xs text-[#94a3b8] md:inline">{nodeCount} lines</span>
          <button
            type="button"
            onClick={resetDemo}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-2.5 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-[#f1f5f9]"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset demo
          </button>
        </div>
      </div>

      {/* ---- two-pane body ---- */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        {/* outline tree */}
        <div className="min-h-0 flex-1 overflow-auto border-b border-[#eef2f7] p-3 md:border-b-0 md:border-r" role="tree" aria-label="Demo outline">
          {renderNode(outline.rootId, 0)}
          <p className="mt-6 px-2 text-xs leading-relaxed text-[#94a3b8]">
            Tip: double-click a line to rename it. Press Enter for a new line, Tab to indent.
            Drag a line onto another to nest it.
          </p>
        </div>

        {/* content editor + smart-tools nudge */}
        <div className="flex min-h-0 flex-1 flex-col overflow-auto p-4 sm:p-6">
          {selected ? (
            <>
              <div className="mb-3 flex items-center gap-2">
                <span className="font-mono text-[10px] uppercase tracking-wider text-[#94a3b8]">Notes</span>
                <span className="truncate text-sm font-semibold text-[#0b1533]">{selected.name}</span>
              </div>
              <textarea
                key={selected.id}
                value={selected.content}
                onChange={(e) => setContent(selected.id, e.target.value)}
                placeholder="Write your notes for this idea… (everything stays in your browser)"
                className="min-h-[220px] w-full flex-1 resize-none rounded-lg border border-[#dde5f2] bg-white p-4 text-[15px] leading-relaxed text-[#1e293b] outline-none focus:border-blue-600/50 focus:ring-2 focus:ring-blue-600/20"
              />

              {/* Smart Tools — presented but locked. NO real AI call is wired here;
                  these buttons only funnel to signup, so an anonymous visitor can
                  never trigger a paid AI request from this page. */}
              <div className="mt-5 rounded-xl border border-[#dde5f2] bg-[#fafbfd] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-bold text-[#0b1533]">Smart Tools</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#eef2f7] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
                    <Lock className="h-3 w-3" /> Sign up to unlock
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {smartTools.map((t) => (
                    <Link
                      key={t}
                      href="/signup"
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:border-blue-600/50 hover:bg-blue-600/5 hover:text-[#1e40af]"
                    >
                      <Sparkles className="h-3.5 w-3.5 text-blue-600/70" />
                      {t}
                    </Link>
                  ))}
                </div>
                <Link
                  href="/signup"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:text-blue-700"
                >
                  Sign up free to unlock Smart Tools
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-[#94a3b8]">
              Select a line to see its notes.
            </div>
          )}
        </div>
      </div>

      {/* ---- footer sandbox note ---- */}
      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-[#eef2f7] bg-[#fafbfd] px-4 py-2.5 text-xs text-[#64748b] sm:px-6">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-500" />
          Live sandbox — changes stay in your browser. Nothing is sent to a server.
        </span>
        <Link href="/signup" className="font-semibold text-blue-600 hover:text-blue-700">
          Save your work → Sign up free
        </Link>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers.
// ---------------------------------------------------------------------------

function ToolBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-[#475569] transition-colors hover:bg-[#eef2f7] hover:text-[#0b1533] disabled:cursor-not-allowed disabled:opacity-40"
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-[#e2e8f0]" />;
}

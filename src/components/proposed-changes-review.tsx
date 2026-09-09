'use client';

/**
 * Proposed Changes review — the UNIFIED approve-before-apply engine
 * (P1 slice 4 of "Proposed Changes mode").
 *
 * ONE shared core behind every AI approval gate in the app. The three shipped
 * gates (Tell-AI delete, sub-outline insert, Expand/Generate content) and the
 * bulk "Generate content for descendants" gate all render through this engine;
 * future gates (moves, NL commands, MCP proposals) plug in with a config — a
 * kind + labels — not a new component.
 *
 * The shared vocabulary (single source of truth, mirrored by node-item.tsx):
 *   - kind 'deletion'  → amber, struck-through, "Will delete" tree badge
 *   - kind 'insertion' → green tint, "Pending" tree badge
 *   - kind 'rewrite'   → green tint, "New content" tree badge for in-place
 *                        content changes; before/after side-by-side preview
 *                        (ProposedBeforeAfter) for single-node rewrites
 *
 * Two surfaces are exported:
 *   - ProposedChangesReview — the floating bottom card (marked tree stays
 *     visible behind it). Supports compact name chips (delete/insert style) OR
 *     a per-item keep/discard checkbox list + approve-all (the LIVE BOOKS
 *     pattern) for batch gates.
 *   - ProposedBeforeAfter — the two-column Before/After comparison used by the
 *     single-node rewrite review (mirrors reformat-dialog).
 */

import React from 'react';
import DOMPurify from 'dompurify';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle, Sparkles, Trash2, Plus, X, MoveRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The kinds of proposed change the unified engine understands. */
export type PendingChangeKind = 'deletion' | 'insertion' | 'rewrite' | 'move';

/**
 * The single pending-marks mechanism: node id → kind of proposed change.
 * Built once in outline-pro and threaded outline-pane → node-item, which maps
 * each kind to its tree mark (see vocabulary above).
 */
export type PendingChangeMarks = ReadonlyMap<string, PendingChangeKind>;

/** One entry in the per-item keep/discard checkbox list (batch gates). */
export interface ProposedChangeItem {
  id: string;
  name: string;
}

interface KindTheme {
  cardBorder: string;
  iconWrap: string;
  iconClass: string;
  Icon: LucideIcon;
  chipClass: string;
  ConfirmIcon: LucideIcon;
  confirmVariant?: 'destructive';
  confirmClass?: string;
  checkboxClass?: string;
}

// Per-kind theme — deletion is amber/destructive; insertion and rewrite are
// both "something green is being added" (a whole node vs. new content inside
// an existing node).
const THEMES: Record<PendingChangeKind, KindTheme> = {
  deletion: {
    cardBorder: 'border-amber-300 dark:border-amber-700/60',
    iconWrap: 'bg-amber-100 dark:bg-amber-900/40',
    iconClass: 'text-amber-600 dark:text-amber-400',
    Icon: AlertTriangle,
    chipClass:
      'border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 line-through decoration-amber-500/70',
    ConfirmIcon: Trash2,
    confirmVariant: 'destructive',
  },
  insertion: {
    cardBorder: 'border-emerald-300 dark:border-emerald-700/60',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    Icon: Sparkles,
    chipClass:
      'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300',
    ConfirmIcon: Plus,
    confirmClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
  },
  rewrite: {
    cardBorder: 'border-emerald-300 dark:border-emerald-700/60',
    iconWrap: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconClass: 'text-emerald-600 dark:text-emerald-400',
    Icon: Sparkles,
    chipClass:
      'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300',
    ConfirmIcon: Plus,
    confirmClass:
      'bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-600 dark:hover:bg-emerald-500',
    checkboxClass:
      'data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600',
  },
  // 'move' — a structural relocation (nothing added or removed): sky blue,
  // "Will move" tree badge (see node-item.tsx). Added for external agent
  // proposals (P8 slice B); usable by any future internal move gate too.
  move: {
    cardBorder: 'border-sky-300 dark:border-sky-700/60',
    iconWrap: 'bg-sky-100 dark:bg-sky-900/40',
    iconClass: 'text-sky-600 dark:text-sky-400',
    Icon: MoveRight,
    chipClass:
      'border-sky-200 dark:border-sky-800/60 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300',
    ConfirmIcon: MoveRight,
    confirmClass:
      'bg-sky-600 text-white hover:bg-sky-700 dark:bg-sky-600 dark:hover:bg-sky-500',
  },
};

interface ProposedChangesReviewProps {
  open: boolean;
  /** Which kind of change is under review — selects the theme + tree vocabulary. */
  kind: PendingChangeKind;
  /** Accessible name of the floating card (tests + screen readers key off it). */
  ariaLabel: string;
  headline: string;
  body: string;
  /** Compact name chips (up to 6 shown, then "+N more"). */
  chipNames?: string[];
  /**
   * Per-item keep/discard checkbox list + select-all (batch gates, the LIVE
   * BOOKS pattern). When provided, chips are not shown and onConfirm receives
   * the checked ids.
   */
  items?: ProposedChangeItem[];
  confirmLabel: string;
  cancelLabel: string;
  /** Checked ids are passed when `items` is used; undefined otherwise. */
  onConfirm: (selectedIds?: string[]) => void;
  onCancel: () => void;
}

export default function ProposedChangesReview({
  open,
  kind,
  ariaLabel,
  headline,
  body,
  chipNames,
  items,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ProposedChangesReviewProps) {
  // Per-item selection (batch mode). Everything starts checked — Approve with
  // nothing unticked = approve-all.
  const itemsKey = items ? items.map((i) => i.id).join('|') : '';
  const [checkedIds, setCheckedIds] = React.useState<Set<string>>(new Set());
  React.useEffect(() => {
    if (open && itemsKey) {
      setCheckedIds(new Set(itemsKey.split('|')));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, itemsKey]);

  if (!open) return null;

  const t = THEMES[kind];
  const { Icon, ConfirmIcon } = t;

  const preview = (chipNames || []).slice(0, 6);
  const remaining = (chipNames || []).length - preview.length;

  const allChecked = !!items && items.length > 0 && items.every((i) => checkedIds.has(i.id));
  const toggleItem = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setCheckedIds(allChecked ? new Set() : new Set((items || []).map((i) => i.id)));
  };

  const confirmDisabled = !!items && checkedIds.size === 0;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-6"
      role="alertdialog"
      aria-modal="false"
      aria-label={ariaLabel}
    >
      <div
        className={cn(
          'pointer-events-auto w-full max-w-lg rounded-xl border bg-card shadow-2xl ring-1 ring-black/5',
          t.cardBorder
        )}
      >
        <div className="flex items-start gap-3 p-4">
          <div
            className={cn(
              'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full',
              t.iconWrap
            )}
          >
            <Icon className={cn('h-5 w-5', t.iconClass)} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-headline text-base font-semibold text-foreground">{headline}</p>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>

            {!items && preview.length > 0 && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {preview.map((n, i) => (
                  <li
                    key={i}
                    className={cn(
                      'max-w-[220px] truncate rounded-md border px-2 py-0.5 text-xs',
                      t.chipClass
                    )}
                    title={n}
                  >
                    {n || 'Untitled'}
                  </li>
                ))}
                {remaining > 0 && (
                  <li className="px-2 py-0.5 text-xs text-muted-foreground">+{remaining} more</li>
                )}
              </ul>
            )}

            {items && items.length > 0 && (
              <div className="mt-2 rounded-md border border-border/60">
                <label className="flex cursor-pointer items-center gap-2 border-b border-border/60 bg-muted/30 px-2.5 py-1.5 text-xs font-medium text-foreground">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label="Keep all"
                    className={cn('h-4 w-4', t.checkboxClass)}
                  />
                  All items ({items.length})
                </label>
                <ul className="max-h-44 overflow-y-auto py-1">
                  {items.map((item) => (
                    <li key={item.id}>
                      <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1 text-sm text-foreground hover:bg-muted/40">
                        <Checkbox
                          checked={checkedIds.has(item.id)}
                          onCheckedChange={() => toggleItem(item.id)}
                          aria-label={`Keep ${item.name || 'Untitled'}`}
                          className={cn('h-4 w-4', t.checkboxClass)}
                        />
                        <span className="truncate" title={item.name}>
                          {item.name || 'Untitled'}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-border/60 bg-muted/30 px-4 py-3">
          <Button variant="outline" onClick={onCancel} className="gap-1.5">
            <X className="h-4 w-4" />
            {cancelLabel}
          </Button>
          <Button
            variant={t.confirmVariant}
            disabled={confirmDisabled}
            onClick={() => onConfirm(items ? Array.from(checkedIds) : undefined)}
            className={cn('gap-1.5', t.confirmClass)}
          >
            <ConfirmIcon className="h-4 w-4" />
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Before/After side-by-side (the 'rewrite' preview vocabulary) ─────────────

// Same Tiptap-safe subset the reformat preview constrains to.
const SANITIZE_CONFIG: DOMPurify.Config = {
  ALLOWED_TAGS: ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'em', 'code', 'pre', 'br', 'blockquote', 'hr', 'a', 'div', 'span', 'img'],
  ALLOWED_ATTR: ['href', 'target', 'rel', 'class', 'src', 'alt', 'data-mermaid-block', 'data-mermaid-code'],
};

function sanitize(html: string): string {
  if (typeof window === 'undefined') return html;
  return DOMPurify.sanitize(html, SANITIZE_CONFIG as unknown as Parameters<typeof DOMPurify.sanitize>[1]);
}

interface ProposedBeforeAfterProps {
  /** The current content, as HTML. */
  beforeHtml: string;
  /** The resulting content once approved, as HTML. */
  afterHtml: string;
}

/**
 * The shared two-column Before/After comparison every single-node rewrite
 * review renders (Expand/Generate today; future rewrite gates tomorrow).
 */
export function ProposedBeforeAfter({ beforeHtml, afterHtml }: ProposedBeforeAfterProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="rounded-lg border border-border/60 p-3 bg-background/50">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-2">Before</div>
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitize(beforeHtml) || '<em>(empty)</em>' }}
        />
      </div>
      <div className="rounded-lg border border-primary/40 p-3 bg-primary/5">
        <div className="text-[10px] uppercase tracking-wide text-primary mb-2">After</div>
        <div
          className="prose prose-sm dark:prose-invert max-w-none"
          dangerouslySetInnerHTML={{ __html: sanitize(afterHtml) || '<em>(empty)</em>' }}
        />
      </div>
    </div>
  );
}

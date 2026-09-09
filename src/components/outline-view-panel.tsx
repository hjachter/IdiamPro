'use client';

// "Show Me" panel — natural-language filtering with VISIBLE, EDITABLE
// criteria, savable as named live views.
//
// Extends the 1988 search-as-view-shaper lineage: the user describes what to
// see (or builds condition rows by hand — no AI needed), the panel shows the
// interpretation as inspectable rows, and the parent reshapes the outline the
// same way search does — matches + ancestors unfold, everything else stays
// compressed but visible and chevron-openable. Saved views are durable
// queries: reopening one re-evaluates against the outline's CURRENT nodes.
//
// Presentation follows the OutlineSearch / OutlineTagFilter panel pattern
// (a slim bar under the toolbar, outline stays visible underneath).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Sparkles, Plus, X, Eraser, Trash2, Loader2, Save } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { parseViewCriteriaAction } from '@/app/actions';
import {
  FIELD_LABELS,
  FIELD_OPERATORS,
  OPERATOR_LABELS,
  PRIORITY_VALUES,
  COLOR_VALUES,
  TYPE_VALUES,
  makeCriterion,
  loadSavedViews,
  upsertSavedView,
  deleteSavedView,
  type ViewCriterion,
  type ViewField,
  type ViewOperator,
  type ViewMatchMode,
  type SavedOutlineView,
} from '@/lib/view-criteria';

interface OutlineViewPanelProps {
  isOpen: boolean;
  onClose: () => void;
  outlineId: string | undefined;
  availableTags: string[];
  criteria: ViewCriterion[];
  matchMode: ViewMatchMode;
  onCriteriaChange: (criteria: ViewCriterion[], matchMode: ViewMatchMode) => void;
  /** Live count of nodes matching the current criteria. */
  matchCount: number;
}

const selectClass =
  'h-8 rounded-md border border-input bg-background px-2 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring';

// Value editor for one criterion row — control type depends on the field.
function ValueEditor({
  criterion,
  availableTags,
  onChange,
}: {
  criterion: ViewCriterion;
  availableTags: string[];
  onChange: (value: string) => void;
}) {
  const { field, value } = criterion;

  if (field === 'tag' && availableTags.length > 0) {
    return (
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Tag value"
        data-testid="view-row-value"
      >
        <option value="">Choose tag…</option>
        {availableTags.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }
  if (field === 'type') {
    return (
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Item type value" data-testid="view-row-value">
        <option value="">Choose type…</option>
        {TYPE_VALUES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    );
  }
  if (field === 'completed') {
    return (
      <select className={selectClass} value={value || 'no'} onChange={(e) => onChange(e.target.value)} aria-label="Completed value" data-testid="view-row-value">
        <option value="no">no (still open)</option>
        <option value="yes">yes (done)</option>
      </select>
    );
  }
  if (field === 'priority') {
    return (
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Priority value" data-testid="view-row-value">
        <option value="">Choose…</option>
        {PRIORITY_VALUES.map(p => <option key={p} value={p}>{p}</option>)}
      </select>
    );
  }
  if (field === 'color') {
    return (
      <select className={selectClass} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Color value" data-testid="view-row-value">
        <option value="">Choose…</option>
        {COLOR_VALUES.map(c => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }
  if (field === 'created' || field === 'updated' || field === 'due') {
    return (
      <input
        type="date"
        className={cn(selectClass, 'min-w-[140px]')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Date value"
        data-testid="view-row-value"
      />
    );
  }
  return (
    <Input
      className="h-8 flex-1 min-w-[120px] text-sm"
      placeholder={field === 'branch' ? 'Branch name…' : 'Text…'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="Condition text"
      data-testid="view-row-value"
    />
  );
}

export default function OutlineViewPanel({
  isOpen,
  onClose,
  outlineId,
  availableTags,
  criteria,
  matchMode,
  onCriteriaChange,
  matchCount,
}: OutlineViewPanelProps) {
  const [nlRequest, setNlRequest] = useState('');
  const [isInterpreting, setIsInterpreting] = useState(false);
  const [interpretError, setInterpretError] = useState<string | null>(null);
  const [savedViews, setSavedViews] = useState<SavedOutlineView[]>([]);
  const [viewName, setViewName] = useState('');
  const [justSaved, setJustSaved] = useState(false);
  const nlInputRef = useRef<HTMLInputElement>(null);

  // Load this outline's saved views whenever the panel opens or the outline
  // changes. Saved views are per-outline (criteria reference its tags/branches).
  useEffect(() => {
    if (outlineId) setSavedViews(loadSavedViews(outlineId));
    setViewName('');
    setNlRequest('');
    setInterpretError(null);
  }, [outlineId, isOpen]);

  useEffect(() => {
    if (isOpen && nlInputRef.current) nlInputRef.current.focus();
  }, [isOpen]);

  const handleInterpret = useCallback(async () => {
    const request = nlRequest.trim();
    if (!request || isInterpreting) return;
    setIsInterpreting(true);
    setInterpretError(null);
    try {
      // Test seam: Playwright suites can run without an AI key by installing
      // window.__nlViewsMockParse. Production never sets it.
      const mock = typeof window !== 'undefined'
        ? (window as unknown as { __nlViewsMockParse?: (req: string) => { matchMode: ViewMatchMode; criteria: Array<Omit<ViewCriterion, 'id'>> } }).__nlViewsMockParse
        : undefined;
      let result: { matchMode: ViewMatchMode; criteria: Array<Omit<ViewCriterion, 'id'>> };
      if (mock) {
        result = mock(request);
      } else {
        const userApiKey = typeof window !== 'undefined' ? window.localStorage.getItem('apiKey_gemini') : null;
        result = await parseViewCriteriaAction(request, availableTags, userApiKey);
      }
      const withIds = result.criteria.map(c => ({ ...makeCriterion(), ...c }));
      if (withIds.length === 0) {
        setInterpretError("I couldn't turn that into conditions — try rephrasing, or build them manually below.");
      } else {
        onCriteriaChange(withIds, result.matchMode);
      }
    } catch (e) {
      setInterpretError(e instanceof Error ? e.message : 'Something went wrong interpreting that — you can build the conditions manually below.');
    } finally {
      setIsInterpreting(false);
    }
  }, [nlRequest, isInterpreting, availableTags, onCriteriaChange]);

  const updateRow = useCallback((rowId: string, patch: Partial<ViewCriterion>) => {
    onCriteriaChange(
      criteria.map(c => {
        if (c.id !== rowId) return c;
        const next = { ...c, ...patch };
        // Changing the field resets operator (and value if the old value no
        // longer fits the new field's control).
        if (patch.field && patch.field !== c.field) {
          next.operator = FIELD_OPERATORS[patch.field][0];
          next.value = '';
        }
        return next;
      }),
      matchMode,
    );
  }, [criteria, matchMode, onCriteriaChange]);

  const removeRow = useCallback((rowId: string) => {
    onCriteriaChange(criteria.filter(c => c.id !== rowId), matchMode);
  }, [criteria, matchMode, onCriteriaChange]);

  const addRow = useCallback(() => {
    onCriteriaChange([...criteria, makeCriterion()], matchMode);
  }, [criteria, matchMode, onCriteriaChange]);

  const handleSave = useCallback(() => {
    const name = viewName.trim();
    if (!name || !outlineId || criteria.length === 0) return;
    upsertSavedView(outlineId, name, matchMode, criteria);
    setSavedViews(loadSavedViews(outlineId));
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 2000);
  }, [viewName, outlineId, criteria, matchMode]);

  const handleOpenSavedView = useCallback((view: SavedOutlineView) => {
    // Durable query semantics: give the rows fresh ids and re-evaluate
    // against the CURRENT outline — never a stored snapshot of results.
    setViewName(view.name);
    onCriteriaChange(view.criteria.map(c => ({ ...c, id: makeCriterion().id })), view.matchMode);
  }, [onCriteriaChange]);

  const handleDeleteSavedView = useCallback((view: SavedOutlineView) => {
    deleteSavedView(view.id);
    if (outlineId) setSavedViews(loadSavedViews(outlineId));
  }, [outlineId]);

  const handleClear = useCallback(() => {
    onCriteriaChange([], 'all');
    setViewName('');
    setNlRequest('');
    setInterpretError(null);
  }, [onCriteriaChange]);

  if (!isOpen) return null;

  const hasCriteria = criteria.length > 0;
  const hasUsableCriteria = criteria.some(c => c.value.trim().length > 0);

  return (
    <div className="flex-shrink-0 px-2 py-2 bg-background border-b" data-testid="view-panel">
      <TooltipProvider delayDuration={300}>
        {/* Row 1 — natural-language request + panel controls */}
        <div className="flex flex-wrap items-center gap-1">
          <Eye className="h-4 w-4 text-muted-foreground shrink-0 ml-1 mr-1" aria-hidden="true" />
          <div className="relative flex-1 min-w-[180px]">
            <Input
              ref={nlInputRef}
              type="text"
              placeholder="Show me… (e.g. open tasks about design from August)"
              value={nlRequest}
              onChange={(e) => setNlRequest(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleInterpret(); if (e.key === 'Escape') onClose(); }}
              className="h-8 pr-8"
              data-testid="view-nl-input"
            />
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="default"
                  size="sm"
                  className="h-8"
                  onClick={handleInterpret}
                  disabled={!nlRequest.trim() || isInterpreting}
                  aria-label="Turn my description into filter conditions"
                  data-testid="view-nl-interpret"
                >
                  {isInterpreting
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Sparkles className="h-4 w-4" />}
                  <span className="ml-1 text-xs">Show Me</span>
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Turn your description into visible filter conditions you can edit (one AI call) — or skip this and add conditions manually below</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={handleClear}
                  disabled={!hasCriteria && !nlRequest}
                  aria-label="Clear all conditions"
                  data-testid="view-clear"
                >
                  <Eraser className="h-4 w-4" />
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Clear conditions — use Expand All to unfold everything again</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={onClose}
                aria-label="Close Show Me panel"
                data-testid="view-close"
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Close panel, keep the view applied</TooltipContent>
          </Tooltip>
        </div>

        {interpretError && (
          <div className="mt-1 px-1 text-xs text-destructive" data-testid="view-nl-error">{interpretError}</div>
        )}

        {/* Row 2 — the visible, editable criterion rows */}
        <div className="mt-1.5 space-y-1">
          {criteria.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-1 pl-6" data-testid="view-row">
              <select
                className={selectClass}
                value={c.field}
                onChange={(e) => updateRow(c.id, { field: e.target.value as ViewField })}
                aria-label="Condition field"
                data-testid="view-row-field"
              >
                {(Object.keys(FIELD_LABELS) as ViewField[]).map(f => (
                  <option key={f} value={f}>{FIELD_LABELS[f]}</option>
                ))}
              </select>
              <select
                className={selectClass}
                value={c.operator}
                onChange={(e) => updateRow(c.id, { operator: e.target.value as ViewOperator })}
                aria-label="Condition comparison"
                data-testid="view-row-op"
              >
                {FIELD_OPERATORS[c.field].map(op => (
                  <option key={op} value={op}>{OPERATOR_LABELS[op]}</option>
                ))}
              </select>
              <ValueEditor
                criterion={c}
                availableTags={availableTags}
                onChange={(value) => updateRow(c.id, { value })}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => removeRow(c.id)}
                    aria-label="Remove this condition"
                    data-testid="view-row-remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove this condition</TooltipContent>
              </Tooltip>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-2 pl-6">
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={addRow}
              aria-label="Add a condition"
              data-testid="view-add-row"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add condition
            </Button>
            {criteria.length > 1 && (
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Match
                <select
                  className={cn(selectClass, 'h-7')}
                  value={matchMode}
                  onChange={(e) => onCriteriaChange(criteria, e.target.value as ViewMatchMode)}
                  aria-label="Match all or any conditions"
                  data-testid="view-match-mode"
                >
                  <option value="all">all conditions</option>
                  <option value="any">any condition</option>
                </select>
              </label>
            )}
          </div>
        </div>

        {/* Row 3 — live match count + save-as-named-view */}
        {hasUsableCriteria && (
          <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
            <span className="text-xs text-muted-foreground" data-testid="view-match-count">
              {matchCount === 0
                ? 'No items match — other branches stay visible, just folded'
                : `Showing ${matchCount} matching item${matchCount !== 1 ? 's' : ''} (highlighted) — other branches folded but openable`}
            </span>
            <span className="flex items-center gap-1 ml-auto">
              <Input
                type="text"
                placeholder="Name this view…"
                value={viewName}
                onChange={(e) => setViewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
                className="h-7 w-40 text-xs"
                aria-label="Name for this saved view"
                data-testid="view-save-name"
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <span tabIndex={0} className="inline-flex">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={handleSave}
                      disabled={!viewName.trim() || !hasUsableCriteria}
                      aria-label="Save this view"
                      data-testid="view-save-btn"
                    >
                      <Save className="h-3.5 w-3.5 mr-1" /> {justSaved ? 'Saved!' : 'Save view'}
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>Save these conditions as a named view — reopening it always shows current results, never a snapshot</TooltipContent>
              </Tooltip>
            </span>
          </div>
        )}

        {/* Row 4 — saved views for this outline (live queries, one click) */}
        {savedViews.length > 0 && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-6" data-testid="view-saved-list">
            <span className="text-xs text-muted-foreground mr-1">Saved views:</span>
            {savedViews.map(v => (
              <Badge
                key={v.id}
                variant="secondary"
                className="cursor-pointer select-none gap-1 pr-1 hover:bg-secondary/70"
                onClick={() => handleOpenSavedView(v)}
                title={`Open "${v.name}" — re-checks the outline right now`}
                data-testid="view-saved-chip"
              >
                {v.name}
                <button
                  type="button"
                  className="rounded-full p-0.5 hover:bg-destructive/20"
                  onClick={(e) => { e.stopPropagation(); handleDeleteSavedView(v); }}
                  aria-label={`Delete saved view ${v.name}`}
                  data-testid="view-saved-delete"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </TooltipProvider>
    </div>
  );
}

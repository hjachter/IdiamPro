'use client';

/**
 * Derivation choice block (2026-06-10).
 *
 * Shared UI fragment used by all AI-transform dialogs (Transform Outline,
 * Reformat, Refresh from Web, Translate). Lets the user pick between:
 *
 *   - "Save as new outline" (derivative) — original stays untouched, a new
 *     outline is created with the result. Default for content-altering
 *     transforms (Transform / Reformat / Refresh).
 *
 *   - "Replace this outline" (in-place) — applies the result to the current
 *     outline. The pre-apply auto-snapshot still fires (Backup/Restore),
 *     and Cmd+Z still undoes — so even the in-place path is recoverable.
 *     Default for Translate (translating IS content-preserving and the user
 *     already chose the target language).
 *
 * Per Howard's rule (feedback-outline-data-protection-paramount): the safer
 * path is the default. Both options are always visible.
 */

import React from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Input } from '@/components/ui/input';
import { GitFork, FileEdit } from 'lucide-react';

export type DerivationMode = 'derivative' | 'inplace';

interface DerivationChoiceProps {
  /** Currently-selected mode. */
  mode: DerivationMode;
  onModeChange: (mode: DerivationMode) => void;

  /** Current text in the derivation-label field. */
  label: string;
  onLabelChange: (label: string) => void;

  /** Used to render the id-prefix; lets multiple dialogs co-exist without
   *  colliding label/radio IDs in the DOM. Pass a unique short string like
   *  "transform" / "reformat" / "refresh" / "translate". */
  idPrefix: string;

  /** Friendly name of the transform — shown in the "Replace" radio's
   *  explanatory text. E.g. "Transform Outline" / "Reformat" / "Refresh
   *  from Web" / "Translate". */
  transformName: string;

  /** Name of the current outline — used in the "Save as new" recommendation
   *  text. Falls back to "this outline" when not provided. */
  currentOutlineName?: string;

  /** Disable the radio while a transform is running. */
  disabled?: boolean;
}

export default function DerivationChoice({
  mode,
  onModeChange,
  label,
  onLabelChange,
  idPrefix,
  transformName,
  currentOutlineName,
  disabled = false,
}: DerivationChoiceProps) {
  const derivativeId = `${idPrefix}-derivative`;
  const inplaceId = `${idPrefix}-inplace`;
  const labelInputId = `${idPrefix}-label-input`;
  const outlineRef = currentOutlineName ? `"${currentOutlineName}"` : 'this outline';

  return (
    <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 p-3">
      <Label className="text-sm font-medium">What should we do with the result?</Label>
      <RadioGroup
        value={mode}
        onValueChange={(v) => onModeChange(v as DerivationMode)}
        className="gap-2"
      >
        {/* Derivative — safer path */}
        <div className="flex items-start gap-2">
          <RadioGroupItem
            value="derivative"
            id={derivativeId}
            className="mt-1"
            disabled={disabled}
          />
          <Label htmlFor={derivativeId} className="font-normal cursor-pointer flex-1">
            <span className="font-medium inline-flex items-center gap-1.5">
              <GitFork className="h-3.5 w-3.5" />
              Save as new outline
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {outlineRef} stays exactly as it is. The result is created as a new
              outline, nested under the original in your sidebar.
            </p>
          </Label>
        </div>

        {/* In-place — opt-in */}
        <div className="flex items-start gap-2">
          <RadioGroupItem
            value="inplace"
            id={inplaceId}
            className="mt-1"
            disabled={disabled}
          />
          <Label htmlFor={inplaceId} className="font-normal cursor-pointer flex-1">
            <span className="font-medium inline-flex items-center gap-1.5">
              <FileEdit className="h-3.5 w-3.5" />
              Replace this outline
            </span>
            <p className="text-xs text-muted-foreground mt-0.5">
              {transformName} writes directly over {outlineRef}. Your current
              outline auto-snapshots before being replaced, and Cmd+Z still
              undoes the change.
            </p>
          </Label>
        </div>
      </RadioGroup>

      {/* Editable label — only relevant when "derivative" is selected. */}
      {mode === 'derivative' && (
        <div className="pt-2 space-y-1">
          <Label htmlFor={labelInputId} className="text-xs font-medium">
            New outline label (becomes the suffix on the name)
          </Label>
          <Input
            id={labelInputId}
            value={label}
            onChange={(e) => onLabelChange(e.target.value)}
            placeholder="e.g. Middle School Version"
            maxLength={60}
            disabled={disabled}
            className="h-8 text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            The new outline will be named {currentOutlineName
              ? <><span className="font-medium">{currentOutlineName} — {label || '[label]'}</span></>
              : <><span className="font-medium">[Original] — {label || '[label]'}</span></>
            }
          </p>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Report Issue — the in-app entry points for reporting a bug to Howard.
 *
 * This module exports three things:
 *   - <ReportIssueDialog>   the controlled dialog component (form + submit)
 *   - <ReportIssueButton>   the toolbar button + tooltip (uses the dialog)
 *   - <ReportIssueMenuItem> the dropdown-menu item (uses the same dialog)
 *
 * Both entry points (toolbar button + Help-menu item) mount the same
 * <ReportIssueDialog> — there is exactly ONE dialog implementation in the
 * codebase. The dialog captures:
 *   - what's not working (required, 10-5000 chars)
 *   - what they were trying to do (optional context)
 *   - severity (FYI / Annoying / Blocking) with friendly explanations
 *   - optional screenshot (drag-drop or file picker, base64-encoded,
 *     max 2MB encoded)
 *
 * On submit, POSTs to /api/bugs/submit and shows a persist-until-dismissed
 * toast on success ("Thanks — Howard will look at this."). On error,
 * surfaces the message inline and keeps form state for retry.
 *
 * The signed-in user's email is pulled server-side from the Clerk session
 * by the API — we never send it from the client.
 */

import * as React from 'react';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Textarea } from './ui/textarea';
import { RadioGroup, RadioGroupItem } from './ui/radio-group';
import { Label } from './ui/label';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';
import { DropdownMenuItem } from './ui/dropdown-menu';
import { Bug, ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

type Severity = 'fyi' | 'annoying' | 'blocking';

const SEVERITY_OPTIONS: { value: Severity; label: string }[] = [
  { value: 'fyi', label: 'Just FYI — saw something odd but not blocking' },
  { value: 'annoying', label: 'Annoying — bumps into my workflow' },
  { value: 'blocking', label: "Blocking me — can't get past this" },
];

// Same ceiling enforced by the API. 2MB of base64 represents ~1.5MB of
// binary screenshot bytes — plenty for a UI capture.
const MAX_SCREENSHOT_BASE64_BYTES = 2 * 1024 * 1024;

interface SubmitResponse {
  ok?: boolean;
  bugId?: string;
  error?: string;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

interface ReportIssueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional: name of the outline currently open, so we can attach it
   *  to the bug metadata for triage. */
  currentOutlineName?: string | null;
}

/**
 * The shared dialog. Both the toolbar button and the Help-menu item open
 * THIS component — there is no duplicate dialog elsewhere in the codebase.
 */
export function ReportIssueDialog({
  open,
  onOpenChange,
  currentOutlineName,
}: ReportIssueDialogProps) {
  const [description, setDescription] = React.useState('');
  const [context, setContext] = React.useState('');
  const [severity, setSeverity] = React.useState<Severity>('annoying');
  const [screenshotDataUrl, setScreenshotDataUrl] = React.useState<string | null>(null);
  const [screenshotError, setScreenshotError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const descriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  const resetForm = React.useCallback(() => {
    setDescription('');
    setContext('');
    setSeverity('annoying');
    setScreenshotDataUrl(null);
    setScreenshotError(null);
    setSubmitError(null);
    setSubmitting(false);
  }, []);

  // Autofocus the description field when the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => descriptionRef.current?.focus(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const ingestFile = React.useCallback(async (file: File | undefined | null) => {
    if (!file) return;
    setScreenshotError(null);
    if (!file.type.startsWith('image/')) {
      setScreenshotError('That doesn’t look like an image — try a PNG or JPG.');
      return;
    }
    let dataUrl: string;
    try {
      dataUrl = await readFileAsDataUrl(file);
    } catch {
      setScreenshotError('Could not read that file. Try again?');
      return;
    }
    if (dataUrl.length > MAX_SCREENSHOT_BASE64_BYTES) {
      setScreenshotError('That screenshot is over 2MB — try a smaller one.');
      return;
    }
    setScreenshotDataUrl(dataUrl);
  }, []);

  const onDrop = React.useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      void ingestFile(file);
    },
    [ingestFile],
  );

  const onPickFile = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      void ingestFile(file);
      // Clear the input so picking the same file twice in a row still fires.
      e.target.value = '';
    },
    [ingestFile],
  );

  const trimmedDescription = description.trim();
  const canSubmit =
    trimmedDescription.length >= 10 &&
    trimmedDescription.length <= 5000 &&
    !submitting;

  const submit = React.useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        description: trimmedDescription,
        context: context.trim() || undefined,
        severity,
        screenshotBase64: screenshotDataUrl,
        metadata: {
          url:
            typeof window !== 'undefined' && window.location
              ? window.location.href
              : '',
          userAgent:
            typeof navigator !== 'undefined' ? navigator.userAgent : '',
          outlineName: currentOutlineName ?? null,
          timestamp: new Date().toISOString(),
        },
      };

      const res = await fetch('/api/bugs/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as SubmitResponse;
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Could not send your report — please try again.');
      }
      // Success — persist-until-dismissed toast (no duration override).
      toast({
        title: 'Thanks — Howard will look at this.',
        description: 'Your report was sent. Keep working — we’ll follow up if we need more info.',
      });
      resetForm();
      onOpenChange(false);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not send your report — please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, context, currentOutlineName, onOpenChange, resetForm, screenshotDataUrl, severity, trimmedDescription]);

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      // If the user dismisses mid-submit, keep state so they can retry.
      if (!next && submitting) return;
      onOpenChange(next);
      if (!next) {
        // Closing without a successful submit — keep their text so a misclick
        // doesn't lose work. Only resetForm() on successful submit.
        setSubmitError(null);
      }
    },
    [onOpenChange, submitting],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" data-testid="report-issue-dialog">
        <DialogHeader>
          <DialogTitle>Report an issue</DialogTitle>
          <DialogDescription>
            Tell Howard about something that&apos;s not working right. He reads every report.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label htmlFor="bug-description" className="text-sm font-medium">
              What&apos;s not working right?
            </Label>
            <Textarea
              id="bug-description"
              ref={descriptionRef}
              data-testid="bug-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what you saw, what you expected, and anything that helps us reproduce it."
              rows={5}
              maxLength={5000}
              className="mt-1"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              At least 10 characters. {trimmedDescription.length}/5000
            </p>
          </div>

          <div>
            <Label htmlFor="bug-context" className="text-sm font-medium">
              What were you trying to do? <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="bug-context"
              data-testid="bug-context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="The steps you took, or the bigger thing you were working on."
              rows={3}
              maxLength={2000}
              className="mt-1"
            />
          </div>

          <div>
            <p className="text-sm font-medium mb-2">How serious is it?</p>
            <RadioGroup
              value={severity}
              onValueChange={(v) => setSeverity(v as Severity)}
              className="space-y-2"
              data-testid="bug-severity"
            >
              {SEVERITY_OPTIONS.map((opt) => (
                <div key={opt.value} className="flex items-start gap-2">
                  <RadioGroupItem
                    value={opt.value}
                    id={`severity-${opt.value}`}
                    className="mt-1"
                  />
                  <Label
                    htmlFor={`severity-${opt.value}`}
                    className="text-sm font-normal leading-snug cursor-pointer"
                  >
                    {opt.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              Screenshot <span className="text-muted-foreground font-normal">(optional, max 2MB)</span>
            </p>
            {screenshotDataUrl ? (
              <div className="relative inline-block">
                <img
                  src={screenshotDataUrl}
                  alt="Screenshot preview"
                  className="max-h-48 rounded border border-input"
                />
                <button
                  type="button"
                  aria-label="Remove screenshot"
                  onClick={() => {
                    setScreenshotDataUrl(null);
                    setScreenshotError(null);
                  }}
                  className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-background border border-input shadow-sm flex items-center justify-center hover:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                className={`rounded-lg border-2 border-dashed px-4 py-6 text-center text-sm transition-colors cursor-pointer ${
                  dragOver
                    ? 'border-violet-400 bg-violet-50 dark:bg-violet-950/30'
                    : 'border-input bg-muted/30 hover:bg-muted/50'
                }`}
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                data-testid="bug-screenshot-dropzone"
              >
                <ImagePlus className="h-5 w-5 mx-auto mb-2 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Drag a screenshot here, or click to pick a file.
                </p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onPickFile}
              data-testid="bug-screenshot-input"
            />
            {screenshotError && (
              <p className="mt-2 text-sm text-destructive" role="alert">
                {screenshotError}
              </p>
            )}
          </div>

          {submitError && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
              data-testid="bug-submit-error"
            >
              {submitError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => handleOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void submit()}
              disabled={!canSubmit}
              data-testid="bug-submit"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send report'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ReportIssueButtonProps {
  currentOutlineName?: string | null;
}

/**
 * Toolbar entry point — Bug icon button + tooltip + mounted dialog.
 */
export function ReportIssueButton({ currentOutlineName }: ReportIssueButtonProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              data-testid="report-issue-button"
              aria-label="Report Issue"
              onClick={() => setOpen(true)}
              className="h-9 px-2.5 gap-1.5"
            >
              <Bug className="h-4 w-4" />
              <span className="hidden md:inline text-sm">Report Issue</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Tell Howard about something that&apos;s not working right</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <ReportIssueDialog
        open={open}
        onOpenChange={setOpen}
        currentOutlineName={currentOutlineName}
      />
    </>
  );
}

interface ReportIssueMenuItemProps {
  currentOutlineName?: string | null;
}

/**
 * Help-menu entry point — DropdownMenuItem labeled "Report Issue" that
 * opens the same dialog the toolbar button opens. Two-word visible label
 * with a tooltip-quality aria-label so screen readers get the long form.
 */
export function ReportIssueMenuItem({ currentOutlineName }: ReportIssueMenuItemProps) {
  const [open, setOpen] = React.useState(false);
  return (
    <>
      <DropdownMenuItem
        onSelect={(e) => {
          // Prevent the menu from closing-and-dismissing the dialog before
          // it has a chance to mount on slow renders.
          e.preventDefault();
          setOpen(true);
        }}
        className="cursor-pointer py-1"
        data-testid="report-issue-menu-item"
        aria-label="Tell Howard about something that's not working right"
      >
        <Bug className="mr-2 h-4 w-4" /> Report Issue
      </DropdownMenuItem>
      <ReportIssueDialog
        open={open}
        onOpenChange={setOpen}
        currentOutlineName={currentOutlineName}
      />
    </>
  );
}

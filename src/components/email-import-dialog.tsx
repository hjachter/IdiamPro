'use client';

/**
 * Email Import dialog (Phase 2 — Professional Customization, 2026-07-22).
 *
 * Bring an email — a single message or a whole thread — INTO IdeaM as a clean,
 * STRUCTURED outline: a Summary, Key Points, Decisions, and Action Items, never
 * a wall of quoted text. The user can PASTE the email text and/or drop/import a
 * .eml file; the AI does the structuring.
 *
 * Reuses the existing import + AI pipeline via importEmailAction (Gemini with an
 * automatic Ollama fallback, or forced on-device), so it inherits the same
 * provider handling and generation-limit gating. One import = one AI generation
 * (gated through useAIUsageGate with feature key 'importEmail').
 *
 * "File suspected junk aside" (default ON): for a thread, the AI classifies each
 * message as keep vs. suspected-junk and quarantines suspected junk into a
 * clearly-labeled "Filtered — likely junk" sub-branch with a count. It NEVER
 * deletes anything — transparent and always rescuable. For a single non-junk
 * email it simply does nothing.
 *
 * GATING: this surface only appears when the master "Email tools" switch AND the
 * "Import email into outlines" sub-toggle are on (Settings → Professional
 * Customization). The junk toggle here is initialized from the persisted
 * "File suspected junk aside" setting.
 *
 * Output choice (mirrors the Summarize / Export patterns):
 *   - "Create new outline" (DEFAULT) — named from the email subject, original
 *     outlines untouched.
 *   - "Add to current outline" — grafts the structured result under the current
 *     outline's root.
 *   - "Save into Second Brain" — offered only when a Second Brain exists.
 */

import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import {
  Mail,
  Loader2,
  AlertTriangle,
  Cpu,
  Upload,
  ShieldCheck,
} from 'lucide-react';
import { importEmailAction } from '@/app/actions';
import { isLocalAIReachable, notifyLocalAIDown } from '@/lib/local-ai';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { getFileJunkAsideEnabled } from '@/lib/use-email-tools-settings';
import type { Outline } from '@/types';

export type EmailImportOutputMode = 'new' | 'append' | 'secondBrain';

interface EmailImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Name of the current outline (for the "add to current" option label). */
  currentOutlineName?: string;
  /** Whether a Second Brain outline exists (to offer it as a target). */
  hasSecondBrain?: boolean;
  /** Applies the produced outline. Parent handles new / append / Second Brain. */
  onApply: (outline: Outline, mode: EmailImportOutputMode) => void;
}

type Phase = 'input' | 'running';

/**
 * Pragmatic .eml → readable text. Pulls the key headers (From / To / Subject /
 * Date) and the best text body it can find, decoding quoted-printable and
 * base64 text parts. Falls back to the raw string if the file isn't MIME-shaped
 * — the AI can cope with lightly-messy input, so we favor never losing content.
 */
function parseEmlText(raw: string): string {
  try {
    const headerEnd = raw.search(/\r?\n\r?\n/);
    if (headerEnd === -1) return raw;
    const headerBlock = raw.slice(0, headerEnd);

    const getHeader = (name: string): string | null => {
      const re = new RegExp(`^${name}:\\s*(.+(?:\\r?\\n[ \\t].+)*)`, 'im');
      const m = headerBlock.match(re);
      return m ? m[1].replace(/\r?\n[ \t]+/g, ' ').trim() : null;
    };

    const decodeQuotedPrintable = (s: string): string =>
      s
        .replace(/=\r?\n/g, '')
        .replace(/=([0-9A-Fa-f]{2})/g, (_, h) =>
          String.fromCharCode(parseInt(h, 16))
        );

    const decodeBase64 = (s: string): string => {
      try {
        return decodeURIComponent(escape(atob(s.replace(/\s+/g, ''))));
      } catch {
        try {
          return atob(s.replace(/\s+/g, ''));
        } catch {
          return s;
        }
      }
    };

    const stripHtml = (s: string): string =>
      s
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<\/(p|div|br|li|tr|h[1-6])>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const contentType = getHeader('Content-Type') || '';
    const boundaryMatch = contentType.match(/boundary="?([^";]+)"?/i);

    let bestBody = '';

    if (boundaryMatch) {
      // Multipart — walk the parts, prefer text/plain, else stripped text/html.
      const boundary = boundaryMatch[1];
      const parts = raw.split(new RegExp(`--${boundary.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
      let plain = '';
      let html = '';
      for (const part of parts) {
        const ptHeaderEnd = part.search(/\r?\n\r?\n/);
        if (ptHeaderEnd === -1) continue;
        const ptHeaders = part.slice(0, ptHeaderEnd).toLowerCase();
        let ptBody = part.slice(ptHeaderEnd).trim();
        if (/content-transfer-encoding:\s*quoted-printable/.test(ptHeaders)) {
          ptBody = decodeQuotedPrintable(ptBody);
        } else if (/content-transfer-encoding:\s*base64/.test(ptHeaders)) {
          ptBody = decodeBase64(ptBody);
        }
        if (/content-type:\s*text\/plain/.test(ptHeaders) && !plain) {
          plain = ptBody;
        } else if (/content-type:\s*text\/html/.test(ptHeaders) && !html) {
          html = stripHtml(ptBody);
        }
      }
      bestBody = plain || html;
    } else {
      let body = raw.slice(headerEnd).trim();
      const cte = (getHeader('Content-Transfer-Encoding') || '').toLowerCase();
      if (cte.includes('quoted-printable')) body = decodeQuotedPrintable(body);
      else if (cte.includes('base64')) body = decodeBase64(body);
      if (/text\/html/i.test(contentType)) body = stripHtml(body);
      bestBody = body;
    }

    const headerLines = [
      getHeader('From') && `From: ${getHeader('From')}`,
      getHeader('To') && `To: ${getHeader('To')}`,
      getHeader('Date') && `Date: ${getHeader('Date')}`,
      getHeader('Subject') && `Subject: ${getHeader('Subject')}`,
    ].filter(Boolean);

    const assembled = `${headerLines.join('\n')}\n\n${bestBody}`.trim();
    return assembled.length > 20 ? assembled : raw;
  } catch {
    return raw;
  }
}

export default function EmailImportDialog({
  open,
  onOpenChange,
  currentOutlineName,
  hasSecondBrain,
  onApply,
}: EmailImportDialogProps) {
  const { gate } = useAIUsageGate();
  const [phase, setPhase] = useState<Phase>('input');
  const [emailText, setEmailText] = useState('');
  const [outlineName, setOutlineName] = useState('');
  const [fileJunkAside, setFileJunkAside] = useState(true);
  const [useLocal, setUseLocal] = useState(false);
  const [outputMode, setOutputMode] = useState<EmailImportOutputMode>('new');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loadedFileName, setLoadedFileName] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setPhase('input');
      setEmailText('');
      setOutlineName('');
      setFileJunkAside(getFileJunkAsideEnabled());
      setUseLocal(false);
      setOutputMode('new');
      setErrorMsg(null);
      setLoadedFileName(null);
    }
  }, [open]);

  const handleClose = () => onOpenChange(false);

  const handleFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = (e.target?.result as string) || '';
      const parsed = parseEmlText(raw);
      // Append to whatever is already pasted so users can combine sources.
      setEmailText((prev) => (prev.trim() ? `${prev.trim()}\n\n${parsed}` : parsed));
      setLoadedFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleRun = async () => {
    if (!emailText.trim() || emailText.trim().length < 10) {
      setErrorMsg('Paste an email or drop a .eml file first.');
      return;
    }

    // Tier-enforcement gate: one email import = one generation.
    if (!gate({ feature: 'importEmail' })) return;

    // On-device AI selected but the engine is down → calm one-click notice.
    if (useLocal && !(await isLocalAIReachable())) {
      await notifyLocalAIDown({ onRetry: () => { void handleRun(); } });
      return;
    }

    setErrorMsg(null);
    setPhase('running');

    try {
      const r = await importEmailAction({
        emailText: emailText.trim(),
        outlineName: outlineName.trim() || undefined,
        fileJunkAside,
        useLocalAI: useLocal || undefined,
      });

      if (r.error || !r.outline) {
        setErrorMsg(
          r.error ||
            "I couldn't structure that email. Try again, switch to local AI, or check your API key in Settings.",
        );
        setPhase('input');
        return;
      }

      onApply(r.outline, outputMode);
      handleClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The import didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`,
      );
      setPhase('input');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent
        className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col"
        data-testid="email-import-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Import email
          </DialogTitle>
          <DialogDescription>
            Paste an email or a whole thread — or drop a .eml file — and I&apos;ll turn it into a
            clean outline of key points, decisions, and action items.
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              {/* Paste area */}
              <div className="space-y-1.5">
                <Label htmlFor="email-import-text" className="text-sm font-medium">
                  Email or thread
                </Label>
                <textarea
                  id="email-import-text"
                  data-testid="email-import-text"
                  className="w-full min-h-[160px] p-2 border rounded-md text-sm bg-background text-foreground"
                  placeholder="Paste the email or entire thread here…"
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                />
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    id="email-import-file"
                    data-testid="email-import-file"
                    accept=".eml,message/rfc822,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFile(file);
                    }}
                    className="sr-only"
                  />
                  <label
                    htmlFor="email-import-file"
                    className="inline-flex items-center gap-2 px-3 py-1.5 border rounded-md text-xs font-medium cursor-pointer hover:bg-muted transition-colors"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Import .eml file
                  </label>
                  {loadedFileName && (
                    <span className="text-xs text-green-600 dark:text-green-400 truncate">
                      Loaded {loadedFileName}
                    </span>
                  )}
                </div>
              </div>

              {/* File junk aside */}
              <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 p-3">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 mt-0.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
                  <div>
                    <Label htmlFor="email-import-junk" className="text-sm font-medium cursor-pointer">
                      File suspected junk aside
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      For a thread, promo / spam messages are quarantined into a labeled
                      &ldquo;Filtered — likely junk&rdquo; branch you can glance at. Nothing is ever deleted.
                    </p>
                  </div>
                </div>
                <Switch
                  id="email-import-junk"
                  data-testid="email-import-junk"
                  checked={fileJunkAside}
                  onCheckedChange={setFileJunkAside}
                />
              </div>

              {/* Output choice */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">Where should it go?</Label>
                <RadioGroup
                  value={outputMode}
                  onValueChange={(v) => setOutputMode(v as EmailImportOutputMode)}
                  className="gap-2"
                >
                  <div className="flex items-start gap-2">
                    <RadioGroupItem value="new" id="email-out-new" className="mt-1" data-testid="email-out-new" />
                    <Label htmlFor="email-out-new" className="font-normal cursor-pointer flex-1">
                      <span className="font-medium">Create new outline</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Named from the subject. Your other outlines stay untouched.
                      </p>
                    </Label>
                  </div>
                  <div className="flex items-start gap-2">
                    <RadioGroupItem
                      value="append"
                      id="email-out-append"
                      className="mt-1"
                      data-testid="email-out-append"
                      disabled={!currentOutlineName}
                    />
                    <Label htmlFor="email-out-append" className="font-normal cursor-pointer flex-1">
                      <span className="font-medium">Add to current outline</span>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {currentOutlineName
                          ? `Grafted under "${currentOutlineName}".`
                          : 'Open an outline first to use this.'}
                      </p>
                    </Label>
                  </div>
                  {hasSecondBrain && (
                    <div className="flex items-start gap-2">
                      <RadioGroupItem
                        value="secondBrain"
                        id="email-out-brain"
                        className="mt-1"
                        data-testid="email-out-brain"
                      />
                      <Label htmlFor="email-out-brain" className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">Save into Second Brain</span>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          File it in your personal knowledge base.
                        </p>
                      </Label>
                    </div>
                  )}
                </RadioGroup>
              </div>

              {/* Optional name */}
              <div className="space-y-1.5">
                <Label htmlFor="email-import-name" className="text-xs text-muted-foreground">
                  Outline name (optional)
                </Label>
                <Input
                  id="email-import-name"
                  placeholder="Auto-generated from the subject"
                  value={outlineName}
                  onChange={(e) => setOutlineName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>

              {/* Local AI */}
              <div className="flex items-start gap-2 pt-1">
                <Checkbox
                  id="email-import-local"
                  checked={useLocal}
                  onCheckedChange={(c) => setUseLocal(!!c)}
                />
                <div className="grid gap-1">
                  <Label htmlFor="email-import-local" className="text-sm font-medium cursor-pointer">
                    <Cpu className="inline h-3.5 w-3.5 mr-1" />
                    Use local AI (Ollama)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Slower but private — the email is processed entirely on your machine.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div
                  className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
                  data-testid="email-import-error"
                >
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  {errorMsg}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-1">
                Counts as 1 AI generation. The AI reads the email you bring in. Cancel or close to skip.
              </p>
            </div>
          </ScrollArea>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Structuring the email…</p>
          </div>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button
                onClick={handleRun}
                disabled={!emailText.trim()}
                data-testid="email-import-run"
              >
                <Mail className="h-4 w-4 mr-1" />
                Import
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Importing…
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

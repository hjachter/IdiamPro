'use client';

/**
 * Export Email dialog (2026-07-22).
 *
 * Turn a selected BRANCH (a node + all its descendants — the same "chapter"
 * scope Generate Video uses) into a ready-to-send email. Lives in the same
 * "Turn Into" family as Generate Video / Share as YouTube package.
 *
 * Flow:
 *   1. 'input'   — tone pick + optional extra instruction + (optional) local AI.
 *   2. 'running' — the AI drafts a real email from the branch.
 *   3. 'preview' — an EDITABLE preview (subject field + body textarea) plus
 *                  three no-login hand-offs:
 *                    a) Open in Gmail — Gmail compose URL (plain-text body).
 *                    b) Copy email    — rich (text/html) + plain to clipboard.
 *                    c) Download      — an RFC-822 .eml draft file.
 *
 * Reuses the existing AI pipeline (generateEmailAction → generate-email flow,
 * Gemini with Ollama fallback, BYOK keys). Counts as 1 AI generation, gated
 * through useAIUsageGate('exportEmail') exactly like the sibling wizards.
 * Google-account (OAuth) "save draft into Gmail" is intentionally OUT of
 * scope — the three hand-offs above need no login.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Mail, Loader2, AlertTriangle, Cpu, ArrowLeft, Sparkles, Copy, Download, Check, Send, Settings2 } from 'lucide-react';
import { generateEmailAction } from '@/app/actions';
import type { EmailTone } from '@/ai/flows/generate-email';
import { isLocalAIReachable, notifyLocalAIDown } from '@/lib/local-ai';
import { serializeSubtree } from '@/lib/transform-outline-helpers';
import { getUserApiKey } from '@/lib/byok-keys';
import { useAIUsageGate } from '@/lib/use-ai-usage-gate';
import { useEmailToolsSettings } from '@/lib/use-email-tools-settings';
import { openExternalUrl } from '@/lib/electron-storage';
import { useToast } from '@/hooks/use-toast';
import type { NodeMap } from '@/types';

interface ExportEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whole node map of the current outline. */
  nodes: NodeMap | null;
  /** Root of the branch to turn into an email — the SELECTED node. */
  rootNodeId: string | null;
  /** Friendly label for the branch (the selected node's name). */
  scopeLabel?: string;
  /** Display name of the current outline (context for the prompt). */
  outlineName?: string;
}

type Phase = 'input' | 'running' | 'preview';

// Above this many plain-text characters, the Gmail compose URL starts to get
// truncated by Gmail — surface a gentle hint that Copy/Download keep it whole.
const GMAIL_URL_SOFT_LIMIT = 1800;

const TONE_OPTIONS: { value: EmailTone; label: string; hint: string }[] = [
  { value: 'friendly-professional', label: 'Friendly professional', hint: 'Warm but polished — the default.' },
  { value: 'formal', label: 'Formal', hint: 'Polished and businesslike.' },
  { value: 'casual', label: 'Casual', hint: 'Relaxed and conversational.' },
];

/** Turn edited plain text back into simple HTML so all three hand-offs stay
 *  faithful to the user's edits (paragraphs + single-line-break handling). */
function plainToHtml(text: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return text
    .split(/\n{2,}/)
    .map((para) => `<p>${esc(para).replace(/\n/g, '<br>')}</p>`)
    .join('\n');
}

/** Safe filename from a subject line. */
function subjectToFilename(subject: string): string {
  const base = (subject || 'email').replace(/[^a-z0-9\- ]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60);
  return `${base || 'email'}.eml`;
}

/** Build a standard RFC-822 .eml draft (multipart/alternative: plain + html).
 *  X-Unsent:1 makes clients open it as a ready-to-edit draft. */
function buildEml(subject: string, bodyText: string, bodyHtml: string): string {
  const boundary = `----=_IdeaM_${Date.now().toString(36)}`;
  const CRLF = '\r\n';
  const htmlDoc = `<!doctype html><html><body>${bodyHtml}</body></html>`;
  return [
    'To: recipient@example.com',
    `Subject: ${subject}`,
    'X-Unsent: 1',
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    bodyText,
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset="utf-8"',
    'Content-Transfer-Encoding: 8bit',
    '',
    htmlDoc,
    '',
    `--${boundary}--`,
    '',
  ].join(CRLF);
}

export default function ExportEmailDialog({
  open,
  onOpenChange,
  nodes,
  rootNodeId,
  scopeLabel,
  outlineName,
}: ExportEmailDialogProps) {
  const { gate } = useAIUsageGate();
  const { userEmail } = useEmailToolsSettings();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>('input');
  // Shown when the user taps "Open in Gmail" without an email address set —
  // instead of opening a broken Gmail compose we prompt them to add it.
  const [showGmailNoEmail, setShowGmailNoEmail] = useState(false);
  const [tone, setTone] = useState<EmailTone>('friendly-professional');
  const [guidance, setGuidance] = useState('');
  const [useLocal, setUseLocal] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  // Editable email state (the preview).
  const [subject, setSubject] = useState('');
  const [bodyText, setBodyText] = useState('');
  // The AI's original HTML rendering — used as the rich copy/eml source UNLESS
  // the user has edited the body (then we re-derive HTML from their text).
  const [aiBodyHtml, setAiBodyHtml] = useState('');
  const [bodyEdited, setBodyEdited] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset each time the dialog opens fresh.
  useEffect(() => {
    if (open) {
      setPhase('input');
      setTone('friendly-professional');
      setGuidance('');
      setUseLocal(false);
      setErrorMsg(null);
      setModelLabel(null);
      setSubject('');
      setBodyText('');
      setAiBodyHtml('');
      setBodyEdited(false);
      setCopied(false);
      setShowGmailNoEmail(false);
    }
  }, [open]);

  // The HTML we hand to Copy / Download: the AI's formatted HTML if the user
  // hasn't touched the body, otherwise a faithful render of their edited text.
  const effectiveHtml = useMemo(
    () => (bodyEdited || !aiBodyHtml ? plainToHtml(bodyText) : aiBodyHtml),
    [bodyEdited, aiBodyHtml, bodyText],
  );

  // Live-composed hand-off payloads (recomputed as the user edits).
  // If the user's email is set, target that Gmail account via &authuser.
  const gmailUrl = useMemo(() => {
    const base = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
    return userEmail.trim()
      ? `${base}&authuser=${encodeURIComponent(userEmail.trim())}`
      : base;
  }, [subject, bodyText, userEmail]);
  // Universal any-provider / Apple Mail path — hands off to the default mail
  // app. One implementation works on every OS.
  const mailtoUrl = useMemo(
    () =>
      `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`,
    [subject, bodyText],
  );
  const emlContent = useMemo(
    () => buildEml(subject, bodyText, effectiveHtml),
    [subject, bodyText, effectiveHtml],
  );
  const copyPlain = useMemo(() => `Subject: ${subject}\n\n${bodyText}`, [subject, bodyText]);
  const copyHtml = useMemo(
    () => `<p><strong>Subject:</strong> ${subject.replace(/</g, '&lt;')}</p>\n${effectiveHtml}`,
    [subject, effectiveHtml],
  );

  const bodyTooLongForGmail = bodyText.length > GMAIL_URL_SOFT_LIMIT;

  const handleClose = () => onOpenChange(false);

  const handleRun = async () => {
    if (!nodes || !rootNodeId) {
      setErrorMsg('Select a branch first — a node and its sub-points.');
      return;
    }
    // Tier-enforcement gate: one email draft = 1 generation.
    if (!gate({ feature: 'exportEmail' })) return;

    // On-device AI selected but the engine is down → calm one-click notice.
    if (useLocal && !(await isLocalAIReachable())) {
      await notifyLocalAIDown({ onRetry: () => { void handleRun(); } });
      return;
    }

    setErrorMsg(null);
    setPhase('running');

    try {
      const { subtreeNodes } = serializeSubtree(nodes, rootNodeId);
      const userApiKey = getUserApiKey('gemini');
      const r = await generateEmailAction({
        subtreeNodes,
        rootNodeId,
        currentOutlineName: outlineName,
        tone,
        guidance: guidance.trim() || undefined,
        senderEmail: userEmail.trim() || undefined,
        useLocal,
        userApiKey,
      });

      if (r.error || (!r.subject && !r.bodyText)) {
        setErrorMsg(
          `I couldn't draft the email. ${r.error || 'The AI returned nothing usable.'} You can try again, switch to local AI, or check your API key in Settings.`,
        );
        setPhase('input');
        return;
      }

      setSubject(r.subject);
      setBodyText(r.bodyText || '');
      setAiBodyHtml(r.bodyHtml || '');
      setBodyEdited(false);
      setModelLabel(r.model);
      setPhase('preview');
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      setErrorMsg(
        `The email draft didn't go through. ${raw ? `Reason: ${raw}. ` : ''}You can try again, switch to local AI, or check your API key in Settings.`,
      );
      setPhase('input');
    }
  };

  const handleOpenInGmail = () => {
    // Gmail's compose hand-off targets a specific account. Without the user's
    // email we'd risk opening the wrong account or a broken compose — so we
    // prompt them to add it instead. Copy/Download stay available regardless.
    if (!userEmail.trim()) {
      setShowGmailNoEmail(true);
      return;
    }
    void openExternalUrl(gmailUrl);
  };

  const handleOpenInMail = () => {
    void openExternalUrl(mailtoUrl);
  };

  // Jump the user straight to the email-address field in Settings.
  const handleJumpToEmailSetting = () => {
    onOpenChange(false);
    window.dispatchEvent(new CustomEvent('open-professional-settings'));
  };

  const handleCopy = async () => {
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([copyHtml], { type: 'text/html' }),
            'text/plain': new Blob([copyPlain], { type: 'text/plain' }),
          }),
        ]);
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(copyPlain);
      } else {
        throw new Error('Clipboard unavailable');
      }
      setCopied(true);
      toast({ title: 'Email copied', description: 'Paste into Gmail or Apple Mail — formatting is preserved.' });
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last-ditch plain-text fallback.
      try {
        await navigator.clipboard?.writeText(copyPlain);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        toast({ variant: 'destructive', title: 'Copy failed', description: 'Your browser blocked clipboard access.' });
      }
    }
  };

  const handleDownload = () => {
    try {
      const blob = new Blob([emlContent], { type: 'message/rfc822' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = subjectToFilename(subject);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: 'Email downloaded', description: 'Open the .eml file to start a draft in your mail app.' });
    } catch {
      toast({ variant: 'destructive', title: 'Download failed', description: 'Could not create the email file.' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleClose(); else onOpenChange(o); }}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] flex flex-col" data-testid="export-email-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Export Email
          </DialogTitle>
          <DialogDescription>
            {scopeLabel
              ? `Turns "${scopeLabel}" and its sub-points into a ready-to-send email.`
              : 'Select a branch first — a node and its sub-points.'}
          </DialogDescription>
        </DialogHeader>

        {phase === 'input' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Tone</Label>
                <RadioGroup value={tone} onValueChange={(v) => setTone(v as EmailTone)} className="gap-2">
                  {TONE_OPTIONS.map((opt) => (
                    <div key={opt.value} className="flex items-start gap-2">
                      <RadioGroupItem value={opt.value} id={`email-tone-${opt.value}`} className="mt-1" />
                      <Label htmlFor={`email-tone-${opt.value}`} className="font-normal cursor-pointer flex-1">
                        <span className="font-medium">{opt.label}</span>
                        <p className="text-xs text-muted-foreground mt-0.5">{opt.hint}</p>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email-guidance" className="text-sm font-medium">
                  Anything to add? <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  id="email-guidance"
                  value={guidance}
                  onChange={(e) => setGuidance(e.target.value)}
                  placeholder="e.g. keep it short, address it to my team"
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleRun(); } }}
                />
              </div>

              <div className="flex items-start gap-2 pt-1">
                <Checkbox id="email-local" checked={useLocal} onCheckedChange={(c) => setUseLocal(!!c)} />
                <div className="grid gap-1">
                  <Label htmlFor="email-local" className="text-sm font-medium cursor-pointer">
                    <Cpu className="inline h-3.5 w-3.5 mr-1" />
                    Use local AI (Ollama)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Slower but private — the draft runs entirely on your machine.
                  </p>
                </div>
              </div>

              {errorMsg && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <AlertTriangle className="inline h-4 w-4 mr-1" />
                  {errorMsg}
                </div>
              )}

              <p className="text-xs text-muted-foreground pt-1">
                Counts as 1 AI generation. Cancel or close to skip.
              </p>
            </div>
          </ScrollArea>
        )}

        {phase === 'running' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Drafting your email…</p>
          </div>
        )}

        {phase === 'preview' && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-3 py-2">
              {modelLabel && (
                <div className="flex items-center gap-2 text-sm">
                  <Badge variant="secondary">{modelLabel}</Badge>
                  <span className="text-muted-foreground text-xs">Edit anything below before you send.</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email-subject" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Subject
                </Label>
                <Input
                  id="email-subject"
                  data-testid="email-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="font-medium"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="email-body" className="text-xs uppercase tracking-wide text-muted-foreground">
                  Body
                </Label>
                <textarea
                  id="email-body"
                  data-testid="email-body"
                  value={bodyText}
                  onChange={(e) => { setBodyText(e.target.value); setBodyEdited(true); }}
                  className="w-full min-h-[240px] rounded-md border border-input bg-background p-3 text-sm leading-relaxed resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  spellCheck
                />
              </div>

              {bodyTooLongForGmail && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  This email is long — the &ldquo;Open in Gmail&rdquo; and &ldquo;Open in Mail&rdquo; hand-offs are plain text and may trim it. Use Copy or Download to keep the full formatting.
                </p>
              )}

              {showGmailNoEmail && (
                <div
                  data-testid="email-gmail-no-email"
                  className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm"
                >
                  <p className="text-amber-700 dark:text-amber-300">
                    Add your email in Settings &rarr; Professional Customization to use Gmail. Copy and Download work without it.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={handleJumpToEmailSetting}
                    data-testid="email-gmail-open-settings"
                  >
                    <Settings2 className="h-4 w-4 mr-1" />
                    Open Settings
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        )}

        <DialogFooter>
          {phase === 'input' && (
            <>
              <Button variant="ghost" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleRun} disabled={!rootNodeId}>
                <Sparkles className="h-4 w-4 mr-1" />
                Draft email
              </Button>
            </>
          )}
          {phase === 'running' && (
            <Button disabled>
              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              Drafting…
            </Button>
          )}
          {phase === 'preview' && (
            <TooltipProvider delayDuration={300}>
              <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-2 w-full">
                <Button variant="ghost" size="sm" onClick={() => setPhase('input')}>
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  Redraft
                </Button>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleOpenInGmail}
                        data-testid="email-open-gmail"
                        data-gmail-url={gmailUrl}
                        disabled={!subject && !bodyText}
                      >
                        <Mail className="h-4 w-4 mr-1" />
                        Open in Gmail
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Open a pre-filled Gmail compose window in your browser (plain text).</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleOpenInMail}
                        data-testid="email-open-mail"
                        data-mailto-url={mailtoUrl}
                        disabled={!subject && !bodyText}
                      >
                        <Send className="h-4 w-4 mr-1" />
                        Open in Mail
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Hand off to your default mail app (Apple Mail, Outlook, any provider) — plain text.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        onClick={handleCopy}
                        data-testid="email-copy"
                        disabled={!subject && !bodyText}
                      >
                        {copied ? <Check className="h-4 w-4 mr-1" /> : <Copy className="h-4 w-4 mr-1" />}
                        {copied ? 'Copied' : 'Copy email'}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Copy with formatting — paste into Gmail or Apple Mail and it keeps its look.</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        onClick={handleDownload}
                        data-testid="email-download"
                        data-eml-content={emlContent}
                        disabled={!subject && !bodyText}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Save an .eml file that opens as a ready draft in Gmail, Apple Mail, or Outlook.</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </TooltipProvider>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Shield, ExternalLink } from 'lucide-react';

interface AIConsentDialogProps {
  open: boolean;
  onConsent: () => void;
  onDecline: () => void;
}

export default function AIConsentDialog({ open, onConsent, onDecline }: AIConsentDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onDecline(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-500" />
            AI Data Processing Consent
          </DialogTitle>
          <DialogDescription>
            IdiamPro uses third-party AI services to power its intelligent features.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm">
            When you use AI features (content generation, outline creation, podcasts, source extraction, diagrams), your outline content is sent to the following services for processing:
          </p>

          <div className="space-y-2">
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="text-lg mt-0.5">🔵</span>
              <div>
                <p className="text-sm font-medium">Google Gemini</p>
                <p className="text-xs text-muted-foreground">Used for AI text generation, content expansion, outline creation, and source extraction. Your outline text and prompts are sent for processing.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="text-lg mt-0.5">🟢</span>
              <div>
                <p className="text-sm font-medium">OpenAI</p>
                <p className="text-xs text-muted-foreground">Used for podcast audio synthesis (text-to-speech). Generated script text is sent for voice synthesis.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-muted rounded-lg">
              <span className="text-lg mt-0.5">🟣</span>
              <div>
                <p className="text-sm font-medium">AssemblyAI</p>
                <p className="text-xs text-muted-foreground">Used for audio transcription with speaker detection. Audio recordings are sent for transcription.</p>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            No data is stored by these providers beyond processing your request. Your outlines remain stored locally on your device. You can revoke this consent at any time in Settings.
          </p>

          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline flex items-center gap-1"
          >
            Read our Privacy Policy <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onDecline}>
            Decline
          </Button>
          <Button onClick={onConsent}>
            I Agree
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';

interface PWAUpdateNotificationProps {
  onUpdate: () => void;
  onDismiss: () => void;
}

export function PWAUpdateNotification({ onUpdate, onDismiss }: PWAUpdateNotificationProps) {
  return (
    <div className="fixed bottom-4 right-4 z-50 bg-blue-600 text-white rounded-lg shadow-lg p-4 max-w-md animate-in slide-in-from-bottom-5">
      <div className="flex items-start gap-3">
        <RefreshCw className="h-5 w-5 mt-0.5 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-sm">Update Available</h3>
          <p className="text-xs mt-1 text-blue-100">
            A new version of IdiamPro is ready. Click update to get the latest features.
          </p>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              onClick={onUpdate}
              className="bg-white text-blue-600 hover:bg-blue-50 h-8 text-xs"
            >
              Update Now
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              className="text-white hover:bg-blue-700 h-8 text-xs"
            >
              Later
            </Button>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-blue-100 hover:text-white transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

'use client';

/**
 * Always-visible amber chip shown whenever the developer "Simulate free user"
 * override is active. Reuses the amber treatment of the Admin Console so the
 * owner instantly recognizes it as a self-only, not-real state and never
 * mistakes the forced free experience for real behavior.
 *
 * Renders nothing when the override is off.
 */

import * as React from 'react';
import { FlaskConical } from 'lucide-react';
import {
  isSimulatingFreeUser,
  DEV_SIMULATE_FREE_EVENT,
} from '@/lib/dev/dev-simulate-free';

export function DevSimulateFreeIndicator() {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setActive(isSimulatingFreeUser());
    sync();
    window.addEventListener(DEV_SIMULATE_FREE_EVENT, sync as EventListener);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(DEV_SIMULATE_FREE_EVENT, sync as EventListener);
      window.removeEventListener('storage', sync);
    };
  }, []);

  if (!active) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="dev-simulate-free-indicator"
      className="pointer-events-none fixed bottom-3 left-3 z-[100] flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500 px-3 py-1 text-[11px] font-semibold text-amber-950 shadow-md"
    >
      <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
      Simulating: Free user
    </div>
  );
}

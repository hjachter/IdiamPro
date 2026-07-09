'use client';

/**
 * /admin/flags — the Feature Switchboard.
 *
 * The admin master switchboard: every server-driven feature flag with an
 * enable/kill toggle and an audience selector (Everyone / Free only / Pro
 * only). Saving calls the admin write API (/api/admin/feature-flags), which
 * persists an override; the whole app reads the effective flags on startup.
 *
 * Access is enforced server-side by the /admin layout (a signed-in Clerk user
 * on the ADMIN_EMAILS allowlist) AND by the API guard — no client flag.
 *
 * Amber theme: this lives under the /admin layout's persistent amber "ADMIN
 * CONSOLE" bar; the page uses amber accents so it can never be mistaken for
 * the live green app.
 *
 * FAIL-SAFE surfacing: if the store is unavailable, a save returns a clear
 * error (persist toast) explaining the app is safely on coded defaults — the
 * UI never pretends a save succeeded.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { RefreshCw, ToggleLeft, Save, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import {
  audienceLabel,
  FLAG_AUDIENCES,
  type FeatureFlag,
  type FlagAudience,
} from '@/lib/flags/flags';

interface FlagsResponse {
  flags: FeatureFlag[];
}

export default function AdminFlagsPage() {
  const { toast } = useToast();
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/admin/feature-flags', { cache: 'no-store' });
      if (!resp.ok) throw new Error(`Could not load flags (HTTP ${resp.status}).`);
      const json = (await resp.json()) as FlagsResponse;
      setFlags(Array.isArray(json.flags) ? json.flags : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flags.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  /** Optimistically update one flag locally (before the save round-trips). */
  const patchLocal = useCallback((key: string, patch: Partial<FeatureFlag>) => {
    setFlags((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));
  }, []);

  /** Persist the current state of one flag via the admin API. */
  const save = useCallback(
    async (flag: FeatureFlag) => {
      setSavingKey(flag.key);
      try {
        const resp = await fetch('/api/admin/feature-flags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            key: flag.key,
            enabled: flag.enabled,
            audience: flag.audience,
          }),
        });
        const json = (await resp.json()) as {
          ok?: boolean;
          error?: string;
          flags?: FeatureFlag[];
        };
        if (!resp.ok || json.ok === false) {
          // Reflect the server's authoritative state and surface the reason.
          if (Array.isArray(json.flags)) setFlags(json.flags);
          toast({
            variant: 'destructive',
            title: 'Could not save',
            description:
              json.error ??
              'The change was not saved. The app is safely using defaults.',
          });
          return;
        }
        if (Array.isArray(json.flags)) setFlags(json.flags);
        toast({
          title: 'Saved',
          description: `"${flag.label}" is now ${
            flag.enabled ? `ON for ${audienceLabel(flag.audience)}` : 'OFF (killed)'
          }.`,
        });
      } catch (err) {
        toast({
          variant: 'destructive',
          title: 'Could not save',
          description:
            err instanceof Error ? err.message : 'A network error prevented saving.',
        });
      } finally {
        setSavingKey(null);
      }
    },
    [toast],
  );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-4xl px-6 py-10">
          <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="flex items-center gap-2 text-3xl font-semibold tracking-tight">
                <ToggleLeft className="h-7 w-7 text-amber-600 dark:text-amber-400" aria-hidden />
                Feature Switchboard
              </h1>
              <p className="mt-1 max-w-2xl text-muted-foreground">
                Turn shipped features on or off for users instantly, and choose
                who sees each one. Changes take effect the next time the app
                loads its flags. If this service is ever unreachable, the app
                safely falls back to built-in defaults.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={reload}
              disabled={loading}
              aria-label="Reload flags"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Reload
            </Button>
          </header>

          {error && (
            <div
              role="alert"
              className="mb-6 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
            >
              {error}
            </div>
          )}

          {!loading && flags.length === 0 && !error ? (
            <div className="text-muted-foreground">No feature flags registered.</div>
          ) : (
            <div className="flex flex-col gap-4">
              {flags.map((flag) => (
                <FlagRow
                  key={flag.key}
                  flag={flag}
                  saving={savingKey === flag.key}
                  onToggle={(enabled) => {
                    patchLocal(flag.key, { enabled });
                    void save({ ...flag, enabled });
                  }}
                  onAudience={(audience) => {
                    patchLocal(flag.key, { audience });
                    void save({ ...flag, audience });
                  }}
                />
              ))}
            </div>
          )}

          <footer className="mt-12 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" aria-hidden />
            <span>
              Killing a flag hides its feature for the chosen audience only —
              the feature&rsquo;s own rules (desktop-only, Pro gating, free
              tastes) still apply underneath. Percentage rollout and per-user
              targeting are planned for a later version.
            </span>
          </footer>
        </div>
      </div>
    </TooltipProvider>
  );
}

function FlagRow({
  flag,
  saving,
  onToggle,
  onAudience,
}: {
  flag: FeatureFlag;
  saving: boolean;
  onToggle: (enabled: boolean) => void;
  onAudience: (audience: FlagAudience) => void;
}) {
  return (
    <Card className="border border-amber-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold">{flag.label}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{flag.description}</p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            {saving && (
              <Save className="h-4 w-4 animate-pulse text-muted-foreground" aria-hidden />
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs font-semibold uppercase tracking-wide ${
                      flag.enabled
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {flag.enabled ? 'On' : 'Off'}
                  </span>
                  <Switch
                    checked={flag.enabled}
                    onCheckedChange={onToggle}
                    disabled={saving}
                    aria-label={`${flag.enabled ? 'Disable' : 'Enable'} ${flag.label}`}
                    className="min-h-[24px] data-[state=checked]:bg-emerald-600"
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="left">
                {flag.enabled ? 'Kill this feature for everyone' : 'Turn this feature back on'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Audience
          </span>
          <Select
            value={flag.audience}
            onValueChange={(v) => onAudience(v as FlagAudience)}
            disabled={saving || !flag.enabled}
          >
            <SelectTrigger className="h-10 w-48" aria-label={`Audience for ${flag.label}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FLAG_AUDIENCES.map((a) => (
                <SelectItem key={a} value={a}>
                  {audienceLabel(a)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!flag.enabled && (
            <span className="text-xs text-muted-foreground">
              (audience applies once the feature is on)
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

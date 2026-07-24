import type {Metadata} from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import './globals.css';

// IBM Plex — self-hosted at build time by next/font (no external font CDN at
// runtime, so it's CSP-safe). Plex Sans is the primary typeface for the whole
// site; Plex Mono powers small uppercase eyebrows/labels for the precise,
// engineered "IBM Carbon" feel. Exposed as CSS variables that Tailwind's
// font-sans / font-mono families resolve to (see tailwind.config.ts).
const plexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-plex-sans',
  display: 'swap',
});
const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-plex-mono',
  display: 'swap',
});
import { Toaster } from "@/components/ui/toaster";
import { AIProvider } from '@/contexts/ai-context';
import { UpgradePromptProvider } from '@/components/upgrade-prompt';
import { AllowanceCapPromptProvider } from '@/components/allowance-cap-prompt';
import ErrorBoundary from '@/components/error-boundary';
import { PWAInstaller } from '@/components/pwa-installer';
import { ThemeProvider } from 'next-themes';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/lib/auth/AuthProvider';
import { DiscoveryProvider } from '@/hooks/use-discovery';
import { DiscoveryToastStack } from '@/components/discovery-toast';
import { DevSimulateFreeIndicator } from '@/components/dev-simulate-free-indicator';
import { FeatureFlagsProvider } from '@/components/feature-flags-provider';
import BackupHealthWatcher from '@/components/backup-health-watcher';

// Social link-preview image: /public/og-image.png (1200x630). Premium
// "one idea → many outputs" card, IdeaM-branded. Re-render/edit the source at
// /public/og/og-preview.html via `node scripts/og/render-og.js`.
export const metadata: Metadata = {
  metadataBase: new URL('https://2ndbrainware.com'),
  title: {
    default: 'IdeaM — AI-native outliner for thinkers and researchers',
    template: '%s | IdeaM',
  },
  description:
    'IdeaM, by SecondBrainWare, is an AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform — the outline editor your second brain deserves.',
  manifest: '/manifest.json',
  applicationName: 'IdeaM',
  creator: 'SecondBrainWare',
  publisher: 'SecondBrainWare',
  keywords: ['SecondBrainWare', 'Second Brain Ware', 'IdeaM', 'AI outliner', 'second brain app', 'AI-native outliner', 'consolidate ideas'],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IdeaM',
  },
  icons: {
    icon: [
      { url: '/favicon.ico' },
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/favicon.ico',
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://2ndbrainware.com',
    siteName: 'IdeaM',
    title: 'IdeaM — AI-native outliner for thinkers and researchers',
    description:
      'An AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform. From SecondBrainWare.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'IdeaM — AI-native outliner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'IdeaM — AI-native outliner for thinkers and researchers',
    description:
      'An AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform. From SecondBrainWare.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full overflow-hidden ${plexSans.variable} ${plexMono.variable}`} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#242424" />
        {/* Organization structured data — tells search engines this domain IS the
            company SecondBrainWare (so searches for the company name find it). */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Organization',
              name: 'SecondBrainWare',
              alternateName: ['Second Brain Ware', '2ndBrainWare'],
              url: 'https://2ndbrainware.com',
              logo: 'https://2ndbrainware.com/icons/icon-180.png',
              description:
                'SecondBrainWare builds IdeaM, an AI-native outliner and second-brain platform that helps you capture, consolidate, and develop your ideas across every platform.',
            }),
          }}
        />
      </head>
      <body className="font-body antialiased h-full overflow-hidden">
        <PWAInstaller />
        {/* AuthProvider is env-gated: with no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            it renders children untouched (exact current behavior, no Clerk
            loaded, no network) — same philosophy as the Sentry integration. */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            <ErrorBoundary>
              <div className="h-full">
                <AIProvider>
                  {/* Feature Switchboard — fetches server-driven feature flags
                      once on startup and exposes useFeatureFlag(). Seeded with
                      safe DEFAULT_FLAGS so it can never blank/block the app if
                      the flag service is unreachable. */}
                  <FeatureFlagsProvider>
                    {/* Phase 3 friendly gate-hit UX. Inert when enforcement
                        is off — the gates that trigger it are themselves
                        no-ops with no auth/billing keys. */}
                    <UpgradePromptProvider>
                      {/* Three-door AI allowance cap prompt (BYOK / overage /
                          on-device). Dormant until subscriptions are verified
                          server-side and a paid user hits their allowance. */}
                      <AllowanceCapPromptProvider>
                        {/* Discovery hints — "Did You Know?" sticky toasts.
                            Provider holds the dismissed-state and queue;
                            DiscoveryToastStack renders the cards. Toggling
                            Professional mode in Settings suppresses them. */}
                        <DiscoveryProvider>
                          {children}
                          <DiscoveryToastStack />
                        </DiscoveryProvider>
                      </AllowanceCapPromptProvider>
                    </UpgradePromptProvider>
                  </FeatureFlagsProvider>
                </AIProvider>
              </div>
              <Toaster />
              {/* Always-on backup watchdog — raises a loud, persistent warning
                  if automatic backups ever silently fail (and clears it on
                  recovery). Mounted once here so it's present on every screen.
                  Silent while backups are healthy. */}
              <BackupHealthWatcher />
              <DevSimulateFreeIndicator />
            </ErrorBoundary>
          </ThemeProvider>
        </AuthProvider>
        {/* Vercel Analytics — must be enabled in the Vercel project settings (Analytics tab) to start collecting. No-op in dev. */}
        <Analytics />
      </body>
    </html>
  );
}

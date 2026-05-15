import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AIProvider } from '@/contexts/ai-context';
import ErrorBoundary from '@/components/error-boundary';
import { PWAInstaller } from '@/components/pwa-installer';
import { ThemeProvider } from 'next-themes';
import { Analytics } from '@vercel/analytics/react';
import { AuthProvider } from '@/lib/auth/AuthProvider';

// NOTE: /og-image.png is referenced below but has not been designed yet.
// A 1200x630 PNG should be added to /public/og-image.png before production launch.
export const metadata: Metadata = {
  metadataBase: new URL('https://secondbrainware.com'),
  title: {
    default: 'SecondBrainWare — AI-native outliner for thinkers and researchers',
    template: '%s | SecondBrainWare',
  },
  description:
    'SecondBrainWare is an AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform — the outline editor your second brain deserves.',
  manifest: '/manifest.json',
  applicationName: 'SecondBrainWare',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IdiamPro',
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
    url: 'https://secondbrainware.com',
    siteName: 'SecondBrainWare',
    title: 'SecondBrainWare — AI-native outliner for thinkers and researchers',
    description:
      'An AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform.',
    images: [
      {
        // TODO: design and add /public/og-image.png (1200x630)
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'SecondBrainWare — AI-native outliner',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecondBrainWare — AI-native outliner for thinkers and researchers',
    description:
      'An AI-native outliner that helps you think, research, and write. Local-first, BYOK, cross-platform.',
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
    <html lang="en" className="h-full overflow-hidden" suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover" />
        <meta name="theme-color" content="#242424" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&family=Source+Code+Pro&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased h-full overflow-hidden">
        <PWAInstaller />
        {/* AuthProvider is env-gated: with no NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
            it renders children untouched (exact current behavior, no Clerk
            loaded, no network) — same philosophy as the Sentry integration. */}
        <AuthProvider>
          <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
            <ErrorBoundary>
              <div className="h-full">
                <AIProvider>
                  {children}
                </AIProvider>
              </div>
              <Toaster />
            </ErrorBoundary>
          </ThemeProvider>
        </AuthProvider>
        {/* Vercel Analytics — must be enabled in the Vercel project settings (Analytics tab) to start collecting. No-op in dev. */}
        <Analytics />
      </body>
    </html>
  );
}

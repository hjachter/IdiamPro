import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AIProvider } from '@/contexts/ai-context';
import ErrorBoundary from '@/components/error-boundary';
import { PWAInstaller } from '@/components/pwa-installer';

export const metadata: Metadata = {
  title: 'IdiamPro - Professional Outlining',
  description: 'Professional outlining with AI-powered assistance.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IdiamPro',
  },
  icons: {
    icon: [
      { url: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
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
        <meta name="theme-color" content="#242424" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f5f5f7" media="(prefers-color-scheme: light)" />
        <script dangerouslySetInnerHTML={{
          __html: `
            (function() {
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              document.documentElement.classList.toggle('dark', prefersDark);
              window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function(e) {
                document.documentElement.classList.toggle('dark', e.matches);
              });
            })();
          `
        }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&family=Source+Code+Pro&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased h-full overflow-hidden">
        <PWAInstaller />
        <ErrorBoundary>
          <div className="h-full">
            <AIProvider>
              {children}
            </AIProvider>
          </div>
          <Toaster />
        </ErrorBoundary>
      </body>
    </html>
  );
}

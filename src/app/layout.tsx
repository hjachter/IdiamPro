import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AIProvider } from '@/contexts/ai-context';
import ErrorBoundary from '@/components/error-boundary';

export const metadata: Metadata = {
  title: 'Outline Pro',
  description: 'Professional outlining with AI-powered assistance.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full overflow-hidden">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;700&family=Source+Code+Pro&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased h-full overflow-hidden">
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

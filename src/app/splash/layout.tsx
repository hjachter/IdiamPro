import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'SecondBrainWare — your AI-native second brain',
  description:
    'Meet SecondBrainWare: an AI-native outliner built for thinkers, researchers, and writers. Local-first, BYOK, cross-platform.',
  alternates: { canonical: '/splash' },
  openGraph: {
    title: 'SecondBrainWare — your AI-native second brain',
    description:
      'An AI-native outliner built for thinkers, researchers, and writers. Local-first, BYOK, cross-platform.',
    url: '/splash',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecondBrainWare — your AI-native second brain',
    description: 'An AI-native outliner for thinkers and researchers.',
  },
};

export default function SplashLayout({ children }: { children: React.ReactNode }) {
  return children;
}

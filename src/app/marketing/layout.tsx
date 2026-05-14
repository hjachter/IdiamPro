import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'AI-native outliner for thinkers, researchers, and writers',
  description:
    'SecondBrainWare turns your notes into a structured second brain. AI-assisted outlining, local-first storage, BYOK keys, and cross-platform sync.',
  alternates: { canonical: '/marketing' },
  openGraph: {
    title: 'SecondBrainWare — AI-native outliner',
    description:
      'Turn your notes into a structured second brain. AI-assisted outlining, local-first, BYOK.',
    url: '/marketing',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SecondBrainWare — AI-native outliner',
    description:
      'Turn your notes into a structured second brain. AI-assisted outlining, local-first, BYOK.',
  },
};

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return children;
}

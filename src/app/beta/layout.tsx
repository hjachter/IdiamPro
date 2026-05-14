import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Join the SecondBrainWare beta',
  description:
    'Get early access to SecondBrainWare. Sign up for the beta and help shape the AI-native outliner for thinkers and researchers.',
  alternates: { canonical: '/beta' },
  openGraph: {
    title: 'Join the SecondBrainWare beta',
    description:
      'Get early access to the AI-native outliner. Help shape SecondBrainWare before public launch.',
    url: '/beta',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Join the SecondBrainWare beta',
    description: 'Get early access to the AI-native outliner.',
  },
};

export default function BetaLayout({ children }: { children: React.ReactNode }) {
  return children;
}

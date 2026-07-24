import type { Metadata } from 'next';
import Deck from './deck';

export const metadata: Metadata = {
  title: 'Idea Engineering — Seminar',
  description:
    'A full-screen keynote on Idea Engineering, the new class of AI app — built in IdeaM for Western Washington University.',
  robots: { index: false, follow: false },
};

export default function PresentationPage() {
  return <Deck />;
}

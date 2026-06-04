import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin — IdiamPro',
  description: 'Internal admin tools for IdiamPro.',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}

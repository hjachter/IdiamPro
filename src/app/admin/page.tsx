import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Users,
  Bug,
  MessageSquare,
  ToggleRight,
  HeartPulse,
  Mail,
  Gauge,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Internal Tools — IdeaM',
  description: 'Internal / developer control panel for IdeaM.',
  robots: { index: false, follow: false },
};

/**
 * Internal control-panel index (route: /admin).
 *
 * A single hub that links to every internal / developer tool so none of them
 * is an orphan — reachable only by typing a URL. Access is already enforced
 * server-side by the /admin layout (a signed-in Clerk user on the
 * ADMIN_EMAILS allowlist); this page just sits inside that gate and lists the
 * destinations. It is intentionally excluded from search indexing and is not
 * in the public marketing nav.
 */

const TOOLS: Array<{
  href: string;
  label: string;
  description: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    href: '/admin/metrics',
    label: 'Launch Metrics',
    description: 'Launch-week vitals — signups, activation, retention, revenue.',
    Icon: BarChart3,
  },
  {
    href: '/admin/applicants',
    label: 'Applicants',
    description: 'Beta / early-access applications: review, approve, or reject.',
    Icon: Users,
  },
  {
    href: '/admin/bugs',
    label: 'Bugs',
    description: 'Incoming bug reports with status, notes, and triage.',
    Icon: Bug,
  },
  {
    href: '/admin/feedback',
    label: 'Feedback',
    description: 'User feedback and suggestions submitted from the app.',
    Icon: MessageSquare,
  },
  {
    href: '/admin/flags',
    label: 'Feature Flags',
    description: 'Turn features on or off per audience without a redeploy.',
    Icon: ToggleRight,
  },
  {
    href: '/admin/health',
    label: 'Health',
    description: 'Dependency and service health checks at a glance.',
    Icon: HeartPulse,
  },
  {
    href: '/admin/invites',
    label: 'Invites',
    description: 'Manage the invite allowlist and outgoing invitations.',
    Icon: Mail,
  },
  {
    href: '/stress-test',
    label: 'Stress Test',
    description: 'Load large outlines to gauge editor performance limits.',
    Icon: Gauge,
  },
];

export default function AdminIndexPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <header className="mb-8">
        <div className="flex items-center gap-2 text-amber-600 dark:text-amber-500">
          <ShieldAlert className="h-4 w-4" aria-hidden="true" />
          <span className="text-xs font-semibold uppercase tracking-widest">
            Internal use only
          </span>
        </div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Internal / Developer Tools
        </h1>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Central hub for the internal control panels. Access is restricted to
          admins and enforced server-side (Clerk sign-in + the ADMIN_EMAILS
          allowlist) — these pages are never shown in the public site.
        </p>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map(({ href, label, description, Icon }) => (
          <Link
            key={href}
            href={href}
            className="group rounded-xl border border-border bg-card hover:border-amber-400/60 hover:shadow-sm transition-all p-5 flex flex-col"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-500">
                <Icon className="h-5 w-5" />
              </span>
              <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <h2 className="mt-4 text-base font-semibold">{label}</h2>
            <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          </Link>
        ))}
      </div>

      <footer className="mt-12 text-xs text-muted-foreground">
        Internal control panel. Every destination is admin-gated server-side.
      </footer>
    </div>
  );
}

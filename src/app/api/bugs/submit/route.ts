/**
 * POST /api/bugs/submit
 *
 * Accepts an in-app "Report Issue" submission, persists it via the storage
 * adapter, and notifies Howard.
 *
 * Body shape (validated):
 *   {
 *     description: string (required, 10-5000 chars),
 *     context: string (optional),
 *     severity: 'fyi' | 'annoying' | 'blocking',
 *     screenshotBase64: string | null,   // < 2MB encoded
 *     metadata: {
 *       url: string,
 *       userAgent: string,
 *       outlineName: string | null,
 *       timestamp: ISO string,
 *     }
 *   }
 *
 * The signed-in user's email is pulled server-side from the Clerk session.
 * We never trust an email field in the request body.
 *
 * Rate-limited per IP to discourage scripted abuse.
 */
import { NextRequest, NextResponse } from 'next/server';
import {
  createBug,
  type BugSeverity,
  type BugMetadata,
} from '@/lib/access/bug-store';
import { sendBugNotification } from '@/lib/email/send';
import { enforceRateLimit } from '@/lib/rate-limit';
import { isAuthEnabled } from '@/lib/auth/auth-config';

export const runtime = 'nodejs';

const VALID_SEVERITIES: BugSeverity[] = ['fyi', 'annoying', 'blocking'];

// 2MB encoded ceiling. Base64 inflates bytes by ~33%, so a 2MB string
// represents ~1.5MB of binary screenshot — plenty for a UI screenshot.
const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

interface SubmitBody {
  description?: unknown;
  context?: unknown;
  severity?: unknown;
  screenshotBase64?: unknown;
  metadata?: {
    url?: unknown;
    userAgent?: unknown;
    outlineName?: unknown;
    timestamp?: unknown;
  };
}

function getAdminBaseUrl(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') ?? 'https';
  const host = request.headers.get('host') ?? '';
  if (!host) return 'https://2ndbrainware.com';
  return `${proto}://${host}`;
}

interface AuthIdentity {
  userId: string | null;
  email: string | null;
}

async function resolveSignedInUser(): Promise<AuthIdentity> {
  if (!isAuthEnabled()) return { userId: null, email: null };
  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const clerkServer = require('@clerk/nextjs/server') as {
      auth?: () => Promise<{ userId?: string | null }> | { userId?: string | null };
      clerkClient?: () => Promise<{
        users: { getUser: (id: string) => Promise<{ emailAddresses?: Array<{ emailAddress?: string }>; primaryEmailAddressId?: string | null }> };
      }>;
    };
    /* eslint-enable @typescript-eslint/no-var-requires */
    if (!clerkServer.auth) return { userId: null, email: null };
    const session = await Promise.resolve(clerkServer.auth());
    const userId = session.userId ?? null;
    if (!userId) return { userId: null, email: null };
    if (!clerkServer.clerkClient) return { userId, email: null };
    const client = await clerkServer.clerkClient();
    const user = await client.users.getUser(userId);
    const primary = user.emailAddresses?.find(
      (e) => Boolean(e.emailAddress),
    );
    return { userId, email: primary?.emailAddress ?? null };
  } catch {
    return { userId: null, email: null };
  }
}

export async function POST(request: NextRequest) {
  const limited = enforceRateLimit(request, {
    limit: 10,
    namespace: 'bugs-submit',
  });
  if (limited) return limited;

  let body: SubmitBody;
  try {
    body = (await request.json()) as SubmitBody;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Could not read your report — please try again.' },
      { status: 400 },
    );
  }

  const description =
    typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 10) {
    return NextResponse.json(
      { ok: false, error: 'Add a few more words describing what you saw.' },
      { status: 400 },
    );
  }
  if (description.length > 5000) {
    return NextResponse.json(
      { ok: false, error: 'That description is a bit long — please keep it under 5000 characters.' },
      { status: 400 },
    );
  }

  const context =
    typeof body.context === 'string' ? body.context.trim() : '';

  const severityRaw = typeof body.severity === 'string' ? body.severity : '';
  if (!VALID_SEVERITIES.includes(severityRaw as BugSeverity)) {
    return NextResponse.json(
      { ok: false, error: 'Pick how serious this is.' },
      { status: 400 },
    );
  }
  const severity = severityRaw as BugSeverity;

  let screenshotBase64: string | null = null;
  if (typeof body.screenshotBase64 === 'string' && body.screenshotBase64.length > 0) {
    if (body.screenshotBase64.length > MAX_SCREENSHOT_BYTES) {
      return NextResponse.json(
        {
          ok: false,
          error: 'That screenshot is over 2MB — try a smaller image.',
        },
        { status: 400 },
      );
    }
    screenshotBase64 = body.screenshotBase64;
  }

  const meta = body.metadata ?? {};
  const metadata: BugMetadata = {
    url: typeof meta.url === 'string' ? meta.url : '',
    userAgent: typeof meta.userAgent === 'string' ? meta.userAgent : '',
    outlineName:
      typeof meta.outlineName === 'string' && meta.outlineName.trim().length > 0
        ? meta.outlineName
        : null,
    timestamp:
      typeof meta.timestamp === 'string'
        ? meta.timestamp
        : new Date().toISOString(),
  };

  const identity = await resolveSignedInUser();

  let record;
  try {
    record = await createBug({
      description,
      context: context.length > 0 ? context : undefined,
      severity,
      userEmail: identity.email,
      userId: identity.userId,
      screenshotBase64,
      metadata,
    });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : 'Could not save your report — please try again.',
      },
      { status: 400 },
    );
  }

  // Notify Howard. Best-effort — don't fail the submission on email error.
  const adminUrl = `${getAdminBaseUrl(request)}/admin/bugs?focus=${encodeURIComponent(record.id)}`;
  try {
    await sendBugNotification({ bug: record, adminUrl });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[bugs/submit] notification send failed:', err);
  }

  return NextResponse.json({ ok: true, bugId: record.id });
}

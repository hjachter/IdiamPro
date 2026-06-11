/**
 * /app layout — beta-approval gate.
 *
 * Wraps the entire /app subtree in a client-side gate that:
 *
 *   - Lets signed-OUT users through if auth is disabled (stub / dev mode)
 *     or the allowlist is empty. Otherwise redirects to /signup.
 *   - Lets signed-IN, allowlist-approved users through to the app.
 *   - Sends signed-IN-but-not-approved users to /waiting, the friendly
 *     "we've got your application, you'll hear from Howard soon" page.
 *
 * This is the runtime enforcement of the invite-only beta. Direct-to-app
 * deep links no longer bypass the application flow.
 */

import AppGate from '@/components/app-gate';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppGate>{children}</AppGate>;
}

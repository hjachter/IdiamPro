# Sign in with Apple — Audit & Decision

## 1. Audit finding (verified from code)

IdiamPro currently has **no authentication system of any kind**. A code audit found:

- No auth libraries installed: no `firebase/auth`, `next-auth`, `@auth/*`, Clerk, Supabase Auth, Lucia, Passport, AWS Amplify, or Appwrite.
- `firebase` package is declared in `package.json` but is **not imported anywhere** in `src/` (no `getAuth`, no `signInWith*`, no Firebase init).
- No social sign-in (Google / Facebook / GitHub / Twitter / Microsoft / etc.) is present.
- No email/password sign-in, magic-link, or SSO flow exists.
- The app today is fully local-first: outlines are stored in `~/Documents/IDM Outlines/` (Electron) or on-device (iOS) with no user account required.

## 2. Apple requirement implication

App Store Guideline **4.8** requires Sign in with Apple **only if** the app offers a third-party or social login. Because IdiamPro offers **no login at all**, Sign in with Apple is **not required** for App Store / Mac App Store approval today.

## 3. Recommendation

**Skip Sign in with Apple for v1 launch.** Implement it only when (and if) account-based features ship: cloud sync, group/collaboration, MCP-server-tied accounts, or billing portal login. When that day comes, add Sign in with Apple **at the same time** as the first social provider — not later — so Guideline 4.8 is satisfied from day one.

Rationale: adding auth before there is anything to authenticate creates friction for zero user benefit and forces premature decisions about identity provider, account recovery, and data migration.

## 4. Effort estimate (if pursued later)

Rough indie-developer estimates, assuming a backend already exists:

- **Web (Next.js)**: ~1 day. NextAuth or Auth.js with the Apple provider; configure Service ID, key, and return URL in the Apple Developer portal.
- **Capacitor (iOS)**: ~1 day. `@capacitor-community/apple-sign-in` plugin + native entitlement + bridging the token back to the backend.
- **Electron (macOS/Win/Linux)**: ~0.5-1 day. Use the web OAuth flow inside a BrowserWindow; Apple does not provide native macOS Electron support.
- **Backend session/JWT plumbing + testing on all 3 platforms**: ~1-2 days.

**Total: 3-5 focused days** once a backend exists. Without a backend, add 1-2 weeks for that foundation.

## 5. Decision pending from Howard

**Yes — confirm: skip for v1?** Recommended answer: yes, skip. Revisit when cloud sync or accounts ship.

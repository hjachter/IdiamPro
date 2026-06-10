# Incident Response Playbook

_Last updated: 2026-05-13. Owner: Howard Jachter (solo operator)._

This is a realistic playbook for a one-person operation. The goal is to act fast, communicate honestly, and write down what happened.

## Severity Ladder

| Severity | Definition | Examples | Response Time |
|---|---|---|---|
| **SEV-1** | Data loss, security breach, full outage of paid features | User outlines corrupted; leaked API keys; Stripe/auth completely down | Acknowledge within **30 min** |
| **SEV-2** | Major degradation affecting many users | Web app won't load; sync broken; AI features all failing | Acknowledge within **2 hours** |
| **SEV-3** | Partial degradation or slow performance | One AI provider slow; intermittent errors; non-core feature broken | Acknowledge within **1 business day** |
| **SEV-4** | Minor bugs, cosmetic issues, single-user reports | Typos; layout bugs; one user's account quirk | Triage in normal support queue |

## First Response

1. **Acknowledge** the incident — reply to the reporting user and post in the project log (`docs/outlines/IdiamPro - Development.idm` > Incidents).
2. **Open an incident note** in plain text: timestamp, what's broken, who's affected, what's been tried.
3. **Stop making changes** to production until the issue is understood. No "quick fixes" without confirming the cause.
4. For SEV-1/SEV-2, **post to status page** (Instatus recommended — set up before launch) within the acknowledgment window.

## Escalation Chain

- **Howard** is the first and usually only responder.
- **Data breach or PII exposure** → engage a privacy lawyer (have one on retainer or know who to call before launch) within 24 hours; check 72-hour GDPR notification requirement if any EU users are affected.
- **Stripe/payment fraud** → Stripe Radar handles most of this; escalate to Stripe support for unusual patterns.
- **Apple/App Store rejection or removal** → Apple Developer Support.

## User-Facing Communications

- **SEV-1/SEV-2**: status page post within the SLA window, updated at least every 2 hours until resolved.
- **Email blast threshold**: if more than ~10% of active users are affected for over 2 hours, send a plain-text email update. Use the support inbox, not a marketing tool.
- **Social media**: post on the SecondBrainWare X/Mastodon/Bluesky accounts mirroring the status page. Template: _"We're aware of [issue] affecting [scope]. Investigating now — updates at status.2ndbrainware.com."_

## Specific Scenarios

- **Vercel outage** — web only. Post status page note; macOS and iOS apps continue working offline. Wait for Vercel; we cannot fix their infra.
- **Anthropic / Gemini API outage** — AI features degrade. Surface a banner in-app: "AI provider temporarily unavailable." Local Ollama still works for users who have it.
- **Security breach (suspected)** — rotate all keys (Stripe, Vercel env vars, signing certs). Email affected users within 72 hours with what we know. Engage lawyer. Preserve logs before any cleanup.
- **Accidental data deletion (ours)** — restore from latest backup (see backup-and-dr.md). Notify affected users individually. Issue refunds proactively for impacted paid users.
- **Leaked API key in repo** — `git push --force` does not erase Git history from clones; treat as compromised. Rotate immediately. Run `git filter-repo`. Notify GitHub support for cache clearing. Audit the key's usage logs.

## Post-Mortem Template

Within **5 business days** of resolution, write a post-mortem and commit it to `docs/operations/postmortems/YYYY-MM-DD-short-name.md`:

1. **Summary** — one paragraph, plain language.
2. **Timeline** — UTC timestamps, what happened when.
3. **Root cause** — the real reason, not the surface symptom.
4. **What worked** — what saved us time or limited the blast radius.
5. **What didn't** — what slowed us down or made it worse.
6. **Action items** — concrete, dated, assigned (to Howard, since solo).

Post-mortems are blameless and public-ish: shareable with affected users on request.

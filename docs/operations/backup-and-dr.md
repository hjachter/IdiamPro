# Backup and Disaster Recovery Plan

_Last updated: 2026-05-13. Owner: Howard Jachter. Annual review: every May._

This document covers what data SecondBrainWare handles, where it lives, how it's backed up, and how we restore it.

## Data Inventory

| Data | Where it lives | Owner | Sensitivity |
|---|---|---|---|
| **User outlines (.idm files)** | User's local device + their own iCloud Drive (`~/Documents/IDM Outlines/`) | The user | High — their content |
| **Subscription state** | Stripe (source of truth) + our billing backend (cached) | SecondBrainWare | Medium — billing PII |
| **BYOK API keys** | Encrypted in our DB (per-user, AES-256 at rest) | The user | High — credentials |
| **Help-chat logs** | Our DB + support inbox | SecondBrainWare | Medium — may contain user context |
| **Account metadata** (email, tier, signup date) | Our DB | SecondBrainWare | Medium |
| **App signing certs, env secrets** | 1Password vault (Howard) + Apple Developer + Vercel | SecondBrainWare | Critical |

## Backup Frequency and Method

- **User outlines**: **Not our backup.** Stored in the user's iCloud Drive — Apple manages versioning and recovery. Users on macOS also get Time Machine if enabled. We do **not** copy user outlines to our servers.
- **Subscription state**: Stripe retains everything indefinitely; treat Stripe as the durable source of truth. Our cache is rebuildable from Stripe webhooks.
- **Our DB (Postgres on managed host)**: **daily automated snapshots**, 30-day retention. **Continuous WAL archiving** for point-in-time recovery within the last 7 days.
- **Help-chat logs**: included in DB snapshots above.
- **Support inbox**: email provider (Fastmail/Google) handles backup; export monthly to a local archive.
- **Secrets (1Password, Apple, Vercel)**: 1Password has its own backup. Export an encrypted vault dump quarterly and store offline (encrypted USB or local Time Machine).

## Restoration Procedures

- **User outline recovery**: walk the user through iCloud Drive Recently Deleted (30 days) and Time Machine. We can't restore content we don't store.
- **DB full restore**: trigger a snapshot restore from the managed Postgres provider. Target RTO **4 hours**, RPO **24 hours** (or 5 minutes with WAL replay).
- **Single-table or row recovery**: restore snapshot to a staging DB, extract the rows, apply to production. Document every step in an incident note.
- **Stripe reconciliation**: replay webhooks from Stripe Dashboard to rebuild our cached subscription state.
- **Secrets recovery**: 1Password recovery key (held by Howard in two physical locations).

## What We Are NOT Responsible For

This is important and will be repeated in the Terms of Service and Privacy Policy:

- **User outline content is the user's own data, stored in their own iCloud Drive.** Apple is the backup provider. We have no copies. If a user disables iCloud, deletes a file, or loses their device, we cannot recover it.
- **BYOK provider usage and billing** — we don't store or back up records of what users do with their own Anthropic/OpenAI/Gemini keys.

## Test Schedule

- **Quarterly restore drill**: every 3 months (Feb / May / Aug / Nov), do a real DB restore to a staging environment, verify data integrity, time the procedure, write up results in `docs/operations/dr-drills/YYYY-Qn.md`.
- **Annual full review**: every May (around this document's anniversary), audit the data inventory, confirm backup jobs are still running, rotate the offline secret dump, update this document.
- **Ad-hoc**: after any major infra change (new DB provider, new region, new data type), run a partial drill within 30 days.

## Disaster Scenarios

- **Managed Postgres provider goes down for >24h** — restore from latest snapshot to a different provider (have a runbook for two alternatives chosen in advance).
- **Vercel project deleted** — redeploy from git; env vars restored from 1Password.
- **Apple Developer account locked** — engage Apple support; users keep working on already-installed apps.
- **Howard is unavailable for an extended period** — successor access documented in a sealed envelope (lawyer or trusted contact) including 1Password emergency kit.

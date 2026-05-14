# Email Deliverability Setup — 2ndbrainware.com

Goal: get `support@2ndbrainware.com` and any transactional mail (password resets, receipts, beta invites) into inboxes — not spam.

## 1. What to set up

Three DNS records, in this order of importance:

- **SPF** (Sender Policy Framework) — a TXT record listing which servers are allowed to send mail "from" your domain. Receivers use it to reject spoofed senders.
- **DKIM** (DomainKeys Identified Mail) — a TXT record holding a public key. Your email provider signs outgoing messages with the matching private key; receivers verify the signature to confirm the message wasn't tampered with and really came from you.
- **DMARC** (Domain-based Message Authentication, Reporting, and Conformance) — a TXT record that tells receivers what to do when SPF or DKIM fails (none / quarantine / reject) and where to send aggregate reports.

A domain without all three lands in spam more often than not, especially at Gmail and Outlook.

## 2. DNS records to add at Namecheap

In Namecheap → Domain List → 2ndbrainware.com → **Advanced DNS** → Add New Record. Use Host = `@` for the root domain.

| Type | Host | Value | Notes |
|---|---|---|---|
| TXT | `@` | `v=spf1 include:<PROVIDER_SPF_DOMAIN> ~all` | e.g. `_spf.google.com` for Workspace, `spf.mtasv.net` for Postmark, `_spf.resend.com` for Resend |
| TXT | `<SELECTOR>._domainkey` | `<DKIM_PUBLIC_KEY_FROM_PROVIDER>` | Selector and value both come from your provider's DKIM setup page |
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:dmarc@2ndbrainware.com; pct=100; aspf=r; adkim=r` | Start with `p=none` to monitor; tighten to `quarantine` then `reject` after 2-4 weeks of clean reports |
| MX | `@` | `<PROVIDER_MX_HOSTS>` priority `<N>` | Only needed if you want to receive mail at the domain (you do, for support@) |

Propagation: 15 min to 24 hr. Namecheap usually shows changes within an hour.

## 3. Email provider recommendation

Best three options for a solo founder, lowest friction first:

1. **Resend** — $0/mo for 3,000 emails/mo (100/day), $20/mo for 50k. Modern API, great DX, DKIM auto-configured. Transactional only — does not host inboxes.
2. **Postmark** — $15/mo for 10k transactional emails. Industry-best deliverability reputation; ideal if launch-day emails must land. Transactional only.
3. **Google Workspace** — $7/user/mo. Full inbox at `support@2ndbrainware.com` plus sending. Convenient but deliverability on bulk/transactional is mediocre; not built for app emails.

**Recommended stack:** **Resend** for transactional/app emails + **Google Workspace** (1 seat) for the `support@` inbox. ~$7/mo until you outgrow Resend's free tier. Configure SPF to `include:` both: `v=spf1 include:_spf.google.com include:_spf.resend.com ~all`.

## 4. Verification

After DNS propagates:

- **mail-tester.com** — send a test email to the address it gives you, get a 0-10 score. Aim for 10/10. It explicitly checks SPF, DKIM, DMARC, reverse DNS, and content.
- **MXToolbox.com** — run "SPF Lookup", "DKIM Lookup" (provide your selector), "DMARC Lookup", and "Domain Health" on `2ndbrainware.com`.
- **Gmail "Show original"** — send yourself a test from a non-Gmail account, open in Gmail, click the three-dot menu → Show original. Confirm SPF: PASS, DKIM: PASS, DMARC: PASS.

## 5. Order of operations

1. **Pick provider** (Resend + Workspace recommended). Sign up for both.
2. **Add MX records** (Workspace) so `support@` can receive mail. Verify mail arrives.
3. **Add SPF** record — must `include:` every sending provider in one combined TXT.
4. **Add DKIM** — generate selector + public key inside each provider's dashboard, paste TXT records into Namecheap. One DKIM record per provider (different selectors).
5. **Send test emails** from each provider; confirm DKIM/SPF pass at mail-tester.com.
6. **Add DMARC** last, with `p=none` to start. Watch the rua aggregate reports for 2-4 weeks.
7. **Tighten DMARC** to `p=quarantine`, then `p=reject` after reports show only your own legitimate sources.

Do not add DMARC before SPF and DKIM are passing — `p=reject` on a misconfigured domain will silently drop your own mail.

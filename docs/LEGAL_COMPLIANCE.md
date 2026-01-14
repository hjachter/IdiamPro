# IdiamPro Legal & Compliance Checklist

## Overview
This document outlines the legal requirements and compliance items for launching IdiamPro as a commercial SaaS product.

### Legend
- **[CLAUDE]** = Claude can do this task
- **[HUMAN]** = Requires human action (payments, signatures, government filings)
- **[LAWYER]** = Requires attorney review

---

## 1. Business Formation

### C-Corp Formation
- **Recommended**: Delaware C-Corp (standard for tech startups, easier for VC funding)
- **Alternative**: Home state (California) - simpler but higher taxes
- **Cost**: $500-2,000 setup + $300-800/year maintenance
- **Timing**: Before collecting any revenue

### Action Items:
- [ ] Choose formation state (Delaware recommended) **[HUMAN]**
- [ ] Register with state Secretary of State **[HUMAN]** (use Clerky/Stripe Atlas)
- [ ] Obtain EIN from IRS **[HUMAN]** (online at irs.gov)
- [ ] Open business bank account **[HUMAN]**
- [ ] Set up bookkeeping (QuickBooks, Xero, or similar) **[HUMAN]**

### Resources:
- **Clerky**: $2-3k all-in for formation + standard docs (automated)
- **Gust Launch**: Similar to Clerky
- **Stripe Atlas**: $500 for Delaware C-Corp formation

---

## 2. Terms of Service (TOS)

### Must Include:
- [ ] User responsibilities and acceptable use **[CLAUDE]** can draft
- [ ] Account creation and termination **[CLAUDE]** can draft
- [ ] Payment terms and refund policy **[CLAUDE]** can draft
- [ ] Intellectual property rights **[CLAUDE]** can draft
- [ ] AI-generated content ownership and disclaimers **[CLAUDE]** can draft
- [ ] Limitation of liability (CRITICAL) **[LAWYER]** must review
- [ ] Disclaimer of warranties **[LAWYER]** must review
- [ ] Indemnification clause **[LAWYER]** must review
- [ ] Governing law and jurisdiction **[CLAUDE]** can draft
- [ ] Dispute resolution (arbitration clause optional) **[LAWYER]** should review
- [ ] Modification of terms notice **[CLAUDE]** can draft

### AI-Specific Clauses:
- [ ] AI may produce inaccurate content - user must verify **[CLAUDE]** can draft
- [ ] No guarantee of AI availability or performance **[CLAUDE]** can draft
- [ ] User responsible for actions based on AI suggestions **[CLAUDE]** can draft
- [ ] AI outputs may be used to improve service **[CLAUDE]** can draft

### Estimated Cost: $1,000-3,000 (template + lawyer review)

**NOTE: Claude can draft a complete TOS template. Lawyer review recommended for liability sections.**

---

## 3. Privacy Policy

### Required Disclosures:
- [ ] What data is collected (personal info, usage data, content) **[CLAUDE]** can draft
- [ ] How data is used (service delivery, AI processing, analytics) **[CLAUDE]** can draft
- [ ] Third-party data sharing (AI providers, analytics, payment) **[CLAUDE]** can draft
- [ ] Data retention periods **[CLAUDE]** can draft
- [ ] User rights (access, correction, deletion) **[CLAUDE]** can draft
- [ ] Cookie policy **[CLAUDE]** can draft
- [ ] Security measures **[CLAUDE]** can draft
- [ ] Children's privacy (COPPA if applicable) **[LAWYER]** should review
- [ ] Contact information for privacy inquiries **[HUMAN]** provide info

**NOTE: Claude can draft a complete Privacy Policy. Lawyer review recommended for GDPR/CCPA sections.**

### Regulatory Compliance:
- [ ] **GDPR** (if serving EU users):
  - Lawful basis for processing
  - Right to be forgotten
  - Data portability
  - DPO appointment (if required)
  - Data Processing Agreements with vendors

- [ ] **CCPA** (if serving California users):
  - "Do Not Sell My Personal Information" link
  - Right to know what data is collected
  - Right to deletion
  - Non-discrimination for exercising rights

### AI-Specific Disclosures:
- [ ] Data sent to third-party AI providers (Google Gemini)
- [ ] How AI processes user content
- [ ] Opt-out options for AI training (if applicable)

### Estimated Cost: $500-2,000 (generator + lawyer review)

---

## 4. Third-Party Dependency Audit

### Current Stack License Summary:

| Dependency | License | Risk Level | Notes |
|------------|---------|------------|-------|
| Next.js | MIT | Low | Safe for commercial use |
| React | MIT | Low | Safe for commercial use |
| Electron | MIT | Low | Safe for commercial use |
| Tailwind CSS | MIT | Low | Safe for commercial use |
| Radix UI | MIT | Low | Safe for commercial use |
| Lucide Icons | ISC | Low | Safe for commercial use |
| Genkit | Apache 2.0 | Low | Safe, attribution may be required |
| pdf-parse | MIT | Low | Safe for commercial use |

### Action Items:
- [ ] Run full license audit: `npx license-checker --summary` **[CLAUDE]** can run
- [ ] Identify any GPL/AGPL packages (viral licenses) **[CLAUDE]** can analyze
- [ ] Remove or replace any problematic dependencies **[CLAUDE]** can do
- [ ] Document all licenses for compliance records **[CLAUDE]** can generate
- [ ] Add license attributions to app (About section or docs) **[CLAUDE]** can implement

### Command to Run:
```bash
cd /Users/howardjachter/Library/Mobile\ Documents/com~apple~CloudDocs/ClaudeProjects/IdiamPro
npx license-checker --summary
npx license-checker --production --json > licenses.json
```

---

## 5. API Terms Compliance

### Google Gemini API (Primary AI Provider)

**Key Terms to Review:**
- [ ] Usage restrictions and prohibited uses **[CLAUDE]** can review & summarize
- [ ] Rate limits and quota management **[CLAUDE]** can review & summarize
- [ ] Data handling and privacy requirements **[CLAUDE]** can review & summarize
- [ ] Attribution requirements ("Powered by Google Gemini") **[CLAUDE]** can implement
- [ ] Restrictions on competing AI model training **[CLAUDE]** can review & summarize
- [ ] Geographic restrictions **[CLAUDE]** can review & summarize
- [ ] Commercial use allowances **[CLAUDE]** can review & summarize

**API Terms URL**: https://ai.google.dev/terms

### Future Providers (Anthropic, OpenAI):
- [ ] Review terms before integration
- [ ] Ensure compliance with each provider's policies
- [ ] Consider multi-provider fallback strategy

---

## 6. Intellectual Property

### Trademark

**IdiamPro Trademark:**
- [ ] Search USPTO database for conflicts **[CLAUDE]** can do web search
- [ ] Search Google/domain names for conflicts **[CLAUDE]** can do web search
- [ ] File trademark application (Class 009 - Software, Class 042 - SaaS) **[HUMAN]** must file
- [ ] Consider international protection (Madrid Protocol) **[HUMAN]** must file

**Cost**: $250-350 per class + attorney fees (~$500-1,000)
**Timeline**: 8-12 months for registration

**USPTO Search**: https://www.uspto.gov/trademarks/search

### Copyright
- [ ] Add copyright notices to code, website, docs **[CLAUDE]** can implement
- [ ] Register key works with US Copyright Office ($65 each) **[HUMAN]** must file
- [ ] Document creation dates for all original content **[CLAUDE]** can document

### Trade Secrets
- [ ] Identify proprietary algorithms/processes **[CLAUDE]** can analyze
- [ ] Implement confidentiality agreements with employees/contractors **[HUMAN]** must sign
- [ ] Secure access to sensitive code/data **[CLAUDE]** can advise

---

## 7. Patent Considerations

### Is IdiamPro Patentable?
- **Core features** (outlining, AI text generation): Likely NOT patentable - well-established
- **Novel combinations**: MAYBE patentable if truly unique workflows exist
- **Recommendation**: Focus on trade secrets + speed to market over patents

### Patent Troll Defense:
- [ ] Document prior art for all features
- [ ] Consider joining LOT Network (free for small companies)
- [ ] Get startup-friendly IP insurance

### If Pursuing Patents:
- **Provisional patent**: $500-1,000 (buys 12 months)
- **Full patent**: $15,000-30,000+ (2-3 year timeline)

---

## 8. Insurance

### Required Coverage:

| Type | Coverage | Est. Annual Cost | Purpose |
|------|----------|------------------|---------|
| General Liability | $1M | $500-800 | Bodily injury, property damage |
| E&O (Professional Liability) | $1M | $1,000-3,000 | Software failures, bad advice |
| Cyber Liability | $1M | $1,000-3,000 | Data breaches, ransomware |
| D&O (Directors & Officers) | $1M | $2,000-5,000 | Investor protection (if funded) |

### Recommended Providers:
- **Embroker**: Tech startup specialist
- **Vouch**: Startup-focused
- **Hiscox**: Small business coverage

### Action Items:
- [ ] Get quotes from 2-3 providers **[HUMAN]** must contact insurers
- [ ] Start with General Liability + E&O minimum **[HUMAN]** must purchase
- [ ] Add Cyber Liability before collecting user data **[HUMAN]** must purchase
- [ ] Add D&O if taking outside investment **[HUMAN]** must purchase

**NOTE: Claude can research and compare insurance providers/coverage options.**

---

## 9. Additional Compliance

### DMCA Compliance (if user-generated content):
- [ ] Register DMCA agent with US Copyright Office
- [ ] Create takedown request process
- [ ] Document response procedures
- [ ] Add DMCA notice to Terms of Service

### Accessibility (ADA/WCAG):
- [ ] Audit app for accessibility issues
- [ ] Implement WCAG 2.1 AA compliance
- [ ] Add accessibility statement to website

### Export Control:
- [ ] Review if encryption features require export licenses
- [ ] Check restricted country lists (OFAC sanctions)

---

## 10. Implementation Timeline

### Phase 1: Pre-Launch (2-4 weeks before)
1. C-Corp formation
2. Draft TOS & Privacy Policy
3. Run license audit
4. Review Google Gemini API terms
5. Get insurance quotes

### Phase 2: At Launch
1. File trademark application
2. Register DMCA agent
3. Implement cookie consent (if EU users)
4. Finalize insurance coverage

### Phase 3: Post-Launch (First 3 months)
1. Join patent defense network (LOT)
2. Complete trademark registration
3. Regular legal review (quarterly)
4. Update policies as needed

---

## 11. Budget Summary

| Item | Estimated Cost |
|------|----------------|
| C-Corp Formation | $500-2,000 |
| TOS + Privacy Policy | $1,500-5,000 |
| Trademark Filing | $750-1,500 |
| Insurance (Year 1) | $2,500-6,000 |
| Legal Review/Retainer | $2,000-5,000 |
| **TOTAL** | **$7,250-19,500** |

---

## 12. Legal Resources

### DIY Tools:
- **Clerky/Gust Launch**: Formation + standard docs
- **Termly/Iubenda**: Privacy policy generators
- **TermsFeed**: TOS generators

### Professional Help:
- **Startup Lawyers**: $300-500/hour
- **Monthly Retainers**: $500-2,000/month
- **Law School Clinics**: Free/low-cost (slower)

### Recommended Reading:
- YCombinator's "Series A Documents" (free templates)
- Stripe Atlas Knowledge Base
- GDPR.eu compliance guide
- FTC privacy compliance resources

---

## Document History
- Created: January 2025
- Last Updated: January 2025
- Next Review: Before product launch

---

*Disclaimer: This document is for informational purposes only and does not constitute legal advice. Consult with a qualified attorney for specific legal questions.*

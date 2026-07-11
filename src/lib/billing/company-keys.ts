/**
 * Company-funded paid-vendor keys — SERVER-ONLY.
 *
 * WHY THIS EXISTS (owner rule, 2026-07-11):
 *   The paid-per-use premium features (OpenAI TTS voice, AssemblyAI
 *   transcription, Google Imagen image generation) each cost real money per
 *   call. Until SecondBrainWare has its OWN funded billing account, there is
 *   NO company key. The founder's PERSONAL API keys (OPENAI_API_KEY,
 *   ASSEMBLYAI_API_KEY, GEMINI_API_KEY) must NEVER fund an END-USER's paid
 *   call — they are for our own dev/testing only.
 *
 *   So end-user paid calls may only ever use:
 *     1. the USER's OWN key (BYOK), or
 *     2. a COMPANY key configured here (absent today → the free "taste" is
 *        simply OFF until a funded company account exists).
 *
 *   These COMPANY_* env vars are DELIBERATELY DISTINCT from the personal
 *   env keys. Nothing here reads OPENAI_API_KEY / ASSEMBLYAI_API_KEY /
 *   GEMINI_API_KEY. That guarantees, by construction, that no end-user path
 *   can bill the founder's personal card. When a real company billing
 *   account is funded, set the matching COMPANY_* var and the company-funded
 *   free "taste" turns on automatically — funded by the company, never the
 *   founder's personal card.
 *
 *   The env-gated philosophy mirrors Sentry / auth-config / billing-gate:
 *   with no key set, the feature simply no-ops (here: the free taste is off).
 */

export type PaidFeature = 'premiumVoice' | 'transcription' | 'imageGeneration';

/** Env-var name of the COMPANY (funded) key backing each paid feature. */
const COMPANY_ENV_VAR: Record<PaidFeature, string> = {
  premiumVoice: 'COMPANY_OPENAI_API_KEY',
  transcription: 'COMPANY_ASSEMBLYAI_API_KEY',
  imageGeneration: 'COMPANY_GEMINI_API_KEY',
};

/**
 * The COMPANY key for a paid feature, or '' if none is configured. Never
 * falls back to a personal env key. Server-only (returns '' if somehow
 * called where process.env is unavailable).
 */
export function getCompanyKey(feature: PaidFeature): string {
  if (typeof process === 'undefined' || !process.env) return '';
  const v = process.env[COMPANY_ENV_VAR[feature]];
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Is the company-funded free "taste" enabled for this feature? True ONLY when
 * a funded COMPANY key is configured. This is the configurable toggle the
 * owner asked for: DISABLED whenever no company key is set (today's state).
 */
export function isCompanyFundedTasteEnabled(feature: PaidFeature): boolean {
  return getCompanyKey(feature).length > 0;
}

import {
  generateScriptIteratively,
  countScriptWords,
  isScriptShort,
  MAX_SCRIPT_PASSES,
  type LengthTarget,
} from '@/lib/podcast-generator';
import type { OpenAIVoice } from '@/types';

const voiceMap: Record<string, OpenAIVoice> = { 'Host A': 'nova', 'Host B': 'onyx' };

// Build a raw JSON-array response (what the model returns) of `count` segments,
// each with `wordsPerSeg` words, alternating the two speakers.
function fakeResponse(count: number, wordsPerSeg = 12): string {
  const segs = Array.from({ length: count }, (_, i) => ({
    speaker: i % 2 === 0 ? 'Host A' : 'Host B',
    text: Array.from({ length: wordsPerSeg }, (_, w) => `word${w}`).join(' '),
  }));
  return JSON.stringify(segs);
}

// A small, fast target so tests don't have to fabricate 60+ segments.
const TARGET: LengthTarget = { min: 90, max: 120, minSegments: 8, label: 'test' };

describe('generateScriptIteratively — reduced pass cap', () => {
  it('MAX_SCRIPT_PASSES is capped at 3', () => {
    expect(MAX_SCRIPT_PASSES).toBe(3);
  });

  it('reaches the target length within the reduced pass cap', async () => {
    // Each pass appends 3 segments × 12 words = 36 words. It takes 3 passes to
    // clear 90 words / 8 segments — exactly the reduced cap.
    let calls = 0;
    const { segments, passes } = await generateScriptIteratively({
      target: TARGET,
      voiceMap,
      runPass: async () => {
        calls++;
        return fakeResponse(3);
      },
    });

    expect(passes).toBeLessThanOrEqual(MAX_SCRIPT_PASSES);
    expect(calls).toBeLessThanOrEqual(MAX_SCRIPT_PASSES);
    // Target reached: no longer materially short.
    expect(isScriptShort(segments, TARGET)).toBe(false);
    expect(segments.length).toBeGreaterThanOrEqual(TARGET.minSegments);
    expect(countScriptWords(segments)).toBeGreaterThanOrEqual(TARGET.min);
  });

  it('stays single-pass when the first pass already hits target (no wasted calls)', async () => {
    let calls = 0;
    const { passes } = await generateScriptIteratively({
      target: TARGET,
      voiceMap,
      runPass: async () => {
        calls++;
        return fakeResponse(10); // 10 × 12 = 120 words, 10 segments — over target
      },
    });
    expect(passes).toBe(1);
    expect(calls).toBe(1);
  });

  it('stops early on a no-progress continuation (never loops forever)', async () => {
    let calls = 0;
    const { segments, passes } = await generateScriptIteratively({
      target: TARGET,
      voiceMap,
      runPass: async (soFar) => {
        calls++;
        // First pass: a short script. Continue passes: an EMPTY array (no new
        // segments) — the loop must stop rather than burn every pass.
        return soFar === null ? fakeResponse(2) : '[]';
      },
    });
    // First pass + at most one wasted continue attempt, then it stops.
    expect(calls).toBeLessThanOrEqual(2);
    expect(passes).toBeLessThanOrEqual(2);
    // It kept what the first pass produced.
    expect(segments.length).toBe(2);
  });

  it('never exceeds the pass cap even if every pass stays short', async () => {
    let calls = 0;
    await generateScriptIteratively({
      target: TARGET,
      voiceMap,
      runPass: async () => {
        calls++;
        return fakeResponse(1); // always short — would loop forever without the cap
      },
    });
    expect(calls).toBe(MAX_SCRIPT_PASSES);
  });
});

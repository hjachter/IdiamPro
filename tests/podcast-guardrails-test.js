// ============================================================================
// Podcast MONEY-SAFETY guardrail + output test
// ----------------------------------------------------------------------------
// Proves that, with NO OpenAI key available (no BYOK key passed AND the env
// key forced absent inside the main process), the podcast pipeline:
//
//   (i)  still produces a PLAYABLE audio file via the FREE macOS `say` engine
//        (file exists, non-trivial size, valid MP3 that ffprobe can decode with
//        an audio stream and a real duration), and
//   (ii) NEVER reaches OpenAI — usedTts is false, usedLocalVoice is true, and a
//        fetch spy inside the main process records ZERO requests to openai.com.
//
// This is the release-blocking guardrail for the "silently bills the founder's
// key" hole: in a shipped/packaged build the env key is structurally
// unreachable, and even on a dev build a keyless user rides the free `say` path.
// We run the pipeline directly in the Electron MAIN process (where the `say`
// engine + ffmpeg live) via electronApp.evaluate — the same approach the video
// generator test uses.
//
// SAFETY: this test spends $0. It forbids and verifies the absence of any
// OpenAI call, so it can never bill the founder.
// ============================================================================

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

// Swallow the benign teardown dialog race (same as the other Electron tests).
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const projectRoot = path.resolve(__dirname, '..');
const ffprobePath = require(path.join(projectRoot, 'node_modules', 'ffprobe-static')).path;
const outDir = path.join(projectRoot, 'test-screenshots', 'podcast-guardrails');
fs.mkdirSync(outDir, { recursive: true });

// A tiny two-speaker script. Two distinct OpenAI voice tags so the free path
// assigns two DISTINCT macOS voices — a real back-and-forth, no cloud key.
const sampleSegments = [
  { speaker: 'Host A', voice: 'nova', text: 'Welcome to the show. Today we look at how an outline becomes a podcast.' },
  { speaker: 'Host B', voice: 'onyx', text: 'And the best part is this runs entirely on your Mac, for free, with no cloud key at all.' },
  { speaker: 'Host A', voice: 'nova', text: 'Two different built-in voices, one finished audio file. Let us listen.' },
];

function writeReport(report) {
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  const md = [
    `# Podcast Guardrails Test — ${report.pass ? 'PASS' : 'FAIL'}`,
    '',
    '**What this proves:** with no OpenAI key, the podcast is produced by the FREE',
    'macOS `say` engine and NEVER calls OpenAI (so the founder is never billed).',
    '',
    '## Steps',
    ...report.steps.map((s) => `- ${s}`),
    '',
    report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`\n` : '',
  ].join('\n');
  fs.writeFileSync(path.join(outDir, 'report.md'), md);
}

async function main() {
  const report = { suite: 'podcast-guardrails', startedAt: new Date().toISOString(), steps: [], pass: false };
  let electronApp;
  const audioPath = path.join(outDir, `free-say-podcast-${Date.now()}.mp3`);

  try {
    if (process.platform !== 'darwin') {
      report.steps.push('Skipped: macOS `say` engine only available on darwin.');
      report.skipped = true;
      report.pass = true; // not a failure off-Mac; the guarded path is Mac-only
      writeReport(report);
      console.log('SKIP (non-darwin)');
      return;
    }

    console.log('Launching Electron (own instance)...');
    electronApp = await electron.launch({
      args: [projectRoot],
      // Force the OpenAI key absent in the LAUNCH env. main.js also loads
      // .env.local via dotenv at boot, so we additionally delete it inside the
      // main process below — belt and suspenders.
      env: { ...process.env, NODE_ENV: 'development', OPENAI_API_KEY: '' },
    });

    console.log('Running the podcast pipeline in the main process (free `say` path)...');
    const result = await electronApp.evaluate(async (_modules, args) => {
      // 1) FORCE the OpenAI key absent in the main process (undo any dotenv load).
      delete process.env.OPENAI_API_KEY;
      process.env.OPENAI_API_KEY = '';

      // 2) Spy on fetch to PROVE no OpenAI request is ever attempted on this path.
      const realFetch = global.fetch;
      let openaiCalls = 0;
      global.fetch = (url, opts) => {
        try { if (String(url).toLowerCase().includes('openai.com')) openaiCalls++; } catch { /* ignore */ }
        return realFetch(url, opts);
      };

      let r;
      try {
        // No openaiApiKey passed → no BYOK key either. Pure free path.
        r = await global.__generatePodcastAudio({ segments: args.segments, ttsModel: 'tts-1' });
      } finally {
        global.fetch = realFetch;
      }
      return { ...r, __openaiCalls: openaiCalls };
    }, { segments: sampleSegments });

    report.pipelineResult = {
      success: result.success,
      usedTts: result.usedTts,
      usedLocalVoice: result.usedLocalVoice,
      failedSegments: result.failedSegments,
      durationSeconds: result.durationSeconds,
      openaiCalls: result.__openaiCalls,
      error: result.error,
    };
    report.steps.push(`Pipeline success: ${result.success}`);
    if (!result.success || !result.audioBase64) {
      throw new Error(`Pipeline failed on the free path: ${result.error || 'no audio produced'}`);
    }

    // ---- GUARDRAIL assertions: no OpenAI, free `say` path only. ----
    report.steps.push(`OpenAI network calls attempted: ${result.__openaiCalls}`);
    if (result.__openaiCalls !== 0) {
      throw new Error(`MONEY-SAFETY VIOLATION: ${result.__openaiCalls} OpenAI request(s) attempted with no key.`);
    }
    report.steps.push(`usedTts (OpenAI): ${result.usedTts}  |  usedLocalVoice (free say): ${result.usedLocalVoice}`);
    if (result.usedTts === true) {
      throw new Error('MONEY-SAFETY VIOLATION: OpenAI TTS was used despite no key being available.');
    }
    if (result.usedLocalVoice !== true) {
      throw new Error('Free macOS `say` path was NOT used — expected the keyless fallback.');
    }

    // ---- OUTPUT assertions: a real, playable MP3 was produced. ----
    const bytes = Buffer.from(result.audioBase64, 'base64');
    fs.writeFileSync(audioPath, bytes);
    const size = fs.statSync(audioPath).size;
    report.fileSizeBytes = size;
    report.steps.push(`Free-path audio written: ${(size / 1024).toFixed(1)} KB at ${audioPath}`);
    if (size < 3000) throw new Error(`Output MP3 suspiciously small: ${size} bytes`);

    // ffprobe: confirm it's a decodable MP3 with an audio stream and duration.
    const probeJson = execFileSync(ffprobePath, [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', audioPath,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
    const probe = JSON.parse(probeJson);
    const streams = probe.streams || [];
    const hasAudio = streams.some((s) => s.codec_type === 'audio');
    const formatName = (probe.format && probe.format.format_name) || '';
    const duration = parseFloat((probe.format && probe.format.duration) || '0');
    report.probe = { hasAudio, formatName, duration };
    report.steps.push(`ffprobe -> audio: ${hasAudio}, format: ${formatName}, duration: ${duration.toFixed(1)}s`);

    if (!hasAudio) throw new Error('No audio stream in the produced file');
    if (!/mp3/i.test(formatName)) throw new Error(`Not an MP3 container: ${formatName}`);
    if (!(duration > 0.5)) throw new Error(`Duration too short to be a real podcast: ${duration}s`);

    report.finalOutputPath = audioPath;
    report.pass = true;
    console.log('PASS');
  } catch (err) {
    report.error = String((err && err.stack) || err);
    console.error('FAIL:', report.error);
  } finally {
    if (electronApp) {
      await Promise.race([
        electronApp.close().catch(() => {}),
        new Promise((r) => setTimeout(r, 5000)),
      ]);
    }
    writeReport(report);
  }

  process.exit(report.pass ? 0 : 1);
}

main();

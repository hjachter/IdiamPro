// ============================================================================
// Phase 1 pipeline test: outline chapter -> slides + AI voiceover -> MP4
// ----------------------------------------------------------------------------
// Launches Electron, drives the slideshow video generator directly in the MAIN
// process (via electronApp.evaluate), then verifies the produced .mp4 with
// ffprobe: it must exist, be non-trivial in size, and carry BOTH a video and
// an audio stream with a sensible duration.
//
// If no OpenAI key is available the generator falls back to a silent audio
// track — the test still proves the video-stitching half and reports it.
// ============================================================================

const { _electron: electron } = require('playwright');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

// During Electron teardown Playwright's JS-dialog auto-handler can race the
// page closing, surfacing as a benign "No dialog is showing" rejection. Swallow
// it so it can't kill the process before the report is written.
process.on('unhandledRejection', (err) => {
  const msg = String((err && err.message) || err);
  if (/handleJavaScriptDialog|No dialog is showing/.test(msg)) return;
  throw err;
});

const projectRoot = path.resolve(__dirname, '..');
const ffprobePath = require(path.join(projectRoot, 'node_modules', 'ffprobe-static')).path;
const outDir = path.join(projectRoot, 'test-screenshots', 'video-generator');
fs.mkdirSync(outDir, { recursive: true });

// Read OPENAI_API_KEY out of .env.local (main process doesn't load dotenv), so
// we can exercise the real TTS path when a key is configured.
function readOpenAiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const envText = fs.readFileSync(path.join(projectRoot, '.env.local'), 'utf8');
    const m = envText.match(/^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$/m);
    if (m) return m[1].replace(/^["']|["']$/g, '').trim();
  } catch { /* ignore */ }
  return '';
}

// A tiny sample "chapter" broken into 3 slides.
const sampleSlides = [
  {
    title: 'Turn Outlines Into Video',
    bullets: ['Pick any chapter of your outline', 'IdiamPro builds the slides', 'An AI voice narrates it'],
    narration: 'IdiamPro can turn any chapter of your outline into a narrated video. Just pick a branch and let it build the slides.',
  },
  {
    title: 'How It Works',
    bullets: ['Each point becomes a slide', 'Narration is generated per slide', 'Everything is stitched into one file'],
    narration: 'Each key point becomes its own slide. The narration is generated for every slide, then everything is stitched together into a single video file.',
  },
  {
    title: 'Ready To Share',
    bullets: ['A real MP4 on your disk', 'Ready for YouTube or social', 'No editing software needed'],
    narration: 'The result is a real video file on your disk, ready to upload to YouTube or share on social media. No editing software required.',
  },
];

async function main() {
  const report = { suite: 'video-generator', startedAt: new Date().toISOString(), steps: [], pass: false };
  const openaiApiKey = readOpenAiKey();
  report.steps.push(`OpenAI key present: ${openaiApiKey ? 'yes (TTS path)' : 'no (silent fallback)'}`);

  const outputPath = path.join(outDir, `sample-render-${Date.now()}.mp4`);
  let electronApp;

  try {
    console.log('Launching Electron...');
    electronApp = await electron.launch({
      args: [projectRoot],
      env: { ...process.env, NODE_ENV: 'development' },
    });

    console.log('Running the video pipeline in the main process (this can take a minute)...');
    const result = await electronApp.evaluate(async (_electronModules, args) => {
      // global.__generateSlideshowVideo is registered in electron/main.js
      return global.__generateSlideshowVideo(args);
    }, { slides: sampleSlides, outputPath, openaiApiKey, voice: 'nova' });

    report.pipelineResult = result;
    report.steps.push(`Pipeline success: ${result.success}`);
    if (!result.success) throw new Error(`Pipeline reported failure: ${result.error}`);

    // Verify the file exists and is non-trivial.
    if (!fs.existsSync(outputPath)) throw new Error('Output MP4 was not created');
    const size = fs.statSync(outputPath).size;
    report.fileSizeBytes = size;
    report.steps.push(`Output size: ${(size / 1024 / 1024).toFixed(2)} MB`);
    if (size < 20000) throw new Error(`Output MP4 is suspiciously small: ${size} bytes`);

    // ffprobe: confirm video + audio streams and duration.
    const probeJson = execFileSync(ffprobePath, [
      '-v', 'error',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      outputPath,
    ], { encoding: 'utf8', maxBuffer: 1024 * 1024 * 16 });
    const probe = JSON.parse(probeJson);
    const streams = probe.streams || [];
    const hasVideo = streams.some((s) => s.codec_type === 'video');
    const hasAudio = streams.some((s) => s.codec_type === 'audio');
    const duration = parseFloat((probe.format && probe.format.duration) || '0');

    report.hasVideo = hasVideo;
    report.hasAudio = hasAudio;
    report.durationSeconds = duration;
    report.steps.push(`Streams -> video: ${hasVideo}, audio: ${hasAudio}, duration: ${duration.toFixed(1)}s`);

    if (!hasVideo) throw new Error('No video stream in output');
    if (!hasAudio) throw new Error('No audio stream in output');
    if (!(duration > 1)) throw new Error(`Duration too short: ${duration}s`);

    report.pass = true;
    report.finalOutputPath = outputPath;
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
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
    const md = [
      `# Video Generator Test — ${report.pass ? 'PASS' : 'FAIL'}`,
      '',
      ...report.steps.map((s) => `- ${s}`),
      '',
      report.error ? `## Error\n\n\`\`\`\n${report.error}\n\`\`\`` : '',
    ].join('\n');
    fs.writeFileSync(path.join(outDir, 'report.md'), md);
    console.log('Report written to', outDir);
    process.exit(report.pass ? 0 : 1);
  }
}

main();

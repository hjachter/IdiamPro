#!/usr/bin/env node
// ============================================================================
// EXPORT FIDELITY TEST (P7) — exports must never be SILENTLY lossy.
//
// Runs tests/export-fidelity/harness.ts (via tsx) against a torture outline:
// deep nesting (8 levels), unicode, XML/CSV/Markdown-hostile names, long and
// empty names, rich HTML content, tags/colors/completion, cross-outline links.
//
//   - Round-trippable formats (.idm JSON, OPML, Markdown, plain text):
//     export → re-import → structural comparison.
//   - One-way formats (19 more): structural completeness — every node must
//     appear in the output except where the format's DOCUMENTED design says
//     otherwise (slides depth cap, tweet truncation, website overview mode).
//
// Grades each format LOSSLESS / DOCUMENTED-LOSSY / SILENTLY-LOSSY and fails
// the suite if ANY format is silently lossy. The per-format truth table lives
// in docs/export-fidelity.md — keep the two in sync.
//
// Deterministic suite: run ONCE per TEST EVERYTHING (no AI, no network, no
// Electron, no cost). Exits non-zero on any silent loss.
// ============================================================================

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const harness = path.join(__dirname, 'export-fidelity', 'harness.ts');

const res = spawnSync(tsx, [harness], {
  cwd: root,
  encoding: 'utf8',
  timeout: 180000, // watchdog: kill a hung harness after 3 minutes
});

const stdout = res.stdout || '';
const stderr = res.stderr || '';
process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

const passed = res.status === 0 && stdout.includes('ALL FORMATS HONEST');

// The harness already writes test-screenshots/export-fidelity/report.{json,md}.
// Add a suite-level summary alongside for TEST EVERYTHING aggregation.
const outDir = path.join(root, 'test-screenshots', 'export-fidelity');
try {
  fs.mkdirSync(outDir, { recursive: true });
  const summary = {
    suite: 'export-fidelity (P7)',
    ranAt: new Date().toISOString(),
    passed,
    notes: passed
      ? 'No silently-lossy export formats. Fidelity table: docs/export-fidelity.md'
      : 'SILENT LOSS DETECTED in at least one export format — see report.json. RELEASE ISSUE: fix or document before shipping.',
  };
  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
} catch (e) {
  console.error('Could not write summary:', e.message);
}

process.exit(passed ? 0 : 1);

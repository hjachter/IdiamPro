#!/usr/bin/env node
// ============================================================================
// compile-core golden test (Phase 0 of the content-compiler architecture).
//
// Proves the consolidation of the duplicated export plumbing changed NOTHING:
//   1. Golden comparison — every migrated public function (podcast extraction,
//      Second-Brain serializer, exporter strip/traverse/path, video slides,
//      deck derivation) still produces byte-identical output to a capture
//      taken from the PRE-migration code on a tricky fixture (nested
//      formatting, entities incl. numeric, lists, links, empty nodes, deep
//      nesting, long names, whitespace torture).
//   2. Old-vs-new — the shared clean-text presets are compared at runtime
//      against frozen verbatim copies of the old private implementations.
//   3. Compile Tree sanity — deterministic build, content fingerprints change
//      exactly when a node's own (name+content+child-ids) state changes.
//
// Deterministic suite: run ONCE per TEST EVERYTHING (no AI, no network, no
// Electron, no cost). Exits non-zero on any difference.
// ============================================================================

const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const root = path.join(__dirname, '..');
const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
const harness = path.join(__dirname, 'compile-core', 'harness.ts');

const res = spawnSync(tsx, [harness], {
  cwd: root,
  encoding: 'utf8',
  timeout: 180000, // watchdog: kill a hung harness after 3 minutes
});

const stdout = res.stdout || '';
const stderr = res.stderr || '';
process.stdout.write(stdout);
if (stderr) process.stderr.write(stderr);

const passed = res.status === 0 && stdout.includes('ALL CHECKS PASSED');
const passCount = (stdout.match(/^ {2}PASS {2}/gm) || []).length;
const failCount = (stdout.match(/^ {2}FAIL {2}/gm) || []).length;

// House-style structured report.
const outDir = path.join(root, 'test-screenshots', 'compile-core');
try {
  fs.mkdirSync(outDir, { recursive: true });
  const report = {
    suite: 'compile-core golden (Phase 0 consolidation)',
    ranAt: new Date().toISOString(),
    passed,
    checks: { pass: passCount, fail: failCount },
    notes: passed
      ? 'All migrated pipelines byte-identical to pre-migration golden capture.'
      : 'Byte differences detected — the consolidation changed behavior. DO NOT SHIP.',
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(
    path.join(outDir, 'report.md'),
    `# compile-core golden test\n\n- Result: ${passed ? 'PASS' : 'FAIL'}\n` +
      `- Checks: ${passCount} passed, ${failCount} failed\n- Ran: ${report.ranAt}\n\n` +
      '```\n' + stdout.slice(-4000) + '\n```\n',
  );
} catch {
  // Report writing is best-effort; the exit code is the source of truth.
}

console.log(passed ? 'COMPILE-CORE GOLDEN TEST: PASS' : 'COMPILE-CORE GOLDEN TEST: FAIL');
process.exit(passed ? 0 : 1);

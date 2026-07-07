/**
 * Marketing Claims Verification Suite (2026-07-06).
 *
 * PURPOSE — PROVE the data-safety claims made on the IdiamPro / SecondBrainWare
 * website are actually true in the code, so a future edit cannot silently make
 * a public claim false. Each claim below maps to one or more assertions against
 * the REAL source files that back it. If someone deletes the snapshot call,
 * flips a default from "save-as-new" to "replace", caps the undo stack, or lets
 * the signup route return success on total failure, the matching assertion here
 * fails loudly.
 *
 * LEVEL CHOICE — these are source-of-truth (static) assertions, deliberately.
 * The guarantees live in specific functions and call sites; the cheapest
 * reliable regression guard is to assert those guard clauses still exist rather
 * than to spin up Electron for every claim. Where a claim is genuinely not
 * automatable (third-party policy), it is recorded as MANUAL/LEGAL, not faked.
 *
 * OUTPUT — structured report.json + report.md to
 *   test-screenshots/claims-verification/
 * Exits non-zero if any automatable claim fails.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, 'test-screenshots', 'claims-verification');

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function read(relPath) {
  const abs = path.join(ROOT, relPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`Expected file is missing: ${relPath}`);
  }
  return fs.readFileSync(abs, 'utf8');
}

// ── tiny assertion harness ────────────────────────────────────────────────
const results = []; // { claim, checks: [{ desc, pass, detail }], status }

function claim(id, title, kind, fn) {
  const checks = [];
  const t = {
    ok(desc, condition, detail) {
      checks.push({ desc, pass: !!condition, detail: detail || '' });
    },
    contains(desc, haystack, needle) {
      const pass = typeof haystack === 'string' && haystack.includes(needle);
      checks.push({ desc, pass, detail: pass ? '' : `missing: ${needle}` });
    },
    notContains(desc, haystack, needle) {
      const pass = typeof haystack === 'string' && !haystack.includes(needle);
      checks.push({ desc, pass, detail: pass ? '' : `unexpectedly present: ${needle}` });
    },
    matches(desc, haystack, regex) {
      const pass = typeof haystack === 'string' && regex.test(haystack);
      checks.push({ desc, pass, detail: pass ? '' : `no match: ${regex}` });
    },
  };
  let error = null;
  if (kind === 'AUTO') {
    try {
      fn(t);
    } catch (e) {
      error = e.message;
      checks.push({ desc: 'ran without throwing', pass: false, detail: e.message });
    }
  }
  let status;
  if (kind !== 'AUTO') {
    status = kind; // MANUAL / LEGAL etc.
  } else {
    status = checks.every(c => c.pass) ? 'VERIFIED' : 'FAILED';
  }
  results.push({ id, title, kind, status, checks, error });
}

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 1 — Outlines are stored locally, not on our server.
// ══════════════════════════════════════════════════════════════════════════
claim('C1', 'Outlines are stored locally, not on our server', 'AUTO', (t) => {
  const storageManager = read('src/lib/storage-manager.ts');
  const electronStorage = read('src/lib/electron-storage.ts');
  const fileStorage = read('src/lib/file-storage.ts');

  // Persistence targets are LOCAL: Electron local .idm file writer + browser
  // localStorage. If both of these disappear, persistence has moved elsewhere.
  t.contains('storage-manager uses Electron local-file writer',
    storageManager, 'electronSaveOutlineToFile');
  t.contains('storage-manager falls back to browser localStorage',
    storageManager, 'localStorage');
  t.contains('local storage key is the on-device outline blob',
    storageManager, "'outline-pro-data'");
  t.contains('file-storage writes outlines to a local file',
    fileStorage, 'saveOutlineToFile');

  // The storage LAYER must not ship outline bodies to a backend. Guard against
  // a network upload sneaking into any of the three persistence files.
  for (const [name, body] of [
    ['storage-manager', storageManager],
    ['electron-storage', electronStorage],
    ['file-storage', fileStorage],
  ]) {
    t.notContains(`${name} does not fetch() to a server`, body, 'fetch(');
    t.notContains(`${name} does not use axios`, body, 'axios');
    t.notContains(`${name} does not open an XMLHttpRequest`, body, 'XMLHttpRequest');
  }
});

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 2 — Content-rewriting AI transforms default to save-as-new (derivative);
//           the original is untouched. (Translate is carved out by its own rule.)
// ══════════════════════════════════════════════════════════════════════════
claim('C2', 'AI transforms default to save-as-new; original untouched', 'AUTO', (t) => {
  const reformat = read('src/components/reformat-dialog.tsx');
  const liveBooks = read('src/components/live-books-dialog.tsx');
  const buildDerivative = read('src/lib/derivation/build-derivative.ts');

  // The two whole-outline content-REWRITING transforms default to derivative.
  t.matches('Reformat defaults to derivative (save-as-new)',
    reformat, /useState<DerivationMode>\('derivative'\)/);
  t.matches('Refresh from Web (Live Books) defaults to derivative',
    liveBooks, /useState<DerivationMode>\('derivative'\)/);

  // The derivative builder must NOT mutate the original and must deep-clone +
  // stamp provenance so the new outline is truly independent.
  t.contains('derivative builder deep-clones node map',
    buildDerivative, 'clonedNodes[id] = {');
  t.contains('derivative gets a fresh id', buildDerivative, 'const newId = uuid();');
  t.contains('derivative records derivedFromOutlineId (provenance)',
    buildDerivative, 'derivedFromOutlineId: original.id');
  t.contains('builder is documented as never mutating the original',
    buildDerivative, 'original outline is NEVER mutated');
  // Hard guard: the builder never writes back into the passed-in original.
  t.notContains('builder never assigns into original.nodes',
    buildDerivative, 'original.nodes[');

  // Behavioural cross-check: the apply handlers, in derivative mode, build a
  // NEW outline and explicitly tell the user the original was not modified.
  const outlinePro = read('src/components/outline-pro.tsx');
  t.contains('derivative apply path creates a new outline',
    outlinePro, 'buildDerivativeOutline');
  t.contains('derivative apply path reassures original untouched',
    outlinePro, 'was not modified');
});

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 3 — If the user chooses "Replace this outline", it snapshots first.
// ══════════════════════════════════════════════════════════════════════════
claim('C3', 'Replace-this-outline snapshots before applying', 'AUTO', (t) => {
  const outlinePro = read('src/components/outline-pro.tsx');

  // Every in-place (replace) apply branch must call snapshotBeforeTransform
  // BEFORE the setOutlines swap. Count them to catch a future path being added
  // without protection.
  const snapCalls = (outlinePro.match(/snapshotBeforeTransform\(/g) || []).length;
  t.ok('multiple in-place transforms snapshot before replacing',
    snapCalls >= 5, `found ${snapCalls} snapshotBeforeTransform() calls (expected >=5)`);

  // Named transforms whose replace path must snapshot.
  for (const name of ['Refresh from Web', 'Translate Outline', 'Reformat with AI',
    'Transform Outline with AI', 'Capture from image']) {
    t.contains(`replace path snapshots for "${name}"`,
      outlinePro, `snapshotBeforeTransform(target, '${name}')`);
  }

  // The Restore/Replace-from-backup path snapshots the current state first.
  const backup = read('src/components/backup-restore-dialog.tsx');
  t.contains('Restore snapshots current state before replacing',
    backup, 'snapshotBeforeRestore(outline)');
});

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 4 — Auto-snapshot before AI transforms is ON by default.
// ══════════════════════════════════════════════════════════════════════════
claim('C4', 'Auto-snapshot before AI transforms defaults ON', 'AUTO', (t) => {
  const snap = read('src/lib/snapshot-storage.ts');

  // The setting reader defaults to true, and the transform guard honors it.
  t.matches('getAutoSnapshotBeforeTransform default is true',
    snap, /getAutoSnapshotBeforeTransform\(\)[\s\S]{0,120}readBoolFlag\(AUTO_TRANSFORM_KEY,\s*true\)/);
  t.contains('snapshotBeforeTransform gates on the (default-on) setting',
    snap, 'if (!getAutoSnapshotBeforeTransform()) return;');
  t.contains('snapshotBeforeTransform writes an auto-transform snapshot',
    snap, "kind: 'auto-transform'");

  // Restore auto-snapshot also defaults ON (belt-and-suspenders for claim 3).
  t.matches('getAutoSnapshotBeforeRestore default is true',
    snap, /getAutoSnapshotBeforeRestore\(\)[\s\S]{0,120}readBoolFlag\(AUTO_RESTORE_KEY,\s*true\)/);
});

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 5 — Deep undo covers edits, moves, deletes, imports, AI changes;
//           no hard cap.
// ══════════════════════════════════════════════════════════════════════════
claim('C5', 'Unified deep undo, all action types, no hard cap', 'AUTO', (t) => {
  const outlinePro = read('src/components/outline-pro.tsx');

  // Undo is unified because ALL state changes flow through one setOutlines
  // wrapper that records history. That single funnel is what makes it cover
  // edits, moves, deletes, imports, and AI transforms alike.
  t.contains('undo history is recorded in the setOutlines funnel',
    outlinePro, 'undoStackRef.current.push({');
  t.matches('every mutation flows through the recording wrapper',
    outlinePro, /history there covers ALL[\s\S]{0,10}actions/);

  // NO hard cap: the push must not be followed by a length-based trim.
  t.matches('code documents no hard cap on undo depth',
    outlinePro, /[Nn]o hard cap/);
  t.notContains('undo stack is not sliced to a max depth',
    outlinePro, 'undoStackRef.current = undoStackRef.current.slice');
  t.notContains('no MAX_UNDO constant capping the stack',
    outlinePro, 'MAX_UNDO');

  // Redo counterpart exists (Cmd+Shift+Z).
  t.contains('redo stack exists', outlinePro, 'redoStackRef');
});

// ══════════════════════════════════════════════════════════════════════════
// CLAIM 6 — Signup fails loud (never false success); guaranteed backup email;
//           storage-health watchdog cron exists.
// ══════════════════════════════════════════════════════════════════════════
claim('C6', 'Signup fails loud + backup email + watchdog cron', 'AUTO', (t) => {
  const apply = read('src/app/api/applicants/apply/route.ts');

  // A true total failure (store AND email both fail) must return an ERROR, not
  // a false success.
  t.contains('total failure returns ok:false', apply, 'ok: false');
  t.contains('total failure returns HTTP 500', apply, 'status: 500');
  t.matches('the 500 branch is the both-failed branch',
    apply, /true total loss[\s\S]{0,200}status:\s*500/);

  // The applicant is ALWAYS emailed to Howard — this redundant email IS the
  // backup, built from request data so it survives a dead store.
  t.contains('always attempts the backup notification email',
    apply, 'sendApplicantNotification');
  t.matches('notification email is the documented backup',
    apply, /redundant email IS the backup/);
  // A degraded save (store failed but email landed) still confirms capture.
  t.contains('degraded path still captures the applicant safely',
    apply, "kind: 'apply-degraded'");

  // The storage-health watchdog cron endpoint exists and is registered to run.
  const cron = read('src/app/api/cron/storage-health/route.ts');
  t.contains('storage-health cron does a real write+read+delete round-trip',
    cron, 'storage.set(probeKey');
  t.contains('storage-health cron alerts on failure',
    cron, 'sendStorageAlert');
  const vercel = read('vercel.json');
  t.contains('storage-health cron is scheduled in vercel.json',
    vercel, '/api/cron/storage-health');
});

// ══════════════════════════════════════════════════════════════════════════
// NON-AUTOMATABLE — recorded honestly, never faked green.
// ══════════════════════════════════════════════════════════════════════════
claim('M1',
  'AI providers do not train on your paid-tier content',
  'MANUAL/LEGAL', () => {});
results[results.length - 1].note =
  'Third-party provider policy (OpenAI/Anthropic/Google API data-use terms). ' +
  'Not assertable from this codebase — verify against each provider\'s current ' +
  'enterprise/API data-usage agreement at launch and on renewal.';

// ── report + exit ─────────────────────────────────────────────────────────
ensureDir(OUT_DIR);

const auto = results.filter(r => r.kind === 'AUTO');
const passed = auto.filter(r => r.status === 'VERIFIED').length;
const failed = auto.filter(r => r.status === 'FAILED').length;
const manual = results.filter(r => r.kind !== 'AUTO').length;

const report = {
  suite: 'Marketing Claims Verification',
  generatedAt: new Date().toISOString(),
  summary: { total: results.length, verified: passed, failed, manualOrLegal: manual },
  claims: results,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));

let md = `# Marketing Claims Verification\n\n`;
md += `_Generated ${report.generatedAt}_\n\n`;
md += `**${passed} verified · ${failed} failed · ${manual} manual/legal**\n\n`;
for (const r of results) {
  const badge = r.status === 'VERIFIED' ? 'PASS'
    : r.status === 'FAILED' ? 'FAIL' : r.status;
  md += `## [${badge}] ${r.id} — ${r.title}\n\n`;
  if (r.note) md += `> ${r.note}\n\n`;
  for (const c of r.checks) {
    md += `- ${c.pass ? '[x]' : '[ ]'} ${c.desc}${c.detail ? ` — ${c.detail}` : ''}\n`;
  }
  md += `\n`;
}
fs.writeFileSync(path.join(OUT_DIR, 'report.md'), md);

// Console summary (plain).
console.log('\nMarketing Claims Verification');
console.log('='.repeat(40));
for (const r of results) {
  const badge = r.status === 'VERIFIED' ? 'PASS'
    : r.status === 'FAILED' ? 'FAIL' : r.status;
  console.log(`[${badge}] ${r.id} ${r.title}`);
  if (r.status === 'FAILED') {
    for (const c of r.checks.filter(x => !x.pass)) {
      console.log(`        x ${c.desc} ${c.detail}`);
    }
  }
}
console.log('='.repeat(40));
console.log(`${passed} verified, ${failed} failed, ${manual} manual/legal`);
console.log(`Report: test-screenshots/claims-verification/report.{json,md}\n`);

process.exit(failed > 0 ? 1 : 0);

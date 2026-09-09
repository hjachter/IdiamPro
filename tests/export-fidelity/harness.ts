// ============================================================================
// EXPORT FIDELITY HARNESS (P7).
//
//   npx tsx tests/export-fidelity/harness.ts
//
// Proves that exports preserve hierarchy, names/content, links and metadata —
// or lose only what the format's nature forces, and that every such loss is
// DOCUMENTED (docs/export-fidelity.md), never silent.
//
// For round-trippable formats (.idm JSON, OPML, Markdown, plain text):
//   export → re-import → structural comparison.
// For one-way formats: structural-completeness sweep — every node (via unique
//   sentinels planted at every depth and in hostile names/content) must appear
//   in the output, except where the format's documented design says otherwise.
//
// Grades per format: LOSSLESS / DOCUMENTED-LOSSY / SILENTLY-LOSSY (bug).
// Deterministic: no AI, no network, no Electron, no cost. Exits non-zero if
// ANY format grades SILENTLY-LOSSY.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import { JSDOM } from 'jsdom';

// DOM for the OPML importer (DOMParser) before importers load.
const dom = new JSDOM('');
(global as any).DOMParser = dom.window.DOMParser;

import {
  TORTURE_OUTLINE,
  LONG_NAME_SENTINEL,
  EMPTY_NAME_CONTENT_SENTINEL,
} from './fixture';
import type { Outline, OutlineNode } from '@/types';
import { htmlToPlainText } from '@/lib/compile-core';

// Exporters (loaded directly — same modules the app lazy-loads)
import { MarkdownExporter } from '@/lib/export/documents/markdown-exporter';
import { PlainTextExporter } from '@/lib/export/documents/plain-text-exporter';
import { HtmlExporter } from '@/lib/export/documents/html-exporter';
import { DocxExporter } from '@/lib/export/documents/docx-exporter';
import { LatexExporter } from '@/lib/export/documents/latex-exporter';
import { EpubExporter } from '@/lib/export/documents/epub-exporter';
import { BlogHtmlExporter } from '@/lib/export/documents/blog-html-exporter';
import { InteractiveOutlineExporter } from '@/lib/export/documents/interactive-outline-exporter';
import { WebsiteExporter } from '@/lib/export/documents/website-exporter';
import { OpmlExporter } from '@/lib/export/outliners/opml-exporter';
import { JsonExporter } from '@/lib/export/outliners/json-exporter';
import { OrgModeExporter } from '@/lib/export/outliners/org-mode-exporter';
import { TaskPaperExporter } from '@/lib/export/outliners/taskpaper-exporter';
import { ObsidianExporter } from '@/lib/export/note-apps/obsidian-exporter';
import { NotionExporter } from '@/lib/export/note-apps/notion-exporter';
import { EvernoteExporter } from '@/lib/export/note-apps/evernote-exporter';
import { FreeMindExporter } from '@/lib/export/mind-maps/freemind-exporter';
import { XMindExporter } from '@/lib/export/mind-maps/xmind-exporter';
import { CsvExporter } from '@/lib/export/data/csv-exporter';
import { JsonTreeExporter } from '@/lib/export/data/json-tree-exporter';
import { RevealjsExporter } from '@/lib/export/presentations/revealjs-exporter';
import { TeleprompterExporter } from '@/lib/export/presentations/teleprompter-exporter';
import { TwitterThreadExporter } from '@/lib/export/social/twitter-thread-exporter';

// Importers
import { MarkdownImporter } from '@/lib/import/documents/markdown-importer';
import { PlainTextImporter } from '@/lib/import/documents/plain-text-importer';
import { OpmlImporter } from '@/lib/import/outliners/opml-importer';

// ---------------------------------------------------------------------------

interface Check {
  name: string;
  pass: boolean;
  note?: string;
}

interface FormatResult {
  format: string;
  roundTrip: boolean;
  grade: 'LOSSLESS' | 'DOCUMENTED-LOSSY' | 'SILENTLY-LOSSY';
  documentedLosses: string[];
  checks: Check[];
}

const results: FormatResult[] = [];

function record(
  format: string,
  roundTrip: boolean,
  documentedLosses: string[],
  checks: Check[],
): FormatResult {
  const anyFail = checks.some((c) => !c.pass);
  const grade: FormatResult['grade'] = anyFail
    ? 'SILENTLY-LOSSY'
    : documentedLosses.length > 0
      ? 'DOCUMENTED-LOSSY'
      : 'LOSSLESS';
  const r: FormatResult = { format, roundTrip, grade, documentedLosses, checks };
  results.push(r);
  return r;
}

function check(checks: Check[], name: string, pass: boolean, note?: string) {
  checks.push({ name, pass, note });
}

async function asText(data: Blob | string): Promise<string> {
  if (typeof data === 'string') return data;
  // Our zips use STORE (no compression) so member bytes are searchable raw.
  const buf = Buffer.from(await data.arrayBuffer());
  return buf.toString('utf8');
}

function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const O = TORTURE_OUTLINE;
const N = O.nodes;

/** Alphanumeric-safe sentinels that survive every escaping scheme. */
const NAME_SENTINELS: Record<string, string> = {
  'n-chain1': 'SENTINEL-D1-alpha',
  'n-chain2': 'SENTINEL-D2-bravo',
  'n-chain3': 'SENTINEL-D3-charlie',
  'n-chain4': 'SENTINEL-D4-delta',
  'n-chain5': 'SENTINEL-D5-echo',
  'n-chain6': 'SENTINEL-D6-foxtrot',
  'n-chain7': 'SENTINEL-D7-golf',
  'n-chain8': 'SENTINEL-D8-hotel',
  'n-unicode': 'UNICODE-SENT',
  'n-xmlhostile': 'XMLHOSTILE-SENT',
  'n-csvhostile': 'CSVHOSTILE-SENT',
  'n-mdhostile': 'MDHOSTILE-SENT',
  'n-task': 'TASKMETA-SENT',
  'n-xlink': 'XLINK-SENT',
  'n-longname': LONG_NAME_SENTINEL,
  'n-emptycontent': 'EMPTYCONTENT-SENT',
  'n-rich': 'RICHCONTENT-SENT',
};

const CONTENT_SENTINELS = ['SENTINEL-D8-BODY', 'RICH-LI-SENT', EMPTY_NAME_CONTENT_SENTINEL];

/** Presence sweep: every sentinel (minus documented exclusions) in output. */
function sweep(
  checks: Check[],
  output: string,
  opts: { excludeNames?: string[]; excludeContent?: string[]; label?: string } = {},
) {
  const exN = new Set(opts.excludeNames || []);
  const exC = new Set(opts.excludeContent || []);
  for (const [id, sent] of Object.entries(NAME_SENTINELS)) {
    if (exN.has(id)) continue;
    check(checks, `node ${id} present`, output.includes(sent), sent);
  }
  for (const sent of CONTENT_SENTINELS) {
    if (exC.has(sent)) continue;
    check(checks, `content sentinel ${sent} present`, output.includes(sent));
  }
}

/** Flatten an outline into [depth, name, content] rows in traversal order. */
function flatten(outline: Outline): { depth: number; name: string; content: string }[] {
  const rows: { depth: number; name: string; content: string }[] = [];
  const walk = (id: string, depth: number) => {
    const n = outline.nodes[id];
    if (!n) return;
    rows.push({ depth, name: n.name, content: n.content || '' });
    for (const c of n.childrenIds || []) walk(c, depth + 1);
  };
  walk(outline.rootNodeId, 0);
  return rows;
}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim();

// ---------------------------------------------------------------------------
// ROUND-TRIP FORMATS
// ---------------------------------------------------------------------------

async function testJsonNative() {
  const checks: Check[] = [];
  const exp = new JsonExporter();

  // Full outline: byte-faithful re-serialization of the native structure.
  const full = await exp.convert(O, undefined, { includeContent: true, includeMetadata: true });
  const parsed = JSON.parse(await asText(full.data)) as Outline;
  check(checks, 'full export parses as valid outline', !!parsed.nodes && !!parsed.nodes[parsed.rootNodeId]);
  check(
    checks,
    'full export is deep-identical to source (hierarchy, names, content, metadata, links, ids)',
    JSON.stringify(parsed) === JSON.stringify(O),
  );

  // Subtree export: complete subtree, detached root, no reserved flags.
  const sub = await exp.convert(O, 'n-chain1', {});
  const subParsed = JSON.parse(await asText(sub.data)) as Outline;
  check(checks, 'subtree root parentId detached (null)', subParsed.nodes['n-chain1']?.parentId === null);
  const subIds = Object.keys(subParsed.nodes);
  check(
    checks,
    'subtree contains exactly the 8 chain nodes',
    subIds.length === 8 && subIds.every((id) => id.startsWith('n-chain')),
  );
  check(
    checks,
    'subtree export drops reserved flags (isGuide/isSecondBrain/derivation)',
    !('isGuide' in subParsed) && !('isSecondBrain' in subParsed) && !('derivedFromOutlineId' in subParsed),
  );
  check(
    checks,
    'subtree preserves node metadata + deep content',
    subParsed.nodes['n-chain8']?.content.includes('SENTINEL-D8-BODY'),
  );

  record('json (.idm native)', true, [], checks);
}

async function testOpml() {
  const checks: Check[] = [];
  const exp = new OpmlExporter();
  const imp = new OpmlImporter();

  const out = await exp.convert(O, undefined, { includeContent: true, includeMetadata: true });
  const xml = await asText(out.data);
  const res = await imp.parse(xml, 'torture.opml');
  const R = res.outline;

  const a = flatten(O);
  const b = flatten(R);

  check(checks, 'node count identical after round-trip', a.length === b.length, `${a.length} vs ${b.length}`);
  let hierOk = true;
  let nameOk = true;
  let contentOk = true;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].depth !== b[i].depth) hierOk = false;
    if (a[i].name !== b[i].name) {
      nameOk = false;
      checks.push({ name: `name mismatch @${i}`, pass: false, note: `${JSON.stringify(a[i].name)} → ${JSON.stringify(b[i].name)}` });
    }
    const want = htmlToPlainText(a[i].content, 'exporter');
    if (norm(want) !== norm(b[i].content)) {
      contentOk = false;
      checks.push({ name: `content mismatch @${i} (${a[i].name})`, pass: false, note: `${JSON.stringify(norm(want)).slice(0, 80)} → ${JSON.stringify(norm(b[i].content)).slice(0, 80)}` });
    }
  }
  check(checks, 'hierarchy (depths, order) identical after round-trip', hierOk);
  check(checks, 'every node name survives round-trip exactly (unicode, XML-hostile, long, empty)', nameOk);
  check(checks, 'node content survives as plain text', contentOk);

  // Types + metadata round-trip
  const byName = (name: string): OutlineNode | undefined =>
    Object.values(R.nodes).find((n) => n.name === name);
  const task = byName(N['n-task'].name);
  check(checks, 'node type (task) survives round-trip', task?.type === 'task');
  check(checks, 'tags survive round-trip', JSON.stringify(task?.metadata?.tags) === JSON.stringify(N['n-task'].metadata!.tags));
  check(checks, 'color survives round-trip', task?.metadata?.color === 'red');
  check(checks, 'completion state survives round-trip', task?.metadata?.isCompleted === true);
  const xlink = byName(N['n-xlink'].name);
  check(checks, 'outline-link node keeps its type', xlink?.type === 'outline-link');

  record('opml', true, [
    'Rich text formatting (bold/lists/links) flattens to plain text in _note',
    'Node IDs and numbering prefixes are regenerated on re-import',
    'Cross-outline link TARGET (linkedOutlineId), task priority/prerequisites/dates not carried',
    'Tags/color/completion carried only when "Include metadata" is checked',
  ], checks);
}

async function testMarkdown() {
  const checks: Check[] = [];
  const exp = new MarkdownExporter();
  const imp = new MarkdownImporter();

  const out = await exp.convert(O, undefined, { includeContent: true });
  const md = await asText(out.data);

  // One-way completeness of the file itself.
  sweep(checks, md);

  const res = await imp.parse(md, 'torture.md');
  const R = res.outline;
  const a = flatten(O);
  const b = flatten(R);

  check(checks, 'round-trip: same node count (nothing silently dropped)', a.length === b.length, `${a.length} vs ${b.length}`);

  // Hierarchy must be identical for depths ≤ 5 (Markdown's 6 heading levels);
  // beyond that flattening is the format's documented limit.
  let shallowOk = true;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i].depth <= 5 && a[i].depth !== b[i].depth) {
      shallowOk = false;
      checks.push({ name: `depth mismatch @${i} (${a[i].name})`, pass: false, note: `${a[i].depth} → ${b[i].depth}` });
    }
    if (a[i].name.trim() !== b[i].name) {
      checks.push({ name: `name mismatch @${i}`, pass: false, note: `${JSON.stringify(a[i].name)} → ${JSON.stringify(b[i].name)}` });
    }
  }
  check(checks, 'hierarchy identical through 6 heading levels', shallowOk);
  check(checks, 'empty-named node survives round-trip', Object.values(R.nodes).some((n) => n.name === '' && n.content.includes(EMPTY_NAME_CONTENT_SENTINEL)));
  check(checks, 'heading-lookalike name survives round-trip', Object.values(R.nodes).some((n) => n.name === N['n-mdhostile'].name));

  record('markdown', true, [
    'Hierarchy deeper than 6 levels flattens to heading level 6 (Markdown has no h7+)',
    'Rich formatting flattens to plain text; lists become bullet characters',
    'Tags, colors, completion, node types, IDs and cross-outline links are not carried',
    'Node content that itself contains Markdown heading lines would re-import as extra nodes',
  ], checks);
}

async function testPlainText() {
  const checks: Check[] = [];
  const exp = new PlainTextExporter();
  const imp = new PlainTextImporter();

  const out = await exp.convert(O, undefined, { includeContent: true });
  const txt = await asText(out.data);

  sweep(checks, txt);

  const res = await imp.parse(txt, 'torture.txt');
  const names = Object.values(res.outline.nodes).map((n) => n.name);
  for (const [id, sent] of Object.entries(NAME_SENTINELS)) {
    check(checks, `round-trip keeps ${id}`, names.some((nm) => nm.includes(sent)), sent);
  }

  record('plain-text', true, [
    'Name-vs-content distinction is lost: content lines re-import as child nodes',
    'Empty-named nodes cannot be represented (blank line) and drop on re-import',
    'All formatting, metadata, types, IDs and links are lost (plain text by nature)',
  ], checks);
}

// ---------------------------------------------------------------------------
// ONE-WAY FORMATS — structural completeness
// ---------------------------------------------------------------------------

async function testOneWay(
  format: string,
  run: () => Promise<Blob | string>,
  documentedLosses: string[],
  opts: {
    excludeNames?: string[];
    excludeContent?: string[];
    extra?: (output: string, checks: Check[]) => void;
  } = {},
) {
  const checks: Check[] = [];
  try {
    const data = await run();
    const output = await asText(data);
    check(checks, 'export produced non-empty output', output.length > 0);
    sweep(checks, output, opts);
    opts.extra?.(output, checks);
  } catch (e: any) {
    check(checks, 'export threw', false, String(e?.message || e));
  }
  record(format, false, documentedLosses, checks);
}

// ---------------------------------------------------------------------------

async function main() {
  await testJsonNative();
  await testOpml();
  await testMarkdown();
  await testPlainText();

  const optsCM = { includeContent: true, includeMetadata: true };

  await testOneWay('html', async () => (await new HtmlExporter().convert(O, undefined, optsCM)).data, [
    'One-way (no HTML importer); metadata not rendered; hierarchy beyond h6 flattens visually',
  ]);

  await testOneWay('docx (Word)', async () => (await new DocxExporter().convert(O, undefined, optsCM)).data, [
    'One-way; rich text flattens to plain paragraphs; hierarchy beyond 9 heading levels flattens; metadata not carried',
  ]);

  await testOneWay('latex', async () => (await new LatexExporter().convert(O, undefined, optsCM)).data, [
    'One-way; hierarchy beyond 5 sectioning levels flattens to subparagraph; special characters escaped; metadata not carried',
  ], {
    // The emoji/unicode name contains characters LaTeX escapes around, but our
    // sentinel is ASCII-safe; the long name survives whole.
  });

  await testOneWay('epub', async () => (await new EpubExporter().convert(O, undefined, optsCM)).data, [
    'One-way; depth-1 nodes become chapters; heading levels cap at h6; metadata not carried',
  ]);

  await testOneWay('blog-html', async () => (await new BlogHtmlExporter().convert(O, undefined, optsCM)).data, [
    'One-way; root becomes the post title; heading levels cap at h6; metadata not carried',
  ]);

  await testOneWay('interactive-outline', async () => (await new InteractiveOutlineExporter().convert(O, undefined, optsCM)).data, [
    'One-way viewer (read-only), but embeds the full structure: ids, hierarchy, rich content, tags, colors, completion',
  ], {
    extra: (output, checks) => {
      check(checks, 'embeds node ids', output.includes('n-chain8'));
      check(checks, 'embeds rich HTML content (not stripped)', output.includes('RICH-LI-SENT'));
      check(checks, 'embeds tags', output.includes('beta tag'));
    },
  });

  // Website: "Content depth" is a USER CHOICE in the website dialog.
  // overview/standard summarize by design; comprehensive must carry everything.
  await testOneWay('website (comprehensive)', async () => (await new WebsiteExporter().convert(O, undefined, { ...optsCM, contentDepth: 'comprehensive' } as any)).data, [
    'One-way designed artifact; metadata not carried',
    'The dialog\'s "overview"/"standard" content-depth settings summarize deep levels BY USER CHOICE; "comprehensive" carries every node',
  ]);

  await testOneWay('org-mode', async () => (await new OrgModeExporter().convert(O, undefined, optsCM)).data, [
    'One-way (no importer yet); rich text flattens to plain; metadata not carried',
  ]);

  await testOneWay('taskpaper', async () => (await new TaskPaperExporter().convert(O, undefined, optsCM)).data, [
    'One-way; parents become Projects, leaves become tasks; metadata/tags not carried as @tags yet',
  ]);

  await testOneWay('obsidian', async () => (await new ObsidianExporter().convert(O, undefined, optsCM)).data, [
    'One-way; single-file Markdown with wiki-links; heading cap at 6; metadata not carried',
  ]);

  await testOneWay('notion', async () => (await new NotionExporter().convert(O, undefined, optsCM)).data, [
    'One-way; levels 4+ render as toggles/bullets; metadata not carried',
  ], {
    extra: (output, checks) => {
      // Toggle blocks must be balanced AND properly nested.
      const open = (output.match(/<details>/g) || []).length;
      const close = (output.match(/<\/details>/g) || []).length;
      check(checks, 'details toggles balanced', open === close, `${open} open vs ${close} close`);
      let depth = 0;
      let ok = true;
      for (const m of output.matchAll(/<details>|<\/details>/g)) {
        depth += m[0] === '<details>' ? 1 : -1;
        if (depth < 0) ok = false;
      }
      check(checks, 'details toggles properly nested', ok && depth === 0);
      // Regression guard for the pre-P7 bug: toggles were all closed at END
      // of file, nesting every later top-level section inside the deep chain's
      // toggles. The deep chain's last toggle must close BEFORE the next
      // top-level section begins.
      const lastClose = output.lastIndexOf('</details>');
      const nextSection = output.indexOf('UNICODE-SENT');
      check(checks, 'toggles close before the next top-level section (no cross-nesting)', lastClose !== -1 && nextSection !== -1 && lastClose < nextSection, `lastClose@${lastClose} vs nextSection@${nextSection}`);
    },
  });

  await testOneWay('evernote', async () => (await new EvernoteExporter().convert(O, undefined, optsCM)).data, [
    'One-way single-note export; hierarchy becomes visual indentation only; metadata not carried',
  ]);

  await testOneWay('freemind', async () => (await new FreeMindExporter().convert(O, undefined, optsCM)).data, [
    'One-way; content becomes mind-map notes; metadata not carried',
  ]);

  await testOneWay('xmind', async () => (await new XMindExporter().convert(O, undefined, optsCM)).data, [
    'One-way; content becomes topic notes; metadata not carried',
  ]);

  await testOneWay('csv', async () => (await new CsvExporter().convert(O, undefined, optsCM)).data, [
    'Flat rows; hierarchy encoded as Level+Path columns (reconstructible), rich text flattens',
  ], {
    extra: (output, checks) => {
      check(checks, 'metadata columns present (Type/ID/Parent ID/Tags/Color/Completed)', output.split('\n')[0].includes('Parent ID') && output.split('\n')[0].includes('Tags'));
      check(checks, 'task row carries tags+color+completed', /alpha,beta tag,γ-greek/.test(output) && output.includes('red') && output.includes('true'));
      check(checks, 'parent linkage exported', output.includes('n-chain7'));
    },
  });

  await testOneWay('json-tree', async () => (await new JsonTreeExporter().convert(O, undefined, optsCM)).data, [
    'Rich text flattens to plain; IDs/links not included (use .idm for full-fidelity backup)',
  ], {
    extra: (output, checks) => {
      const parsed = JSON.parse(output);
      check(checks, 'valid JSON tree', !!parsed.root);
      const findTask = (n: any): any =>
        n?.name?.includes('TASKMETA-SENT') ? n : (n?.children || []).map(findTask).find(Boolean);
      const task = findTask(parsed.root);
      check(checks, 'task metadata (tags/color/completed) in tree', !!task && JSON.stringify(task.tags) === JSON.stringify(['alpha', 'beta tag', 'γ-greek']) && task.color === 'red' && task.completed === true);
    },
  });

  await testOneWay('revealjs (slides)', async () => (await new RevealjsExporter().convert(O, undefined, optsCM)).data, [
    'Slides show 3 levels by design (sections → sub-slides → bullets); deeper levels are omitted from the deck',
    'Metadata not carried',
  ], {
    excludeNames: ['n-chain4', 'n-chain5', 'n-chain6', 'n-chain7', 'n-chain8'],
    excludeContent: ['SENTINEL-D8-BODY'],
    extra: (output, checks) => {
      // Confirm the DOCUMENTED depth cutoff is where we say it is.
      check(checks, 'depth-3 node present on slides', output.includes('SENTINEL-D3-charlie'));
    },
  });

  await testOneWay('teleprompter', async () => (await new TeleprompterExporter().convert(O, undefined, optsCM)).data, [
    'One-way script view; hierarchy becomes section breaks; metadata not carried',
  ]);

  await testOneWay('twitter-thread', async () => (await new TwitterThreadExporter().convert(O, undefined, optsCM)).data, [
    'Tweets truncate at 280 characters (long names/content split or trimmed with an ellipsis)',
    'Hierarchy flattens into a numbered thread; metadata not carried',
  ]);

  // -------------------------------------------------------------------------
  // Report
  // -------------------------------------------------------------------------
  const silently = results.filter((r) => r.grade === 'SILENTLY-LOSSY');
  const documented = results.filter((r) => r.grade === 'DOCUMENTED-LOSSY');
  const lossless = results.filter((r) => r.grade === 'LOSSLESS');

  const outDir = path.join(__dirname, '..', '..', 'test-screenshots', 'export-fidelity');
  fs.mkdirSync(outDir, { recursive: true });

  const totalChecks = results.reduce((s, r) => s + r.checks.length, 0);
  const failedChecks = results.reduce((s, r) => s + r.checks.filter((c) => !c.pass).length, 0);

  const report = {
    suite: 'export-fidelity (P7)',
    ranAt: new Date().toISOString(),
    formats: results.length,
    roundTrippable: results.filter((r) => r.roundTrip).length,
    grades: {
      LOSSLESS: lossless.map((r) => r.format),
      'DOCUMENTED-LOSSY': documented.map((r) => r.format),
      'SILENTLY-LOSSY': silently.map((r) => r.format),
    },
    checks: { total: totalChecks, failed: failedChecks },
    results,
  };
  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));

  const md: string[] = [];
  md.push('# Export Fidelity Report (P7)');
  md.push('');
  md.push(`Ran: ${report.ranAt}  |  Formats: ${results.length}  |  Checks: ${totalChecks} (${failedChecks} failed)`);
  md.push('');
  md.push(`- LOSSLESS: ${lossless.length}`);
  md.push(`- DOCUMENTED-LOSSY: ${documented.length}`);
  md.push(`- SILENTLY-LOSSY (bugs): ${silently.length}`);
  md.push('');
  for (const r of results) {
    md.push(`## ${r.format} — ${r.grade}${r.roundTrip ? ' (round-trip verified)' : ' (one-way)'}`);
    for (const c of r.checks.filter((c) => !c.pass)) {
      md.push(`- FAIL: ${c.name}${c.note ? ` — ${c.note}` : ''}`);
    }
    for (const l of r.documentedLosses) md.push(`- documented: ${l}`);
    md.push('');
  }
  fs.writeFileSync(path.join(outDir, 'report.md'), md.join('\n'));

  // Console summary
  for (const r of results) {
    const fails = r.checks.filter((c) => !c.pass);
    console.log(`  ${fails.length === 0 ? 'PASS' : 'FAIL'}  ${r.format} — ${r.grade}`);
    for (const c of fails) console.log(`        ✗ ${c.name}${c.note ? ` — ${c.note}` : ''}`);
  }
  console.log('');
  console.log(`Formats: ${results.length} | lossless ${lossless.length} | documented-lossy ${documented.length} | SILENTLY-LOSSY ${silently.length}`);
  if (silently.length === 0 && failedChecks === 0) {
    console.log('ALL FORMATS HONEST — no silent loss detected.');
    process.exit(0);
  } else {
    console.log('SILENT LOSS DETECTED — fix before shipping.');
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('HARNESS CRASHED:', e);
  process.exit(2);
});

// ============================================================================
// Golden harness for the Phase-0 compile-core consolidation.
//
//   npx tsx tests/compile-core/harness.ts --capture   → writes golden.json
//                                                       (run ONCE, pre-migration)
//   npx tsx tests/compile-core/harness.ts             → compares live outputs
//                                                       against golden.json AND
//                                                       compares the shared
//                                                       compile-core presets
//                                                       against frozen verbatim
//                                                       copies of the OLD code.
//
// Exits non-zero on any byte difference. No AI, no network, no Electron.
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';

import { FIXTURE_NODES, FIXTURE_OUTLINE, HTML_BATTERY } from './fixture';

import { extractSubtreeContent } from '@/lib/podcast-generator';
import { serializeOutline, serializeOutlines } from '@/lib/outline-serializer';
import { stripHtmlToText, nodesToPlainText } from '@/lib/ai/hallucination-verifier';
import { deriveSlidesFromChapter, countSlidesForChapter } from '@/lib/video/derive-slides';
import { deriveDeck, extractDataPoints } from '@/lib/deck/derive-deck';
import { BaseExporter } from '@/lib/export/base-exporter';
import type { Outline, NodeMap, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '@/lib/export/types';

const GOLDEN_PATH = path.join(__dirname, 'golden.json');

// --- Expose BaseExporter's protected helpers via a test-only subclass. -------
class ProbeExporter extends BaseExporter {
  formatId = 'probe';
  mimeType = 'text/plain';
  extension = '.txt';
  async convert(_o: Outline, _r?: string, _opts?: ExportOptions): Promise<ExportResult> {
    throw new Error('not used');
  }
  public strip(html: string): string {
    return this.stripHtml(html);
  }
  public traverse(nodes: NodeMap, rootId: string): Array<{ id: string; depth: number; path: string[] }> {
    const seen: Array<{ id: string; depth: number; path: string[] }> = [];
    this.traverseDepthFirst(nodes, rootId, (node: OutlineNode, depth: number, p: string[]) => {
      seen.push({ id: node.id, depth, path: p });
    });
    return seen;
  }
  public traverseCapped(nodes: NodeMap, rootId: string, maxDepth: number): string[] {
    const ids: string[] = [];
    this.traverseDepthFirst(nodes, rootId, (node: OutlineNode) => ids.push(node.id), maxDepth);
    return ids;
  }
  public pathTo(nodes: NodeMap, nodeId: string, rootId: string): string[] {
    return this.getNodePath(nodes, nodeId, rootId);
  }
}

// --- Compute every observable output the migration must preserve. ------------
function computeOutputs(): Record<string, unknown> {
  const probe = new ProbeExporter();
  return {
    verifier_stripHtmlToText: HTML_BATTERY.map((h) => stripHtmlToText(h)),
    verifier_nodesToPlainText: nodesToPlainText(FIXTURE_NODES as any, 'root'),
    podcast_extractSubtreeContent: extractSubtreeContent(FIXTURE_NODES, 'root'),
    serializer_serializeOutline: serializeOutline(FIXTURE_OUTLINE),
    serializer_serializeOutlines: serializeOutlines([FIXTURE_OUTLINE]),
    exporter_stripHtml: HTML_BATTERY.map((h) => probe.strip(h)),
    exporter_traverseDepthFirst: probe.traverse(FIXTURE_NODES, 'root'),
    exporter_traverseCappedDepth2: probe.traverseCapped(FIXTURE_NODES, 'root', 2),
    exporter_getNodePath_d8: probe.pathTo(FIXTURE_NODES, 'd8', 'root'),
    slides_default: deriveSlidesFromChapter(FIXTURE_NODES, 'root'),
    slides_depth3: deriveSlidesFromChapter(FIXTURE_NODES, 'root', { maxDepth: 3 }),
    slides_deep99: deriveSlidesFromChapter(FIXTURE_NODES, 'root', { maxDepth: 99 }),
    slides_capped5: deriveSlidesFromChapter(FIXTURE_NODES, 'root', { maxDepth: 99, maxSlides: 5 }),
    slides_count_depth3: countSlidesForChapter(FIXTURE_NODES, 'root', { maxDepth: 3 }),
    slides_subbranch_c7: deriveSlidesFromChapter(FIXTURE_NODES, 'c7', { maxDepth: 2 }),
    deck_default: deriveDeck(FIXTURE_NODES, 'root', 'Golden Fixture Outline'),
    deck_noArc_max2: deriveDeck(FIXTURE_NODES, 'root', undefined, { includeArc: false, maxSections: 2 }),
    deck_subbranch_c7: deriveDeck(FIXTURE_NODES, 'c7', 'Fallback Name'),
    deck_extractDataPoints: [
      extractDataPoints('80% use AI · 29% trust it · 45% lose time debugging'),
      extractDataPoints('<p>Survey: 80% adoption &middot; range 10&ndash;25% unsure</p>'),
      extractDataPoints('no numbers here at all'),
      extractDataPoints('only one stat: 50% of things'),
    ],
  };
}

// --- Frozen VERBATIM copies of the pre-migration private strip chains. -------
// These are the OLD side of the old-vs-new comparison and must never change.
const OLD = {
  // src/ai/flows/* + hallucination-verifier stripHtmlToText (5 identical copies)
  prompt(html: string): string {
    return (html || '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  // src/lib/podcast-generator.ts stripHtml
  podcast(html: string): string {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  // src/lib/outline-serializer.ts stripHtml
  serializer(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<\/li>/gi, '\n')
      .replace(/<li[^>]*>/gi, '- ')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  // src/lib/export/base-exporter.ts + website base-template stripHtml (2 identical copies)
  exporter(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  },
  // src/lib/video/derive-slides.ts stripHtml
  videoInline(html: string): string {
    return String(html || '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/\s+/g, ' ')
      .trim();
  },
  // src/ai/flows/suggest-tags.ts + multimedia/insert-proposed-nodes.ts inline chain
  bareInline(html: string): string {
    return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  },
  // src/lib/deck/derive-deck.ts decodeEntities + stripHtml + cleanText
  deckDecodeEntities(s: string): string {
    const safeCodePoint = (cp: number): string => {
      if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ' ';
      try {
        return String.fromCodePoint(cp);
      } catch {
        return ' ';
      }
    };
    return String(s || '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&middot;/g, ' · ')
      .replace(/&bull;/g, ' · ')
      .replace(/&mdash;/g, ' — ')
      .replace(/&ndash;/g, '–')
      .replace(/&times;/g, '×')
      .replace(/&hellip;/g, '…')
      .replace(/&ldquo;|&rdquo;|&quot;/g, '"')
      .replace(/&lsquo;|&rsquo;|&apos;/g, "'")
      .replace(/&#(\d+);/g, (_, n) => safeCodePoint(parseInt(n, 10)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => safeCodePoint(parseInt(n, 16)));
  },
  deckBlock(html: string): string {
    const withBreaks = String(html || '')
      .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, '\n')
      .replace(/<br\s*\/?>/gi, '\n');
    return OLD.deckDecodeEntities(withBreaks.replace(/<[^>]+>/g, ' '))
      .replace(/[^\S\n]+/g, ' ')
      .replace(/ *\n */g, '\n')
      .replace(/\n{2,}/g, '\n')
      .replace(/\s+([,.;:!?%)])/g, '$1')
      .replace(/([(])\s+/g, '$1')
      .trim();
  },
  deckInline(s: string): string {
    return OLD.deckDecodeEntities(String(s || '').replace(/<[^>]+>/g, ' '))
      .replace(/\s+/g, ' ')
      .replace(/\s+([,.;:!?%)])/g, '$1')
      .replace(/([(])\s+/g, '$1')
      .trim();
  },
};

// --- Diff helpers -------------------------------------------------------------
let failures = 0;
function check(label: string, oldVal: unknown, newVal: unknown): void {
  const a = JSON.stringify(oldVal);
  const b = JSON.stringify(newVal);
  if (a === b) {
    console.log(`  PASS  ${label}`);
  } else {
    failures++;
    console.log(`  FAIL  ${label}`);
    console.log(`        old: ${a?.slice(0, 400)}`);
    console.log(`        new: ${b?.slice(0, 400)}`);
  }
}

async function main(): Promise<void> {
  const mode = process.argv.includes('--capture') ? 'capture' : 'compare';
  const outputs = computeOutputs();

  if (mode === 'capture') {
    fs.writeFileSync(GOLDEN_PATH, JSON.stringify(outputs, null, 2));
    console.log(`Captured golden outputs → ${GOLDEN_PATH}`);
    console.log(`Keys: ${Object.keys(outputs).join(', ')}`);
    return;
  }

  // 1) Golden comparison: live (migrated) modules vs pre-migration capture.
  if (!fs.existsSync(GOLDEN_PATH)) {
    console.error('golden.json missing — run with --capture on pre-migration code first.');
    process.exit(2);
  }
  const golden = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  console.log('Golden comparison (pre-migration capture vs live modules):');
  for (const key of Object.keys(golden)) {
    check(key, golden[key], (outputs as any)[key]);
  }
  for (const key of Object.keys(outputs)) {
    if (!(key in golden)) {
      failures++;
      console.log(`  FAIL  ${key} — present live but missing from golden capture`);
    }
  }

  // 2) Old-vs-new: frozen verbatim OLD chains vs shared compile-core presets.
  console.log('Old-vs-new comparison (frozen verbatim chains vs compile-core):');
  try {
    const core = await import('@/lib/compile-core');
    for (const [preset, oldFn] of [
      ['prompt', OLD.prompt],
      ['podcast', OLD.podcast],
      ['serializer', OLD.serializer],
      ['exporter', OLD.exporter],
      ['video-inline', OLD.videoInline],
      ['bare-inline', OLD.bareInline],
      ['rich-block', OLD.deckBlock],
      ['rich-inline', OLD.deckInline],
    ] as const) {
      check(
        `preset:${preset}`,
        HTML_BATTERY.map((h) => oldFn(h)),
        HTML_BATTERY.map((h) => core.htmlToPlainText(h, preset as any)),
      );
    }
    check(
      'decodeEntities',
      HTML_BATTERY.map((h) => OLD.deckDecodeEntities(h)),
      HTML_BATTERY.map((h) => core.decodeEntities(h)),
    );

    // 3) Compile Tree sanity (new Phase-0 capability — deterministic invariants).
    const tree1 = core.buildCompileTree(FIXTURE_NODES, 'root')!;
    const tree2 = core.buildCompileTree(FIXTURE_NODES, 'root')!;
    if (!tree1 || !tree2) throw new Error('buildCompileTree returned null for a valid root');
    check('compileTree deterministic', tree1, tree2);
    const mutated: NodeMap = {
      ...FIXTURE_NODES,
      c1: { ...FIXTURE_NODES.c1, content: FIXTURE_NODES.c1.content + '<p>edit</p>' },
    };
    const tree3 = core.buildCompileTree(mutated, 'root')!;
    if (!tree3) throw new Error('buildCompileTree returned null for the mutated map');
    const hashOf = (t: any, id: string): string | undefined => {
      let found: string | undefined;
      const walk = (u: any) => {
        if (u.nodeId === id) found = u.contentHash;
        u.children.forEach(walk);
      };
      walk(t.root);
      return found;
    };
    if (hashOf(tree1, 'c1') === hashOf(tree3, 'c1')) {
      failures++;
      console.log('  FAIL  contentHash: editing a node did not change its hash');
    } else {
      console.log('  PASS  contentHash changes when node content changes');
    }
    if (hashOf(tree1, 'c2') !== hashOf(tree3, 'c2')) {
      failures++;
      console.log('  FAIL  contentHash: untouched sibling hash changed');
    } else {
      console.log('  PASS  contentHash stable for untouched sibling');
    }
    if (tree1.root.contentHash === tree3.root.contentHash) {
      // Root fingerprint intentionally covers only (name + content + child ids),
      // per the blueprint — a descendant edit shows up on the descendant's unit.
      console.log('  PASS  root shallow fingerprint unchanged by descendant edit (by design)');
    }
  } catch (err) {
    failures++;
    console.log(`  FAIL  could not load @/lib/compile-core: ${(err as Error).message}`);
  }

  console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

// ============================================================================
// Render a DeckModel to a real .pptx using pptxgenjs — NATIVE text/shapes/charts
// so the result stays fully editable in PowerPoint AND Apple Keynote (Keynote
// imports .pptx cleanly, then can Save As .key). Every slide is branded to match
// the app: dark on-brand background, accent bar, and a native IdeaM logo mark
// drawn from shapes (no flat images), matching src/lib/video/video-style.ts and
// the marketing site.
//
// The pptxgenjs module is imported DYNAMICALLY so it never bloats SSR / the main
// bundle. The returned instance is ready to `.writeFile(...)` (browser download
// or Node disk write).
// ============================================================================

import type PptxGenJSType from 'pptxgenjs';
import type { DeckModel, DeckSlide, DeckDataPoint } from './derive-deck';
import {
  DECK_FONT,
  DEFAULT_DECK_BRAND,
  resolvePalette,
  type DeckBrand,
  type DeckPalette,
} from './deck-brand';

type Slide = ReturnType<PptxGenJSType['addSlide']>;

// Widescreen 16:9 canvas (inches).
const W = 13.333;
const H = 7.5;
const MARGIN = 0.7;

/** Draw the native IdeaM logo mark (rounded blue tile + 4 ascending white bars)
 *  at (x,y) with square size `size` inches. Fully editable vector shapes. */
function addLogoMark(pptx: PptxGenJSType, slide: Slide, x: number, y: number, size: number): void {
  const s = size / 100; // svg viewBox is 100×100
  const { ShapeType } = pptx as unknown as { ShapeType: Record<string, string> };
  slide.addShape(ShapeType.roundRect as never, {
    x, y, w: size, h: size,
    fill: { color: '2563EB' },
    line: { type: 'none' } as never,
    rectRadius: 22 * s,
  });
  const bars = [
    { bx: 20, by: 56, bh: 20 },
    { bx: 38, by: 42, bh: 34 },
    { bx: 56, by: 28, bh: 48 },
    { bx: 74, by: 14, bh: 62 },
  ];
  for (const b of bars) {
    slide.addShape(ShapeType.roundRect as never, {
      x: x + b.bx * s, y: y + b.by * s, w: 12 * s, h: b.bh * s,
      fill: { color: 'FFFFFF' },
      line: { type: 'none' } as never,
      rectRadius: 6 * s,
    });
  }
}

/** Common branded chrome: background, accent top bar, footer logo + page no. */
function paintChrome(
  pptx: PptxGenJSType,
  slide: Slide,
  pal: DeckPalette,
  brand: DeckBrand,
  pageNo: number,
  total: number,
): void {
  slide.background = { color: pal.bg };
  // Accent top rule.
  slide.addShape('rect' as never, {
    x: 0, y: 0, w: W, h: 0.12, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });
  // Footer: logo mark + wordmark (left), page number (right).
  addLogoMark(pptx, slide, MARGIN, H - 0.62, 0.3);
  slide.addText(brand.brandLabel, {
    x: MARGIN + 0.42, y: H - 0.66, w: 3, h: 0.38,
    fontFace: DECK_FONT, fontSize: 12, bold: true, color: pal.muted, align: 'left', valign: 'middle',
  });
  slide.addText(`${pageNo} / ${total}`, {
    x: W - MARGIN - 1.5, y: H - 0.66, w: 1.5, h: 0.38,
    fontFace: DECK_FONT, fontSize: 11, color: pal.muted, align: 'right', valign: 'middle',
  });
}

function addTitleSlide(pptx: PptxGenJSType, slide: Slide, pal: DeckPalette, brand: DeckBrand, s: Extract<DeckSlide, { kind: 'title' }>): void {
  slide.background = { color: pal.bg };
  // Accent glow block (a soft on-brand panel in the corner).
  slide.addShape('rect' as never, {
    x: W - 3.6, y: 0, w: 3.6, h: 2.4, fill: { color: pal.panel }, line: { type: 'none' } as never,
  });
  slide.addShape('rect' as never, {
    x: 0, y: 0, w: 0.22, h: H, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });
  // Short accent bar above the title.
  slide.addShape('rect' as never, {
    x: MARGIN + 0.2, y: 2.5, w: 1.1, h: 0.16, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });
  slide.addText(s.title, {
    x: MARGIN + 0.2, y: 2.75, w: W - 2 * MARGIN - 0.2, h: 2.0,
    fontFace: DECK_FONT, fontSize: 40, bold: true, color: pal.text, align: 'left', valign: 'top',
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: MARGIN + 0.2, y: 4.7, w: W - 2 * MARGIN - 0.2, h: 1.2,
      fontFace: DECK_FONT, fontSize: 18, color: pal.muted, align: 'left', valign: 'top',
    });
  }
  // Brand lockup bottom-left.
  addLogoMark(pptx, slide, MARGIN + 0.2, H - 0.95, 0.42);
  slide.addText(brand.brandLabel, {
    x: MARGIN + 0.75, y: H - 0.98, w: 4, h: 0.5,
    fontFace: DECK_FONT, fontSize: 16, bold: true, color: pal.text, align: 'left', valign: 'middle',
  });
}

function addArcSlide(pptx: PptxGenJSType, slide: Slide, pal: DeckPalette, brand: DeckBrand, pageNo: number, total: number): void {
  paintChrome(pptx, slide, pal, brand, pageNo, total);
  slide.addText('The Arc', {
    x: MARGIN, y: 0.55, w: W - 2 * MARGIN, h: 0.7,
    fontFace: DECK_FONT, fontSize: 28, bold: true, color: pal.text, align: 'left',
  });
  slide.addShape('rect' as never, {
    x: MARGIN, y: 1.28, w: 1.1, h: 0.09, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });
  slide.addText('Source to published work', {
    x: MARGIN, y: 1.45, w: W - 2 * MARGIN, h: 0.5,
    fontFace: DECK_FONT, fontSize: 16, color: pal.muted, align: 'left',
  });

  const steps = ['Thought', 'Idea', 'Produce', 'Publish'];
  const boxW = 2.55;
  const gap = 0.55;
  const totalW = steps.length * boxW + (steps.length - 1) * gap;
  const startX = (W - totalW) / 2;
  const boxY = 3.35;
  const boxH = 1.35;
  const { ShapeType } = pptx as unknown as { ShapeType: Record<string, string> };
  steps.forEach((label, i) => {
    const bx = startX + i * (boxW + gap);
    slide.addShape(ShapeType.roundRect as never, {
      x: bx, y: boxY, w: boxW, h: boxH,
      fill: { color: i % 2 === 0 ? pal.panel : pal.accent },
      line: { color: pal.accent, width: 1.5 },
      rectRadius: 0.14,
    });
    slide.addText(label, {
      x: bx, y: boxY, w: boxW, h: boxH,
      fontFace: DECK_FONT, fontSize: 18, bold: true,
      color: i % 2 === 0 ? pal.text : 'FFFFFF', align: 'center', valign: 'middle',
    });
    if (i < steps.length - 1) {
      slide.addText('→', {
        x: bx + boxW, y: boxY, w: gap, h: boxH,
        fontFace: DECK_FONT, fontSize: 24, bold: true, color: pal.accent, align: 'center', valign: 'middle',
      });
    }
  });
}

function addChartToSlide(pptx: PptxGenJSType, slide: Slide, pal: DeckPalette, points: DeckDataPoint[], x: number, y: number, w: number, h: number): void {
  const { ChartType } = pptx as unknown as { ChartType: Record<string, string> };
  const isPct = points.some((p) => p.isPercent);
  const data = [{
    name: isPct ? 'Percent' : 'Value',
    labels: points.map((p) => p.label),
    values: points.map((p) => p.value),
  }];
  slide.addChart(ChartType.bar as never, data, {
    x, y, w, h,
    barDir: 'col',
    chartColors: [pal.accent],
    showValue: true,
    dataLabelColor: pal.text,
    dataLabelFontFace: DECK_FONT,
    dataLabelFontSize: 12,
    dataLabelFormatCode: isPct ? '0"%"' : '0',
    showLegend: false,
    showTitle: false,
    catAxisLabelColor: pal.muted,
    catAxisLabelFontFace: DECK_FONT,
    catAxisLabelFontSize: 11,
    valAxisHidden: true,
    valGridLine: { style: 'none' },
    catGridLine: { style: 'none' },
    catAxisLineColor: pal.line,
    barGapWidthPct: 40,
  } as never);
}

function addSectionSlide(pptx: PptxGenJSType, slide: Slide, pal: DeckPalette, brand: DeckBrand, s: Extract<DeckSlide, { kind: 'section' }>, pageNo: number, total: number): void {
  paintChrome(pptx, slide, pal, brand, pageNo, total);
  slide.addText(s.title, {
    x: MARGIN, y: 0.55, w: W - 2 * MARGIN, h: 0.9,
    fontFace: DECK_FONT, fontSize: 26, bold: true, color: pal.text, align: 'left', valign: 'top',
  });
  slide.addShape('rect' as never, {
    x: MARGIN, y: 1.45, w: 1.1, h: 0.09, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });

  const hasChart = !!s.chart && s.chart.length > 0;
  // `breakLine: true` is REQUIRED: without it pptxgenjs renders an array of text
  // objects as consecutive RUNS inside a single paragraph — so every bullet fuses
  // into one blob with no line break and (for text lacking end punctuation) no
  // space between them ("mattersWhy…"). breakLine forces one paragraph per bullet.
  const bulletItems = s.bullets.map((b) => ({
    text: b,
    options: { bullet: { code: '2022', indent: 18 }, breakLine: true, color: pal.text, fontSize: 18, paraSpaceAfter: 10 },
  }));

  if (hasChart && s.bullets.length > 0) {
    // Split layout: bullets left, chart right.
    slide.addText(bulletItems as never, {
      x: MARGIN, y: 1.9, w: 5.6, h: 4.6,
      fontFace: DECK_FONT, align: 'left', valign: 'top',
    });
    addChartToSlide(pptx, slide, pal, s.chart!, 6.7, 1.9, 5.9, 4.4);
  } else if (hasChart) {
    // Chart is the whole story.
    addChartToSlide(pptx, slide, pal, s.chart!, MARGIN + 0.5, 1.95, W - 2 * MARGIN - 1, 4.3);
  } else if (s.bullets.length > 0) {
    slide.addText(bulletItems as never, {
      x: MARGIN, y: 1.9, w: W - 2 * MARGIN, h: 4.6,
      fontFace: DECK_FONT, align: 'left', valign: 'top',
    });
  } else {
    slide.addText('—', {
      x: MARGIN, y: 1.9, w: W - 2 * MARGIN, h: 1,
      fontFace: DECK_FONT, fontSize: 18, color: pal.muted, align: 'left',
    });
  }
}

function addClosingSlide(pptx: PptxGenJSType, slide: Slide, pal: DeckPalette, brand: DeckBrand, s: Extract<DeckSlide, { kind: 'closing' }>): void {
  slide.background = { color: pal.bg };
  slide.addShape('rect' as never, {
    x: 0, y: 0, w: W, h: 0.12, fill: { color: pal.accent }, line: { type: 'none' } as never,
  });
  slide.addText(s.title, {
    x: MARGIN, y: 2.7, w: W - 2 * MARGIN, h: 1.2,
    fontFace: DECK_FONT, fontSize: 44, bold: true, color: pal.text, align: 'center', valign: 'middle',
  });
  if (s.subtitle) {
    slide.addText(s.subtitle, {
      x: MARGIN, y: 3.9, w: W - 2 * MARGIN, h: 0.8,
      fontFace: DECK_FONT, fontSize: 18, color: pal.muted, align: 'center', valign: 'middle',
    });
  }
  addLogoMark(pptx, slide, W / 2 - 0.75, 5.15, 0.4);
  slide.addText(`Made with ${brand.brandLabel}`, {
    x: W / 2 - 0.3, y: 5.13, w: 3, h: 0.44,
    fontFace: DECK_FONT, fontSize: 14, bold: true, color: pal.muted, align: 'left', valign: 'middle',
  });
}

/**
 * Build the .pptx presentation for a deck model. Returns the pptxgenjs instance;
 * call `.writeFile({ fileName })` to download (browser) or save (Node).
 */
export async function buildDeckPptx(deck: DeckModel, brandIn?: Partial<DeckBrand>): Promise<PptxGenJSType> {
  const brand: DeckBrand = { ...DEFAULT_DECK_BRAND, ...brandIn };
  const pal = resolvePalette(brand);

  const mod = await import('pptxgenjs');
  const PptxGenJS = (mod as unknown as { default: new () => PptxGenJSType }).default;
  const pptx = new PptxGenJS();
  pptx.author = brand.brandLabel;
  pptx.company = brand.brandLabel;
  pptx.title = deck.name;
  pptx.layout = 'LAYOUT_WIDE';

  const total = deck.slides.length;
  deck.slides.forEach((s, i) => {
    const slide = pptx.addSlide();
    const pageNo = i + 1;
    switch (s.kind) {
      case 'title': addTitleSlide(pptx, slide, pal, brand, s); break;
      case 'arc': addArcSlide(pptx, slide, pal, brand, pageNo, total); break;
      case 'section': addSectionSlide(pptx, slide, pal, brand, s, pageNo, total); break;
      case 'closing': addClosingSlide(pptx, slide, pal, brand, s); break;
    }
  });

  return pptx;
}

/** A filesystem/attachment-safe file name for the deck. */
export function deckFileName(name: string): string {
  const base = (name || 'Slide Deck')
    .replace(/[^a-z0-9\- ]/gi, '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 70);
  return `${base || 'Slide Deck'}.pptx`;
}

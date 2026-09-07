// ============================================================================
// Golden-test fixture for the compile-core consolidation (Phase 0).
// A deliberately tricky outline: nested formatting, entities (named + numeric),
// lists, links, empty nodes, deep nesting, long names, whitespace torture,
// percentages (deck charts), a canvas node (serializer skip path).
// MUST STAY FROZEN — the golden outputs were captured against exactly this.
// ============================================================================

import type { NodeMap, Outline, OutlineNode } from '@/types';

function n(partial: Partial<OutlineNode> & { id: string; name: string }): OutlineNode {
  return {
    content: '',
    type: 'default' as any,
    parentId: null,
    childrenIds: [],
    prefix: '',
    ...partial,
  } as OutlineNode;
}

export const LONG_NAME =
  'A very long node name that keeps going and going well past any sensible ' +
  'length a slide or heading would want, testing truncation and word-boundary ' +
  'behavior in every consumer that caps text, including bullets and titles ' +
  'and mermaid labels and prompt renderings — all of it, end to end';

export const FIXTURE_NODES: NodeMap = {
  root: n({
    id: 'root',
    name: 'Golden Fixture Outline',
    content: '<p>Root intro with <strong>bold</strong> &amp; <em>emphasis</em>.</p>',
    type: 'root' as any,
    childrenIds: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c10'],
  }),
  c1: n({
    id: 'c1',
    name: 'Nested formatting',
    parentId: 'root',
    prefix: '1',
    content:
      '<p><strong>Bold <em>italic nested</em></strong> and <u>underline</u> and <s>strike</s>.</p>' +
      '<p>Second paragraph after the first.</p><div>A div block</div>line one<br>line two<br/>line three',
    childrenIds: ['c1a'],
  }),
  c1a: n({
    id: 'c1a',
    name: 'Child of formatting',
    parentId: 'c1',
    prefix: '1.1',
    content: '<h2>A heading</h2><p>Text under heading with <code>inline code</code>.</p>',
  }),
  c2: n({
    id: 'c2',
    name: 'Entities galore',
    parentId: 'root',
    prefix: '2',
    content:
      '<p>&amp; &lt;tag&gt; &quot;dq&quot; &#39;sq&#39; a&nbsp;nbsp &ldquo;curly&rdquo; ' +
      '&lsquo;single&rsquo; &mdash; dash &ndash; en 3&times;4 wait&hellip; ' +
      '&bull; bullet &middot; middot &#8212;numeric &#x2192; arrow &#65; letterA</p>',
  }),
  c3: n({
    id: 'c3',
    name: 'Lists',
    parentId: 'root',
    prefix: '3',
    content:
      '<ul><li>Item one</li><li>Item <b>two</b> bolded</li><li><p>Wrapped in p</p></li></ul>' +
      '<ol><li>Numbered first</li><li>Numbered second</li></ol>',
  }),
  c4: n({
    id: 'c4',
    name: 'Links',
    parentId: 'root',
    prefix: '4',
    content:
      '<p>See <a href="https://example.com/page?a=1&amp;b=2">the linked site</a> for more, ' +
      'and <a href="mailto:x@y.z">mail us</a>.</p>',
  }),
  c5: n({
    id: 'c5',
    name: 'Totally empty node',
    parentId: 'root',
    prefix: '5',
    content: '',
  }),
  c6: n({
    id: 'c6',
    name: 'Deep nesting start',
    parentId: 'root',
    prefix: '6',
    content: '<p>Level zero prose.</p>',
    childrenIds: ['d1'],
  }),
  d1: n({ id: 'd1', name: 'Depth 1', parentId: 'c6', content: '<p>At depth one.</p>', childrenIds: ['d2'] }),
  d2: n({ id: 'd2', name: 'Depth 2', parentId: 'd1', content: '<p>At depth two.</p>', childrenIds: ['d3'] }),
  d3: n({ id: 'd3', name: 'Depth 3', parentId: 'd2', content: '', childrenIds: ['d4'] }),
  d4: n({ id: 'd4', name: 'Depth 4', parentId: 'd3', content: '<p>At depth four.</p>', childrenIds: ['d5'] }),
  d5: n({ id: 'd5', name: 'Depth 5', parentId: 'd4', content: '', childrenIds: ['d6'] }),
  d6: n({ id: 'd6', name: 'Depth 6', parentId: 'd5', content: '<p>Deepest prose &amp; entity.</p>', childrenIds: ['d7'] }),
  d7: n({ id: 'd7', name: 'Depth 7', parentId: 'd6', content: '', childrenIds: ['d8'] }),
  d8: n({ id: 'd8', name: 'Depth 8 leaf', parentId: 'd7', content: '<p>The very bottom.</p>' }),
  c7: n({
    id: 'c7',
    name: LONG_NAME,
    parentId: 'root',
    prefix: '7',
    content:
      '<p>Survey says: 80% use AI daily &middot; 29% trust the output &middot; ' +
      '45% lose time debugging. Range 10&ndash;25% remains unsure.</p>' +
      '<p>A second, quite long paragraph that runs on and on to exercise bullet ' +
      'truncation at word boundaries with an ellipsis so slides never render a ' +
      'run-on wall of text under any circumstances whatsoever, truly.</p>',
    childrenIds: ['c7a', 'c7b'],
  }),
  c7a: n({ id: 'c7a', name: 'Stat child A', parentId: 'c7', content: '<p>60% of leaves matter.</p>' }),
  c7b: n({ id: 'c7b', name: 'Stat child B', parentId: 'c7', content: '' }),
  c8: n({
    id: 'c8',
    name: 'Whitespace torture',
    parentId: 'root',
    prefix: '8',
    content:
      '<p>  spaced    out\ttabbed  </p>\n\n\n<p>after  blank\n\nlines</p>' +
      '<div>   </div><p></p><br><br><br><p>end.</p>',
  }),
  c9: n({
    id: 'c9',
    name: 'Canvas node (skipped by serializer)',
    parentId: 'root',
    prefix: '9',
    content: '<p>binary-ish payload</p>',
    type: 'canvas' as any,
  }),
  c10: n({
    id: 'c10',
    name: 'Table & misc blocks',
    parentId: 'root',
    prefix: '10',
    content:
      '<table><tr><td>cell one</td><td>cell two</td></tr><tr><td>row2</td></tr></table>' +
      '<h3>After table</h3><blockquote>Quoted words</blockquote>',
    childrenIds: ['ghost'], // intentionally dangling child id (live-child filtering)
  }),
};

export const FIXTURE_OUTLINE: Outline = {
  id: 'fixture-outline',
  name: 'Golden Fixture Outline',
  rootNodeId: 'root',
  nodes: FIXTURE_NODES,
} as unknown as Outline;

/** Raw HTML strings for direct strip-function comparisons. */
export const HTML_BATTERY: string[] = [
  '',
  'plain text no markup',
  '<p>one para</p>',
  '<p><strong>Bold <em>italic</em></strong> tail</p>',
  '<ul><li>a</li><li>b <i>ital</i></li></ul>',
  '<ol><li><p>wrapped</p></li></ol>',
  'x<br>y<br/>z<BR>w',
  '<div>d1</div><div>d2</div>',
  '<h1>H1</h1><h2>H2</h2><h6>H6</h6>after',
  '&amp;&lt;&gt;&quot;&#39;&nbsp;',
  '&ldquo;q&rdquo; &mdash; &ndash; &times; &hellip; &bull; &middot; &#8594; &#x2713;',
  '<a href="https://x.y/z?a=1&amp;b=2">link text</a> after link',
  '<p>  lots   of\t space  </p>\n\n\n\n<p>gap</p>',
  '<span>inline</span><b>joined</b>words',
  '<table><tr><td>c1</td></tr></table>tail',
  '<p>80% use AI &middot; 29% trust it &middot; 45% lose time</p>',
  '<p>unterminated <b>bold',
  '<P>UPPERCASE TAGS</P><LI>item</LI>',
  '<p>punct , spacing ( inside ) test %</p>',
  '<blockquote>quote</blockquote><pre><code>code block</code></pre>',
];

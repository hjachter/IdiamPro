// ============================================================================
// Export-fidelity torture fixture.
//
// A deliberately hostile outline used by tests/export-fidelity/harness.ts to
// prove every export format either preserves structure or loses only what its
// nature forces it to lose (and that loss is documented — never silent).
//
// Contents:
//   - a sentinel chain 8 levels deep (deeper than Markdown's 6 heading levels)
//   - unicode names (CJK, RTL, emoji, accents)
//   - XML/HTML-hostile characters (& < > " ')
//   - CSV-hostile characters (commas, quotes)
//   - a Markdown-hostile name that looks like a heading
//   - a very long name (with a checkable sentinel prefix)
//   - an empty-named node and an empty-content node
//   - rich HTML content (lists, bold, entities, <br>, links)
//   - full metadata: tags, color, completion, priority, prerequisites, dates
//   - a cross-outline link node (linkedOutlineId)
// ============================================================================

import type { Outline, NodeMap } from '@/types';

export const LONG_NAME_SENTINEL = 'LONGNAME-SENT-7734';
export const LONG_NAME =
  LONG_NAME_SENTINEL +
  ' ' +
  'very long node name '.repeat(12).trim();

export const EMPTY_NAME_CONTENT_SENTINEL = 'EMPTYNAME-CONTENT-SENT-4411';

const nodes: NodeMap = {
  'n-root': {
    id: 'n-root',
    name: 'Fidelity Torture Outline',
    content: '<p>Root content with an entity: &amp; and <b>bold</b>.</p>',
    type: 'root',
    parentId: null,
    childrenIds: ['n-chain1', 'n-unicode', 'n-xmlhostile', 'n-csvhostile', 'n-mdhostile', 'n-task', 'n-xlink', 'n-longname', 'n-emptyname', 'n-emptycontent', 'n-rich'],
    prefix: '',
  },

  // --- Deep sentinel chain: depth 1..8 -------------------------------------
  'n-chain1': { id: 'n-chain1', name: 'SENTINEL-D1-alpha', content: 'Depth one body text.', type: 'chapter', parentId: 'n-root', childrenIds: ['n-chain2'], prefix: '1' },
  'n-chain2': { id: 'n-chain2', name: 'SENTINEL-D2-bravo', content: '', type: 'chapter', parentId: 'n-chain1', childrenIds: ['n-chain3'], prefix: '1.1' },
  'n-chain3': { id: 'n-chain3', name: 'SENTINEL-D3-charlie', content: 'Depth three body text.', type: 'chapter', parentId: 'n-chain2', childrenIds: ['n-chain4'], prefix: '1.1.1' },
  'n-chain4': { id: 'n-chain4', name: 'SENTINEL-D4-delta', content: '', type: 'chapter', parentId: 'n-chain3', childrenIds: ['n-chain5'], prefix: '1.1.1.1' },
  'n-chain5': { id: 'n-chain5', name: 'SENTINEL-D5-echo', content: '', type: 'chapter', parentId: 'n-chain4', childrenIds: ['n-chain6'], prefix: '1.1.1.1.1' },
  'n-chain6': { id: 'n-chain6', name: 'SENTINEL-D6-foxtrot', content: '', type: 'chapter', parentId: 'n-chain5', childrenIds: ['n-chain7'], prefix: '1.1.1.1.1.1' },
  'n-chain7': { id: 'n-chain7', name: 'SENTINEL-D7-golf', content: '', type: 'chapter', parentId: 'n-chain6', childrenIds: ['n-chain8'], prefix: '1.1.1.1.1.1.1' },
  'n-chain8': { id: 'n-chain8', name: 'SENTINEL-D8-hotel', content: 'Deepest body text SENTINEL-D8-BODY.', type: 'document', parentId: 'n-chain7', childrenIds: [], prefix: '1.1.1.1.1.1.1.1' },

  // --- Hostile leaves at depth 1 -------------------------------------------
  'n-unicode': {
    id: 'n-unicode',
    name: 'Ünïcödé 中文名字 🚀 עברית UNICODE-SENT',
    content: '<p>Unicode body: naïve café — 日本語テキスト — שלום עולם 🌍</p>',
    type: 'note', parentId: 'n-root', childrenIds: [], prefix: '2',
  },
  'n-xmlhostile': {
    id: 'n-xmlhostile',
    name: `Fish & Chips <"quoted"> 'n XMLHOSTILE-SENT`,
    content: `<p>Ampersand & angle <brackets> and "double" plus 'single' quotes.</p>`,
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '3',
  },
  'n-csvhostile': {
    id: 'n-csvhostile',
    name: 'Commas, everywhere, "quoted, too" CSVHOSTILE-SENT',
    content: '<p>Cell, with, commas and "quotes".</p>',
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '4',
  },
  'n-mdhostile': {
    id: 'n-mdhostile',
    name: '## Not a heading #tag MDHOSTILE-SENT',
    content: '<p>Body that mentions hash marks mid-line # like this.</p>',
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '5',
  },

  // --- Metadata-rich task node ----------------------------------------------
  'n-task': {
    id: 'n-task',
    name: 'TASKMETA-SENT finish the fidelity harness',
    content: '<p>Task body.</p>',
    type: 'task', parentId: 'n-root', childrenIds: [], prefix: '6',
    metadata: {
      tags: ['alpha', 'beta tag', 'γ-greek'],
      color: 'red',
      isCompleted: true,
      priority: 'High',
      prerequisites: ['n-chain1'],
      dueDate: 1767225600000,
      createdAt: 1735689600000,
      updatedAt: 1735776000000,
    },
  },

  // --- Cross-outline link node ----------------------------------------------
  'n-xlink': {
    id: 'n-xlink',
    name: 'XLINK-SENT jump to another outline',
    content: '',
    type: 'outline-link', parentId: 'n-root', childrenIds: [], prefix: '7',
    linkedOutlineId: 'other-outline-uuid-1234',
  },

  // --- Long name, empty name, empty content ---------------------------------
  'n-longname': {
    id: 'n-longname',
    name: LONG_NAME,
    content: '',
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '8',
  },
  'n-emptyname': {
    id: 'n-emptyname',
    name: '',
    content: `<p>${EMPTY_NAME_CONTENT_SENTINEL} body of the unnamed node.</p>`,
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '9',
  },
  'n-emptycontent': {
    id: 'n-emptycontent',
    name: 'EMPTYCONTENT-SENT nothing inside',
    content: '',
    type: 'document', parentId: 'n-root', childrenIds: [], prefix: '10',
  },

  // --- Rich HTML content -----------------------------------------------------
  'n-rich': {
    id: 'n-rich',
    name: 'RICHCONTENT-SENT formatted body',
    content:
      '<p>First paragraph with <b>bold</b> and <i>italics</i>.</p>' +
      '<ul><li>Bullet one RICH-LI-SENT</li><li>Bullet two</li></ul>' +
      '<p>Entities: &amp; &lt; &gt; &quot; &#39; &nbsp;done.</p>' +
      '<p>Line<br>break and a <a href="https://example.com/page">link</a>.</p>',
    type: 'note', parentId: 'n-root', childrenIds: [], prefix: '11',
    metadata: { tags: ['rich'], color: 'blue' },
  },
};

export const TORTURE_OUTLINE: Outline = {
  id: 'fidelity-torture-outline-id',
  name: 'Fidelity Torture Outline',
  rootNodeId: 'n-root',
  nodes,
  lastModified: 1735689600000,
};

/** Names of every node (used for structural-completeness checks). */
export const ALL_NODE_IDS = Object.keys(nodes);

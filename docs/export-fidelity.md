# Export Fidelity — what every format keeps, and what it loses

**The rule:** an export may lose only what its format *cannot represent* — and every
such loss must be written down here. Undocumented ("silent") loss is a bug and a
release blocker, enforced by `tests/export-fidelity-test.js` (run under TEST
EVERYTHING). That harness exports a torture outline (8 levels deep, unicode, hostile
characters, long/empty names, rich content, tags/colors/completion, cross-outline
links) through all 23 registry formats and grades each one.

Last verified: 2026-09-09 — **0 silently-lossy formats** (23 checked: 1 lossless,
22 documented-lossy).

## The one complete backup format

**IdeaM outline (.idm / JSON)** is the native format: a plain, human-readable JSON
file. It keeps **everything** — hierarchy, node names *and* their separate content,
node types, IDs, numbering, tags, colors, completion, priorities, prerequisites,
dates, cross-outline links, edit provenance. Export → re-import is verified
byte-faithful. If you want a full-fidelity copy of your work, this is the format.
(Subtree exports detach cleanly: the piece you export becomes a complete standalone
outline.)

## Round-trippable formats (export → re-import verified)

| Format | Keeps | Loses (by the format's nature) |
|---|---|---|
| **IdeaM .idm (JSON)** | Everything | Nothing — verified lossless |
| **OPML** | Full hierarchy, names, content (as plain text), node types; tags/colors/completion when "Include metadata" is checked | Rich text formatting; IDs and numbering are regenerated on re-import; task dates/priorities/prerequisites; cross-outline link *targets* |
| **Markdown** | Hierarchy to 6 levels, names (even empty ones), content as plain text | Levels deeper than 6 flatten (Markdown has no h7+); formatting becomes plain text; all metadata, types, IDs, links |
| **Plain text** | Every node's name at its indent level, content indented beneath | The name-vs-content distinction (content lines re-import as nodes); empty-named nodes; all formatting, metadata, IDs, links |

## One-way formats (structural completeness verified — every node present)

| Format | Notes on what's kept / lost |
|---|---|
| **Interactive outline (HTML viewer)** | Read-only, but embeds the *full* structure: IDs, hierarchy, rich content, tags, colors, completion. Closest to lossless after .idm. |
| **HTML / Blog HTML** | All nodes and content as a document; headings cap at h6; metadata not rendered |
| **Word (.docx)** | All nodes as real Word headings (9 levels) + paragraphs; deeper levels flatten; formatting simplified; no metadata |
| **PDF** | Visual document (title page, contents, index); a picture of the outline, not a data file |
| **LaTeX** | All nodes; 5 sectioning levels, deeper flatten to subparagraph; special characters escaped; no metadata |
| **ePub** | Depth-1 nodes become chapters, everything beneath included; headings cap at h6; no metadata |
| **Website** | A designed artifact. "Comprehensive" content depth carries **every** node (verified); "Overview"/"Standard" summarize deep levels — that's the user's explicit choice in the dialog, not silent loss |
| **Org-mode / TaskPaper / Obsidian / Notion** | All nodes present; formatting flattens to each app's conventions; metadata not carried. Notion toggles verified properly nested |
| **Evernote (.enex)** | One note; hierarchy becomes visual indentation only |
| **FreeMind / XMind** | Full topic tree; content becomes notes; no metadata |
| **CSV** | Every node as a row with Level, Prefix, Name, Path (+ Type, ID, Parent ID, Tags, Color, Completed with "Include metadata") — hierarchy is reconstructible; rich text flattens |
| **JSON tree** | Full hierarchy + content; tags/colors/completion with "Include metadata"; no IDs (use .idm for that) |
| **Slides (Reveal.js)** | By design shows 3 levels (sections → sub-slides → bullets); deeper levels are omitted from the deck |
| **Teleprompter** | Reading script; hierarchy becomes section breaks |
| **Twitter/X thread** | Numbered thread; long items split/truncate at 280 characters with an ellipsis; hierarchy flattens |
| **Podcast / Video / Slide-deck generators** | Creative transformations, not data exports — they *interpret* the outline |

## Fixes shipped with this audit (P7, 2026-09)

- **OPML round-trip no longer silently drops node types, tags, colors, or completion** — the exporter writes them (metadata behind the "Include metadata" checkbox), the importer reads them back.
- **OPML/Markdown re-import no longer buries the outline one level deep** under a duplicate root.
- **OPML items without a name are imported with a warning** instead of silently vanishing with their whole subtree.
- **Markdown re-import keeps empty-named nodes** instead of silently deleting them.
- **Notion export toggles now close correctly** — previously every section after a deep branch got nested inside that branch's collapsible block.
- **Subtree .idm exports detach cleanly** (no dangling parent reference, no copied reserved flags).
- **CSV and JSON-tree honor the "Include metadata (tags, colors)" checkbox** the dialog was already promising.
- **Plain-text re-import strips the numbering prefixes** our own export writes.

## Keeping this honest

When adding or changing an exporter: (1) add/extend its checks in
`tests/export-fidelity/harness.ts`, (2) update this table, (3) never let a speed or
layout optimization drop a node silently. If a format genuinely can't carry
something, that's fine — *say so here*.

# Undo/Redo Audit — IdiamPro
**Date:** 2026-05-27
**Scope:** What undo/redo infrastructure exists today, which actions support it, which don't, and where the gaps matter most given the new natural-language command bar.

## Bottom line (TL;DR)

Some undo infrastructure is present (see Section 1 for details), but coverage is partial. The audit categorizes which actions are protected vs. which would silently destroy work if performed today.

## 1. Infrastructure inventory

### Hook Files
- *(none found)*

### History Stacks
- src/app/api/help-chat/route.ts
- src/ai/flows/generate-outline-from-topic.ts
- src/lib/export/documents/interactive-outline-exporter.ts
- src/app/splash/page.tsx

### Cmd Z Handlers
- src/lib/export/documents/epub-exporter.ts

### Undo Calls
- src/components/content-pane.tsx

### Middleware
- *(none found)*

## 2. State-mutating handlers in outline-pro.tsx

All categorized by user-visible impact. Anything in the "delete", "apply_ai", or "rename" buckets is a potential data-loss vector if undo is missing.

### create (7)
- `handleCreateNode`
- `handleCreateChildNode`
- `handleCreateSiblingNode`
- `handleCreateOutline`
- `handleCreateFromTemplate`
- `handleAddImportedOutline`
- `handleBulkAddTag`

### delete (3)
- `handleDeleteNode`
- `handleDeleteOutline`
- `handleBulkDelete`

### update (5)
- `handleVisibilityChange`
- `handleUpdateNode`
- `handleSearchTermChange`
- `handleImportFileChange`
- `handleBulkChangeColor`

### move (2)
- `handleMoveNode`
- `handleMouseMove`

### apply_ai (8)
- `handleApplyLiveBooks`
- `handleExpandAll`
- `handleExpandAncestors`
- `handleCancelAI`
- `handleExpandContent`
- `handleApplyIngestPreview`
- `handleRefreshGuide`
- `handleAICommand`

### rename (1)
- `handleRenameOutline`

### collapse_expand (6)
- `handleToggleCollapse`
- `handleCollapseAll`
- `handleExpandAll`
- `handleExpandAncestors`
- `handleExpandContent`
- `handleToggleNodeSelection`

### other (44)
- `handlePanelResize`
- `handleBeforeUnload`
- `handleWindowFocus`
- `handleRecoverPendingImport`
- `handleDismissPendingImport`
- `handleKeyDown`
- `handleSelectNode`
- `handleOpenGuide`
- `handleShowWelcome`
- `handleFolderSelected`
- `handleSidebarMouseDown`
- `handleMouseUp`
- `handleSelectOutline`
- `handleCopyOutline`
- `handleAiConsentGranted`
- `handleAiConsentDeclined`
- `handleGenerateOutline`
- `handleGenerateContentForNode`
- `handleGenerateContentForChildren`
- `handleIngestSource`
- `handleUnmerge`
- `handleBulkResearch`
- `handleImportOutline`
- `handleImportAsChapter`
- `handleDuplicateNode`
- `handleExportOutline`
- `handleImportOutlineTrigger`
- `handleOpenSearch`
- `handleCopySubtree`
- `handleCutSubtree`
- `handlePasteSubtree`
- `handleRangeSelect`
- `handleClearSelection`
- `handleSaveToSecondBrain`
- `handleOpenSecondBrain`
- `handleSearchSecondBrain`
- `handleImportToSecondBrain`
- `handleOpenQuickCapture`
- `handleOpenSecondBrainDashboard`
- `handleJumpToSecondBrainNode`
- `handleQuickCapture`
- `handleSecondBrainKeys`
- `handleExportSubtree`
- `handleGeneratePodcast`

## 3. AI-driven apply points (highest-priority for undo)

These are the places where an AI operation actually mutates the user's outline. If undo doesn't cover these, a user who turns off "Confirm Delete" has no safety net.

- src/components/translate-dialog.tsx::handleApply
- src/components/live-books-dialog.tsx::applyApproved
- src/lib/transforms/transform-engine.ts::runTransformPreview
- src/lib/transforms/transform-engine.ts::applyTransformPreview

## 4. Outline-state-update chokepoint analysis

A clean undo implementation works best when ALL state mutations go through a single chokepoint (one function that wraps every change). If they do, adding undo means adding a history-push in one place. If they don't, undo has to be added at every mutation site.

Functions that look like outline-state setters (and how many files call them):

- `saveOutline` — referenced in 1 file(s)
- `updateOutline` — referenced in 1 file(s)

**Likely chokepoint:** `saveOutline` (referenced in 1 files). If this is the single setter the rest of the app calls, undo can be added here once and cover most mutations.

## 5. User-visible consequence — today, without undo

Here is what a user experiences right now for each AI-triggered action, based on this audit:

- **Delete a node via the NL command bar** → Content is gone permanently. No recovery short of "the last save still has it if the user hasn't saved since."
- **Apply a LIVE BOOKS refresh (overwrite mode)** → Original content is replaced with the AI-generated version. No way back to the original unless the user explicitly saved a backup first.
- **Apply a translation to a subtree** → All translated nodes lose their original-language content. No way back.
- **Apply an "Expand with AI" action** → AI-generated body content overwrites the user's existing content. No way back.
- **Delete an outline via the NL command bar** → The whole outline is gone. (May be recoverable from file-system trash if the file backing it has one.)
- **Drag-rearrange nodes** → Structure changes; recovery would require manual re-arrangement.
- **Type into a node body** → Browser-level Cmd+Z usually works within a contenteditable element, but only for character-level edits inside the SAME node — not for structural changes.

## 6. Recommendation

Based on this audit:

**Extend the existing undo infrastructure** to cover the gaps identified above. The work depends on what's actually there — section 1 details the current state.

## 7. What this audit does NOT cover

- **Cross-device sync** — undo on Mac doesn't undo on iPhone. Not addressed here.
- **Time-machine-style outline history** — explicit "view earlier versions" feature. Different from session undo.
- **Undo across app restarts** — most apps reset the undo stack when the app closes. We may want to persist it, but that's a v2 conversation.
- **Performance with large outlines** — undo stacks holding 1000+ entries of large outlines could grow memory. Worth measuring after building.
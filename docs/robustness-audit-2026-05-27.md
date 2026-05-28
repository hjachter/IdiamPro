# Robustness Audit — IdiamPro
**Date:** 2026-05-27
**Scope:** Static pattern scan of `src/` for risky patterns.

## Bottom line
- Total findings: **173**
  - High (raw error shown to user): **0**
  - Medium (could freeze or throw on bad input): **9**
  - Low (silent failures or edge cases): **164**
- Files with explicit error boundaries: **3**
- Top-level Next.js error.tsx handler: **MISSING**

## Category descriptions
- **error-ux (HIGH)** — `{error.message}` rendered raw in JSX; user sees stack-trace-like text.
- **parse-throw (MEDIUM)** — JSON.parse without try/catch; throws on malformed input (corrupt localStorage, mangled API responses).
- **silent-error (LOW)** — console.error with no toast/UI feedback; user sees nothing happen, no idea what went wrong.
- **storage-throw (LOW)** — localStorage.setItem without try/catch; throws on quota exceeded or private browsing.

## Findings by file

### src/app/actions.ts
- **low** / line 144 / `silent-error` — `console.error('Error fetching YouTube title:', error);`
- **low** / line 240 / `silent-error` — `console.error('Error generating outline:', error);`
- **low** / line 254 / `silent-error` — `console.error('Error expanding content:', error);`
- **low** / line 272 / `silent-error` — `console.error('Error suggesting tags:', error);`
- **low** / line 301 / `silent-error` — `console.error('Error refreshing node content:', message);`
- **low** / line 336 / `silent-error` — `console.error('Error translating node content:', message);`
- **low** / line 403 / `silent-error` — `console.error('Error generating content for node:', error);`
- **low** / line 481 / `silent-error` — `console.error('Error ingesting external source:', error);`
- **low** / line 1748 / `silent-error` — `console.error(`[Bullet] Failed to extract from ${source.type}:`, msg);`
- **low** / line 1903 / `silent-error` — `console.error('[Bullet] ❌ Could not save pending result:', saveError);`
- **low** / line 1912 / `silent-error` — `console.error('[Bullet] Error in bullet-based research:', error);`
- **low** / line 1955 / `silent-error` — `console.error(`Failed to extract from source type ${source.type}:`, error instanceof Error ? error.message : error);`
- **low** / line 2147 / `silent-error` — `console.error('Error in bulk research ingest:', error);`
- **low** / line 2189 / `silent-error` — `console.error('Error in transcription:', error);`
- **low** / line 2249 / `silent-error` — `console.error('Error generating image:', error);`
- **low** / line 2298 / `silent-error` — `console.error('Error generating image description:', error);`
- **low** / line 2388 / `silent-error` — `console.error('Error describing image:', error);`
- **low** / line 2411 / `silent-error` — `console.error('Error interpreting command:', message);`

### src/app/api/extract-pdf/route.ts
- **low** / line 117 / `silent-error` — `console.error('PDF extraction error:', error);`

### src/app/api/generate-podcast-script/route.ts
- **low** / line 72 / `silent-error` — `console.error('[Podcast Script] Error:', error);`

### src/app/api/generate-podcast/route.ts
- **low** / line 88 / `silent-error` — `console.error(`[Podcast] TTS failed after ${maxRetries + 1} attempts: ${msg}`);`
- **low** / line 234 / `silent-error` — `console.error('[Podcast] Generation error:', err);`
- **low** / line 252 / `silent-error` — `console.error('[Podcast] Route error:', error);`

### src/app/api/help-chat/route.ts
- **low** / line 187 / `silent-error` — `console.error('Help chat error:', error);`

### src/app/api/knowledge-chat/route.ts
- **low** / line 310 / `silent-error` — `console.error('Knowledge chat error:', error);`

### src/app/api/synthesize-podcast/route.ts
- **low** / line 77 / `silent-error` — `console.error(`[Podcast] TTS failed after ${maxRetries + 1} attempts: ${msg}`);`
- **low** / line 174 / `silent-error` — `console.error('[Podcast TTS] Error:', err);`
- **low** / line 190 / `silent-error` — `console.error('[Podcast TTS] Route error:', error);`

### src/app/stress-test/page.tsx
- **medium** / line 223 / `parse-throw` — `JSON.parse(json);`

### src/components/ai-generate-dialog.tsx
- **low** / line 43 / `storage-throw` — `localStorage.setItem('aiTone', tone);`
- **low** / line 44 / `storage-throw` — `localStorage.setItem('aiLevel', level);`

### src/components/bulk-research-dialog.tsx
- **low** / line 433 / `silent-error` — `console.error('Transcription error:', error);`

### src/components/content-pane.tsx
- **low** / line 475 / `storage-throw` — `localStorage.setItem('idiampro-generate-source', generateSource);`
- **low** / line 481 / `storage-throw` — `localStorage.setItem('idiampro-generate-placement', generatePlacement);`
- **low** / line 487 / `storage-throw` — `localStorage.setItem('idiampro-include-diagram', String(includeDiagram));`
- **low** / line 493 / `storage-throw` — `localStorage.setItem('idiampro-diagram-type', diagramType);`
- **low** / line 1375 / `silent-error` — `console.error('Failed to generate image description:', descError);`
- **low** / line 1394 / `silent-error` — `console.error('Error generating image:', error);`
- **low** / line 1772 / `silent-error` — `console.error('PDF extract API error:', res.status, errBody);`
- **low** / line 1778 / `silent-error` — `console.error('PDF extraction step failed:', err);`
- **low** / line 1817 / `silent-error` — `console.error('AI formatting step failed, inserting raw text:', err);`
- **medium** / line 2743 / `parse-throw` — `const recovered = JSON.parse(jsonMatch[0]);`

### src/components/error-boundary.tsx
- **low** / line 28 / `silent-error` — `console.error('Error caught by boundary:', error, errorInfo);`

### src/components/excalidraw-drawing-canvas.tsx
- **low** / line 65 / `silent-error` — `console.error('Failed to export drawing: no blob returned');`
- **low** / line 69 / `silent-error` — `console.error('Failed to export drawing:', error);`

### src/components/export-dialog.tsx
- **low** / line 149 / `silent-error` — `console.error('Export failed:', error);`

### src/components/file-import-dialog.tsx
- **medium** / line 177 / `parse-throw` — `const outline = JSON.parse(content) as Outline;`
- **low** / line 229 / `silent-error` — `console.error('Import failed:', error);`

### src/components/help-chat-dialog.tsx
- **low** / line 206 / `silent-error` — `console.error('Help chat error:', error);`

### src/components/import-dialog.tsx
- **low** / line 85 / `silent-error` — `console.error('Import failed:', error);`

### src/components/knowledge-chat-dialog.tsx
- **low** / line 304 / `silent-error` — `console.error('Knowledge chat error:', error);`

### src/components/outline-pane.tsx
- **low** / line 764 / `silent-error` — `console.error('Failed to backup outlines:', error);`
- **low** / line 809 / `silent-error` — `console.error('Failed to restore outlines:', error);`

### src/components/outline-pro.tsx
- **low** / line 257 / `storage-throw` — `localStorage.setItem('idiampro-outline-panel-size', sizes[0].toString());`
- **low** / line 404 / `silent-error` — `console.error("Auto-save failed:", error);`
- **low** / line 473 / `silent-error` — `console.error('[Mtime] Error checking file mtime:', error);`
- **low** / line 588 / `silent-error` — `console.error('Failed to load lazy outline on startup:', error);`
- **low** / line 601 / `silent-error` — `console.error("Failed to load data, initializing with guide:", error);`
- **low** / line 633 / `silent-error` — `console.error('[Unmerge] Failed to restore backup:', error);`
- **low** / line 655 / `silent-error` — `console.error('[Pending] Failed to check pending imports:', error);`
- **low** / line 803 / `silent-error` — `console.error('[Pending] Failed to recover import:', error);`
- **low** / line 824 / `silent-error` — `console.error('[Pending] Failed to dismiss import:', error);`
- **low** / line 1322 / `silent-error` — `console.error('Failed to migrate to file system:', error);`
- **low** / line 1361 / `silent-error` — `console.error('Failed to delete outline file:', error);`
- **low** / line 1389 / `storage-throw` — `localStorage.setItem('idiampro-sidebar-width', sidebarWidth.toString());`
- **low** / line 1596 / `silent-error` — `console.error('Error loading lazy outline:', error);`
- **low** / line 1633 / `silent-error` — `console.error('[Mtime] Error checking file mtime:', error);`
- **low** / line 1726 / `storage-throw` — `localStorage.setItem('aiDataConsent', 'granted');`
- **low** / line 2014 / `silent-error` — `console.error(`Failed to generate content for ${descendantNode.name}:`, e);`
- **low** / line 2056 / `silent-error` — `console.error('Failed to generate subtree diagram:', e);`
- **low** / line 2192 / `silent-error` — `console.error('[Unmerge] Failed to delete backup:', err)`
- **low** / line 2264 / `silent-error` — `console.error('[Unmerge] Failed to persist backup:', err)`
- **medium** / line 2638 / `parse-throw` — `const importedData = JSON.parse(text);`
- **medium** / line 2666 / `parse-throw` — `const importedData = JSON.parse(text);`
- **low** / line 3226 / `silent-error` — `console.error('[Unmerge] Failed to persist Second Brain backup:', err)`
- **low** / line 3296 / `silent-error` — `.catch(err => console.error('[Auto-tag] suggestTagsAction failed:', err));`
- **low** / line 3311 / `storage-throw` — `localStorage.setItem('knowledgeChatInitMode', 'secondbrain');`
- **low** / line 3446 / `silent-error` — `.catch(err => console.error('[Quick Capture Auto-tag] suggestTagsAction failed:', err));`

### src/components/podcast-dialog.tsx
- **low** / line 117 / `storage-throw` — `localStorage.setItem(PREF_VOICES, JSON.stringify(allVoices));`
- **low** / line 164 / `storage-throw` — `useEffect(() => { localStorage.setItem(PREF_STYLE, style); }, [style]);`
- **low** / line 165 / `storage-throw` — `useEffect(() => { localStorage.setItem(PREF_LENGTH, length); }, [length]);`
- **low** / line 166 / `storage-throw` — `useEffect(() => { localStorage.setItem(PREF_TTS_MODEL, ttsModel); }, [ttsModel]);`
- **low** / line 490 / `silent-error` — `console.error('Save failed:', err);`
- **low** / line 509 / `silent-error` — `console.error('Share failed:', err);`

### src/components/settings-dialog.tsx
- **low** / line 178 / `storage-throw` — `localStorage.setItem('aiDepth', value);`
- **low** / line 183 / `storage-throw` — `localStorage.setItem('aiProvider', value);`
- **low** / line 188 / `storage-throw` — `localStorage.setItem('ollamaModel', value);`
- **low** / line 198 / `storage-throw` — `localStorage.setItem('requireDestructiveConfirmation', String(checked));`
- **low** / line 203 / `storage-throw` — `localStorage.setItem('requireDestructiveConfirmation', 'false');`
- **low** / line 209 / `storage-throw` — `localStorage.setItem('confirmDelete', String(checked));`
- **low** / line 215 / `storage-throw` — `localStorage.setItem(`apiKey_${provider}`, value.trim());`
- **low** / line 298 / `silent-error` — `console.error('Export failed:', err);`
- **low** / line 335 / `silent-error` — `console.error('Delete failed:', err);`
- **low** / line 417 / `storage-throw` — `localStorage.setItem('aiDataConsent', checked ? 'granted' : 'revoked');`

### src/components/spreadsheet-editor.tsx
- **low** / line 178 / `silent-error` — `console.error('[SpreadsheetEditor] Error saving:', error);`

### src/components/website-export-dialog.tsx
- **low** / line 427 / `silent-error` — `console.error('Export failed:', error);`

### src/contexts/ai-context.tsx
- **low** / line 38 / `silent-error` — `console.error('Failed to save AI plan to storage:', error);`
- **low** / line 49 / `silent-error` — `console.error('Failed to save AI plan to storage:', error);`

### src/lib/electron-storage.ts
- **low** / line 142 / `silent-error` — `console.error('Failed to load outlines:', result.error);`
- **low** / line 166 / `silent-error` — `console.error('Failed to load outline metadata:', result.error);`
- **low** / line 188 / `silent-error` — `console.error('Failed to load single outline:', result.error);`
- **low** / line 368 / `silent-error` — `console.error('[Pending] Failed to delete pending import:', result.error);`
- **low** / line 382 / `silent-error` — `console.error('[Pending] Failed to clear pending imports:', e);`
- **low** / line 426 / `silent-error` — `console.error('[Unmerge] Failed to save backup:', result.error);`
- **low** / line 453 / `silent-error` — `console.error('[Unmerge] Failed to delete backup:', result.error);`

### src/lib/entitlements/index.ts
- **medium** / line 184 / `parse-throw` — `const parsed = JSON.parse(raw) as Partial<UsageRecord>;`

### src/lib/export.ts
- **low** / line 44 / `silent-error` — `console.error('Failed to backup to localStorage:', error);`
- **medium** / line 56 / `parse-throw` — `const backup = JSON.parse(data);`
- **low** / line 62 / `silent-error` — `console.error('Failed to restore from localStorage:', error);`
- **low** / line 200 / `silent-error` — `console.error('Failed to share outline file:', error);`
- **low** / line 236 / `silent-error` — `console.error('Failed to share backup file:', error);`

### src/lib/file-storage.ts
- **low** / line 57 / `silent-error` — `console.error('Failed to get directory handle:', error);`
- **low** / line 157 / `silent-error` — `console.error('Failed to save outline to file:', error);`
- **low** / line 174 / `silent-error` — `console.error('Failed to load outline from file:', error);`
- **low** / line 201 / `silent-error` — `console.error(`Failed to load ${entry.name}:`, error);`
- **low** / line 209 / `silent-error` — `console.error('Failed to load outlines from directory:', error);`
- **low** / line 231 / `silent-error` — `console.error('Failed to delete outline file:', error);`
- **low** / line 269 / `silent-error` — `console.error('Failed to rename outline file:', error);`

### src/lib/media-extractors.ts
- **low** / line 36 / `silent-error` — `console.error('Error extracting PDF from URL:', error);`
- **low** / line 68 / `silent-error` — `console.error('Error extracting PDF from file:', error);`
- **low** / line 170 / `silent-error` — `console.error('Error extracting YouTube transcript:', error);`
- **low** / line 240 / `silent-error` — `console.error('Error extracting text from web URL:', error);`
- **low** / line 280 / `silent-error` — `console.error('Error extracting text from image:', error);`
- **low** / line 328 / `silent-error` — `console.error('Error extracting text from document:', error);`
- **low** / line 377 / `silent-error` — `console.error('Error transcribing audio:', error);`
- **low** / line 426 / `silent-error` — `console.error('Error transcribing video:', error);`

### src/lib/pdf-export.ts
- **low** / line 139 / `silent-error` — `console.error('Failed to render mermaid diagram:', err);`
- **low** / line 368 / `silent-error` — `console.error('Failed to render mermaid for HTML:', err);`
- **low** / line 614 / `silent-error` — `console.error('printToPdf failed:', result.error);`
- **low** / line 621 / `silent-error` — `console.error('PDF generation failed:', err);`
- **low** / line 682 / `silent-error` — `console.error('Failed to share PDF:', error);`

### src/lib/privacy-data.ts
- **low** / line 423 / `silent-error` — `console.error('[Privacy] Failed to load outline list for deletion:', err);`
- **low** / line 431 / `silent-error` — `console.error('[Privacy] Failed to delete outline:', outline.name, err);`

### src/lib/storage-manager.ts
- **low** / line 62 / `silent-error` — `console.error('Error checking file system storage:', error);`
- **low** / line 77 / `silent-error` — `console.error('Failed to load from Electron storage:', error);`
- **low** / line 94 / `silent-error` — `console.error('Failed to load from file system:', error);`
- **low** / line 110 / `silent-error` — `console.error('Failed to load from localStorage:', error);`
- **low** / line 152 / `silent-error` — `console.error(`  ✗ Failed to save repaired outline "${outline.name}":`, error);`
- **low** / line 224 / `silent-error` — `console.error(`  ✗ Failed to save corrected outline "${outline.name}":`, error);`
- **low** / line 257 / `storage-throw` — `localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);`
- **low** / line 260 / `silent-error` — `console.error('Failed to save corrected outlines to localStorage:', error);`
- **medium** / line 267 / `parse-throw` — `const currentOutlineId = savedCurrentOutlineId || (savedData ? JSON.parse(savedData).currentOutlineId || localOutlines[0]?.id || '' : '');`
- **low** / line 288 / `silent-error` — `console.error('Failed to save to Electron storage, falling back to localStorage:', error);`
- **low** / line 304 / `silent-error` — `console.error('Failed to save to file system, falling back to localStorage:', error);`
- **low** / line 321 / `storage-throw` — `localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));`
- **low** / line 323 / `silent-error` — `console.error('Failed to save to localStorage:', error);`
- **low** / line 344 / `silent-error` — `console.error(`🚨 DUPLICATE IDs DETECTED before save: ${duplicates.join(', ')}`);`
- **low** / line 345 / `silent-error` — `console.error('This should not happen - the app may have a bug. Please report this issue.');`
- **low** / line 357 / `storage-throw` — `localStorage.setItem(CURRENT_OUTLINE_KEY, currentOutlineId);`
- **low** / line 389 / `silent-error` — `console.error('Failed to save to Electron storage, falling back to localStorage:', error);`
- **low** / line 406 / `silent-error` — `console.error('Failed to save to file system, falling back to localStorage:', error);`
- **low** / line 416 / `storage-throw` — `localStorage.setItem(LOCAL_STORAGE_KEY, dataToSave);`
- **low** / line 418 / `silent-error` — `console.error('Failed to save to localStorage:', error);`
- **low** / line 433 / `silent-error` — `console.error('Failed to delete from Electron storage, falling back to localStorage:', error);`
- **low** / line 449 / `silent-error` — `console.error('Failed to delete from file system, falling back to localStorage:', error);`
- **medium** / line 457 / `parse-throw` — `const existingData = JSON.parse(savedData);`
- **low** / line 459 / `storage-throw` — `localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(existingData));`
- **low** / line 462 / `silent-error` — `console.error('Failed to delete from localStorage:', error);`
- **low** / line 477 / `silent-error` — `console.error('Failed to rename in Electron storage, falling back to localStorage:', error);`
- **low** / line 493 / `silent-error` — `console.error('Failed to rename in file system, falling back to localStorage:', error);`
- **low** / line 579 / `silent-error` — `console.error('Failed to migrate to Electron storage:', error);`
- **low** / line 643 / `silent-error` — `console.error('Failed to migrate to file system:', error);`
- **low** / line 654 / `silent-error` — `console.error('loadSingleOutlineOnDemand is only available in Electron');`
- **low** / line 666 / `silent-error` — `console.error('Failed to load outline on demand:', error);`
- **low** / line 692 / `silent-error` — `console.error('[Unmerge] Electron save failed, falling back to localStorage:', error);`
- **low** / line 699 / `silent-error` — `console.error('[Unmerge] Failed to save backup to localStorage:', error);`
- **low** / line 713 / `silent-error` — `console.error('[Unmerge] Electron load failed, falling back to localStorage:', error);`
- **low** / line 723 / `silent-error` — `console.error('[Unmerge] Failed to load backup from localStorage:', error);`
- **low** / line 738 / `silent-error` — `console.error('[Unmerge] Electron delete failed, falling back to localStorage:', error);`

### src/lib/use-audio-recorder.ts
- **low** / line 165 / `silent-error` — `console.error('MediaRecorder error:', event);`
- **low** / line 181 / `silent-error` — `console.error('Failed to start recording:', err);`

### src/lib/use-speech-recognition.ts
- **low** / line 142 / `silent-error` — `console.error('Speech recognition start error:', e);`

### src/lib/welcome-outline.ts
- **low** / line 135 / `storage-throw` — `localStorage.setItem('idiampro-welcomed', 'true');`

## What this static audit does NOT catch

- Logic errors on edge inputs (empty strings, huge inputs, Unicode, RTL)
- Race conditions across overlapping operations
- State-corruption bugs that crash later renders
- Missing loading states (UI looks frozen when it's really just slow)
- iOS gesture/keyboard/low-power-mode issues
- Memory leaks in long-running sessions
- Browser/Electron-specific differences

Phase 2 (fix) and Phase 3 (Playwright tests intentionally trying to break things) are where the dynamic issues surface.
/// <reference lib="webworker" />
/**
 * PDF rendering Web Worker.
 *
 * pdfMake's layout + render pass is CPU-bound and SYNCHRONOUS. Running it on
 * the main thread freezes the whole app for large outlines (the reported bug).
 * This worker runs that work off the UI thread so the app stays responsive,
 * the export is cancelable (terminate the worker), and we can show honest
 * progress. It works identically on Safari/WebKit, other browsers, iOS
 * (WKWebView), and Electron — Web Workers are a standard platform feature.
 *
 * The main thread does all DOM-dependent work (parsing TipTap HTML into a
 * pdfMake document definition) and hands this worker a plain, serializable
 * `docDefinition`. The worker only lays out and renders it to bytes.
 */
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';

// Wire up the bundled Roboto fonts. `vfs_fonts` exports `{ vfs }`; fall back to
// the module object itself in case a build exposes the map directly.
(pdfMake as any).vfs =
  ((pdfFonts as any).vfs as { [file: string]: string } | undefined) ||
  (pdfFonts as unknown as { [file: string]: string });

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (e: MessageEvent) => {
  const data = e.data || {};
  if (data.type !== 'render') return;
  const { docDefinition } = data;

  // pdfMake 0.3.x is Promise-based (getBuffer() returns a Promise<Uint8Array>).
  (async () => {
    try {
      const buffer: Uint8Array = await (pdfMake as any).createPdf(docDefinition).getBuffer();
      const u8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
      const ab = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
      // Transfer the ArrayBuffer to avoid a copy.
      ctx.postMessage({ type: 'done', ok: true, buffer: ab }, [ab as ArrayBuffer]);
    } catch (err: any) {
      ctx.postMessage({ type: 'done', ok: false, error: String(err?.message || err) });
    }
  })();
};

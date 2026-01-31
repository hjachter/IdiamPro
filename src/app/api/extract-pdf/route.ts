import { NextRequest, NextResponse } from 'next/server';

// Import pdf-parse lib directly to avoid the debug test code in index.js
// The main index.js runs a test parse when module.parent is undefined (which happens in webpack)
// @ts-ignore - pdf-parse doesn't have proper ESM types
const pdfParse = require('pdf-parse/lib/pdf-parse');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000;

/** Validate that a URL is safe to fetch (no SSRF) */
function isAllowedUrl(urlString: string): { ok: true } | { ok: false; reason: string } {
  let parsed: URL;
  try {
    parsed = new URL(urlString);
  } catch {
    return { ok: false, reason: 'Invalid URL' };
  }

  // Only allow http(s)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, reason: `Disallowed scheme: ${parsed.protocol}` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Block localhost and common loopback names
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '0.0.0.0' || hostname === '[::1]') {
    return { ok: false, reason: 'Loopback addresses are not allowed' };
  }

  // Block private/reserved IP ranges
  const ipv4Match = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const [, a, b] = ipv4Match.map(Number);
    if (a === 10) return { ok: false, reason: 'Private IP range (10.x)' };
    if (a === 172 && b >= 16 && b <= 31) return { ok: false, reason: 'Private IP range (172.16-31.x)' };
    if (a === 192 && b === 168) return { ok: false, reason: 'Private IP range (192.168.x)' };
    if (a === 169 && b === 254) return { ok: false, reason: 'Link-local address (169.254.x)' };
    if (a === 127) return { ok: false, reason: 'Loopback address (127.x)' };
    if (a === 0) return { ok: false, reason: 'Reserved address (0.x)' };
  }

  return { ok: true };
}

/**
 * POST /api/extract-pdf
 *
 * Extract text from PDF via URL or file upload
 *
 * Body (JSON):
 * - { type: 'url', url: string } - Extract from URL
 * - { type: 'file', data: string } - Extract from base64 data URL
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, url, data } = body;

    let buffer: Buffer;

    if (type === 'url') {
      // Fetch PDF from URL
      if (!url) {
        return NextResponse.json(
          { error: 'URL is required for type "url"' },
          { status: 400 }
        );
      }

      // SSRF protection: validate URL scheme and block private/reserved IPs
      const urlCheck = isAllowedUrl(url);
      if (!urlCheck.ok) {
        return NextResponse.json(
          { error: `URL not allowed: ${urlCheck.reason}` },
          { status: 400 }
        );
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

      let response: Response;
      try {
        response = await fetch(url, { signal: controller.signal });
      } finally {
        clearTimeout(timeout);
      }

      if (!response.ok) {
        return NextResponse.json(
          { error: `Failed to fetch PDF: ${response.statusText}` },
          { status: response.status }
        );
      }

      // Enforce size limit before reading body
      const contentLength = Number(response.headers.get('content-length') || '0');
      if (contentLength > MAX_PDF_SIZE) {
        return NextResponse.json(
          { error: `PDF too large (${Math.round(contentLength / 1024 / 1024)}MB). Maximum is 50MB.` },
          { status: 413 }
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_PDF_SIZE) {
        return NextResponse.json(
          { error: `PDF too large. Maximum is 50MB.` },
          { status: 413 }
        );
      }
      buffer = Buffer.from(arrayBuffer);
    } else if (type === 'file') {
      // Extract from base64 data URL
      if (!data) {
        return NextResponse.json(
          { error: 'Data is required for type "file"' },
          { status: 400 }
        );
      }

      // Handle data URL format: data:application/pdf;base64,xxx
      const base64Data = data.includes('base64,')
        ? data.split('base64,')[1]
        : data;

      buffer = Buffer.from(base64Data, 'base64');
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Must be "url" or "file"' },
        { status: 400 }
      );
    }

    // Parse PDF
    const pdfData = await pdfParse(buffer);

    // Return extracted text
    return NextResponse.json({
      success: true,
      text: pdfData.text,
      pages: pdfData.numpages,
      info: pdfData.info,
    });

  } catch (error) {
    console.error('PDF extraction error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      },
      { status: 500 }
    );
  }
}

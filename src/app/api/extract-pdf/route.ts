import { NextRequest, NextResponse } from 'next/server';
import { isAllowedUrl } from '@/lib/security';

// Import pdf-parse lib directly to avoid the debug test code in index.js
// The main index.js runs a test parse when module.parent is undefined (which happens in webpack)
// @ts-ignore - pdf-parse doesn't have proper ESM types
const pdfParse = require('pdf-parse/lib/pdf-parse');

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50 MB
const FETCH_TIMEOUT_MS = 30_000;

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

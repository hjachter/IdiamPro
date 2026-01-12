'use server';

import { YoutubeTranscript } from 'youtube-transcript';

// @ts-ignore - pdf-parse doesn't have proper ESM types
const pdfParse = require('pdf-parse');

/**
 * Extract text content from a PDF URL
 */
export async function extractPdfFromUrl(url: string): Promise<string> {
  try {
    // Fetch PDF from URL
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    // Convert to buffer
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const pdfData = await pdfParse(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('PDF contains no extractable text');
    }

    return pdfData.text;
  } catch (error) {
    console.error('Error extracting PDF from URL:', error);
    throw new Error(`Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text content from a PDF file (base64 data URL or ArrayBuffer)
 */
export async function extractPdfFromFile(data: string | ArrayBuffer): Promise<string> {
  try {
    let buffer: Buffer;

    if (data instanceof ArrayBuffer) {
      // Convert ArrayBuffer to Buffer
      buffer = Buffer.from(data);
    } else {
      // Handle data URL format: data:application/pdf;base64,xxx
      const base64Data = data.includes('base64,')
        ? data.split('base64,')[1]
        : data;
      buffer = Buffer.from(base64Data, 'base64');
    }

    // Parse PDF
    const pdfData = await pdfParse(buffer);

    if (!pdfData.text || pdfData.text.trim().length === 0) {
      throw new Error('PDF contains no extractable text');
    }

    return pdfData.text;
  } catch (error) {
    console.error('Error extracting PDF from file:', error);
    throw new Error(`Failed to extract PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract transcript from a YouTube video URL
 */
export async function extractYoutubeTranscript(url: string): Promise<string> {
  try {
    // Extract video ID from URL
    const videoId = extractYoutubeVideoId(url);
    if (!videoId) {
      throw new Error('Invalid YouTube URL. Could not extract video ID.');
    }

    // Fetch the transcript
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    // Combine transcript items into a single text
    const fullTranscript = transcriptItems
      .map((item: any) => item.text)
      .join(' ')
      .replace(/\[.*?\]/g, '') // Remove speaker labels like [Music]
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();

    return fullTranscript;
  } catch (error) {
    console.error('Error extracting YouTube transcript:', error);
    throw new Error(`Failed to extract YouTube transcript: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract YouTube video ID from various URL formats
 */
function extractYoutubeVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  // If URL is just the video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(url)) {
    return url;
  }

  return null;
}

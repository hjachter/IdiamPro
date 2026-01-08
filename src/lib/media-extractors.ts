'use server';

import { YoutubeTranscript } from 'youtube-transcript';

/**
 * Extract text content from a PDF URL
 * TODO: Implement via Next.js API route with pdf-parse or similar library
 */
export async function extractPdfFromUrl(url: string): Promise<string> {
  // Temporary stub - will implement via API route
  throw new Error('PDF URL import is not yet implemented. Coming soon!');
}

/**
 * Extract text content from a PDF file (base64 data URL or ArrayBuffer)
 * TODO: Implement via Next.js API route with pdf-parse or similar library
 */
export async function extractPdfFromFile(data: string | ArrayBuffer): Promise<string> {
  // Temporary stub - will implement via API route
  throw new Error('PDF file import is not yet implemented. Coming soon!');
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

'use server';

import { YoutubeTranscript } from 'youtube-transcript';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker
if (typeof window === 'undefined') {
  // Server-side: use node canvas for PDF rendering
  pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
}

/**
 * Extract text content from a PDF URL
 */
export async function extractPdfFromUrl(url: string): Promise<string> {
  try {
    // Fetch the PDF
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch PDF: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return extractPdfFromBuffer(arrayBuffer);
  } catch (error) {
    console.error('Error extracting PDF from URL:', error);
    throw new Error(`Failed to extract PDF from URL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text content from a PDF file (base64 data URL or ArrayBuffer)
 */
export async function extractPdfFromFile(data: string | ArrayBuffer): Promise<string> {
  try {
    let arrayBuffer: ArrayBuffer;

    if (typeof data === 'string') {
      // Handle base64 data URL (from FileReader)
      const base64Data = data.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      arrayBuffer = bytes.buffer;
    } else {
      arrayBuffer = data;
    }

    return extractPdfFromBuffer(arrayBuffer);
  } catch (error) {
    console.error('Error extracting PDF from file:', error);
    throw new Error(`Failed to extract PDF from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from PDF ArrayBuffer using pdf.js
 */
async function extractPdfFromBuffer(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Load the PDF document
    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items from the page
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += `\n\n--- Page ${pageNum} ---\n${pageText}`;
    }

    return fullText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF buffer:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

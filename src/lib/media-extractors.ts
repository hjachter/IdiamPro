'use server';

import { YoutubeTranscript } from 'youtube-transcript';
import { ai } from '@/ai/genkit';

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

/**
 * Extract text content from a web URL
 * Uses Gemini to extract and summarize the main content
 */
export async function extractTextFromWebUrl(url: string): Promise<string> {
  try {
    // Fetch the webpage
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch webpage: ${response.statusText}`);
    }

    const html = await response.text();

    // Use Gemini to extract the main content from HTML
    const prompt = `Extract the main text content from this webpage HTML. Remove navigation, ads, footers, and other non-content elements. Return only the meaningful text content that would be useful for research:

${html.substring(0, 50000)}`; // Limit HTML size

    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt,
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No text content could be extracted from the webpage');
    }

    return text;
  } catch (error) {
    console.error('Error extracting text from web URL:', error);
    throw new Error(`Failed to extract text from webpage: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from an image using OCR (via Gemini vision)
 * Supports base64 data URLs or raw base64 strings
 */
export async function extractTextFromImage(data: string): Promise<string> {
  try {
    // Handle data URL format
    let base64Data = data;
    let mimeType = 'image/jpeg'; // default

    if (data.includes('base64,')) {
      const parts = data.split('base64,');
      base64Data = parts[1];
      // Extract mime type from data URL
      const mimeMatch = parts[0].match(/data:([^;]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    }

    // Use Gemini vision to extract text
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Extract all text from this image. Include any visible text, captions, labels, and annotations. If there are diagrams or charts, describe their key information as well.',
      media: {
        url: `data:${mimeType};base64,${base64Data}`,
      },
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the image');
    }

    return text;
  } catch (error) {
    console.error('Error extracting text from image:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text from a document file (Word, Excel, PowerPoint)
 * Uses Gemini's document understanding capabilities
 */
export async function extractTextFromDocument(data: string, fileName: string): Promise<string> {
  try {
    // Handle data URL format
    let base64Data = data;
    let mimeType = 'application/octet-stream';

    if (data.includes('base64,')) {
      const parts = data.split('base64,');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:([^;]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else {
      // Infer mime type from file extension
      if (fileName.endsWith('.docx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else if (fileName.endsWith('.xlsx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      } else if (fileName.endsWith('.pptx')) {
        mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      }
    }

    // Use Gemini to extract text from document
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Extract all text content from this document. Preserve the structure and meaning. Include headings, paragraphs, bullet points, and any important textual information.',
      media: {
        url: `data:${mimeType};base64,${base64Data}`,
      },
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No text could be extracted from the document');
    }

    return text;
  } catch (error) {
    console.error('Error extracting text from document:', error);
    throw new Error(`Failed to extract text from document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transcribe audio file using Gemini
 */
export async function transcribeAudio(data: string, fileName?: string): Promise<string> {
  try {
    // Handle data URL format
    let base64Data = data;
    let mimeType = 'audio/mpeg'; // default

    if (data.includes('base64,')) {
      const parts = data.split('base64,');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:([^;]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else if (fileName) {
      // Infer mime type from file extension
      if (fileName.endsWith('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (fileName.endsWith('.wav')) {
        mimeType = 'audio/wav';
      } else if (fileName.endsWith('.m4a')) {
        mimeType = 'audio/mp4';
      } else if (fileName.endsWith('.ogg')) {
        mimeType = 'audio/ogg';
      }
    }

    // Use Gemini to transcribe audio
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Transcribe this audio file completely. Include all spoken words and important sounds or context.',
      media: {
        url: `data:${mimeType};base64,${base64Data}`,
      },
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No transcription could be generated from the audio');
    }

    return text;
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error(`Failed to transcribe audio: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Transcribe video file using Gemini
 */
export async function transcribeVideo(data: string, fileName?: string): Promise<string> {
  try {
    // Handle data URL format
    let base64Data = data;
    let mimeType = 'video/mp4'; // default

    if (data.includes('base64,')) {
      const parts = data.split('base64,');
      base64Data = parts[1];
      const mimeMatch = parts[0].match(/data:([^;]+);/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
      }
    } else if (fileName) {
      // Infer mime type from file extension
      if (fileName.endsWith('.mp4')) {
        mimeType = 'video/mp4';
      } else if (fileName.endsWith('.mov')) {
        mimeType = 'video/quicktime';
      } else if (fileName.endsWith('.avi')) {
        mimeType = 'video/x-msvideo';
      } else if (fileName.endsWith('.webm')) {
        mimeType = 'video/webm';
      }
    }

    // Use Gemini to transcribe video
    const { text } = await ai.generate({
      model: 'googleai/gemini-1.5-flash',
      prompt: 'Transcribe this video completely. Include all spoken words, describe any important visual information, and provide context about what is happening in the video.',
      media: {
        url: `data:${mimeType};base64,${base64Data}`,
      },
    });

    if (!text || text.trim().length === 0) {
      throw new Error('No transcription could be generated from the video');
    }

    return text;
  } catch (error) {
    console.error('Error transcribing video:', error);
    throw new Error(`Failed to transcribe video: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

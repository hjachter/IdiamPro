'use client';

import type { Outline } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';

/**
 * Export outline to Twitter/X thread format
 * Numbered posts with 280-char limit, breaking long content across tweets
 */
export class TwitterThreadExporter extends BaseExporter {
  formatId = 'twitter-thread';
  mimeType = 'text/plain';
  extension = '.txt';

  private readonly MAX_TWEET_LENGTH = 280;

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: ExportOptions
  ): Promise<ExportResult> {
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const rootNode = nodes[root];
    const title = options?.title || rootNode?.name || outline.name;
    const includeContent = options?.includeContent ?? true;
    const maxDepth = options?.maxDepth;

    const tweets: string[] = [];

    // First tweet: title/hook
    tweets.push(title);

    this.traverseDepthFirst(nodes, root, (node, depth) => {
      if (depth === 0) return; // Root used as first tweet

      let text = node.name;

      if (includeContent && node.content) {
        const content = this.stripHtml(node.content);
        if (content) {
          text += '\n\n' + content;
        }
      }

      // Split into 280-char tweets if needed
      const split = this.splitIntoTweets(text);
      tweets.push(...split);
    }, maxDepth);

    // Number the tweets and format
    const numbered = tweets.map((tweet, i) => {
      const num = `${i + 1}/${tweets.length}`;
      // Ensure room for the numbering
      const maxContent = this.MAX_TWEET_LENGTH - num.length - 1;
      const trimmed = tweet.length > maxContent ? tweet.slice(0, maxContent - 1) + '\u2026' : tweet;
      return `${trimmed}\n${num}`;
    });

    const output = numbered.join('\n\n---\n\n');

    return {
      data: output,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  private splitIntoTweets(text: string): string[] {
    if (text.length <= this.MAX_TWEET_LENGTH - 10) { // Leave room for numbering
      return [text];
    }

    const tweets: string[] = [];
    const sentences = text.split(/(?<=[.!?])\s+/);
    let current = '';

    for (const sentence of sentences) {
      if (current && (current + ' ' + sentence).length > this.MAX_TWEET_LENGTH - 15) {
        tweets.push(current.trim());
        current = sentence;
      } else {
        current = current ? current + ' ' + sentence : sentence;
      }
    }

    if (current.trim()) {
      // If current is still too long, force-split by words
      if (current.length > this.MAX_TWEET_LENGTH - 15) {
        const words = current.split(/\s+/);
        let chunk = '';
        for (const word of words) {
          if (chunk && (chunk + ' ' + word).length > this.MAX_TWEET_LENGTH - 15) {
            tweets.push(chunk.trim());
            chunk = word;
          } else {
            chunk = chunk ? chunk + ' ' + word : word;
          }
        }
        if (chunk.trim()) tweets.push(chunk.trim());
      } else {
        tweets.push(current.trim());
      }
    }

    return tweets;
  }
}

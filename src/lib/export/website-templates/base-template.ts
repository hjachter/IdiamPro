'use client';

import type { OutlineNode } from '@/types';

/**
 * Options passed to website templates
 */
export interface WebsiteTemplateOptions {
  title: string;
  tagline?: string;
  colorScheme: 'auto' | 'light' | 'dark';
  ctaText: string;
  guidance?: string;
  includeContent: boolean;
}

/**
 * Section data extracted from outline
 */
export interface WebsiteSection {
  id: string;
  name: string;
  slug: string;
  content: string;
  children: WebsiteSection[];
  node: OutlineNode;
}

/**
 * Base class for all website templates
 */
export abstract class BaseWebsiteTemplate {
  abstract readonly id: string;
  abstract readonly name: string;

  /**
   * Generate the complete HTML for this template
   */
  abstract generate(
    sections: WebsiteSection[],
    options: WebsiteTemplateOptions
  ): string;

  // ============ Shared Utility Methods ============

  /**
   * Escape HTML special characters
   */
  protected escapeHtml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Create URL-friendly slug from text
   */
  protected slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }

  /**
   * Remove numeric prefixes like "1.", "1.1", etc.
   */
  protected cleanName(name: string): string {
    return name.replace(/^\d+(\.\d+)*\.?\s*/, '').trim();
  }

  /**
   * Strip HTML tags and convert to plain text
   */
  protected stripHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /**
   * Extract first paragraph from HTML content
   */
  protected extractFirstParagraph(content: string): string {
    const text = this.stripHtml(content);
    const firstLine = text.split('\n').find(line => line.trim().length > 10);
    if (firstLine && firstLine.length < 300) {
      return this.escapeHtml(firstLine.trim());
    }
    return '';
  }

  /**
   * Extract list items from HTML content
   */
  protected extractListItems(content: string): string[] {
    const items: string[] = [];
    const matches = content.matchAll(/<li[^>]*>(?:<p>)?([^<]+)(?:<\/p>)?<\/li>/g);
    for (const match of matches) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text) items.push(text);
    }
    return items;
  }

  /**
   * Process HTML content for display (clean up headings, etc.)
   */
  protected processContent(content: string): string {
    return content
      .replace(/<h[1-6][^>]*>/g, '<h4>')
      .replace(/<\/h[1-6]>/g, '</h4>')
      .replace(/class="[^"]*"/g, '')
      .trim();
  }

  /**
   * Get color scheme CSS based on option
   */
  protected getColorSchemeCSS(scheme: 'auto' | 'light' | 'dark'): string {
    const lightVars = `
      --bg: #ffffff;
      --bg-alt: #f8fafc;
      --text: #1e293b;
      --text-muted: #64748b;
      --border: #e2e8f0;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    `;

    const darkVars = `
      --bg: #0f172a;
      --bg-alt: #1e293b;
      --text: #f1f5f9;
      --text-muted: #94a3b8;
      --border: #334155;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    `;

    if (scheme === 'light') {
      return `:root { ${lightVars} }`;
    } else if (scheme === 'dark') {
      return `:root { ${darkVars} }`;
    } else {
      return `
        :root { ${lightVars} }
        @media (prefers-color-scheme: dark) {
          :root { ${darkVars} }
        }
      `;
    }
  }

  /**
   * Get common base CSS variables
   */
  protected getBaseVariables(): string {
    return `
      --primary: #2563eb;
      --primary-dark: #1d4ed8;
      --primary-light: #3b82f6;
      --secondary: #64748b;
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius: 0.75rem;
      --max-width: 1200px;
    `;
  }

  /**
   * Get common reset CSS
   */
  protected getResetCSS(): string {
    return `
      * { box-sizing: border-box; margin: 0; padding: 0; }
      html { scroll-behavior: smooth; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        background: var(--bg);
        color: var(--text);
        line-height: 1.6;
      }
      a { color: var(--primary); text-decoration: none; }
      a:hover { text-decoration: underline; }
      img { max-width: 100%; height: auto; }
    `;
  }

  /**
   * Generate the HTML document wrapper
   */
  protected wrapInDocument(
    title: string,
    description: string,
    styles: string,
    body: string,
    scripts: string = ''
  ): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.escapeHtml(title)}</title>
  <meta name="description" content="${this.escapeHtml(description)}">
  <style>
${styles}
  </style>
</head>
<body>
${body}
${scripts ? `  <script>\n${scripts}\n  </script>` : ''}
</body>
</html>`;
  }
}

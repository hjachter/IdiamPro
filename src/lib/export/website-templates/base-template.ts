'use client';

import type { OutlineNode } from '@/types';

/**
 * Custom color theme configuration
 */
export interface ColorTheme {
  id: string;
  primary?: string;
  secondary?: string;
  bg?: string;
  text?: string;
}

/**
 * Options passed to website templates
 */
export interface WebsiteTemplateOptions {
  title: string;
  tagline?: string;
  colorScheme: 'auto' | 'light' | 'dark';
  colorTheme?: ColorTheme;
  contentDepth?: 'overview' | 'standard' | 'comprehensive';
  toneStyle?: 'professional' | 'friendly' | 'bold' | 'minimal' | 'educational';
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
  protected getColorSchemeCSS(scheme: 'auto' | 'light' | 'dark', colorTheme?: ColorTheme): string {
    // Use custom theme colors if provided
    const customBg = colorTheme?.bg;
    const customText = colorTheme?.text;

    const lightVars = `
      --bg: ${customBg || '#ffffff'};
      --bg-alt: ${customBg ? this.adjustColor(customBg, -8) : '#f8fafc'};
      --text: ${customText || '#1e293b'};
      --text-muted: ${customText ? this.adjustColor(customText, 60) : '#64748b'};
      --border: #e2e8f0;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    `;

    const darkVars = `
      --bg: ${customBg || '#0f172a'};
      --bg-alt: ${customBg ? this.adjustColor(customBg, 15) : '#1e293b'};
      --text: ${customText || '#f1f5f9'};
      --text-muted: ${customText ? this.adjustColor(customText, -60) : '#94a3b8'};
      --border: #334155;
      --shadow: 0 4px 6px -1px rgb(0 0 0 / 0.3);
    `;

    // Determine if the theme is dark based on bg color
    const isDarkTheme = colorTheme?.bg === '#0f172a' || scheme === 'dark';

    if (scheme === 'light' || (colorTheme && !isDarkTheme)) {
      return `:root { ${lightVars} }`;
    } else if (scheme === 'dark' || isDarkTheme) {
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
  protected getBaseVariables(colorTheme?: ColorTheme): string {
    const primary = colorTheme?.primary || '#2563eb';
    const secondary = colorTheme?.secondary || '#64748b';

    // Calculate darker/lighter variants
    const primaryDark = this.adjustColor(primary, -20);
    const primaryLight = this.adjustColor(primary, 20);

    return `
      --primary: ${primary};
      --primary-dark: ${primaryDark};
      --primary-light: ${primaryLight};
      --secondary: ${secondary};
      --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      --radius: 0.75rem;
      --max-width: 1200px;
    `;
  }

  /**
   * Adjust a hex color's brightness
   */
  private adjustColor(hex: string, amount: number): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Parse RGB values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Adjust values
    const newR = Math.max(0, Math.min(255, r + amount));
    const newG = Math.max(0, Math.min(255, g + amount));
    const newB = Math.max(0, Math.min(255, b + amount));

    // Convert back to hex
    return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
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

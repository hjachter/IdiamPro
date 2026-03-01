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

  // ============ Shared Recursive Content Renderer ============

  /**
   * Render a full content tree from sections.
   * Entry point: iterates top-level sections and calls the recursive helper.
   */
  protected renderContentTree(
    sections: WebsiteSection[],
    startDepth: number,
    options: WebsiteTemplateOptions
  ): string {
    return sections
      .map((section, i) => this.renderContentNode(section, startDepth, i, options))
      .join('\n');
  }

  /**
   * Recursively render one section node with heading, content, and children.
   */
  private renderContentNode(
    section: WebsiteSection,
    depth: number,
    index: number,
    options: WebsiteTemplateOptions
  ): string {
    const contentDepth = options.contentDepth || 'overview';
    const headingLevel = Math.min(depth + 2, 6); // h2 at depth 0, h3 at depth 1, ..., h6 at depth 4+
    const tag = `h${headingLevel}`;
    const title = this.cleanName(section.name);

    // Content rendering based on depth
    let contentHtml = '';
    if (contentDepth === 'comprehensive' && section.content) {
      contentHtml = `<div class="ct-content">${this.processContent(section.content)}</div>`;
    } else if (contentDepth === 'standard' && section.content) {
      const firstPara = this.extractFirstParagraph(section.content);
      contentHtml = firstPara ? `<div class="ct-content"><p>${firstPara}</p></div>` : '';
    }

    // Children rendering based on depth
    let childrenHtml = '';
    if (section.children.length > 0) {
      if (contentDepth === 'overview') {
        // Just names for overview
        const visibleChildren = section.children.slice(0, 5);
        const moreCount = section.children.length - 5;
        childrenHtml = `<ul class="ct-child-list">
${visibleChildren.map(c => `          <li>${this.escapeHtml(this.cleanName(c.name))}</li>`).join('\n')}
${moreCount > 0 ? `          <li class="ct-more">+${moreCount} more</li>` : ''}
        </ul>`;
      } else {
        // Full recursive rendering for standard and comprehensive
        childrenHtml = section.children
          .map((child, i) => this.renderContentNode(child, depth + 1, i, options))
          .join('\n');
      }
    }

    return `      <div class="ct-node ct-depth-${depth}" id="${section.slug}">
        <${tag} class="ct-heading">${this.escapeHtml(title)}</${tag}>
        ${contentHtml}
        ${childrenHtml}
      </div>`;
  }

  /**
   * Shared CSS for the recursive content tree.
   * Uses existing CSS variables from each template's theme.
   */
  protected getContentTreeCSS(): string {
    return `
    /* Content Tree - Recursive Section Rendering */
    .content-tree-section {
      padding: 4rem 2rem;
    }
    .content-tree-container {
      max-width: var(--max-width, 1200px);
      margin: 0 auto;
    }
    .content-tree-container > h2 {
      font-size: clamp(1.75rem, 3vw, 2.25rem);
      font-weight: 700;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .content-tree-subtitle {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.05rem;
      margin-bottom: 3rem;
    }
    .ct-node {
      margin-bottom: 1.5rem;
    }
    .ct-depth-0 {
      padding: 2rem;
      background: var(--bg-alt);
      border-radius: var(--radius, 0.75rem);
      margin-bottom: 2rem;
    }
    .ct-depth-1,
    .ct-depth-2,
    .ct-depth-3,
    .ct-depth-4 {
      padding-left: 1.5rem;
      border-left: 3px solid var(--primary);
      margin-left: 0.25rem;
      margin-top: 1rem;
    }
    .ct-depth-2 { border-left-color: var(--secondary, var(--text-muted)); }
    .ct-depth-3,
    .ct-depth-4 { border-left-color: var(--border); }
    h2.ct-heading { font-size: 1.75rem; font-weight: 700; margin-bottom: 0.75rem; text-align: left; }
    h3.ct-heading { font-size: 1.35rem; font-weight: 600; margin-bottom: 0.5rem; }
    h4.ct-heading { font-size: 1.15rem; font-weight: 600; margin-bottom: 0.5rem; }
    h5.ct-heading { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; }
    h6.ct-heading { font-size: 0.95rem; font-weight: 600; margin-bottom: 0.4rem; }
    .ct-content {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1rem;
    }
    .ct-content p { margin-bottom: 0.75rem; }
    .ct-content ul, .ct-content ol { margin-left: 1.5rem; margin-bottom: 0.75rem; }
    .ct-content li { margin-bottom: 0.25rem; }
    .ct-content h4 { font-size: 1rem; font-weight: 600; margin: 1rem 0 0.5rem; color: var(--text); }
    .ct-content blockquote {
      border-left: 3px solid var(--primary);
      padding-left: 1rem;
      margin: 0.75rem 0;
      font-style: italic;
      color: var(--text-muted);
    }
    .ct-content pre {
      background: var(--bg-alt);
      padding: 1rem;
      border-radius: 8px;
      overflow-x: auto;
      margin: 0.75rem 0;
      font-size: 0.9rem;
    }
    .ct-content table {
      width: 100%;
      border-collapse: collapse;
      margin: 0.75rem 0;
      font-size: 0.9rem;
    }
    .ct-content th, .ct-content td {
      padding: 0.5rem 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }
    .ct-content th { font-weight: 600; background: var(--bg-alt); }
    .ct-child-list {
      list-style: none;
      margin: 0.5rem 0 1rem;
    }
    .ct-child-list li {
      padding: 0.3rem 0 0.3rem 1.25rem;
      position: relative;
      color: var(--text-muted);
      font-size: 0.95rem;
    }
    .ct-child-list li::before {
      content: "\\2192";
      position: absolute;
      left: 0;
      color: var(--primary);
    }
    .ct-more {
      font-style: italic;
      color: var(--primary) !important;
    }
    .ct-more::before { content: "" !important; }
    @media (max-width: 768px) {
      .ct-depth-0 { padding: 1.5rem; }
      .ct-depth-1,
      .ct-depth-2,
      .ct-depth-3,
      .ct-depth-4 {
        padding-left: 1rem;
      }
    }
    @media print {
      .ct-depth-0 { break-inside: avoid; }
    }
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

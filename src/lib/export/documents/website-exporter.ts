'use client';

import type { Outline, OutlineNode } from '@/types';
import type { ExportOptions, ExportResult } from '../types';
import { BaseExporter } from '../base-exporter';
import { getWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from '../website-templates';

/**
 * Extended export options for website generation
 */
interface WebsiteExportOptions extends ExportOptions {
  websiteType?: string;
  colorScheme?: 'auto' | 'light' | 'dark';
  ctaText?: string;
  guidance?: string;
}

/**
 * Website Exporter - Generates professional websites from outlines
 *
 * This is IdiamPro's "universal output format" - demonstrating that any outline
 * can be transformed into a polished, standalone website.
 *
 * Supports multiple website types:
 * - Marketing: Product launches, landing pages
 * - Informational: Company info, about pages (Apple.com inspired)
 * - Documentation: User guides, API docs, reference materials
 * - Portfolio: Work samples, case studies (Premium)
 * - Event: Conferences, webinars (Premium)
 * - Educational: Courses, tutorials (Premium)
 * - Blog: Articles, news feeds (Premium)
 * - Personal: CV, personal brand (Premium)
 */
export class WebsiteExporter extends BaseExporter {
  formatId = 'website';
  mimeType = 'text/html';
  extension = '.html';

  async convert(
    outline: Outline,
    rootNodeId?: string,
    options?: WebsiteExportOptions
  ): Promise<ExportResult> {
    const root = rootNodeId || outline.rootNodeId;
    const nodes = outline.nodes;
    const rootNode = nodes[root];
    const title = options?.title || rootNode?.name || outline.name;
    const includeContent = options?.includeContent ?? true;

    // Get the appropriate template
    const templateId = options?.websiteType || 'marketing';
    const template = getWebsiteTemplate(templateId);

    // Extract tagline from root content
    const tagline = this.extractTagline(rootNode?.content || '');

    // Build section tree from outline
    const sections = this.buildSections(nodes, root, includeContent);

    // Prepare template options
    const templateOptions: WebsiteTemplateOptions = {
      title,
      tagline,
      colorScheme: options?.colorScheme || 'auto',
      ctaText: options?.ctaText || 'Get Started',
      guidance: options?.guidance,
      includeContent,
    };

    // Generate the website using the template
    const html = template.generate(sections, templateOptions);

    return {
      data: html,
      filename: this.getSuggestedFilename(outline, rootNodeId),
      mimeType: this.mimeType,
    };
  }

  /**
   * Build section tree from outline nodes
   */
  private buildSections(
    nodes: Record<string, OutlineNode>,
    rootId: string,
    includeContent: boolean
  ): WebsiteSection[] {
    const rootNode = nodes[rootId];
    if (!rootNode || !rootNode.childrenIds) return [];

    return rootNode.childrenIds
      .map(childId => this.buildSection(nodes, childId, includeContent))
      .filter((section): section is WebsiteSection => section !== null);
  }

  /**
   * Recursively build a section from a node
   */
  private buildSection(
    nodes: Record<string, OutlineNode>,
    nodeId: string,
    includeContent: boolean
  ): WebsiteSection | null {
    const node = nodes[nodeId];
    if (!node) return null;

    const children = (node.childrenIds || [])
      .map(childId => this.buildSection(nodes, childId, includeContent))
      .filter((section): section is WebsiteSection => section !== null);

    return {
      id: node.id,
      name: node.name,
      slug: this.slugify(node.name),
      content: includeContent ? (node.content || '') : '',
      children,
      node,
    };
  }

  /**
   * Extract tagline from content (often in italics or quotes)
   */
  private extractTagline(content: string): string {
    // Look for tagline in content (often in italics or quotes)
    const italicMatch = content.match(/<em>"([^"]+)"<\/em>/);
    if (italicMatch) return italicMatch[1];

    const quoteMatch = content.match(/"([^"]+)"/);
    if (quoteMatch) return quoteMatch[1];

    // Fall back to first paragraph if short enough
    const firstP = content.match(/<p>([^<]+)<\/p>/);
    if (firstP && firstP[1].length < 100) return firstP[1];

    return '';
  }

  /**
   * Create URL-friendly slug from text
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
  }
}

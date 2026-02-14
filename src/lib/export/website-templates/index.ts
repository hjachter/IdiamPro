'use client';

import type { BaseWebsiteTemplate, WebsiteSection, WebsiteTemplateOptions } from './base-template';
import { MarketingTemplate } from './marketing-template';
import { InformationalTemplate } from './informational-template';
import { DocumentationTemplate } from './documentation-template';

// Export types
export type { WebsiteSection, WebsiteTemplateOptions } from './base-template';
export { BaseWebsiteTemplate } from './base-template';

// Template registry
const TEMPLATES: Record<string, BaseWebsiteTemplate> = {
  marketing: new MarketingTemplate(),
  informational: new InformationalTemplate(),
  documentation: new DocumentationTemplate(),
  // Premium templates (to be implemented)
  portfolio: new MarketingTemplate(), // Fallback to marketing for now
  event: new MarketingTemplate(),
  educational: new MarketingTemplate(),
  blog: new MarketingTemplate(),
  personal: new MarketingTemplate(),
};

/**
 * Get a website template by ID
 */
export function getWebsiteTemplate(id: string): BaseWebsiteTemplate {
  return TEMPLATES[id] || TEMPLATES.marketing;
}

/**
 * Get all available template IDs
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(TEMPLATES);
}

/**
 * Check if a template exists
 */
export function hasTemplate(id: string): boolean {
  return id in TEMPLATES;
}

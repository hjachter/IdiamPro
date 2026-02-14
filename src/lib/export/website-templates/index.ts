'use client';

import type { BaseWebsiteTemplate, WebsiteSection, WebsiteTemplateOptions } from './base-template';
import { MarketingTemplate } from './marketing-template';
import { InformationalTemplate } from './informational-template';
import { DocumentationTemplate } from './documentation-template';
import { PortfolioTemplate } from './portfolio-template';
import { EventTemplate } from './event-template';
import { EducationalTemplate } from './educational-template';
import { BlogTemplate } from './blog-template';
import { PersonalTemplate } from './personal-template';

// Export types
export type { WebsiteSection, WebsiteTemplateOptions } from './base-template';
export { BaseWebsiteTemplate } from './base-template';

// Template registry - all 8 website types
const TEMPLATES: Record<string, BaseWebsiteTemplate> = {
  // Free templates
  marketing: new MarketingTemplate(),
  informational: new InformationalTemplate(),
  documentation: new DocumentationTemplate(),
  // Premium templates
  portfolio: new PortfolioTemplate(),
  event: new EventTemplate(),
  educational: new EducationalTemplate(),
  blog: new BlogTemplate(),
  personal: new PersonalTemplate(),
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

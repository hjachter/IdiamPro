'use client';

import type { BaseWebsiteTemplate, WebsiteSection, WebsiteTemplateOptions } from './base-template';

// Export types
export type { WebsiteSection, WebsiteTemplateOptions } from './base-template';
export { BaseWebsiteTemplate } from './base-template';

// Lazy template factories — each template is only instantiated on first use
const TEMPLATE_FACTORIES: Record<string, () => BaseWebsiteTemplate> = {
  // Free templates
  marketing: () => new (require('./marketing-template').MarketingTemplate)(),
  informational: () => new (require('./informational-template').InformationalTemplate)(),
  documentation: () => new (require('./documentation-template').DocumentationTemplate)(),
  // Premium templates
  portfolio: () => new (require('./portfolio-template').PortfolioTemplate)(),
  event: () => new (require('./event-template').EventTemplate)(),
  educational: () => new (require('./educational-template').EducationalTemplate)(),
  blog: () => new (require('./blog-template').BlogTemplate)(),
  personal: () => new (require('./personal-template').PersonalTemplate)(),
};

// Cache of instantiated templates
const templateCache: Record<string, BaseWebsiteTemplate> = {};

/**
 * Get a website template by ID (lazy-instantiated)
 */
export function getWebsiteTemplate(id: string): BaseWebsiteTemplate {
  const templateId = id in TEMPLATE_FACTORIES ? id : 'marketing';
  if (!templateCache[templateId]) {
    templateCache[templateId] = TEMPLATE_FACTORIES[templateId]();
  }
  return templateCache[templateId];
}

/**
 * Get all available template IDs
 */
export function getAvailableTemplates(): string[] {
  return Object.keys(TEMPLATE_FACTORIES);
}

/**
 * Check if a template exists
 */
export function hasTemplate(id: string): boolean {
  return id in TEMPLATE_FACTORIES;
}

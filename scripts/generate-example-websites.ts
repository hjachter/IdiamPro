#!/usr/bin/env npx tsx
/**
 * Generate example websites from "The Longevity Blueprint" outline
 * Usage: npx tsx scripts/generate-example-websites.ts
 */

import * as fs from 'fs';
import * as path from 'path';

// Import all templates
import { MarketingTemplate } from '../src/lib/export/website-templates/marketing-template';
import { InformationalTemplate } from '../src/lib/export/website-templates/informational-template';
import { DocumentationTemplate } from '../src/lib/export/website-templates/documentation-template';
import { PortfolioTemplate } from '../src/lib/export/website-templates/portfolio-template';
import { EventTemplate } from '../src/lib/export/website-templates/event-template';
import { EducationalTemplate } from '../src/lib/export/website-templates/educational-template';
import { BlogTemplate } from '../src/lib/export/website-templates/blog-template';
import { PersonalTemplate } from '../src/lib/export/website-templates/personal-template';
import type { WebsiteSection, WebsiteTemplateOptions } from '../src/lib/export/website-templates/base-template';
import type { OutlineNode } from '../src/types';

// Read the original outline
const outlinePath = '/Users/howardjachter/Documents/IDM Outlines/Dave Asprey - Superhuman.idm';
const outline = JSON.parse(fs.readFileSync(outlinePath, 'utf-8'));

// Rename and sanitize content
function sanitizeContent(content: string): string {
  return content
    .replace(/Dave Asprey/g, 'the author')
    .replace(/Asprey's/g, "the author's")
    .replace(/Asprey/g, 'the author')
    .replace(/Bulletproof/g, 'Optimal Living')
    .replace(/daveasprey\.com/g, 'longevityblueprint.example.com')
    .replace(/Super Human/g, 'Longevity Blueprint')
    .replace(/Superhuman/g, 'Longevity Blueprint');
}

// Update outline name
outline.name = 'The Longevity Blueprint';

// Update root node name
const rootNode = outline.nodes[outline.rootNodeId];
rootNode.name = 'The Longevity Blueprint';

// Sanitize all node names and content
for (const nodeId in outline.nodes) {
  const node = outline.nodes[nodeId];
  node.name = sanitizeContent(node.name);
  if (node.content) {
    node.content = sanitizeContent(node.content);
  }
}

// Convert outline nodes to WebsiteSection format
function buildSections(nodeIds: string[], nodes: Record<string, OutlineNode>): WebsiteSection[] {
  const sections: WebsiteSection[] = [];

  for (const nodeId of nodeIds) {
    const node = nodes[nodeId];
    if (!node) continue;

    const section: WebsiteSection = {
      id: node.id,
      name: node.name,
      slug: node.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50),
      content: node.content || '',
      children: node.childrenIds ? buildSections(node.childrenIds, nodes) : [],
      node: node
    };

    sections.push(section);
  }

  return sections;
}

// Get root node children
const sections = buildSections(rootNode.childrenIds || [], outline.nodes);

// Output directory
const outputDir = path.join(process.cwd(), 'public', 'examples');
fs.mkdirSync(outputDir, { recursive: true });

// All templates with their configurations
const templates = [
  { template: new MarketingTemplate(), filename: 'marketing.html' },
  { template: new InformationalTemplate(), filename: 'informational.html' },
  { template: new DocumentationTemplate(), filename: 'documentation.html' },
  { template: new PortfolioTemplate(), filename: 'portfolio.html' },
  { template: new EventTemplate(), filename: 'event.html' },
  { template: new EducationalTemplate(), filename: 'educational.html' },
  { template: new BlogTemplate(), filename: 'blog.html' },
  { template: new PersonalTemplate(), filename: 'personal.html' },
];

// Base options
const baseOptions: WebsiteTemplateOptions = {
  title: 'The Longevity Blueprint',
  tagline: 'Master the science of living longer and healthier',
  colorScheme: 'auto',
  ctaText: 'Start Your Journey',
  guidance: '',
  includeContent: true
};

// Generate each template
for (const { template, filename } of templates) {
  console.log(`Generating ${filename}...`);

  try {
    const html = template.generate(sections, baseOptions);
    const outputPath = path.join(outputDir, filename);
    fs.writeFileSync(outputPath, html);
    console.log(`  ✓ Saved to ${outputPath}`);
  } catch (error) {
    console.error(`  ✗ Error generating ${filename}:`, error);
  }
}

console.log('\nDone! Generated 8 example websites.');

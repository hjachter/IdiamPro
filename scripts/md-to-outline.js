#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Convert markdown file to IdiamPro outline format
 */
function markdownToOutline(markdownPath, outputPath) {
  // Read markdown file
  const markdown = fs.readFileSync(markdownPath, 'utf8');

  // Parse markdown into sections
  const lines = markdown.split('\n');
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Check if it's a header
    const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headerMatch) {
      // Save previous section
      if (currentSection) {
        sections.push(currentSection);
      }

      // Start new section
      const level = headerMatch[1].length;
      const title = headerMatch[2];

      currentSection = {
        level,
        title,
        content: []
      };
    } else if (currentSection) {
      // Add content to current section
      currentSection.content.push(line);
    }
  }

  // Don't forget the last section
  if (currentSection) {
    sections.push(currentSection);
  }

  // Build outline structure
  const nodes = {};
  const rootId = generateId();
  const outlineId = generateId();

  // Create root node (using first H1 as root name)
  const rootTitle = sections[0]?.title || 'Untitled';
  nodes[rootId] = {
    id: rootId,
    name: rootTitle,
    content: '',
    type: 'root',
    parentId: null,
    childrenIds: [],
    prefix: '',
    metadata: {
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
  };

  // Track hierarchy for parent-child relationships
  const levelStack = [{ level: 0, id: rootId }];

  // Process sections (skip first since it became the root)
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const nodeId = generateId();

    // Find parent based on level
    while (levelStack.length > 1 && levelStack[levelStack.length - 1].level >= section.level) {
      levelStack.pop();
    }
    const parentId = levelStack[levelStack.length - 1].id;

    // Join content lines and trim
    const content = section.content.join('\n').trim();

    // Create node
    nodes[nodeId] = {
      id: nodeId,
      name: section.title,
      content: content,
      type: determineNodeType(section.title, content),
      parentId: parentId,
      childrenIds: [],
      prefix: '',
      metadata: {
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
    };

    // Add to parent's children
    nodes[parentId].childrenIds.push(nodeId);

    // Push to stack
    levelStack.push({ level: section.level, id: nodeId });
  }

  // Create outline object
  const outline = {
    id: outlineId,
    name: rootTitle,
    rootNodeId: rootId,
    nodes: nodes,
    lastModified: Date.now()
  };

  // Write to file
  fs.writeFileSync(outputPath, JSON.stringify(outline, null, 2), 'utf8');

  console.log(`✓ Converted ${sections.length} sections to outline`);
  console.log(`✓ Created ${Object.keys(nodes).length} nodes`);
  console.log(`✓ Saved to: ${outputPath}`);

  return outline;
}

/**
 * Generate unique ID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Determine node type based on content
 */
function determineNodeType(title, content) {
  const lowerTitle = title.toLowerCase();

  if (lowerTitle.includes('code') || lowerTitle.includes('implementation')) {
    return 'code';
  }
  if (lowerTitle.includes('phase') || lowerTitle.includes('week')) {
    return 'task';
  }
  if (lowerTitle.includes('pricing') || lowerTitle.includes('metrics')) {
    return 'spreadsheet';
  }
  if (lowerTitle.includes('architecture') || lowerTitle.includes('structure')) {
    return 'document';
  }
  if (lowerTitle.includes('strategy') || lowerTitle.includes('plan')) {
    return 'chapter';
  }

  return 'note';
}

// Run conversion
const inputPath = process.argv[2] || '/Users/howardjachter/Documents/IDM Outlines/IdiamPro-MCP-Plan.md';
const outputPath = process.argv[3] || '/Users/howardjachter/Documents/IDM Outlines/IdiamPro-MCP-Plan.idm';

try {
  markdownToOutline(inputPath, outputPath);
} catch (error) {
  console.error('Error converting markdown:', error.message);
  process.exit(1);
}

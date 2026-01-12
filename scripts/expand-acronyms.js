#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Acronym definitions
const acronyms = {
  'MRR': 'Monthly Recurring Revenue',
  'ARR': 'Annual Recurring Revenue',
  'VC': 'Venture Capital',
  'CAC': 'Customer Acquisition Cost',
  'LTV': 'Lifetime Value',
  'UI': 'User Interface',
  'UX': 'User Experience',
  'API': 'Application Programming Interface',
  'SEO': 'Search Engine Optimization',
  'LLC': 'Limited Liability Company',
  'YC': 'Y Combinator',
  'PM': 'Product Manager',
  'TAM': 'Total Addressable Market',
  'OS': 'Operating System',
  'FTE': 'Full-Time Equivalent',
  'ARPU': 'Average Revenue Per User',
  'TOS': 'Terms of Service',
  'PKM': 'Personal Knowledge Management',
  'PDF': 'Portable Document Format',
  'DMCA': 'Digital Millennium Copyright Act',
  'CRDT': 'Conflict-free Replicated Data Type',
  'CPA': 'Cost Per Acquisition',
};

// Track which acronyms have been expanded
const expanded = new Set();

/**
 * Expand acronyms in text (first occurrence only)
 */
function expandAcronymsInText(text) {
  let modified = text;

  for (const [acronym, expansion] of Object.entries(acronyms)) {
    if (expanded.has(acronym)) continue;

    // Match whole word acronym (not part of another word)
    const regex = new RegExp(`\\b${acronym}\\b`, 'g');
    const matches = text.match(regex);

    if (matches && matches.length > 0) {
      // Replace only the first occurrence
      modified = modified.replace(regex, function(match) {
        if (!expanded.has(acronym)) {
          expanded.add(acronym);
          return `${acronym} (${expansion})`;
        }
        return match;
      });
    }
  }

  return modified;
}

/**
 * Walk outline tree in depth-first order
 */
function walkNodes(nodes, nodeId, callback) {
  const node = nodes[nodeId];
  if (!node) return;

  callback(node);

  // Process children
  for (const childId of node.childrenIds || []) {
    walkNodes(nodes, childId, callback);
  }
}

/**
 * Expand acronyms in outline
 */
function expandAcronymsInOutline(outline) {
  const modifiedNodes = { ...outline.nodes };
  let changeCount = 0;

  // Walk tree from root to maintain document order
  walkNodes(modifiedNodes, outline.rootNodeId, (node) => {
    const originalName = node.name;
    const originalContent = node.content;

    // Expand in node name
    node.name = expandAcronymsInText(node.name);

    // Expand in node content
    node.content = expandAcronymsInText(node.content);

    if (node.name !== originalName || node.content !== originalContent) {
      changeCount++;
    }
  });

  return {
    outline: { ...outline, nodes: modifiedNodes },
    changeCount,
    expandedAcronyms: Array.from(expanded),
  };
}

// Main execution
const inputPath = process.argv[2] || '/Users/howardjachter/Documents/IDM Outlines/IdiamPro Planning.idm';
const outputPath = inputPath; // Overwrite in place

try {
  console.log(`Reading outline from: ${inputPath}`);
  const content = fs.readFileSync(inputPath, 'utf-8');
  const outline = JSON.parse(content);

  console.log(`Expanding acronyms...`);
  const result = expandAcronymsInOutline(outline);

  // Write back to file
  fs.writeFileSync(outputPath, JSON.stringify(result.outline, null, 2), 'utf-8');

  console.log(`✓ Modified ${result.changeCount} nodes`);
  console.log(`✓ Expanded acronyms: ${result.expandedAcronyms.join(', ')}`);
  console.log(`✓ Saved to: ${outputPath}`);

} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}

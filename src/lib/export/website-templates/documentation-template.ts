'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Documentation Website Template
 *
 * Features: Sidebar navigation, table of contents, code blocks, search-friendly
 * Best for: User guides, API docs, reference materials, wikis
 */
export class DocumentationTemplate extends BaseWebsiteTemplate {
  readonly id = 'documentation';
  readonly name = 'Documentation';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const body = `
  <div class="docs-layout">
    <aside class="sidebar">
      <div class="sidebar-header">
        <a href="#" class="sidebar-logo">${this.escapeHtml(options.title)}</a>
      </div>
      <nav class="sidebar-nav">
${this.renderSidebarNav(sections)}
      </nav>
    </aside>

    <main class="docs-main">
      <header class="docs-header">
        <button class="sidebar-toggle" onclick="toggleSidebar()" aria-label="Toggle sidebar">
          <span></span><span></span><span></span>
        </button>
        <h1>${this.escapeHtml(options.title)}</h1>
      </header>

      <div class="docs-content">
${options.tagline ? `        <p class="docs-intro">${this.escapeHtml(options.tagline)}</p>\n` : ''}
${sections.map(section => this.renderSection(section, options, 0)).join('\n\n')}
      </div>

      <footer class="docs-footer">
        <p>Generated with <a href="https://idiampro.com">IdiamPro</a></p>
      </footer>
    </main>
  </div>`;

    return this.wrapInDocument(
      options.title,
      options.tagline || options.title,
      this.getStyles(options),
      body,
      this.getScripts()
    );
  }

  private renderSidebarNav(sections: WebsiteSection[], depth: number = 0): string {
    const items = sections.map(section => {
      const name = this.cleanName(section.name);
      const hasChildren = section.children.length > 0;

      let html = `        <li class="nav-item depth-${depth}">
          <a href="#${section.slug}">${this.escapeHtml(name)}</a>`;

      if (hasChildren && depth < 2) {
        html += `\n          <ul class="nav-sublist">\n`;
        html += section.children.map(child =>
          `            <li><a href="#${child.slug}">${this.escapeHtml(this.cleanName(child.name))}</a></li>`
        ).join('\n');
        html += `\n          </ul>`;
      }

      html += `\n        </li>`;
      return html;
    });

    return `        <ul class="nav-list">\n${items.join('\n')}\n        </ul>`;
  }

  private renderSection(section: WebsiteSection, options: WebsiteTemplateOptions, depth: number): string {
    const sectionName = this.cleanName(section.name);
    const headingLevel = Math.min(depth + 2, 6);
    const headingTag = `h${headingLevel}`;

    let content = '';

    // Section content
    if (options.includeContent && section.content) {
      content += `        <div class="section-content">\n`;
      content += `          ${this.processDocContent(section.content)}\n`;
      content += `        </div>\n`;
    }

    // Child sections
    if (section.children.length > 0) {
      content += section.children.map(child =>
        this.renderSection(child, options, depth + 1)
      ).join('\n\n');
    }

    return `        <section id="${section.slug}" class="doc-section depth-${depth}">
          <${headingTag} class="section-heading">
            <a href="#${section.slug}" class="anchor-link">#</a>
            ${this.escapeHtml(sectionName)}
          </${headingTag}>
${content}        </section>`;
  }

  private processDocContent(content: string): string {
    // Process content for documentation display
    let processed = content;

    // Convert headings to appropriate levels
    processed = processed
      .replace(/<h1[^>]*>/g, '<h4>')
      .replace(/<\/h1>/g, '</h4>')
      .replace(/<h2[^>]*>/g, '<h4>')
      .replace(/<\/h2>/g, '</h4>')
      .replace(/<h3[^>]*>/g, '<h5>')
      .replace(/<\/h3>/g, '</h5>');

    // Clean up classes
    processed = processed.replace(/class="[^"]*"/g, '');

    // Add code block styling hints
    processed = processed.replace(/<pre>/g, '<pre class="code-block">');

    // Add table styling
    processed = processed.replace(/<table>/g, '<div class="table-wrapper"><table>');
    processed = processed.replace(/<\/table>/g, '</table></div>');

    return processed;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --sidebar-width: 280px;
      --header-height: 60px;
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
    ${this.getResetCSS()}

    /* Layout */
    .docs-layout {
      display: flex;
      min-height: 100vh;
    }

    /* Sidebar */
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background: var(--bg-alt);
      border-right: 1px solid var(--border);
      overflow-y: auto;
      z-index: 100;
      transition: transform 0.3s;
    }

    .sidebar-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      position: sticky;
      top: 0;
      background: var(--bg-alt);
    }

    .sidebar-logo {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--text);
      text-decoration: none;
    }

    .sidebar-nav {
      padding: 1rem 0;
    }

    .nav-list {
      list-style: none;
    }

    .nav-item {
      margin-bottom: 0.25rem;
    }

    .nav-item > a {
      display: block;
      padding: 0.5rem 1.5rem;
      color: var(--text);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 500;
      border-left: 3px solid transparent;
      transition: all 0.15s;
    }

    .nav-item > a:hover {
      background: var(--bg);
      border-left-color: var(--primary);
    }

    .nav-item > a.active {
      background: var(--bg);
      border-left-color: var(--primary);
      color: var(--primary);
    }

    .nav-sublist {
      list-style: none;
      margin-top: 0.25rem;
    }

    .nav-sublist li a {
      display: block;
      padding: 0.35rem 1.5rem 0.35rem 2.25rem;
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.15s;
    }

    .nav-sublist li a:hover {
      color: var(--text);
    }

    /* Main Content */
    .docs-main {
      flex: 1;
      margin-left: var(--sidebar-width);
      min-width: 0;
    }

    .docs-header {
      position: sticky;
      top: 0;
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      padding: 1rem 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
      z-index: 50;
    }

    .docs-header h1 {
      font-size: 1.25rem;
      font-weight: 600;
      margin: 0;
    }

    .sidebar-toggle {
      display: none;
      flex-direction: column;
      gap: 4px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
    }

    .sidebar-toggle span {
      display: block;
      width: 20px;
      height: 2px;
      background: var(--text);
    }

    .docs-content {
      max-width: 850px;
      margin: 0 auto;
      padding: 2rem;
    }

    .docs-intro {
      font-size: 1.2rem;
      color: var(--text-muted);
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    /* Sections */
    .doc-section {
      margin-bottom: 3rem;
    }

    .doc-section.depth-0 {
      padding-top: 1rem;
    }

    .doc-section.depth-1 {
      margin-left: 0;
      padding-left: 1rem;
      border-left: 2px solid var(--border);
    }

    .doc-section.depth-2 {
      margin-left: 0;
      padding-left: 1rem;
    }

    .section-heading {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
      scroll-margin-top: calc(var(--header-height) + 1rem);
    }

    h2.section-heading { font-size: 1.75rem; font-weight: 700; }
    h3.section-heading { font-size: 1.4rem; font-weight: 600; }
    h4.section-heading { font-size: 1.15rem; font-weight: 600; }
    h5.section-heading { font-size: 1rem; font-weight: 600; }
    h6.section-heading { font-size: 0.9rem; font-weight: 600; }

    .anchor-link {
      color: var(--text-muted);
      text-decoration: none;
      opacity: 0;
      transition: opacity 0.15s;
      font-weight: 400;
    }

    .section-heading:hover .anchor-link {
      opacity: 1;
    }

    .anchor-link:hover {
      color: var(--primary);
    }

    /* Content Styling */
    .section-content {
      margin-bottom: 1.5rem;
    }

    .section-content p {
      margin-bottom: 1rem;
      line-height: 1.7;
    }

    .section-content ul, .section-content ol {
      margin-left: 1.5rem;
      margin-bottom: 1rem;
    }

    .section-content li {
      margin-bottom: 0.5rem;
      line-height: 1.6;
    }

    .section-content h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-top: 2rem;
      margin-bottom: 0.75rem;
    }

    .section-content h5 {
      font-size: 1rem;
      font-weight: 600;
      margin-top: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .section-content a {
      color: var(--primary);
    }

    .section-content a:hover {
      text-decoration: underline;
    }

    /* Code Blocks */
    .section-content code {
      background: var(--bg-alt);
      padding: 0.2rem 0.4rem;
      border-radius: 0.25rem;
      font-size: 0.9em;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
    }

    .code-block {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      padding: 1rem 1.25rem;
      overflow-x: auto;
      margin-bottom: 1rem;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    .code-block code {
      background: none;
      padding: 0;
    }

    /* Tables */
    .table-wrapper {
      overflow-x: auto;
      margin-bottom: 1rem;
    }

    .section-content table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    .section-content th, .section-content td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    .section-content th {
      background: var(--bg-alt);
      font-weight: 600;
    }

    /* Blockquotes / Notes */
    .section-content blockquote {
      border-left: 4px solid var(--primary);
      margin: 1.5rem 0;
      padding: 1rem 1.5rem;
      background: var(--bg-alt);
      border-radius: 0 0.5rem 0.5rem 0;
    }

    .section-content blockquote p:last-child {
      margin-bottom: 0;
    }

    /* Footer */
    .docs-footer {
      margin-top: 4rem;
      padding: 2rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Mobile */
    @media (max-width: 900px) {
      .sidebar {
        transform: translateX(-100%);
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .docs-main {
        margin-left: 0;
      }

      .sidebar-toggle {
        display: flex;
      }

      .docs-content {
        padding: 1.5rem;
      }
    }

    /* Overlay for mobile sidebar */
    .sidebar-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    }

    .sidebar-overlay.active {
      display: block;
    }

    @media print {
      .sidebar { display: none; }
      .docs-main { margin-left: 0; }
      .docs-header { position: static; }
      .sidebar-toggle { display: none; }
    }
    `;
  }

  private getScripts(): string {
    return `
    // Sidebar toggle for mobile
    function toggleSidebar() {
      const sidebar = document.querySelector('.sidebar');
      const overlay = document.querySelector('.sidebar-overlay');
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    }

    // Create overlay element
    const overlay = document.createElement('div');
    overlay.className = 'sidebar-overlay';
    overlay.onclick = toggleSidebar;
    document.body.appendChild(overlay);

    // Close sidebar on link click (mobile)
    document.querySelectorAll('.sidebar-nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (window.innerWidth <= 900) {
          toggleSidebar();
        }
      });
    });

    // Highlight active section in sidebar
    const sections = document.querySelectorAll('.doc-section');
    const navLinks = document.querySelectorAll('.sidebar-nav a');

    function updateActiveLink() {
      let current = '';
      sections.forEach(section => {
        const sectionTop = section.offsetTop - 100;
        if (window.pageYOffset >= sectionTop) {
          current = section.getAttribute('id');
        }
      });

      navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.getAttribute('href') === '#' + current) {
          link.classList.add('active');
        }
      });
    }

    window.addEventListener('scroll', updateActiveLink);
    updateActiveLink();

    // Smooth scroll with offset
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      });
    });
    `;
  }
}

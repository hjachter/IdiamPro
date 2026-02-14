'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Documentation Website Template
 *
 * Inspired by Stripe Docs, GitBook, ReadTheDocs
 * Features: Persistent sidebar, search-friendly layout, code blocks,
 * section anchors, breadcrumbs, "On this page" TOC
 * Best for: User guides, API docs, reference materials, wikis, manuals
 */
export class DocumentationTemplate extends BaseWebsiteTemplate {
  readonly id = 'documentation';
  readonly name = 'Documentation';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countAllTopics(sections);

    // Group sections into categories for sidebar
    const sidebarGroups = this.createSidebarGroups(sections);

    const body = `
  <div class="docs-layout">
    <!-- SIDEBAR -->
    <aside class="sidebar">
      <div class="sidebar-header">
        <a href="#" class="sidebar-logo">${this.escapeHtml(options.title)}</a>
        <span class="sidebar-version">v1.0</span>
      </div>

      <div class="sidebar-search">
        <input type="text" placeholder="Search docs..." disabled>
        <span class="search-hint">⌘K</span>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <a href="#getting-started" class="nav-item nav-intro">
            <span class="nav-icon">🚀</span>
            Getting Started
          </a>
        </div>

${sidebarGroups.map(group => this.renderSidebarGroup(group)).join('\n')}
      </nav>

      <div class="sidebar-footer">
        <a href="#" class="sidebar-link">📖 Full Guide</a>
        <a href="#" class="sidebar-link">💬 Support</a>
      </div>
    </aside>

    <!-- MAIN CONTENT -->
    <main class="docs-main">
      <div class="docs-topbar">
        <button class="sidebar-toggle" onclick="toggleSidebar()" aria-label="Toggle sidebar">
          <span></span><span></span><span></span>
        </button>
        <div class="breadcrumbs">
          <a href="#">Docs</a>
          <span>/</span>
          <span>${this.escapeHtml(options.title)}</span>
        </div>
      </div>

      <div class="docs-content-wrapper">
        <article class="docs-content">
          <!-- HERO -->
          <header class="docs-hero" id="getting-started">
            <h1>${this.escapeHtml(options.title)}</h1>
            ${options.tagline ? `<p class="docs-intro">${this.escapeHtml(options.tagline)}</p>` : ''}
            <div class="docs-meta">
              <span>📚 ${sections.length} Chapters</span>
              <span>📝 ${totalTopics}+ Topics</span>
              <span>⏱️ Comprehensive Guide</span>
            </div>
          </header>

          <!-- QUICK START -->
          <section class="quick-start">
            <h2>Quick Start</h2>
            <p>Jump to any section below to begin exploring the documentation.</p>
            <div class="quick-links">
${sections.slice(0, 4).map((s, i) => `              <a href="#${s.slug}" class="quick-link">
                <span class="quick-icon">${['📖', '🎯', '⚡', '💡'][i]}</span>
                <span class="quick-text">
                  <strong>${this.escapeHtml(this.cleanName(s.name))}</strong>
                  <span>${s.children.length} topics</span>
                </span>
              </a>`).join('\n')}
            </div>
          </section>

          <!-- MAIN DOCUMENTATION -->
${sections.map((section, i) => this.renderDocSection(section, i, options)).join('\n\n')}

          <!-- FOOTER -->
          <footer class="docs-footer">
            <div class="footer-nav">
              <div class="footer-prev">
                <span>Previous</span>
                <a href="#">Introduction</a>
              </div>
              <div class="footer-next">
                <span>Next</span>
                <a href="#">Getting Started</a>
              </div>
            </div>
            <p class="footer-credit">Generated with <a href="https://idiampro.com">IdiamPro</a></p>
          </footer>
        </article>

        <!-- RIGHT SIDEBAR - ON THIS PAGE -->
        <aside class="docs-toc">
          <div class="toc-sticky">
            <h4>On This Page</h4>
            <ul>
${sections.slice(0, 6).map(s => `              <li><a href="#${s.slug}">${this.escapeHtml(this.cleanName(s.name).slice(0, 30))}</a></li>`).join('\n')}
            </ul>
          </div>
        </aside>
      </div>
    </main>
  </div>

  <div class="sidebar-overlay" onclick="toggleSidebar()"></div>`;

    return this.wrapInDocument(
      options.title,
      options.tagline || options.title,
      this.getStyles(options),
      body,
      this.getScripts()
    );
  }

  private countAllTopics(sections: WebsiteSection[]): number {
    let count = 0;
    for (const section of sections) {
      count += section.children.length;
      count += this.countAllTopics(section.children);
    }
    return count;
  }

  private createSidebarGroups(sections: WebsiteSection[]): { name: string; items: WebsiteSection[] }[] {
    // If sections are numerous, group them; otherwise, flat list
    if (sections.length <= 6) {
      return [{ name: 'Contents', items: sections }];
    }

    // Split into logical groups
    const half = Math.ceil(sections.length / 2);
    return [
      { name: 'Fundamentals', items: sections.slice(0, half) },
      { name: 'Advanced Topics', items: sections.slice(half) }
    ];
  }

  private renderSidebarGroup(group: { name: string; items: WebsiteSection[] }): string {
    return `        <div class="nav-section">
          <h3 class="nav-heading">${this.escapeHtml(group.name)}</h3>
${group.items.map(item => `          <a href="#${item.slug}" class="nav-item">
            ${this.escapeHtml(this.cleanName(item.name))}
          </a>`).join('\n')}
        </div>`;
  }

  private renderDocSection(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const sectionName = this.cleanName(section.name);
    const sectionIcon = ['📖', '🎯', '⚡', '💡', '🔧', '📊', '🧠', '🌟', '💪', '🚀'][index % 10];

    let content = '';

    // Section description
    if (options.includeContent && section.content) {
      content += `            <div class="doc-intro">
              ${this.processDocContent(section.content)}
            </div>\n`;
    }

    // Subsections as cards
    if (section.children.length > 0) {
      content += `            <div class="doc-cards">
${section.children.map(child => `              <div class="doc-card" id="${child.slug}">
                <h4>${this.escapeHtml(this.cleanName(child.name))}</h4>
${options.includeContent && child.content ? `                <div class="card-content">${this.extractFirstParagraph(child.content)}</div>` : ''}
${child.children.length > 0 ? `                <ul class="card-list">
${child.children.slice(0, 3).map(sub => `                  <li>${this.escapeHtml(this.cleanName(sub.name))}</li>`).join('\n')}
${child.children.length > 3 ? `                  <li class="more">+${child.children.length - 3} more</li>` : ''}
                </ul>` : ''}
              </div>`).join('\n')}
            </div>`;
    }

    return `          <section id="${section.slug}" class="doc-section">
            <div class="section-header">
              <span class="section-icon">${sectionIcon}</span>
              <div class="section-title-group">
                <span class="section-num">Chapter ${index + 1}</span>
                <h2>${this.escapeHtml(sectionName)}</h2>
              </div>
            </div>
${content}          </section>`;
  }

  private processDocContent(content: string): string {
    let processed = content;

    // Clean up and format for documentation
    processed = processed
      .replace(/<h1[^>]*>/g, '<h3>')
      .replace(/<\/h1>/g, '</h3>')
      .replace(/<h2[^>]*>/g, '<h4>')
      .replace(/<\/h2>/g, '</h4>')
      .replace(/class="[^"]*"/g, '');

    // Add code block styling
    processed = processed.replace(/<pre>/g, '<pre class="code-block">');

    // Add table wrapper
    processed = processed.replace(/<table>/g, '<div class="table-wrapper"><table>');
    processed = processed.replace(/<\/table>/g, '</table></div>');

    return processed;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --sidebar-width: 280px;
      --toc-width: 200px;
      --header-height: 60px;
      --doc-max-width: 720px;
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
    ${this.getResetCSS()}

    /* LAYOUT */
    .docs-layout {
      display: flex;
      min-height: 100vh;
    }

    /* SIDEBAR */
    .sidebar {
      position: fixed;
      top: 0;
      left: 0;
      bottom: 0;
      width: var(--sidebar-width);
      background: var(--bg-alt);
      border-right: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      z-index: 100;
      transition: transform 0.3s;
    }

    .sidebar-header {
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid var(--border);
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .sidebar-logo {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--text);
      text-decoration: none;
    }

    .sidebar-version {
      font-size: 0.7rem;
      background: var(--primary);
      color: white;
      padding: 0.2rem 0.5rem;
      border-radius: 4px;
      font-weight: 600;
    }

    .sidebar-search {
      padding: 1rem 1.5rem;
      position: relative;
    }

    .sidebar-search input {
      width: 100%;
      padding: 0.6rem 1rem;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
    }

    .sidebar-search input:focus {
      outline: none;
      border-color: var(--primary);
    }

    .search-hint {
      position: absolute;
      right: 1.75rem;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.75rem;
      color: var(--text-muted);
      background: var(--bg-alt);
      padding: 0.2rem 0.4rem;
      border-radius: 4px;
      border: 1px solid var(--border);
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 1rem 0;
    }

    .nav-section {
      margin-bottom: 1.5rem;
    }

    .nav-heading {
      padding: 0.5rem 1.5rem;
      font-size: 0.7rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
    }

    .nav-item {
      display: block;
      padding: 0.6rem 1.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
      text-decoration: none;
      transition: all 0.15s;
      border-left: 3px solid transparent;
    }

    .nav-item:hover {
      background: var(--bg);
      color: var(--text);
    }

    .nav-item.active {
      background: var(--bg);
      border-left-color: var(--primary);
      color: var(--primary);
    }

    .nav-intro {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-weight: 500;
    }

    .nav-icon {
      font-size: 1rem;
    }

    .sidebar-footer {
      padding: 1rem 1.5rem;
      border-top: 1px solid var(--border);
    }

    .sidebar-link {
      display: block;
      padding: 0.4rem 0;
      font-size: 0.85rem;
      color: var(--text-muted);
      text-decoration: none;
    }

    .sidebar-link:hover {
      color: var(--primary);
    }

    /* MAIN CONTENT */
    .docs-main {
      flex: 1;
      margin-left: var(--sidebar-width);
      min-width: 0;
    }

    .docs-topbar {
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

    .breadcrumbs {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .breadcrumbs a {
      color: var(--text-muted);
    }

    .breadcrumbs a:hover {
      color: var(--primary);
    }

    .breadcrumbs span {
      margin: 0 0.5rem;
    }

    .docs-content-wrapper {
      display: flex;
      max-width: calc(var(--doc-max-width) + var(--toc-width) + 6rem);
      margin: 0 auto;
      padding: 0 2rem;
    }

    .docs-content {
      flex: 1;
      max-width: var(--doc-max-width);
      padding: 2rem 0 4rem;
    }

    /* DOCS HERO */
    .docs-hero {
      margin-bottom: 3rem;
      padding-bottom: 2rem;
      border-bottom: 1px solid var(--border);
    }

    .docs-hero h1 {
      font-size: clamp(2rem, 4vw, 2.75rem);
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .docs-intro {
      font-size: 1.15rem;
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }

    .docs-meta {
      display: flex;
      gap: 1.5rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* QUICK START */
    .quick-start {
      background: var(--bg-alt);
      border-radius: 12px;
      padding: 2rem;
      margin-bottom: 3rem;
    }

    .quick-start h2 {
      font-size: 1.25rem;
      margin-bottom: 0.5rem;
    }

    .quick-start > p {
      color: var(--text-muted);
      margin-bottom: 1.5rem;
    }

    .quick-links {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }

    .quick-link {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1rem;
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      text-decoration: none;
      transition: all 0.2s;
    }

    .quick-link:hover {
      border-color: var(--primary);
      transform: translateY(-2px);
      box-shadow: var(--shadow);
    }

    .quick-icon {
      font-size: 1.5rem;
    }

    .quick-text strong {
      display: block;
      color: var(--text);
      margin-bottom: 0.2rem;
    }

    .quick-text span {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* DOC SECTIONS */
    .doc-section {
      margin-bottom: 4rem;
      scroll-margin-top: calc(var(--header-height) + 2rem);
    }

    .section-header {
      display: flex;
      align-items: flex-start;
      gap: 1rem;
      margin-bottom: 1.5rem;
    }

    .section-icon {
      font-size: 2rem;
      line-height: 1;
    }

    .section-title-group {
      flex: 1;
    }

    .section-num {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .section-header h2 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-top: 0.25rem;
    }

    .doc-intro {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 2rem;
    }

    .doc-intro p {
      margin-bottom: 1rem;
    }

    /* DOC CARDS */
    .doc-cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .doc-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 1.5rem;
      transition: all 0.2s;
      scroll-margin-top: calc(var(--header-height) + 2rem);
    }

    .doc-card:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow);
    }

    .doc-card h4 {
      font-size: 1.1rem;
      margin-bottom: 0.75rem;
    }

    .card-content {
      font-size: 0.9rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .card-list {
      list-style: none;
      font-size: 0.85rem;
    }

    .card-list li {
      padding: 0.3rem 0;
      padding-left: 1.25rem;
      position: relative;
      color: var(--text-muted);
    }

    .card-list li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--primary);
    }

    .card-list .more {
      font-style: italic;
      color: var(--primary);
    }

    .card-list .more::before {
      content: "";
    }

    /* CODE BLOCKS */
    .code-block {
      background: #1e293b;
      color: #e2e8f0;
      padding: 1.25rem;
      border-radius: 8px;
      overflow-x: auto;
      font-family: 'SF Mono', Monaco, Consolas, monospace;
      font-size: 0.9rem;
      line-height: 1.5;
      margin: 1rem 0;
    }

    /* TABLE */
    .table-wrapper {
      overflow-x: auto;
      margin: 1rem 0;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.9rem;
    }

    th, td {
      padding: 0.75rem 1rem;
      text-align: left;
      border-bottom: 1px solid var(--border);
    }

    th {
      background: var(--bg-alt);
      font-weight: 600;
    }

    /* RIGHT TOC */
    .docs-toc {
      width: var(--toc-width);
      padding-left: 2rem;
      display: none;
    }

    @media (min-width: 1100px) {
      .docs-toc {
        display: block;
      }
    }

    .toc-sticky {
      position: sticky;
      top: calc(var(--header-height) + 2rem);
    }

    .toc-sticky h4 {
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .toc-sticky ul {
      list-style: none;
    }

    .toc-sticky li {
      margin-bottom: 0.5rem;
    }

    .toc-sticky a {
      font-size: 0.85rem;
      color: var(--text-muted);
      text-decoration: none;
      transition: color 0.15s;
    }

    .toc-sticky a:hover {
      color: var(--primary);
    }

    /* FOOTER */
    .docs-footer {
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
    }

    .footer-nav {
      display: flex;
      justify-content: space-between;
      margin-bottom: 3rem;
    }

    .footer-prev,
    .footer-next {
      font-size: 0.9rem;
    }

    .footer-prev span,
    .footer-next span {
      display: block;
      font-size: 0.75rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }

    .footer-nav a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 500;
    }

    .footer-credit {
      text-align: center;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* OVERLAY */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      z-index: 99;
    }

    .sidebar-overlay.active {
      display: block;
    }

    /* MOBILE */
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

      .docs-content-wrapper {
        padding: 0 1.5rem;
      }

      .quick-links {
        grid-template-columns: 1fr;
      }

      .doc-cards {
        grid-template-columns: 1fr;
      }
    }

    @media print {
      .sidebar { display: none; }
      .docs-toc { display: none; }
      .docs-main { margin-left: 0; }
      .docs-topbar { display: none; }
    }
    `;
  }

  private getScripts(): string {
    return `
    function toggleSidebar() {
      document.querySelector('.sidebar').classList.toggle('open');
      document.querySelector('.sidebar-overlay').classList.toggle('active');
    }

    // Active nav tracking
    const sections = document.querySelectorAll('.doc-section');
    const navLinks = document.querySelectorAll('.nav-item');

    function updateActiveNav() {
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

    window.addEventListener('scroll', updateActiveNav);
    updateActiveNav();

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href.length > 1) {
          const targetId = href.substring(1);
          const target = document.getElementById(targetId);
          if (target) {
            e.preventDefault();
            const headerOffset = 80;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });

            // Close mobile sidebar
            if (window.innerWidth <= 900) {
              toggleSidebar();
            }
          }
        }
      });
    });
    `;
  }
}

'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Informational Website Template
 *
 * Inspired by Apple.com - clean, spacious, sophisticated
 * Features: Clean hierarchy, navigation, large typography, white space
 * Best for: Company info, about pages, corporate sites
 */
export class InformationalTemplate extends BaseWebsiteTemplate {
  readonly id = 'informational';
  readonly name = 'Informational';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const navItems = sections.map(s => ({
      id: s.slug,
      name: this.cleanName(s.name),
    }));

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <button class="nav-toggle" onclick="toggleNav()" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-menu">
${navItems.map(item => `        <li><a href="#${item.id}">${this.escapeHtml(item.name)}</a></li>`).join('\n')}
      </ul>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-content">
      <h1>${this.escapeHtml(options.title)}</h1>
${options.tagline ? `      <p class="tagline">${this.escapeHtml(options.tagline)}</p>` : ''}
    </div>
  </header>

  <main>
${sections.map((section, i) => this.renderSection(section, options, i)).join('\n\n')}
  </main>

  <footer>
    <div class="footer-container">
      <div class="footer-grid">
        <div class="footer-brand">
          <h3>${this.escapeHtml(options.title)}</h3>
${options.tagline ? `          <p>${this.escapeHtml(options.tagline)}</p>` : ''}
        </div>
        <div class="footer-links">
          <h4>Sections</h4>
          <ul>
${navItems.slice(0, 6).map(item => `            <li><a href="#${item.id}">${this.escapeHtml(item.name)}</a></li>`).join('\n')}
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(options.title)}. Generated with <a href="https://idiampro.com">IdiamPro</a>.</p>
      </div>
    </div>
  </footer>`;

    return this.wrapInDocument(
      options.title,
      options.tagline || options.title,
      this.getStyles(options),
      body,
      this.getScripts()
    );
  }

  private renderSection(section: WebsiteSection, options: WebsiteTemplateOptions, index: number): string {
    const sectionName = this.cleanName(section.name);
    const isAlt = index % 2 === 1;
    const layout = this.determineSectionLayout(section);

    let content = '';

    // Section intro/description
    if (options.includeContent && section.content) {
      const intro = this.extractIntroContent(section.content);
      if (intro) {
        content += `      <div class="section-intro">${intro}</div>\n`;
      }
    }

    // Render children based on layout
    if (section.children.length > 0) {
      switch (layout) {
        case 'grid':
          content += this.renderGrid(section.children, options);
          break;
        case 'alternating':
          content += this.renderAlternating(section.children, options);
          break;
        case 'list':
          content += this.renderList(section.children, options);
          break;
        default:
          content += this.renderBlocks(section.children, options);
      }
    }

    return `    <section id="${section.slug}" class="section${isAlt ? ' section-alt' : ''}">
      <div class="section-container">
        <h2 class="section-title">${this.escapeHtml(sectionName)}</h2>
${content}      </div>
    </section>`;
  }

  private determineSectionLayout(section: WebsiteSection): string {
    const childCount = section.children.length;
    const name = section.name.toLowerCase();

    // Specific section types
    if (name.includes('team') || name.includes('people') || name.includes('leadership')) {
      return 'grid';
    }
    if (name.includes('value') || name.includes('principle') || name.includes('mission')) {
      return 'alternating';
    }
    if (name.includes('contact') || name.includes('location') || name.includes('office')) {
      return 'list';
    }

    // Based on child count
    if (childCount >= 4 && childCount <= 8) {
      return 'grid';
    }
    if (childCount <= 3) {
      return 'alternating';
    }
    return 'blocks';
  }

  private extractIntroContent(content: string): string {
    // Get first few paragraphs, cleaned up
    const paragraphs = content.match(/<p>([^<]+)<\/p>/g);
    if (paragraphs && paragraphs.length > 0) {
      const text = paragraphs.slice(0, 2).join(' ')
        .replace(/<\/?p>/g, '')
        .trim();
      if (text.length > 0 && text.length < 500) {
        return `<p>${this.escapeHtml(text)}</p>`;
      }
    }
    return '';
  }

  private renderGrid(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const items = children.map(child => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.extractFirstParagraph(child.content) : '';

      return `        <div class="grid-item">
          <h3>${this.escapeHtml(title)}</h3>
${description ? `          <p>${description}</p>` : ''}
        </div>`;
    });

    return `      <div class="content-grid">\n${items.join('\n')}\n      </div>\n`;
  }

  private renderAlternating(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const items = children.map((child, i) => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.processContent(child.content) : '';
      const isReversed = i % 2 === 1;

      return `        <div class="alternating-item${isReversed ? ' reversed' : ''}">
          <div class="alternating-content">
            <h3>${this.escapeHtml(title)}</h3>
            <div class="alternating-text">${description}</div>
          </div>
          <div class="alternating-visual">
            <div class="visual-placeholder">${this.getVisualIcon(child.name)}</div>
          </div>
        </div>`;
    });

    return `      <div class="alternating-layout">\n${items.join('\n')}\n      </div>\n`;
  }

  private renderBlocks(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const blocks = children.map(child => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.processContent(child.content) : '';

      return `        <div class="content-block">
          <h3>${this.escapeHtml(title)}</h3>
          <div class="block-content">${description}</div>
        </div>`;
    });

    return `      <div class="blocks-layout">\n${blocks.join('\n')}\n      </div>\n`;
  }

  private renderList(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const items = children.map(child => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.extractFirstParagraph(child.content) : '';

      return `        <div class="list-item">
          <h4>${this.escapeHtml(title)}</h4>
${description ? `          <p>${description}</p>` : ''}
        </div>`;
    });

    return `      <div class="list-layout">\n${items.join('\n')}\n      </div>\n`;
  }

  private getVisualIcon(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('mission') || nameLower.includes('vision')) return '🎯';
    if (nameLower.includes('value') || nameLower.includes('principle')) return '💎';
    if (nameLower.includes('team') || nameLower.includes('people')) return '👥';
    if (nameLower.includes('history') || nameLower.includes('story')) return '📖';
    if (nameLower.includes('product') || nameLower.includes('service')) return '✨';
    if (nameLower.includes('global') || nameLower.includes('world')) return '🌍';
    return '◆';
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --max-width: 1100px;
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
    ${this.getResetCSS()}

    /* Navigation - minimal, sophisticated */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(var(--bg-rgb, 255, 255, 255), 0.9);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 1000;
      padding: 1rem 0;
    }

    .nav-container {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-logo {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2.5rem;
    }

    .nav-menu a {
      color: var(--text);
      text-decoration: none;
      font-size: 0.85rem;
      font-weight: 400;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .nav-menu a:hover { opacity: 1; }

    .nav-toggle {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 5px;
    }

    .nav-toggle span {
      display: block;
      width: 20px;
      height: 1.5px;
      background: var(--text);
    }

    @media (max-width: 768px) {
      .nav-toggle { display: flex; }
      .nav-menu {
        display: none;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--bg);
        flex-direction: column;
        padding: 1.5rem 2rem;
        gap: 1rem;
        border-bottom: 1px solid var(--border);
      }
      .nav-menu.active { display: flex; }
    }

    /* Hero - clean, minimal */
    .hero {
      padding: 10rem 2rem 6rem;
      text-align: center;
    }

    .hero-content {
      max-width: 900px;
      margin: 0 auto;
    }

    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      line-height: 1.1;
      margin-bottom: 1.5rem;
    }

    .tagline {
      font-size: clamp(1.1rem, 2vw, 1.4rem);
      color: var(--text-muted);
      font-weight: 400;
      line-height: 1.5;
    }

    /* Sections */
    .section {
      padding: 6rem 2rem;
    }

    .section-alt {
      background: var(--bg-alt);
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section-title {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 600;
      letter-spacing: -0.02em;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .section-intro {
      max-width: 700px;
      margin: 0 auto 4rem;
      text-align: center;
      font-size: 1.1rem;
      line-height: 1.7;
      color: var(--text-muted);
    }

    .section-intro p {
      margin: 0;
    }

    /* Content Grid */
    .content-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 3rem;
    }

    .grid-item {
      text-align: center;
    }

    .grid-item h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      letter-spacing: -0.01em;
    }

    .grid-item p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
    }

    /* Alternating Layout */
    .alternating-layout {
      display: flex;
      flex-direction: column;
      gap: 6rem;
    }

    .alternating-item {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    .alternating-item.reversed {
      direction: rtl;
    }

    .alternating-item.reversed > * {
      direction: ltr;
    }

    .alternating-content h3 {
      font-size: 1.75rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      letter-spacing: -0.02em;
    }

    .alternating-text {
      color: var(--text-muted);
      line-height: 1.7;
    }

    .alternating-text p { margin-bottom: 1rem; }
    .alternating-text ul { margin-left: 1.5rem; margin-bottom: 1rem; }

    .alternating-visual {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .visual-placeholder {
      width: 100%;
      aspect-ratio: 4/3;
      background: var(--bg-alt);
      border-radius: 1rem;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 4rem;
    }

    @media (max-width: 768px) {
      .alternating-item {
        grid-template-columns: 1fr;
        gap: 2rem;
      }
      .alternating-item.reversed {
        direction: ltr;
      }
    }

    /* Blocks Layout */
    .blocks-layout {
      display: flex;
      flex-direction: column;
      gap: 3rem;
    }

    .content-block {
      max-width: 800px;
      margin: 0 auto;
    }

    .content-block h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin-bottom: 1rem;
      letter-spacing: -0.01em;
    }

    .block-content {
      color: var(--text-muted);
      line-height: 1.7;
    }

    .block-content p { margin-bottom: 1rem; }
    .block-content ul, .block-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
    .block-content h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; color: var(--text); }

    /* List Layout */
    .list-layout {
      max-width: 600px;
      margin: 0 auto;
    }

    .list-item {
      padding: 1.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .list-item:last-child {
      border-bottom: none;
    }

    .list-item h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .list-item p {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    /* Footer */
    footer {
      background: var(--bg-alt);
      padding: 4rem 2rem 2rem;
    }

    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .footer-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 4rem;
      margin-bottom: 3rem;
    }

    .footer-brand h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .footer-brand p {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    .footer-links h4 {
      font-size: 0.8rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
      color: var(--text-muted);
    }

    .footer-links ul {
      list-style: none;
    }

    .footer-links li {
      margin-bottom: 0.5rem;
    }

    .footer-links a {
      color: var(--text);
      font-size: 0.9rem;
      opacity: 0.8;
    }

    .footer-links a:hover {
      opacity: 1;
    }

    .footer-bottom {
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      text-align: center;
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    @media (max-width: 640px) {
      .hero { padding: 8rem 1.5rem 4rem; }
      .section { padding: 4rem 1.5rem; }
      .footer-grid { grid-template-columns: 1fr; gap: 2rem; }
    }

    @media print {
      .navbar { display: none; }
      .hero { padding-top: 2rem; }
    }
    `;
  }

  private getScripts(): string {
    return `
    function toggleNav() {
      document.querySelector('.nav-menu').classList.toggle('active');
    }

    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelector('.nav-menu').classList.remove('active');
      });
    });

    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          const headerOffset = 70;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      });
    });
    `;
  }
}

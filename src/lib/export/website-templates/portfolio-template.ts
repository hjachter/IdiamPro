'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Portfolio/Showcase Website Template
 *
 * Features: Visual galleries, project cards, filterable grid, minimal text
 * Best for: Work samples, case studies, creative showcases, photography
 */
export class PortfolioTemplate extends BaseWebsiteTemplate {
  readonly id = 'portfolio';
  readonly name = 'Portfolio';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    // Extract all projects from sections (flatten one level)
    const projects = this.extractProjects(sections);
    const categories = this.extractCategories(sections);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#work">Work</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact">Contact</a></li>
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
    <section id="work" class="section">
      <div class="section-container">
${categories.length > 1 ? this.renderFilters(categories) : ''}
        <div class="project-grid">
${projects.map(project => this.renderProjectCard(project, options)).join('\n')}
        </div>
      </div>
    </section>

${this.renderAboutSection(sections, options)}
${this.renderContactSection(options)}
  </main>

  <footer>
    <div class="footer-content">
      <p>&copy; ${new Date().getFullYear()} ${this.escapeHtml(options.title)}. Generated with <a href="https://idiampro.com">IdiamPro</a>.</p>
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

  private extractProjects(sections: WebsiteSection[]): WebsiteSection[] {
    const projects: WebsiteSection[] = [];
    for (const section of sections) {
      if (section.children.length > 0) {
        projects.push(...section.children);
      } else {
        projects.push(section);
      }
    }
    return projects;
  }

  private extractCategories(sections: WebsiteSection[]): string[] {
    return sections
      .filter(s => s.children.length > 0)
      .map(s => this.cleanName(s.name));
  }

  private renderFilters(categories: string[]): string {
    return `        <div class="filters">
          <button class="filter-btn active" data-filter="all">All</button>
${categories.map(cat => `          <button class="filter-btn" data-filter="${this.slugify(cat)}">${this.escapeHtml(cat)}</button>`).join('\n')}
        </div>\n`;
  }

  private renderProjectCard(project: WebsiteSection, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(project.name);
    const description = options.includeContent ? this.extractFirstParagraph(project.content) : '';
    const category = project.node.parentId ? this.slugify(project.node.parentId) : 'all';

    return `          <div class="project-card" data-category="${category}">
            <div class="project-image">
              <span class="project-placeholder">${this.getProjectIcon(title)}</span>
            </div>
            <div class="project-info">
              <h3>${this.escapeHtml(title)}</h3>
${description ? `              <p>${description}</p>` : ''}
            </div>
          </div>`;
  }

  private renderAboutSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    // Look for an "about" section in the outline
    const aboutSection = sections.find(s =>
      s.name.toLowerCase().includes('about') ||
      s.name.toLowerCase().includes('bio')
    );

    const content = aboutSection && options.includeContent
      ? this.processContent(aboutSection.content)
      : `<p>Creative professional showcasing selected works.</p>`;

    return `
    <section id="about" class="section section-alt">
      <div class="section-container">
        <h2>About</h2>
        <div class="about-content">
          ${content}
        </div>
      </div>
    </section>`;
  }

  private renderContactSection(options: WebsiteTemplateOptions): string {
    return `
    <section id="contact" class="section">
      <div class="section-container">
        <h2>Get in Touch</h2>
        <p class="contact-intro">Interested in working together? Let's connect.</p>
        <a href="mailto:hello@example.com" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
      </div>
    </section>`;
  }

  private getProjectIcon(name: string): string {
    const icons = ['🎨', '📷', '🎬', '✏️', '🖼️', '📐', '🎭', '💡'];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return icons[hash % icons.length];
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
    ${this.getResetCSS()}

    /* Navigation */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(10px);
      z-index: 1000;
      padding: 1rem 0;
    }

    @media (prefers-color-scheme: dark) {
      .navbar { background: rgba(15,23,42,0.95); }
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
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--text);
      text-decoration: none;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2rem;
    }

    .nav-menu a {
      color: var(--text);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--primary); }

    /* Hero */
    .hero {
      padding: 10rem 2rem 6rem;
      text-align: center;
    }

    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }

    .tagline {
      font-size: 1.25rem;
      color: var(--text-muted);
    }

    /* Sections */
    .section {
      padding: 5rem 2rem;
    }

    .section-alt {
      background: var(--bg-alt);
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section h2 {
      font-size: 2rem;
      font-weight: 600;
      margin-bottom: 2rem;
      text-align: center;
    }

    /* Filters */
    .filters {
      display: flex;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 3rem;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 2rem;
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-btn:hover, .filter-btn.active {
      background: var(--primary);
      border-color: var(--primary);
      color: white;
    }

    /* Project Grid */
    .project-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
    }

    .project-card {
      background: var(--bg);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
      transition: transform 0.3s, box-shadow 0.3s;
      cursor: pointer;
    }

    .project-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--shadow-lg);
    }

    .project-card.hidden {
      display: none;
    }

    .project-image {
      aspect-ratio: 4/3;
      background: var(--bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .project-placeholder {
      font-size: 4rem;
    }

    .project-info {
      padding: 1.5rem;
    }

    .project-info h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .project-info p {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
    }

    /* About */
    .about-content {
      max-width: 700px;
      margin: 0 auto;
      text-align: center;
      line-height: 1.8;
    }

    .about-content p {
      margin-bottom: 1rem;
    }

    /* Contact */
    #contact {
      text-align: center;
    }

    .contact-intro {
      color: var(--text-muted);
      margin-bottom: 2rem;
      font-size: 1.1rem;
    }

    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border-radius: var(--radius);
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
    }

    /* Footer */
    footer {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
    }

    @media (max-width: 640px) {
      .hero { padding: 8rem 1.5rem 4rem; }
      .section { padding: 3rem 1.5rem; }
      .project-grid { grid-template-columns: 1fr; }
      .nav-menu { display: none; }
    }
    `;
  }

  private getScripts(): string {
    return `
    // Filter functionality
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter;

        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        document.querySelectorAll('.project-card').forEach(card => {
          if (filter === 'all' || card.dataset.category === filter) {
            card.classList.remove('hidden');
          } else {
            card.classList.add('hidden');
          }
        });
      });
    });

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
    `;
  }
}

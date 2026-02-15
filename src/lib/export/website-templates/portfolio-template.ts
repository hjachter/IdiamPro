'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Portfolio/Showcase Website Template
 *
 * Inspired by Behance, Dribbble, Awwwards
 * Features: Visual-first project grid, case study layout, hover effects,
 * filterable categories, project spotlights
 * Best for: Work samples, case studies, creative showcases, photography
 */
export class PortfolioTemplate extends BaseWebsiteTemplate {
  readonly id = 'portfolio';
  readonly name = 'Portfolio';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    // Treat top sections as categories/projects
    const projects = this.extractProjects(sections);
    const categories = this.extractCategories(sections);
    const featuredProjects = projects.slice(0, 3);
    const totalWorks = this.countAllChildren(sections);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#work">Work</a></li>
        <li><a href="#about">About</a></li>
        <li><a href="#contact" class="nav-cta">${this.escapeHtml(options.ctaText)}</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero">
    <div class="hero-content">
      <h1>${this.escapeHtml(options.title)}</h1>
      <p class="hero-tagline">${options.tagline ? this.escapeHtml(options.tagline) : 'A collection of selected works'}</p>
      <div class="hero-stats">
        <div class="stat">
          <span class="stat-num">${projects.length}</span>
          <span class="stat-label">Projects</span>
        </div>
        <div class="stat">
          <span class="stat-num">${totalWorks}+</span>
          <span class="stat-label">Topics</span>
        </div>
        <div class="stat">
          <span class="stat-num">${categories.length}</span>
          <span class="stat-label">Categories</span>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- FEATURED WORK -->
    <section class="section section-featured">
      <div class="section-container">
        <div class="featured-header">
          <h2>Featured Work</h2>
          <a href="#work" class="view-all">View all →</a>
        </div>
        <div class="featured-grid">
${featuredProjects.map((project, i) => this.renderFeaturedCard(project, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- ALL WORK -->
    <section id="work" class="section section-work">
      <div class="section-container">
        <div class="work-header">
          <h2>All Work</h2>
          <div class="filters">
            <button class="filter-btn active" data-filter="all">All</button>
${categories.map(cat => `            <button class="filter-btn" data-filter="${this.slugify(cat)}">${this.escapeHtml(cat)}</button>`).join('\n')}
          </div>
        </div>
        <div class="work-grid">
${projects.map((project, i) => this.renderProjectCard(project, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- PROCESS / APPROACH -->
    <section class="section section-process">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">My Approach</span>
          <h2>How I Work</h2>
        </div>
        <div class="process-grid">
          <div class="process-step">
            <span class="step-num">01</span>
            <h3>Research</h3>
            <p>Deep dive into the subject matter to understand the landscape and opportunities.</p>
          </div>
          <div class="process-step">
            <span class="step-num">02</span>
            <h3>Strategy</h3>
            <p>Develop a clear framework and structure to organize complex information.</p>
          </div>
          <div class="process-step">
            <span class="step-num">03</span>
            <h3>Creation</h3>
            <p>Craft detailed content with attention to clarity and actionability.</p>
          </div>
          <div class="process-step">
            <span class="step-num">04</span>
            <h3>Refinement</h3>
            <p>Iterate and polish until every piece delivers maximum value.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ABOUT -->
    <section id="about" class="section section-about">
      <div class="section-container">
        <div class="about-grid">
          <div class="about-visual">
            <div class="about-avatar">📚</div>
          </div>
          <div class="about-content">
            <span class="section-eyebrow">About</span>
            <h2>The Story Behind</h2>
            <p>${options.tagline ? this.escapeHtml(options.tagline) : 'This collection represents deep exploration and careful curation of knowledge.'}</p>
            <p>Each project in this portfolio represents hours of research, analysis, and synthesis to create comprehensive guides that deliver real value.</p>
            <div class="about-stats">
              <div class="about-stat">
                <span class="stat-value">${projects.length}</span>
                <span class="stat-name">Projects</span>
              </div>
              <div class="about-stat">
                <span class="stat-value">${totalWorks}+</span>
                <span class="stat-name">Topics Covered</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT -->
    <section id="contact" class="section section-contact">
      <div class="section-container">
        <div class="contact-box">
          <span class="section-eyebrow">Get in Touch</span>
          <h2>Let's Work Together</h2>
          <p>Interested in collaborating or learning more about these projects?</p>
          <a href="mailto:hello@example.com" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <div class="footer-content">
        <p>© ${new Date().getFullYear()} ${this.escapeHtml(options.title)}. Generated with <a href="https://idiampro.com">IdiamPro</a>.</p>
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

  private countAllChildren(sections: WebsiteSection[]): number {
    let count = 0;
    for (const section of sections) {
      count += section.children.length;
      for (const child of section.children) {
        count += child.children.length;
      }
    }
    return count;
  }

  private renderFeaturedCard(project: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(project.name);
    const icons = ['🎯', '⚡', '💡', '🔥', '✨', '🚀'];
    const description = options.includeContent && project.content
      ? this.extractFirstParagraph(project.content).slice(0, 150)
      : `Explore ${project.children.length} topics`;

    return `          <article class="featured-card">
            <div class="featured-image">
              <span class="featured-icon">${icons[index % icons.length]}</span>
            </div>
            <div class="featured-content">
              <span class="featured-label">Featured</span>
              <h3>${this.escapeHtml(title)}</h3>
              <p>${description}${description.length >= 150 ? '...' : ''}</p>
              <a href="#${project.slug}" class="featured-link">View Project →</a>
            </div>
          </article>`;
  }

  private renderProjectCard(project: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(project.name);
    const icons = ['📖', '🎯', '⚡', '💡', '🔧', '📊', '🧠', '🌟'];
    const topicCount = project.children.length;
    const category = project.node.parentId
      ? this.slugify(this.cleanName(project.node.parentId))
      : 'general';

    return `          <article class="project-card" data-category="${category}" id="${project.slug}">
            <div class="project-image">
              <span class="project-icon">${icons[index % icons.length]}</span>
            </div>
            <div class="project-info">
              <h3>${this.escapeHtml(title)}</h3>
              <span class="project-meta">${topicCount} topics</span>
            </div>
            <div class="project-overlay">
              <span class="overlay-icon">↗</span>
            </div>
          </article>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables(options.colorTheme)}
      --max-width: 1200px;
    }
    ${this.getColorSchemeCSS(options.colorScheme, options.colorTheme)}
    ${this.getResetCSS()}

    /* NAV */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--bg);
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
      font-weight: 700;
      font-size: 1.5rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2rem;
      align-items: center;
    }

    .nav-menu a {
      color: var(--text);
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--primary); }

    .nav-cta {
      background: var(--text);
      color: var(--bg) !important;
      padding: 0.6rem 1.25rem;
      border-radius: 6px;
      font-weight: 500;
    }

    @media (max-width: 768px) {
      .nav-menu { display: none; }
    }

    /* HERO */
    .hero {
      padding: 12rem 2rem 6rem;
      text-align: center;
    }

    .hero-content {
      max-width: 700px;
      margin: 0 auto;
    }

    .hero h1 {
      font-size: clamp(3rem, 8vw, 5.5rem);
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.04em;
      margin-bottom: 1.5rem;
    }

    .hero-tagline {
      font-size: 1.35rem;
      color: var(--text-muted);
      margin-bottom: 3rem;
    }

    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 4rem;
    }

    .stat {
      text-align: center;
    }

    .stat-num {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* SECTIONS */
    .section {
      padding: 6rem 2rem;
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section-header {
      text-align: center;
      margin-bottom: 4rem;
    }

    .section-eyebrow {
      display: block;
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-bottom: 0.75rem;
    }

    .section-header h2 {
      font-size: 2.5rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    /* FEATURED */
    .section-featured {
      background: var(--bg-alt);
    }

    .featured-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
    }

    .featured-header h2 {
      font-size: 2rem;
      font-weight: 700;
    }

    .view-all {
      color: var(--primary);
      font-weight: 500;
      text-decoration: none;
    }

    .featured-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 2rem;
    }

    .featured-card {
      background: var(--bg);
      border-radius: 16px;
      overflow: hidden;
      transition: all 0.3s;
    }

    .featured-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--shadow-lg);
    }

    .featured-image {
      height: 220px;
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .featured-icon {
      font-size: 5rem;
    }

    .featured-content {
      padding: 2rem;
    }

    .featured-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    .featured-content h3 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0.5rem 0 0.75rem;
    }

    .featured-content p {
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1rem;
    }

    .featured-link {
      color: var(--primary);
      font-weight: 500;
      text-decoration: none;
    }

    /* WORK */
    .work-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
      flex-wrap: wrap;
      gap: 1.5rem;
    }

    .work-header h2 {
      font-size: 2rem;
      font-weight: 700;
    }

    .filters {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .filter-btn {
      padding: 0.5rem 1.25rem;
      border: 1px solid var(--border);
      border-radius: 50px;
      background: var(--bg);
      color: var(--text);
      font-size: 0.9rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .filter-btn:hover {
      border-color: var(--text);
    }

    .filter-btn.active {
      background: var(--text);
      border-color: var(--text);
      color: var(--bg);
    }

    .work-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .project-card {
      position: relative;
      background: var(--bg-alt);
      border-radius: 12px;
      overflow: hidden;
      cursor: pointer;
      transition: all 0.3s;
    }

    .project-card:hover {
      transform: scale(1.02);
    }

    .project-card.hidden {
      display: none;
    }

    .project-image {
      aspect-ratio: 4/3;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .project-icon {
      font-size: 4rem;
    }

    .project-info {
      padding: 1.25rem;
    }

    .project-info h3 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .project-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .project-overlay {
      position: absolute;
      inset: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      transition: opacity 0.3s;
    }

    .project-card:hover .project-overlay {
      opacity: 1;
    }

    .overlay-icon {
      font-size: 2rem;
      color: white;
    }

    /* PROCESS */
    .section-process {
      background: var(--bg-alt);
    }

    .process-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
    }

    .process-step {
      text-align: center;
      padding: 2rem 1.5rem;
    }

    .step-num {
      display: block;
      font-size: 3rem;
      font-weight: 800;
      color: var(--primary);
      opacity: 0.2;
      margin-bottom: 1rem;
    }

    .process-step h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .process-step p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
    }

    @media (max-width: 900px) {
      .process-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    @media (max-width: 600px) {
      .process-grid {
        grid-template-columns: 1fr;
      }
    }

    /* ABOUT */
    .about-grid {
      display: grid;
      grid-template-columns: 1fr 1.5fr;
      gap: 4rem;
      align-items: center;
    }

    .about-visual {
      display: flex;
      justify-content: center;
    }

    .about-avatar {
      width: 250px;
      height: 250px;
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 6rem;
    }

    .about-content h2 {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0.5rem 0 1.5rem;
    }

    .about-content p {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1rem;
      font-size: 1.1rem;
    }

    .about-stats {
      display: flex;
      gap: 3rem;
      margin-top: 2rem;
    }

    .about-stat {
      text-align: center;
    }

    .stat-value {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
    }

    .stat-name {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    @media (max-width: 768px) {
      .about-grid {
        grid-template-columns: 1fr;
        text-align: center;
      }
      .about-avatar { width: 180px; height: 180px; font-size: 4rem; }
      .about-stats { justify-content: center; }
    }

    /* CONTACT */
    .section-contact {
      text-align: center;
    }

    .contact-box {
      background: var(--bg-alt);
      border-radius: 24px;
      padding: 5rem 3rem;
      max-width: 700px;
      margin: 0 auto;
    }

    .contact-box h2 {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0.5rem 0 1rem;
    }

    .contact-box p {
      color: var(--text-muted);
      font-size: 1.15rem;
      margin-bottom: 2rem;
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--text);
      color: var(--bg);
    }

    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
    }

    .btn-lg {
      padding: 1.25rem 2.5rem;
      font-size: 1.1rem;
    }

    /* FOOTER */
    footer {
      padding: 3rem 2rem;
      border-top: 1px solid var(--border);
    }

    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .footer-content {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    footer a { color: var(--primary); }

    @media print {
      .navbar { display: none; }
      .hero { padding-top: 2rem; }
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
          }
        }
      });
    });

    // Animate on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.featured-card, .project-card, .process-step').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.5s, transform 0.5s';
      observer.observe(el);
    });
    `;
  }
}

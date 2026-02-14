'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Personal/Resume Website Template
 *
 * Features: Bio section, skills display, experience timeline, contact info
 * Best for: CV, personal brand, about me pages, professional profiles
 */
export class PersonalTemplate extends BaseWebsiteTemplate {
  readonly id = 'personal';
  readonly name = 'Personal';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#about">About</a></li>
        <li><a href="#experience">Experience</a></li>
        <li><a href="#skills">Skills</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-content">
      <div class="avatar">${this.getInitials(options.title)}</div>
      <h1>${this.escapeHtml(options.title)}</h1>
${options.tagline ? `      <p class="tagline">${this.escapeHtml(options.tagline)}</p>` : ''}
      <div class="social-links">
        <a href="#contact" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
      </div>
    </div>
  </header>

  <main>
${this.renderAboutSection(sections, options)}
${this.renderExperienceSection(sections, options)}
${this.renderSkillsSection(sections, options)}
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

  private getInitials(name: string): string {
    return name
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private renderAboutSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const aboutSection = sections.find(s =>
      s.name.toLowerCase().includes('about') ||
      s.name.toLowerCase().includes('bio') ||
      s.name.toLowerCase().includes('summary')
    );

    const content = aboutSection && options.includeContent
      ? this.processContent(aboutSection.content)
      : '<p>Professional with experience in various fields.</p>';

    return `
    <section id="about" class="section">
      <div class="section-container">
        <h2>About Me</h2>
        <div class="about-content">
          ${content}
        </div>
      </div>
    </section>`;
  }

  private renderExperienceSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const experienceSection = sections.find(s =>
      s.name.toLowerCase().includes('experience') ||
      s.name.toLowerCase().includes('work') ||
      s.name.toLowerCase().includes('career') ||
      s.name.toLowerCase().includes('history')
    );

    if (!experienceSection) {
      // Try to find any section with children that could be experience items
      const fallbackSection = sections.find(s => s.children.length > 0);
      if (!fallbackSection) {
        return `
    <section id="experience" class="section section-alt">
      <div class="section-container">
        <h2>Experience</h2>
        <p class="section-intro">Experience details coming soon.</p>
      </div>
    </section>`;
      }
      return this.renderTimelineSection('Experience', fallbackSection.children, options);
    }

    const items = experienceSection.children.length > 0
      ? experienceSection.children
      : [experienceSection];

    return this.renderTimelineSection('Experience', items, options);
  }

  private renderTimelineSection(title: string, items: WebsiteSection[], options: WebsiteTemplateOptions): string {
    return `
    <section id="experience" class="section section-alt">
      <div class="section-container">
        <h2>${title}</h2>
        <div class="timeline">
${items.map(item => `          <div class="timeline-item">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <h3>${this.escapeHtml(this.cleanName(item.name))}</h3>
${options.includeContent && item.content ? `              <div class="timeline-description">${this.processContent(item.content)}</div>` : ''}
            </div>
          </div>`).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderSkillsSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const skillsSection = sections.find(s =>
      s.name.toLowerCase().includes('skill') ||
      s.name.toLowerCase().includes('expertise') ||
      s.name.toLowerCase().includes('competenc') ||
      s.name.toLowerCase().includes('capabilit')
    );

    if (!skillsSection) {
      return `
    <section id="skills" class="section">
      <div class="section-container">
        <h2>Skills</h2>
        <p class="section-intro">Skills details coming soon.</p>
      </div>
    </section>`;
    }

    // Get skills from children or extract from content
    const skills = skillsSection.children.length > 0
      ? skillsSection.children.map(s => this.cleanName(s.name))
      : this.extractListItems(skillsSection.content);

    // Group skills into categories if they're nested
    const hasCategories = skillsSection.children.some(c => c.children.length > 0);

    if (hasCategories) {
      return `
    <section id="skills" class="section">
      <div class="section-container">
        <h2>Skills</h2>
        <div class="skills-categories">
${skillsSection.children.map(category => `          <div class="skill-category">
            <h3>${this.escapeHtml(this.cleanName(category.name))}</h3>
            <div class="skill-tags">
${category.children.map(skill => `              <span class="skill-tag">${this.escapeHtml(this.cleanName(skill.name))}</span>`).join('\n')}
            </div>
          </div>`).join('\n')}
        </div>
      </div>
    </section>`;
    }

    return `
    <section id="skills" class="section">
      <div class="section-container">
        <h2>Skills</h2>
        <div class="skill-tags">
${skills.map(skill => `          <span class="skill-tag">${this.escapeHtml(skill)}</span>`).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderContactSection(options: WebsiteTemplateOptions): string {
    return `
    <section id="contact" class="section section-alt">
      <div class="section-container">
        <h2>Get in Touch</h2>
        <p class="section-intro">Interested in working together? I'd love to hear from you.</p>
        <div class="contact-actions">
          <a href="mailto:hello@example.com" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
        </div>
      </div>
    </section>`;
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
      background: var(--bg);
      border-bottom: 1px solid var(--border);
      z-index: 1000;
      padding: 0.75rem 0;
    }

    .nav-container {
      max-width: 900px;
      margin: 0 auto;
      padding: 0 2rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-logo {
      font-weight: 700;
      font-size: 1.1rem;
      color: var(--text);
      text-decoration: none;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2rem;
    }

    .nav-menu a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--text); }

    /* Hero */
    .hero {
      padding: 10rem 2rem 5rem;
      text-align: center;
    }

    .avatar {
      width: 120px;
      height: 120px;
      background: linear-gradient(135deg, var(--primary), var(--primary-dark));
      border-radius: 50%;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .tagline {
      font-size: 1.25rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .btn {
      display: inline-block;
      padding: 0.875rem 1.75rem;
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

    /* Sections */
    .section {
      padding: 5rem 2rem;
    }

    .section-alt {
      background: var(--bg-alt);
    }

    .section-container {
      max-width: 800px;
      margin: 0 auto;
    }

    .section h2 {
      font-size: 1.75rem;
      font-weight: 700;
      margin-bottom: 2rem;
      text-align: center;
    }

    .section-intro {
      text-align: center;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    /* About */
    .about-content {
      max-width: 700px;
      margin: 0 auto;
      line-height: 1.8;
    }

    .about-content p {
      margin-bottom: 1rem;
    }

    /* Timeline */
    .timeline {
      position: relative;
      padding-left: 2rem;
    }

    .timeline::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border);
    }

    .timeline-item {
      position: relative;
      padding-bottom: 2rem;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-marker {
      position: absolute;
      left: -2rem;
      top: 0.25rem;
      width: 12px;
      height: 12px;
      background: var(--primary);
      border-radius: 50%;
      transform: translateX(-5px);
    }

    .timeline-content h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .timeline-description {
      color: var(--text-muted);
      line-height: 1.6;
    }

    .timeline-description p {
      margin-bottom: 0.5rem;
    }

    .timeline-description ul {
      margin-left: 1.5rem;
    }

    /* Skills */
    .skills-categories {
      display: grid;
      gap: 2rem;
    }

    .skill-category h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      color: var(--text-muted);
    }

    .skill-tags {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      justify-content: center;
    }

    .skill-category .skill-tags {
      justify-content: flex-start;
    }

    .skill-tag {
      background: var(--bg-alt);
      border: 1px solid var(--border);
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .skill-tag:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    /* Contact */
    .contact-actions {
      text-align: center;
    }

    /* Footer */
    footer {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
    }

    @media (max-width: 768px) {
      .nav-menu { display: none; }
      .hero { padding: 8rem 1.5rem 4rem; }
      .avatar { width: 100px; height: 100px; font-size: 2rem; }
    }
    `;
  }

  private getScripts(): string {
    return `
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
          const offset = 70;
          const pos = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: pos, behavior: 'smooth' });
        }
      });
    });
    `;
  }
}

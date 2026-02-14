'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Event Website Template
 *
 * Features: Date/time display, speaker cards, schedule/agenda, registration CTA
 * Best for: Conferences, webinars, meetups, product launches
 */
export class EventTemplate extends BaseWebsiteTemplate {
  readonly id = 'event';
  readonly name = 'Event';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const navItems = ['About', 'Schedule', 'Speakers', 'Register'];

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
${navItems.map(item => `        <li><a href="#${item.toLowerCase()}">${item}</a></li>`).join('\n')}
      </ul>
      <a href="#register" class="nav-cta">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-content">
      <div class="event-badge">Upcoming Event</div>
      <h1>${this.escapeHtml(options.title)}</h1>
${options.tagline ? `      <p class="tagline">${this.escapeHtml(options.tagline)}</p>` : ''}
      <div class="event-meta">
        <span class="event-date">📅 Date TBD</span>
        <span class="event-location">📍 Location TBD</span>
      </div>
      <a href="#register" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </header>

  <main>
${this.renderAboutSection(sections, options)}
${this.renderScheduleSection(sections, options)}
${this.renderSpeakersSection(sections, options)}
${this.renderRegisterSection(options)}
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

  private renderAboutSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const aboutSection = sections.find(s =>
      s.name.toLowerCase().includes('about') ||
      s.name.toLowerCase().includes('overview') ||
      s.name.toLowerCase().includes('description')
    ) || sections[0];

    const content = aboutSection && options.includeContent
      ? this.processContent(aboutSection.content)
      : '<p>Join us for an exciting event.</p>';

    const highlights = aboutSection?.children.slice(0, 4) || [];

    return `
    <section id="about" class="section">
      <div class="section-container">
        <h2>About the Event</h2>
        <div class="about-content">
          ${content}
        </div>
${highlights.length > 0 ? `        <div class="highlights-grid">
${highlights.map(h => `          <div class="highlight">
            <span class="highlight-icon">${this.getHighlightIcon(h.name)}</span>
            <h3>${this.escapeHtml(this.cleanName(h.name))}</h3>
            <p>${this.extractFirstParagraph(h.content) || ''}</p>
          </div>`).join('\n')}
        </div>` : ''}
      </div>
    </section>`;
  }

  private renderScheduleSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const scheduleSection = sections.find(s =>
      s.name.toLowerCase().includes('schedule') ||
      s.name.toLowerCase().includes('agenda') ||
      s.name.toLowerCase().includes('program')
    );

    if (!scheduleSection) {
      return `
    <section id="schedule" class="section section-alt">
      <div class="section-container">
        <h2>Schedule</h2>
        <p class="section-intro">Full schedule coming soon.</p>
      </div>
    </section>`;
    }

    const items = scheduleSection.children.length > 0
      ? scheduleSection.children
      : [scheduleSection];

    return `
    <section id="schedule" class="section section-alt">
      <div class="section-container">
        <h2>Schedule</h2>
        <div class="schedule-list">
${items.map((item, i) => `          <div class="schedule-item">
            <div class="schedule-time">${this.extractTime(item.name) || `Session ${i + 1}`}</div>
            <div class="schedule-content">
              <h3>${this.escapeHtml(this.cleanName(item.name))}</h3>
              <p>${options.includeContent ? this.extractFirstParagraph(item.content) : ''}</p>
            </div>
          </div>`).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderSpeakersSection(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const speakersSection = sections.find(s =>
      s.name.toLowerCase().includes('speaker') ||
      s.name.toLowerCase().includes('presenter') ||
      s.name.toLowerCase().includes('panelist') ||
      s.name.toLowerCase().includes('team')
    );

    if (!speakersSection || speakersSection.children.length === 0) {
      return `
    <section id="speakers" class="section">
      <div class="section-container">
        <h2>Speakers</h2>
        <p class="section-intro">Speaker lineup coming soon.</p>
      </div>
    </section>`;
    }

    return `
    <section id="speakers" class="section">
      <div class="section-container">
        <h2>Speakers</h2>
        <div class="speakers-grid">
${speakersSection.children.map(speaker => `          <div class="speaker-card">
            <div class="speaker-avatar">${this.getInitials(speaker.name)}</div>
            <h3>${this.escapeHtml(this.cleanName(speaker.name))}</h3>
            <p class="speaker-title">${options.includeContent ? this.extractFirstParagraph(speaker.content) : ''}</p>
          </div>`).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderRegisterSection(options: WebsiteTemplateOptions): string {
    return `
    <section id="register" class="section section-cta">
      <div class="section-container">
        <h2>Register Now</h2>
        <p class="section-intro">Don't miss out. Secure your spot today.</p>
        <a href="#" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
      </div>
    </section>`;
  }

  private getHighlightIcon(name: string): string {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('network')) return '🤝';
    if (nameLower.includes('learn')) return '📚';
    if (nameLower.includes('workshop')) return '🔧';
    if (nameLower.includes('keynote')) return '🎤';
    if (nameLower.includes('panel')) return '💬';
    if (nameLower.includes('demo')) return '💻';
    return '✨';
  }

  private extractTime(name: string): string | null {
    const timeMatch = name.match(/\d{1,2}:\d{2}(?:\s*(?:AM|PM))?/i);
    return timeMatch ? timeMatch[0] : null;
  }

  private getInitials(name: string): string {
    return this.cleanName(name)
      .split(' ')
      .map(word => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --accent: #8b5cf6;
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
      padding: 0.75rem 0;
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
      color: var(--text);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .nav-cta {
      background: var(--primary);
      color: white;
      padding: 0.5rem 1.25rem;
      border-radius: var(--radius);
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      padding: 10rem 2rem 6rem;
      text-align: center;
      color: white;
    }

    .event-badge {
      display: inline-block;
      background: rgba(255,255,255,0.2);
      padding: 0.5rem 1rem;
      border-radius: 2rem;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }

    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4rem);
      font-weight: 800;
      margin-bottom: 1rem;
    }

    .tagline {
      font-size: 1.25rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .event-meta {
      display: flex;
      justify-content: center;
      gap: 2rem;
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

    .btn-lg {
      padding: 1.25rem 2.5rem;
      font-size: 1.1rem;
    }

    .btn-primary {
      background: white;
      color: var(--primary);
    }

    .hero .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }

    /* Sections */
    .section {
      padding: 5rem 2rem;
    }

    .section-alt {
      background: var(--bg-alt);
    }

    .section-cta {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      color: white;
      text-align: center;
    }

    .section-cta .btn-primary {
      background: white;
      color: var(--primary);
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section h2 {
      font-size: 2.25rem;
      font-weight: 700;
      margin-bottom: 1.5rem;
      text-align: center;
    }

    .section-intro {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .section-cta .section-intro {
      color: rgba(255,255,255,0.9);
    }

    /* About */
    .about-content {
      max-width: 800px;
      margin: 0 auto 3rem;
      text-align: center;
      line-height: 1.8;
    }

    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
    }

    .highlight {
      text-align: center;
      padding: 1.5rem;
    }

    .highlight-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }

    .highlight h3 {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
    }

    .highlight p {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Schedule */
    .schedule-list {
      max-width: 800px;
      margin: 0 auto;
    }

    .schedule-item {
      display: flex;
      gap: 2rem;
      padding: 1.5rem 0;
      border-bottom: 1px solid var(--border);
    }

    .schedule-time {
      min-width: 100px;
      font-weight: 600;
      color: var(--primary);
    }

    .schedule-content h3 {
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .schedule-content p {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Speakers */
    .speakers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 2rem;
    }

    .speaker-card {
      text-align: center;
      padding: 2rem 1rem;
    }

    .speaker-avatar {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 50%;
      margin: 0 auto 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      font-weight: 700;
      color: white;
    }

    .speaker-card h3 {
      font-size: 1.1rem;
      margin-bottom: 0.25rem;
    }

    .speaker-title {
      color: var(--text-muted);
      font-size: 0.9rem;
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
      .nav-menu, .nav-cta { display: none; }
      .hero { padding: 8rem 1.5rem 4rem; }
      .event-meta { flex-direction: column; gap: 0.5rem; }
      .schedule-item { flex-direction: column; gap: 0.5rem; }
      .schedule-time { min-width: auto; }
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
          const offset = 80;
          const pos = target.getBoundingClientRect().top + window.pageYOffset - offset;
          window.scrollTo({ top: pos, behavior: 'smooth' });
        }
      });
    });
    `;
  }
}

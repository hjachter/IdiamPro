'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Event Website Template
 *
 * Inspired by top conference sites (Apple WWDC, Google I/O, TED)
 * Features: Countdown/date prominence, speaker cards, schedule timeline,
 * highlight reel, registration CTA
 * Best for: Conferences, webinars, meetups, product launches, workshops
 */
export class EventTemplate extends BaseWebsiteTemplate {
  readonly id = 'event';
  readonly name = 'Event';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countTopics(sections);

    // Extract key sections for event structure
    const highlightsSections = sections.slice(0, 4);
    const speakerSection = sections.slice(4, 8);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#about">About</a></li>
        <li><a href="#highlights">Highlights</a></li>
        <li><a href="#schedule">Schedule</a></li>
        <li><a href="#speakers">Speakers</a></li>
      </ul>
      <a href="#register" class="nav-cta">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero">
    <div class="hero-bg"></div>
    <div class="hero-content">
      <div class="event-badge">Featured Event</div>
      <h1>${this.escapeHtml(options.title)}</h1>
      <p class="hero-tagline">${options.tagline ? this.escapeHtml(options.tagline) : 'Join us for this transformative experience'}</p>
      <div class="event-info">
        <div class="info-item">
          <span class="info-icon">📅</span>
          <div class="info-text">
            <span class="info-label">Date</span>
            <span class="info-value">Coming Soon</span>
          </div>
        </div>
        <div class="info-item">
          <span class="info-icon">📍</span>
          <div class="info-text">
            <span class="info-label">Location</span>
            <span class="info-value">Virtual & In-Person</span>
          </div>
        </div>
        <div class="info-item">
          <span class="info-icon">📚</span>
          <div class="info-text">
            <span class="info-label">Topics</span>
            <span class="info-value">${totalTopics}+ Sessions</span>
          </div>
        </div>
      </div>
      <a href="#register" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </header>

  <main>
    <!-- ABOUT -->
    <section id="about" class="section section-about">
      <div class="section-container">
        <div class="about-grid">
          <div class="about-content">
            <span class="section-eyebrow">About the Event</span>
            <h2>What to Expect</h2>
            <p>${options.tagline ? this.escapeHtml(options.tagline) : 'A comprehensive exploration of key topics.'}</p>
            <p>This event brings together ${sections.length} comprehensive chapters covering ${totalTopics}+ essential topics, designed to transform your understanding and deliver actionable insights.</p>
          </div>
          <div class="about-stats">
            <div class="stat-card">
              <span class="stat-num">${sections.length}</span>
              <span class="stat-label">Chapters</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">${totalTopics}+</span>
              <span class="stat-label">Topics</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">100%</span>
              <span class="stat-label">Actionable</span>
            </div>
            <div class="stat-card">
              <span class="stat-num">∞</span>
              <span class="stat-label">Insights</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- HIGHLIGHTS -->
    <section id="highlights" class="section section-highlights">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Key Takeaways</span>
          <h2>Event Highlights</h2>
          <p class="section-desc">Discover the core themes you'll explore</p>
        </div>
        <div class="highlights-grid">
${highlightsSections.map((section, i) => this.renderHighlight(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- SCHEDULE -->
    <section id="schedule" class="section section-schedule">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Program</span>
          <h2>Event Schedule</h2>
          <p class="section-desc">A structured journey through all topics</p>
        </div>
        <div class="schedule-timeline">
${sections.map((section, i) => this.renderScheduleItem(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- SPEAKERS / TOPICS -->
    <section id="speakers" class="section section-speakers">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Featured</span>
          <h2>Key Topics</h2>
          <p class="section-desc">Deep dives into essential subjects</p>
        </div>
        <div class="speakers-grid">
${speakerSection.map((section, i) => this.renderSpeakerCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- REGISTER -->
    <section id="register" class="section section-register">
      <div class="section-container">
        <div class="register-box">
          <span class="section-eyebrow">Join Us</span>
          <h2>Secure Your Spot</h2>
          <p>Be part of this transformative experience. Access ${sections.length} chapters and ${totalTopics}+ topics.</p>
          <a href="#" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
          <div class="register-features">
            <span>✓ Full Access</span>
            <span>✓ All Topics</span>
            <span>✓ Resources Included</span>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <div class="footer-content">
        <h3>${this.escapeHtml(options.title)}</h3>
        <div class="footer-links">
          <a href="#about">About</a>
          <a href="#highlights">Highlights</a>
          <a href="#schedule">Schedule</a>
          <a href="#register">Register</a>
        </div>
        <p class="footer-credit">© ${new Date().getFullYear()} ${this.escapeHtml(options.title)}. Generated with <a href="https://idiampro.com">IdiamPro</a>.</p>
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

  private countTopics(sections: WebsiteSection[]): number {
    let count = 0;
    for (const section of sections) {
      count += section.children.length;
      for (const child of section.children) {
        count += child.children.length;
      }
    }
    return count;
  }

  private renderHighlight(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const icons = ['🎯', '⚡', '💡', '🔥'];
    const title = this.cleanName(section.name);
    const description = options.includeContent && section.content
      ? this.extractFirstParagraph(section.content).slice(0, 100)
      : `${section.children.length} topics covered`;

    return `          <div class="highlight-card">
            <span class="highlight-icon">${icons[index % icons.length]}</span>
            <h3>${this.escapeHtml(title)}</h3>
            <p>${description}${description.length >= 100 ? '...' : ''}</p>
          </div>`;
  }

  private renderScheduleItem(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const topicCount = section.children.length;
    const topics = section.children.slice(0, 3).map(c => this.cleanName(c.name));

    return `          <div class="schedule-item" id="${section.slug}">
            <div class="schedule-time">
              <span class="time-num">${String(index + 1).padStart(2, '0')}</span>
              <span class="time-label">Chapter</span>
            </div>
            <div class="schedule-content">
              <h3>${this.escapeHtml(title)}</h3>
              <span class="schedule-meta">${topicCount} topics</span>
              ${topics.length > 0 ? `<ul class="schedule-topics">
${topics.map(t => `                <li>${this.escapeHtml(t)}</li>`).join('\n')}
              </ul>` : ''}
            </div>
          </div>`;
  }

  private renderSpeakerCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const icons = ['📖', '🎓', '💡', '🧠'];
    const title = this.cleanName(section.name);
    const topicCount = section.children.length;

    return `          <div class="speaker-card">
            <div class="speaker-avatar">${icons[index % icons.length]}</div>
            <h3>${this.escapeHtml(title)}</h3>
            <span class="speaker-role">${topicCount} Topics</span>
          </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --max-width: 1200px;
      --accent: #8b5cf6;
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
    ${this.getResetCSS()}

    /* NAV */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      z-index: 1000;
      padding: 0;
    }

    @media (prefers-color-scheme: dark) {
      .navbar { background: rgba(15, 23, 42, 0.95); }
    }

    .nav-container {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 2rem;
      height: 60px;
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
      opacity: 0.8;
    }

    .nav-menu a:hover { opacity: 1; }

    .nav-cta {
      background: var(--primary);
      color: white;
      padding: 0.6rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }

    @media (max-width: 900px) {
      .nav-menu { display: none; }
      .nav-cta { display: none; }
    }

    /* HERO */
    .hero {
      position: relative;
      padding: 12rem 2rem 6rem;
      text-align: center;
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      color: white;
      overflow: hidden;
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/></svg>');
      opacity: 0.5;
    }

    .hero-content {
      position: relative;
      max-width: 800px;
      margin: 0 auto;
    }

    .event-badge {
      display: inline-block;
      background: rgba(255, 255, 255, 0.2);
      padding: 0.5rem 1.25rem;
      border-radius: 50px;
      font-size: 0.85rem;
      font-weight: 600;
      margin-bottom: 2rem;
    }

    .hero h1 {
      font-size: clamp(2.5rem, 6vw, 4.5rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 1.5rem;
    }

    .hero-tagline {
      font-size: 1.35rem;
      opacity: 0.9;
      margin-bottom: 2.5rem;
    }

    .event-info {
      display: flex;
      justify-content: center;
      gap: 3rem;
      margin-bottom: 3rem;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .info-icon {
      font-size: 1.5rem;
    }

    .info-text {
      text-align: left;
    }

    .info-label {
      display: block;
      font-size: 0.75rem;
      opacity: 0.7;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-value {
      font-weight: 600;
      font-size: 1rem;
    }

    @media (max-width: 768px) {
      .event-info {
        flex-direction: column;
        gap: 1.5rem;
        align-items: center;
      }
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border-radius: 10px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: white;
      color: var(--primary);
    }

    .btn-primary:hover {
      transform: translateY(-3px);
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
    }

    .btn-lg {
      padding: 1.25rem 3rem;
      font-size: 1.1rem;
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
      margin-bottom: 1rem;
    }

    .section-desc {
      color: var(--text-muted);
      font-size: 1.15rem;
    }

    /* ABOUT */
    .about-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    .about-content h2 {
      font-size: 2.5rem;
      font-weight: 700;
      margin: 0.5rem 0 1.5rem;
    }

    .about-content p {
      color: var(--text-muted);
      line-height: 1.7;
      font-size: 1.1rem;
      margin-bottom: 1rem;
    }

    .about-stats {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1.5rem;
    }

    .stat-card {
      background: var(--bg-alt);
      padding: 2rem;
      border-radius: 16px;
      text-align: center;
    }

    .stat-num {
      display: block;
      font-size: 2.5rem;
      font-weight: 800;
      color: var(--primary);
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    @media (max-width: 768px) {
      .about-grid { grid-template-columns: 1fr; }
    }

    /* HIGHLIGHTS */
    .section-highlights {
      background: var(--bg-alt);
    }

    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .highlight-card {
      background: var(--bg);
      padding: 2.5rem;
      border-radius: 16px;
      text-align: center;
      transition: all 0.3s;
    }

    .highlight-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-lg);
    }

    .highlight-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 1.5rem;
    }

    .highlight-card h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .highlight-card p {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
    }

    /* SCHEDULE */
    .schedule-timeline {
      max-width: 800px;
      margin: 0 auto;
    }

    .schedule-item {
      display: flex;
      gap: 2rem;
      padding: 2rem 0;
      border-bottom: 1px solid var(--border);
      scroll-margin-top: 100px;
    }

    .schedule-item:last-child {
      border-bottom: none;
    }

    .schedule-time {
      flex-shrink: 0;
      width: 80px;
      text-align: center;
    }

    .time-num {
      display: block;
      font-size: 2rem;
      font-weight: 800;
      color: var(--primary);
    }

    .time-label {
      font-size: 0.75rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .schedule-content h3 {
      font-size: 1.35rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .schedule-meta {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .schedule-topics {
      margin-top: 1rem;
      list-style: none;
      font-size: 0.9rem;
    }

    .schedule-topics li {
      padding: 0.3rem 0;
      padding-left: 1.25rem;
      position: relative;
      color: var(--text-muted);
    }

    .schedule-topics li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--primary);
    }

    /* SPEAKERS */
    .section-speakers {
      background: var(--bg-alt);
    }

    .speakers-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 2rem;
    }

    .speaker-card {
      background: var(--bg);
      padding: 2.5rem 2rem;
      border-radius: 16px;
      text-align: center;
      transition: all 0.3s;
    }

    .speaker-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--shadow-lg);
    }

    .speaker-avatar {
      width: 100px;
      height: 100px;
      background: linear-gradient(135deg, var(--primary), var(--accent));
      border-radius: 50%;
      margin: 0 auto 1.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
    }

    .speaker-card h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .speaker-role {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    /* REGISTER */
    .section-register {
      text-align: center;
    }

    .register-box {
      background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%);
      color: white;
      padding: 5rem 3rem;
      border-radius: 24px;
      max-width: 700px;
      margin: 0 auto;
    }

    .register-box .section-eyebrow {
      color: rgba(255, 255, 255, 0.7);
    }

    .register-box h2 {
      font-size: 2.5rem;
      margin: 0.5rem 0 1rem;
    }

    .register-box p {
      font-size: 1.15rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .register-features {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
      gap: 2rem;
      font-size: 0.9rem;
      opacity: 0.8;
    }

    /* FOOTER */
    footer {
      background: var(--bg-alt);
      padding: 4rem 2rem;
    }

    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .footer-content {
      text-align: center;
    }

    .footer-content h3 {
      font-size: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .footer-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .footer-links a:hover { color: var(--primary); }

    .footer-credit {
      color: var(--text-muted);
      font-size: 0.85rem;
    }

    .footer-credit a { color: var(--primary); }

    @media print {
      .navbar { display: none; }
      .hero { padding-top: 2rem; }
    }
    `;
  }

  private getScripts(): string {
    return `
    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href.length > 1) {
          const targetId = href.substring(1);
          const target = document.getElementById(targetId);
          if (target) {
            e.preventDefault();
            const headerOffset = 70;
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

    document.querySelectorAll('.highlight-card, .schedule-item, .speaker-card, .stat-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.5s, transform 0.5s';
      observer.observe(el);
    });
    `;
  }
}

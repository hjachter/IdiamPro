'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Personal/Resume Website Template
 *
 * Inspired by About.me, Linktree, personal portfolio sites
 * Features: Hero with avatar, bio section, skills display,
 * experience timeline, social links, contact form
 * Best for: CV, personal brand, about me pages, professional profiles
 */
export class PersonalTemplate extends BaseWebsiteTemplate {
  readonly id = 'personal';
  readonly name = 'Personal';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countTopics(sections);
    const experienceItems = sections.slice(0, 4);
    const skillItems = sections.slice(4, 8);

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

  <!-- HERO -->
  <header class="hero">
    <div class="hero-content">
      <div class="avatar">${this.getInitials(options.title)}</div>
      <h1>${this.escapeHtml(options.title)}</h1>
      <p class="tagline">${options.tagline ? this.escapeHtml(options.tagline) : 'Professional Profile'}</p>
      <div class="hero-stats">
        <div class="stat">
          <span class="stat-num">${sections.length}</span>
          <span class="stat-label">Chapters</span>
        </div>
        <div class="stat">
          <span class="stat-num">${totalTopics}+</span>
          <span class="stat-label">Topics</span>
        </div>
      </div>
      <div class="hero-actions">
        <a href="#experience" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
        <a href="#contact" class="btn btn-outline">Get in Touch</a>
      </div>
    </div>
  </header>

  <main>
    <!-- ABOUT -->
    <section id="about" class="section section-about">
      <div class="section-container">
        <div class="about-grid">
          <div class="about-content">
            <span class="section-eyebrow">About</span>
            <h2>The Story</h2>
            <p>${options.tagline ? this.escapeHtml(options.tagline) : 'A comprehensive exploration of key topics.'}</p>
            <p>This profile encompasses ${sections.length} major areas of expertise with ${totalTopics}+ detailed topics, representing deep knowledge and practical experience.</p>
            <ul class="about-highlights">
              <li>📚 ${sections.length} Areas of Focus</li>
              <li>📝 ${totalTopics}+ Detailed Topics</li>
              <li>🎯 Actionable Insights</li>
              <li>💡 Comprehensive Coverage</li>
            </ul>
          </div>
          <div class="about-visual">
            <div class="visual-card">
              <span class="visual-icon">🧠</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- EXPERIENCE -->
    <section id="experience" class="section section-experience">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Background</span>
          <h2>Experience</h2>
          <p class="section-desc">A journey through key areas</p>
        </div>
        <div class="timeline">
${experienceItems.map((item, i) => this.renderTimelineItem(item, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- SKILLS -->
    <section id="skills" class="section section-skills">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Expertise</span>
          <h2>Skills & Knowledge</h2>
          <p class="section-desc">Areas of deep understanding</p>
        </div>
        <div class="skills-grid">
${sections.slice(0, 8).map((section, i) => this.renderSkillCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- ACCOMPLISHMENTS -->
    <section class="section section-accomplishments">
      <div class="section-container">
        <div class="accomplishments-grid">
          <div class="accomplishment">
            <span class="acc-num">${sections.length}</span>
            <span class="acc-label">Major Topics</span>
          </div>
          <div class="accomplishment">
            <span class="acc-num">${totalTopics}+</span>
            <span class="acc-label">Subtopics Covered</span>
          </div>
          <div class="accomplishment">
            <span class="acc-num">∞</span>
            <span class="acc-label">Knowledge Gained</span>
          </div>
          <div class="accomplishment">
            <span class="acc-num">100%</span>
            <span class="acc-label">Actionable</span>
          </div>
        </div>
      </div>
    </section>

    <!-- CONTACT -->
    <section id="contact" class="section section-contact">
      <div class="section-container">
        <div class="contact-box">
          <span class="section-eyebrow">Get in Touch</span>
          <h2>Let's Connect</h2>
          <p>Interested in learning more or collaborating? I'd love to hear from you.</p>
          <a href="mailto:hello@example.com" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
          <div class="social-links">
            <a href="#" class="social-link">LinkedIn</a>
            <a href="#" class="social-link">Twitter</a>
            <a href="#" class="social-link">GitHub</a>
          </div>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <p>© ${new Date().getFullYear()} ${this.escapeHtml(options.title)}. Generated with <a href="https://idiampro.com">IdiamPro</a>.</p>
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

  private renderTimelineItem(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const topicCount = section.children.length;
    const topics = section.children.slice(0, 3).map(c => this.cleanName(c.name));

    return `          <div class="timeline-item" id="${section.slug}">
            <div class="timeline-marker">
              <span class="marker-num">${String(index + 1).padStart(2, '0')}</span>
            </div>
            <div class="timeline-content">
              <h3>${this.escapeHtml(title)}</h3>
              <span class="timeline-meta">${topicCount} topics covered</span>
${topics.length > 0 ? `              <ul class="timeline-topics">
${topics.map(t => `                <li>${this.escapeHtml(t)}</li>`).join('\n')}
              </ul>` : ''}
            </div>
          </div>`;
  }

  private renderSkillCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const icons = ['🎯', '⚡', '💡', '🔧', '📊', '🧠', '🌟', '💪'];
    const topicCount = section.children.length;

    // Calculate a "proficiency" based on topic count
    const proficiency = Math.min(100, Math.max(40, topicCount * 15 + 30));

    return `          <div class="skill-card">
            <div class="skill-header">
              <span class="skill-icon">${icons[index % icons.length]}</span>
              <h4>${this.escapeHtml(title)}</h4>
            </div>
            <div class="skill-bar">
              <div class="skill-fill" style="width: ${proficiency}%"></div>
            </div>
            <span class="skill-meta">${topicCount} topics</span>
          </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables(options.colorTheme)}
      --max-width: 900px;
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
      border-bottom: 1px solid var(--border);
      z-index: 1000;
      padding: 0;
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
      font-size: 1.15rem;
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

    @media (max-width: 768px) {
      .nav-menu { display: none; }
    }

    /* HERO */
    .hero {
      padding: 12rem 2rem 6rem;
      text-align: center;
    }

    .hero-content {
      max-width: 600px;
      margin: 0 auto;
    }

    .avatar {
      width: 140px;
      height: 140px;
      background: linear-gradient(135deg, var(--primary), #7c3aed);
      border-radius: 50%;
      margin: 0 auto 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 3rem;
      font-weight: 700;
      color: white;
      box-shadow: 0 10px 30px rgba(37, 99, 235, 0.3);
    }

    .hero h1 {
      font-size: clamp(2.5rem, 5vw, 3.5rem);
      font-weight: 700;
      margin-bottom: 0.75rem;
      letter-spacing: -0.02em;
    }

    .tagline {
      font-size: 1.35rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .hero-stats {
      display: flex;
      justify-content: center;
      gap: 4rem;
      margin-bottom: 2.5rem;
    }

    .stat {
      text-align: center;
    }

    .stat-num {
      display: block;
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary);
    }

    .stat-label {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .hero-actions {
      display: flex;
      justify-content: center;
      gap: 1rem;
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border-radius: 50px;
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
      box-shadow: var(--shadow-lg);
    }

    .btn-outline {
      background: transparent;
      border: 2px solid var(--border);
      color: var(--text);
    }

    .btn-outline:hover {
      border-color: var(--primary);
      color: var(--primary);
    }

    .btn-lg {
      padding: 1.15rem 2.5rem;
      font-size: 1.05rem;
    }

    /* SECTIONS */
    .section {
      padding: 5rem 2rem;
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
      font-size: 2.25rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .section-desc {
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    /* ABOUT */
    .about-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    .about-content h2 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0.5rem 0 1.5rem;
    }

    .about-content p {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    .about-highlights {
      list-style: none;
      margin-top: 2rem;
    }

    .about-highlights li {
      padding: 0.5rem 0;
      font-weight: 500;
    }

    .about-visual {
      display: flex;
      justify-content: center;
    }

    .visual-card {
      width: 200px;
      height: 200px;
      background: var(--bg-alt);
      border-radius: 20px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-lg);
    }

    .visual-icon {
      font-size: 5rem;
    }

    @media (max-width: 768px) {
      .about-grid { grid-template-columns: 1fr; }
      .about-visual { display: none; }
    }

    /* EXPERIENCE / TIMELINE */
    .section-experience {
      background: var(--bg-alt);
    }

    .timeline {
      position: relative;
      padding-left: 3rem;
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
      padding-bottom: 3rem;
      scroll-margin-top: 100px;
    }

    .timeline-item:last-child {
      padding-bottom: 0;
    }

    .timeline-marker {
      position: absolute;
      left: -3rem;
      top: 0;
      width: 40px;
      height: 40px;
      background: var(--primary);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      transform: translateX(-19px);
    }

    .marker-num {
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
    }

    .timeline-content h3 {
      font-size: 1.35rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
    }

    .timeline-meta {
      font-size: 0.9rem;
      color: var(--text-muted);
      display: block;
      margin-bottom: 1rem;
    }

    .timeline-topics {
      list-style: none;
    }

    .timeline-topics li {
      padding: 0.3rem 0;
      padding-left: 1.25rem;
      position: relative;
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    .timeline-topics li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--primary);
    }

    /* SKILLS */
    .skills-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .skill-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .skill-card:hover {
      border-color: var(--primary);
      box-shadow: var(--shadow);
    }

    .skill-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .skill-icon {
      font-size: 1.5rem;
    }

    .skill-header h4 {
      font-size: 1rem;
      font-weight: 600;
    }

    .skill-bar {
      height: 6px;
      background: var(--bg-alt);
      border-radius: 3px;
      margin-bottom: 0.75rem;
      overflow: hidden;
    }

    .skill-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary), #7c3aed);
      border-radius: 3px;
    }

    .skill-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* ACCOMPLISHMENTS */
    .section-accomplishments {
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      color: white;
    }

    .accomplishments-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      text-align: center;
    }

    .accomplishment {
      padding: 2rem 1rem;
    }

    .acc-num {
      display: block;
      font-size: 3rem;
      font-weight: 800;
      margin-bottom: 0.5rem;
    }

    .acc-label {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    @media (max-width: 768px) {
      .accomplishments-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* CONTACT */
    .section-contact {
      text-align: center;
    }

    .contact-box {
      max-width: 500px;
      margin: 0 auto;
    }

    .contact-box h2 {
      font-size: 2rem;
      margin: 0.5rem 0 1rem;
    }

    .contact-box p {
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    .social-links {
      margin-top: 2rem;
      display: flex;
      justify-content: center;
      gap: 1.5rem;
    }

    .social-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.2s;
    }

    .social-link:hover {
      color: var(--primary);
    }

    /* FOOTER */
    footer {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
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

    document.querySelectorAll('.timeline-item, .skill-card, .accomplishment').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s, transform 0.5s';
      observer.observe(el);
    });

    // Animate skill bars
    document.querySelectorAll('.skill-fill').forEach(bar => {
      const width = bar.style.width;
      bar.style.width = '0%';
      setTimeout(() => {
        bar.style.transition = 'width 1s ease-out';
        bar.style.width = width;
      }, 500);
    });
    `;
  }
}

'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Informational Website Template
 *
 * Inspired by Apple.com - clean, spacious, sophisticated
 * Features: Large typography, generous whitespace, feature showcases,
 * alternating sections, minimalist navigation
 * Best for: Company info, about pages, product pages, corporate sites
 */
export class InformationalTemplate extends BaseWebsiteTemplate {
  readonly id = 'informational';
  readonly name = 'Informational';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countTopics(sections);

    // Use first 3 sections as "key highlights"
    const keyHighlights = sections.slice(0, 3);
    // Remaining sections for deep dive
    const deepDiveSections = sections.slice(3);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <button class="nav-toggle" onclick="toggleNav()" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-menu">
        <li><a href="#overview">Overview</a></li>
        <li><a href="#highlights">Highlights</a></li>
        <li><a href="#explore">Explore</a></li>
        <li><a href="#learn-more" class="nav-cta">${this.escapeHtml(options.ctaText)}</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero" id="overview">
    <div class="hero-content">
      <h1>${this.escapeHtml(options.title)}</h1>
      <p class="hero-tagline">${options.tagline ? this.escapeHtml(options.tagline) : 'A comprehensive overview'}</p>
      <div class="hero-actions">
        <a href="#highlights" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
        <a href="#explore" class="btn btn-outline">Explore →</a>
      </div>
    </div>
    <div class="hero-visual">
      <div class="visual-card">
        <div class="visual-icon">📖</div>
        <div class="visual-stats">
          <div class="stat">
            <span class="stat-num">${sections.length}</span>
            <span class="stat-label">Chapters</span>
          </div>
          <div class="stat">
            <span class="stat-num">${totalTopics}+</span>
            <span class="stat-label">Topics</span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- HIGHLIGHTS SECTION -->
    <section id="highlights" class="section section-highlights">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">What's Inside</span>
          <h2>Key Highlights</h2>
          <p class="section-desc">Discover the essential topics covered in this comprehensive guide.</p>
        </div>
        <div class="highlights-grid">
${keyHighlights.map((section, i) => this.renderHighlightCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- FEATURE STRIPS -->
    <section class="section section-features">
      <div class="section-container">
${sections.slice(0, 4).map((section, i) => this.renderFeatureStrip(section, i, options)).join('\n')}
      </div>
    </section>

    <!-- EXPLORE SECTION -->
    <section id="explore" class="section section-explore">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Deep Dive</span>
          <h2>Explore Every Topic</h2>
          <p class="section-desc">Browse the complete contents organized by chapter.</p>
        </div>
        <div class="explore-grid">
${sections.map((section, i) => this.renderExploreCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- SPECS/DETAILS SECTION -->
    <section class="section section-specs">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">At a Glance</span>
          <h2>Quick Reference</h2>
        </div>
        <div class="specs-grid">
          <div class="spec-item">
            <span class="spec-label">Chapters</span>
            <span class="spec-value">${sections.length}</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Topics</span>
            <span class="spec-value">${totalTopics}+</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Format</span>
            <span class="spec-value">Structured Guide</span>
          </div>
          <div class="spec-item">
            <span class="spec-label">Coverage</span>
            <span class="spec-value">Comprehensive</span>
          </div>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section id="learn-more" class="section section-cta">
      <div class="section-container">
        <div class="cta-box">
          <h2>Ready to Learn More?</h2>
          <p>Dive into ${this.escapeHtml(options.title)} and discover everything you need to know.</p>
          <a href="#overview" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <div class="footer-brand">
        <h3>${this.escapeHtml(options.title)}</h3>
        <p>${options.tagline ? this.escapeHtml(options.tagline) : ''}</p>
      </div>
      <div class="footer-links">
        <a href="#overview">Overview</a>
        <a href="#highlights">Highlights</a>
        <a href="#explore">Explore</a>
      </div>
      <div class="footer-bottom">
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

  private renderHighlightCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const icons = ['🎯', '⚡', '💡', '🔥', '✨', '🚀'];
    const title = this.cleanName(section.name);
    const description = options.includeContent && section.content
      ? this.extractFirstParagraph(section.content).slice(0, 120)
      : `Explore ${section.children.length} topics covering ${title.toLowerCase()}.`;

    return `          <div class="highlight-card">
            <span class="highlight-icon">${icons[index % icons.length]}</span>
            <h3>${this.escapeHtml(title)}</h3>
            <p>${description}${description.length >= 120 ? '...' : ''}</p>
            <a href="#explore" class="highlight-link">Learn more →</a>
          </div>`;
  }

  private renderFeatureStrip(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const isReversed = index % 2 === 1;
    const icons = ['📖', '🎯', '⚡', '💡'];

    let description = '';
    if (options.includeContent && section.content) {
      description = this.stripHtml(section.content).slice(0, 250);
    }

    const topics = section.children.slice(0, 4).map(c => this.cleanName(c.name));

    return `        <div class="feature-strip ${isReversed ? 'reversed' : ''}">
          <div class="feature-content">
            <span class="feature-label">Chapter ${index + 1}</span>
            <h3>${this.escapeHtml(title)}</h3>
            ${description ? `<p>${this.escapeHtml(description)}${description.length >= 250 ? '...' : ''}</p>` : ''}
            ${topics.length > 0 ? `<ul class="feature-list">
${topics.map(t => `              <li>${this.escapeHtml(t)}</li>`).join('\n')}
            </ul>` : ''}
          </div>
          <div class="feature-visual">
            <span class="feature-icon">${icons[index % icons.length]}</span>
          </div>
        </div>`;
  }

  private renderExploreCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const topicCount = section.children.length;
    const topics = section.children.slice(0, 3).map(c => this.cleanName(c.name));

    return `          <div class="explore-card" id="${section.slug}">
            <div class="explore-num">${String(index + 1).padStart(2, '0')}</div>
            <div class="explore-content">
              <h4>${this.escapeHtml(title)}</h4>
              <span class="explore-count">${topicCount} topics</span>
${topics.length > 0 ? `              <ul class="explore-topics">
${topics.map(t => `                <li>${this.escapeHtml(t)}</li>`).join('\n')}
${topicCount > 3 ? `                <li class="more">+${topicCount - 3} more</li>` : ''}
              </ul>` : ''}
            </div>
          </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables(options.colorTheme)}
      --max-width: 1200px;
    }
    ${this.getColorSchemeCSS(options.colorScheme, options.colorTheme)}
    ${this.getResetCSS()}

    /* NAV - Minimal, Apple-style */
    .navbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: rgba(255, 255, 255, 0.72);
      backdrop-filter: saturate(180%) blur(20px);
      -webkit-backdrop-filter: saturate(180%) blur(20px);
      z-index: 1000;
      padding: 0;
    }

    @media (prefers-color-scheme: dark) {
      .navbar {
        background: rgba(29, 29, 31, 0.72);
      }
    }

    .nav-container {
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 2rem;
      height: 48px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-logo {
      font-weight: 600;
      font-size: 1.1rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.01em;
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
      font-size: 0.85rem;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .nav-menu a:hover { opacity: 1; }

    .nav-cta {
      background: var(--primary);
      color: white !important;
      opacity: 1 !important;
      padding: 0.4rem 1rem;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .nav-toggle {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
    }

    .nav-toggle span {
      display: block;
      width: 18px;
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

    /* HERO - Clean, spacious */
    .hero {
      padding: 10rem 2rem 6rem;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6rem;
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .hero-content {
      flex: 1;
      max-width: 560px;
    }

    .hero h1 {
      font-size: clamp(3rem, 6vw, 5rem);
      font-weight: 700;
      line-height: 1.05;
      letter-spacing: -0.03em;
      margin-bottom: 1.5rem;
    }

    .hero-tagline {
      font-size: clamp(1.25rem, 2vw, 1.5rem);
      color: var(--text-muted);
      line-height: 1.4;
      margin-bottom: 2.5rem;
    }

    .hero-actions {
      display: flex;
      gap: 1rem;
    }

    .hero-visual {
      flex-shrink: 0;
    }

    .visual-card {
      width: 300px;
      height: 350px;
      background: var(--bg-alt);
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      box-shadow: var(--shadow-lg);
    }

    .visual-icon {
      font-size: 5rem;
    }

    .visual-stats {
      display: flex;
      gap: 3rem;
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

    @media (max-width: 900px) {
      .hero {
        flex-direction: column;
        text-align: center;
        gap: 4rem;
        padding: 8rem 2rem 5rem;
      }
      .hero-actions { justify-content: center; }
      .visual-card { width: 260px; height: 300px; }
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 0.9rem 1.75rem;
      border-radius: 24px;
      font-weight: 500;
      font-size: 1rem;
      text-decoration: none;
      transition: all 0.2s;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: scale(1.02);
    }

    .btn-outline {
      background: transparent;
      color: var(--primary);
    }

    .btn-outline:hover {
      background: rgba(37, 99, 235, 0.1);
    }

    .btn-lg {
      padding: 1.1rem 2.5rem;
      font-size: 1.1rem;
    }

    /* SECTIONS */
    .section {
      padding: 7rem 2rem;
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
      font-size: 0.9rem;
      font-weight: 500;
      color: var(--primary);
      margin-bottom: 0.5rem;
      letter-spacing: 0.02em;
    }

    .section-header h2 {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      margin-bottom: 1rem;
    }

    .section-desc {
      font-size: 1.15rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
      line-height: 1.6;
    }

    /* HIGHLIGHTS */
    .section-highlights {
      background: var(--bg-alt);
    }

    .highlights-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 2rem;
    }

    .highlight-card {
      background: var(--bg);
      border-radius: 20px;
      padding: 2.5rem;
      transition: all 0.3s;
    }

    .highlight-card:hover {
      transform: translateY(-8px);
      box-shadow: var(--shadow-lg);
    }

    .highlight-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1.5rem;
    }

    .highlight-card h3 {
      font-size: 1.4rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
    }

    .highlight-card p {
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .highlight-link {
      color: var(--primary);
      font-weight: 500;
      text-decoration: none;
    }

    .highlight-link:hover {
      text-decoration: underline;
    }

    /* FEATURE STRIPS */
    .feature-strip {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
      padding: 4rem 0;
      border-bottom: 1px solid var(--border);
    }

    .feature-strip:last-child {
      border-bottom: none;
    }

    .feature-strip.reversed {
      direction: rtl;
    }

    .feature-strip.reversed > * {
      direction: ltr;
    }

    .feature-content {
      padding: 1rem 0;
    }

    .feature-label {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .feature-content h3 {
      font-size: 2rem;
      font-weight: 600;
      margin: 0.5rem 0 1rem;
      letter-spacing: -0.01em;
    }

    .feature-content p {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }

    .feature-list {
      list-style: none;
    }

    .feature-list li {
      padding: 0.4rem 0;
      padding-left: 1.5rem;
      position: relative;
      color: var(--text-muted);
    }

    .feature-list li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--primary);
    }

    .feature-visual {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .feature-icon {
      font-size: 10rem;
    }

    @media (max-width: 768px) {
      .feature-strip {
        grid-template-columns: 1fr;
        gap: 2rem;
        text-align: center;
      }
      .feature-strip.reversed { direction: ltr; }
      .feature-visual { order: -1; }
      .feature-icon { font-size: 6rem; }
      .feature-list { display: none; }
    }

    /* EXPLORE */
    .section-explore {
      background: var(--bg-alt);
    }

    .explore-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1.5rem;
    }

    .explore-card {
      display: flex;
      gap: 1.5rem;
      background: var(--bg);
      border-radius: 16px;
      padding: 1.75rem;
      transition: all 0.2s;
      scroll-margin-top: 100px;
    }

    .explore-card:hover {
      box-shadow: var(--shadow);
      transform: translateY(-2px);
    }

    .explore-num {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--primary);
      opacity: 0.3;
    }

    .explore-content h4 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .explore-count {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .explore-topics {
      margin-top: 1rem;
      list-style: none;
      font-size: 0.9rem;
    }

    .explore-topics li {
      padding: 0.25rem 0;
      color: var(--text-muted);
    }

    .explore-topics .more {
      color: var(--primary);
      font-style: italic;
    }

    /* SPECS */
    .specs-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .spec-item {
      text-align: center;
      padding: 2rem;
      background: var(--bg-alt);
      border-radius: 16px;
    }

    .spec-label {
      display: block;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.5rem;
    }

    .spec-value {
      font-size: 1.5rem;
      font-weight: 600;
    }

    @media (max-width: 768px) {
      .specs-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    /* CTA */
    .section-cta {
      text-align: center;
    }

    .cta-box {
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      color: white;
      padding: 5rem 3rem;
      border-radius: 24px;
      max-width: 800px;
      margin: 0 auto;
    }

    .cta-box h2 {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .cta-box p {
      font-size: 1.15rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .cta-box .btn-primary {
      background: white;
      color: var(--primary);
    }

    /* FOOTER */
    footer {
      background: var(--bg-alt);
      padding: 4rem 2rem 2rem;
    }

    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .footer-brand {
      text-align: center;
      margin-bottom: 2rem;
    }

    .footer-brand h3 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .footer-brand p {
      color: var(--text-muted);
    }

    .footer-links {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .footer-links a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .footer-links a:hover {
      color: var(--primary);
    }

    .footer-bottom {
      text-align: center;
      padding-top: 2rem;
      border-top: 1px solid var(--border);
      color: var(--text-muted);
      font-size: 0.85rem;
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

    // Smooth scroll
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');
        if (href && href.length > 1) {
          const targetId = href.substring(1);
          const target = document.getElementById(targetId);
          if (target) {
            e.preventDefault();
            const headerOffset = 60;
            const elementPosition = target.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
            window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
          }
        }
      });
    });

    // Fade in on scroll
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.highlight-card, .explore-card, .feature-strip').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.6s, transform 0.6s';
      observer.observe(el);
    });
    `;
  }
}

'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Marketing/Promotional Website Template
 *
 * Based on best-in-class book/product landing pages:
 * 1. Hero - Big promise + credibility + CTA
 * 2. Problem - What pain point does this solve?
 * 3. Transformation - What will they achieve?
 * 4. Key Benefits - 3-4 major value propositions
 * 5. What's Inside - Full TOC as value proof
 * 6. Deep Dive - Featured chapters with content
 * 7. About/Credibility - Author or source info
 * 8. FAQ - Address objections
 * 9. Final CTA - Strong close
 */
export class MarketingTemplate extends BaseWebsiteTemplate {
  readonly id = 'marketing';
  readonly name = 'Marketing';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countAllChildren(sections);

    // Extract content intelligently for each section
    const problemSection = this.findSectionByKeywords(sections, ['problem', 'challenge', 'why', 'issue', 'pain']);
    const benefitsSection = this.findSectionByKeywords(sections, ['benefit', 'feature', 'advantage', 'result', 'outcome']);
    const aboutSection = this.findSectionByKeywords(sections, ['about', 'author', 'who', 'journey', 'story', 'background']);

    // First few sections become "key benefits"
    const keyBenefits = sections.slice(0, 3);

    // Build hero subtitle from first section content if available
    const heroSubtitle = sections[0]?.content
      ? this.extractFirstParagraph(sections[0].content).slice(0, 200)
      : `A comprehensive guide with ${sections.length} chapters and ${totalTopics}+ actionable insights.`;

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <button class="nav-toggle" onclick="toggleNav()" aria-label="Toggle navigation">
        <span></span><span></span><span></span>
      </button>
      <ul class="nav-menu">
        <li><a href="#benefits">Benefits</a></li>
        <li><a href="#inside">What's Inside</a></li>
        <li><a href="#chapters">Chapters</a></li>
        <li><a href="#faq">FAQ</a></li>
        <li><a href="#start" class="nav-cta">Get Started</a></li>
      </ul>
    </div>
  </nav>

  <!-- HERO SECTION -->
  <header class="hero">
    <div class="hero-container">
      <div class="hero-content">
        <p class="hero-eyebrow">The Complete Guide</p>
        <h1>${this.escapeHtml(options.title)}</h1>
        <p class="hero-subtitle">${options.tagline ? this.escapeHtml(options.tagline) : heroSubtitle}</p>
        <div class="hero-stats">
          <div class="stat">
            <span class="stat-number">${sections.length}</span>
            <span class="stat-label">Chapters</span>
          </div>
          <div class="stat">
            <span class="stat-number">${totalTopics}+</span>
            <span class="stat-label">Topics</span>
          </div>
          <div class="stat">
            <span class="stat-number">100%</span>
            <span class="stat-label">Actionable</span>
          </div>
        </div>
        <div class="hero-cta">
          <a href="#inside" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
          <a href="#benefits" class="btn btn-outline">Learn More</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="book-mockup">
          <div class="book-cover">
            <span class="book-title">${this.escapeHtml(options.title)}</span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- PROBLEM/TRANSFORMATION SECTION -->
    <section class="section section-problem">
      <div class="section-container">
        <div class="problem-grid">
          <div class="problem-card">
            <div class="problem-icon">😫</div>
            <h3>The Challenge</h3>
            <p>Information overload makes it hard to find reliable, actionable guidance. You need a clear path forward.</p>
          </div>
          <div class="problem-arrow">→</div>
          <div class="problem-card solution">
            <div class="problem-icon">🎯</div>
            <h3>The Solution</h3>
            <p>${this.escapeHtml(options.title)} gives you a structured, comprehensive framework to achieve real results.</p>
          </div>
        </div>
      </div>
    </section>

    <!-- KEY BENEFITS SECTION -->
    <section id="benefits" class="section section-benefits">
      <div class="section-container">
        <h2>What You'll Learn</h2>
        <p class="section-subtitle">Key insights from every chapter, organized for maximum impact</p>
        <div class="benefits-grid">
${keyBenefits.map((section, i) => this.renderBenefitCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- WHAT'S INSIDE - FULL TOC -->
    <section id="inside" class="section section-toc">
      <div class="section-container">
        <h2>What's Inside</h2>
        <p class="section-subtitle">Explore the complete table of contents — ${sections.length} comprehensive chapters</p>
        <div class="toc-grid">
${sections.map((section, i) => this.renderTocChapter(section, i)).join('\n')}
        </div>
      </div>
    </section>

    <!-- FEATURED CHAPTERS - DEEP DIVE -->
    <section id="chapters" class="section section-chapters">
      <div class="section-container">
        <h2>Featured Chapters</h2>
        <p class="section-subtitle">A closer look at what you'll discover</p>
${sections.slice(0, 4).map((section, i) => this.renderFeaturedChapter(section, i, options)).join('\n')}
      </div>
    </section>

    <!-- SOCIAL PROOF / TESTIMONIALS -->
    <section class="section section-proof">
      <div class="section-container">
        <div class="proof-grid">
          <div class="proof-card">
            <p class="proof-quote">"Comprehensive and actionable. This changed how I approach the subject."</p>
            <p class="proof-author">— Satisfied Reader</p>
          </div>
          <div class="proof-card">
            <p class="proof-quote">"Finally, everything I needed in one place. Well-organized and thorough."</p>
            <p class="proof-author">— Knowledge Seeker</p>
          </div>
          <div class="proof-card">
            <p class="proof-quote">"The structure makes complex topics easy to understand and apply."</p>
            <p class="proof-author">— Lifelong Learner</p>
          </div>
        </div>
      </div>
    </section>

    <!-- FAQ SECTION -->
    <section id="faq" class="section section-faq">
      <div class="section-container">
        <h2>Frequently Asked Questions</h2>
        <div class="faq-list">
          <details class="faq-item">
            <summary>What makes this guide different?</summary>
            <p>${this.escapeHtml(options.title)} is structured as a comprehensive outline with ${sections.length} chapters and ${totalTopics}+ topics, making it easy to navigate and reference specific information when you need it.</p>
          </details>
          <details class="faq-item">
            <summary>How is the content organized?</summary>
            <p>The content follows a logical progression through ${sections.slice(0, 3).map(s => this.cleanName(s.name)).join(', ')}, and more. Each chapter builds on the previous one while remaining useful as a standalone reference.</p>
          </details>
          <details class="faq-item">
            <summary>Who is this for?</summary>
            <p>Anyone looking to gain deep knowledge about ${this.cleanName(sections[0]?.name || options.title).toLowerCase()} and related topics. Whether you're a beginner or experienced, you'll find valuable insights.</p>
          </details>
          <details class="faq-item">
            <summary>Can I navigate to specific topics?</summary>
            <p>Absolutely. The outline structure makes it easy to jump to any chapter or topic. Use the table of contents above to explore exactly what interests you.</p>
          </details>
        </div>
      </div>
    </section>

    <!-- FINAL CTA -->
    <section id="start" class="section section-final-cta">
      <div class="section-container">
        <div class="final-cta-box">
          <h2>Ready to Get Started?</h2>
          <p>Dive into ${this.escapeHtml(options.title)} and transform your understanding today.</p>
          <a href="#inside" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <p>© ${new Date().getFullYear()} ${this.escapeHtml(options.title)} · Generated with <a href="https://idiampro.com">IdiamPro</a></p>
    </div>
  </footer>`;

    return this.wrapInDocument(
      options.title,
      options.tagline || `Comprehensive guide with ${sections.length} chapters`,
      this.getStyles(options),
      body,
      this.getScripts()
    );
  }

  private countAllChildren(sections: WebsiteSection[]): number {
    let count = 0;
    for (const section of sections) {
      count += section.children.length;
      count += this.countAllChildren(section.children);
    }
    return count;
  }

  private findSectionByKeywords(sections: WebsiteSection[], keywords: string[]): WebsiteSection | null {
    for (const section of sections) {
      const nameLower = section.name.toLowerCase();
      if (keywords.some(kw => nameLower.includes(kw))) {
        return section;
      }
    }
    return null;
  }

  private renderBenefitCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const icons = ['🧬', '⚡', '🧠', '💡', '🎯', '🔥'];
    const title = this.cleanName(section.name);
    const description = options.includeContent && section.content
      ? this.extractFirstParagraph(section.content).slice(0, 150)
      : `Master the essentials of ${title.toLowerCase()}`;

    const topicCount = section.children.length;

    return `          <div class="benefit-card">
            <div class="benefit-icon">${icons[index % icons.length]}</div>
            <h3>${this.escapeHtml(title)}</h3>
            <p>${description}${description.length >= 150 ? '...' : ''}</p>
            <span class="benefit-meta">${topicCount} topics covered</span>
          </div>`;
  }

  private renderTocChapter(section: WebsiteSection, index: number): string {
    const title = this.cleanName(section.name);
    const topicCount = section.children.length;
    const topics = section.children.slice(0, 4).map(c => this.cleanName(c.name));
    const moreCount = section.children.length - 4;

    return `          <div class="toc-chapter" id="chapter-${section.slug}">
            <div class="toc-header" onclick="toggleToc(this)">
              <span class="toc-num">${String(index + 1).padStart(2, '0')}</span>
              <div class="toc-info">
                <h3>${this.escapeHtml(title)}</h3>
                <span class="toc-count">${topicCount} topics</span>
              </div>
              <span class="toc-toggle">+</span>
            </div>
            <ul class="toc-topics">
${topics.map(t => `              <li>${this.escapeHtml(t)}</li>`).join('\n')}
${moreCount > 0 ? `              <li class="toc-more">+ ${moreCount} more topics</li>` : ''}
            </ul>
          </div>`;
  }

  private renderFeaturedChapter(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const isEven = index % 2 === 0;
    const icons = ['🧬', '⚡', '🧠', '💪'];

    let content = '';
    if (options.includeContent && section.content) {
      content = this.stripHtml(section.content).slice(0, 300);
    }

    const topics = section.children.slice(0, 4).map(c => this.cleanName(c.name));

    return `        <div class="chapter-feature ${isEven ? '' : 'chapter-reverse'}">
          <div class="chapter-content">
            <span class="chapter-label">Chapter ${index + 1}</span>
            <h3>${this.escapeHtml(title)}</h3>
            ${content ? `<p>${this.escapeHtml(content)}${content.length >= 300 ? '...' : ''}</p>` : ''}
            ${topics.length > 0 ? `
            <ul class="chapter-topics">
${topics.map(t => `              <li>${this.escapeHtml(t)}</li>`).join('\n')}
            </ul>` : ''}
          </div>
          <div class="chapter-visual">
            <span class="chapter-icon">${icons[index % icons.length]}</span>
          </div>
        </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --gradient-start: #2563eb;
      --gradient-end: #7c3aed;
    }
    ${this.getColorSchemeCSS(options.colorScheme)}
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
      font-size: 1.25rem;
      color: var(--text);
      text-decoration: none;
    }
    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2rem;
      align-items: center;
    }
    .nav-menu a {
      color: var(--text-muted);
      text-decoration: none;
      font-weight: 500;
      font-size: 0.95rem;
      transition: color 0.2s;
    }
    .nav-menu a:hover { color: var(--text); }
    .nav-cta {
      background: var(--primary);
      color: white !important;
      padding: 0.5rem 1rem;
      border-radius: 6px;
    }
    .nav-cta:hover { background: var(--primary-dark); }
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
      width: 24px;
      height: 2px;
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

    /* HERO */
    .hero {
      padding: 10rem 2rem 6rem;
      background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
      color: white;
    }
    .hero-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
    }
    .hero-eyebrow {
      font-size: 0.9rem;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      opacity: 0.8;
      margin-bottom: 1rem;
    }
    .hero h1 {
      font-size: clamp(2.5rem, 5vw, 4rem);
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 1.5rem;
    }
    .hero-subtitle {
      font-size: 1.25rem;
      opacity: 0.9;
      line-height: 1.6;
      margin-bottom: 2rem;
    }
    .hero-stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 2.5rem;
    }
    .stat {
      text-align: center;
    }
    .stat-number {
      display: block;
      font-size: 2rem;
      font-weight: 700;
    }
    .stat-label {
      font-size: 0.85rem;
      opacity: 0.8;
    }
    .hero-cta {
      display: flex;
      gap: 1rem;
    }
    .hero-visual {
      display: flex;
      justify-content: center;
    }
    .book-mockup {
      perspective: 1000px;
    }
    .book-cover {
      width: 280px;
      height: 380px;
      background: linear-gradient(145deg, #1e293b 0%, #0f172a 100%);
      border-radius: 4px 12px 12px 4px;
      box-shadow:
        20px 20px 60px rgba(0,0,0,0.3),
        -5px -5px 20px rgba(255,255,255,0.1);
      transform: rotateY(-15deg);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .book-title {
      font-size: 1.5rem;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
    }
    @media (max-width: 900px) {
      .hero-container { grid-template-columns: 1fr; text-align: center; }
      .hero-stats { justify-content: center; }
      .hero-cta { justify-content: center; }
      .hero-visual { margin-top: 3rem; }
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 1rem 2rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }
    .btn-primary {
      background: white;
      color: var(--gradient-start);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .btn-outline {
      background: transparent;
      color: white;
      border: 2px solid rgba(255,255,255,0.3);
    }
    .btn-outline:hover {
      border-color: white;
      background: rgba(255,255,255,0.1);
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
    .section h2 {
      font-size: clamp(2rem, 4vw, 2.75rem);
      font-weight: 700;
      text-align: center;
      margin-bottom: 0.5rem;
    }
    .section-subtitle {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 3rem;
    }

    /* PROBLEM SECTION */
    .section-problem {
      background: var(--bg-alt);
    }
    .problem-grid {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2rem;
      flex-wrap: wrap;
    }
    .problem-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2.5rem;
      text-align: center;
      max-width: 320px;
    }
    .problem-card.solution {
      border-color: var(--primary);
      box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1);
    }
    .problem-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }
    .problem-card h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }
    .problem-card p {
      color: var(--text-muted);
      line-height: 1.6;
    }
    .problem-arrow {
      font-size: 2rem;
      color: var(--primary);
    }
    @media (max-width: 768px) {
      .problem-arrow { transform: rotate(90deg); }
    }

    /* BENEFITS */
    .benefits-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }
    .benefit-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      transition: all 0.3s;
    }
    .benefit-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
      border-color: var(--primary);
    }
    .benefit-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }
    .benefit-card h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }
    .benefit-card p {
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .benefit-meta {
      font-size: 0.85rem;
      color: var(--primary);
      font-weight: 500;
    }

    /* TOC */
    .section-toc {
      background: var(--bg-alt);
    }
    .toc-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
      gap: 1rem;
    }
    .toc-chapter {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    .toc-header {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 1.25rem;
      cursor: pointer;
      transition: background 0.2s;
    }
    .toc-header:hover {
      background: var(--bg-alt);
    }
    .toc-num {
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--primary);
      background: rgba(37, 99, 235, 0.1);
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    .toc-info {
      flex: 1;
    }
    .toc-info h3 {
      font-size: 1rem;
      margin: 0;
      text-align: left;
    }
    .toc-count {
      font-size: 0.8rem;
      color: var(--text-muted);
    }
    .toc-toggle {
      font-size: 1.25rem;
      color: var(--primary);
      transition: transform 0.2s;
    }
    .toc-chapter.open .toc-toggle {
      transform: rotate(45deg);
    }
    .toc-topics {
      display: none;
      list-style: none;
      padding: 0 1.25rem 1.25rem 3.5rem;
      border-top: 1px solid var(--border);
      background: var(--bg-alt);
    }
    .toc-chapter.open .toc-topics {
      display: block;
    }
    .toc-topics li {
      padding: 0.4rem 0;
      font-size: 0.9rem;
      color: var(--text-muted);
    }
    .toc-more {
      font-style: italic;
      color: var(--primary) !important;
    }

    /* FEATURED CHAPTERS */
    .chapter-feature {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: center;
      padding: 3rem;
      background: var(--bg-alt);
      border-radius: 16px;
      margin-bottom: 2rem;
    }
    .chapter-feature:last-child {
      margin-bottom: 0;
    }
    .chapter-reverse {
      direction: rtl;
    }
    .chapter-reverse > * {
      direction: ltr;
    }
    .chapter-label {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .chapter-content h3 {
      font-size: 1.75rem;
      margin: 0.5rem 0 1rem;
      text-align: left;
    }
    .chapter-content p {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1.5rem;
    }
    .chapter-topics {
      list-style: none;
    }
    .chapter-topics li {
      padding: 0.4rem 0;
      padding-left: 1.5rem;
      position: relative;
      color: var(--text-muted);
    }
    .chapter-topics li::before {
      content: "→";
      position: absolute;
      left: 0;
      color: var(--primary);
    }
    .chapter-visual {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .chapter-icon {
      font-size: 8rem;
    }
    @media (max-width: 768px) {
      .chapter-feature {
        grid-template-columns: 1fr;
        gap: 2rem;
        padding: 2rem;
      }
      .chapter-reverse { direction: ltr; }
      .chapter-visual { order: -1; }
      .chapter-icon { font-size: 5rem; }
    }

    /* SOCIAL PROOF */
    .section-proof {
      background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
      color: white;
    }
    .proof-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
    }
    .proof-card {
      background: rgba(255,255,255,0.1);
      backdrop-filter: blur(10px);
      border-radius: 12px;
      padding: 2rem;
    }
    .proof-quote {
      font-size: 1.1rem;
      font-style: italic;
      line-height: 1.6;
      margin-bottom: 1rem;
    }
    .proof-author {
      font-size: 0.9rem;
      opacity: 0.8;
    }

    /* FAQ */
    .section-faq {
      background: var(--bg-alt);
    }
    .faq-list {
      max-width: 800px;
      margin: 0 auto;
    }
    .faq-item {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      margin-bottom: 1rem;
      overflow: hidden;
    }
    .faq-item summary {
      padding: 1.25rem 1.5rem;
      font-weight: 600;
      cursor: pointer;
      list-style: none;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .faq-item summary::after {
      content: "+";
      font-size: 1.5rem;
      color: var(--primary);
    }
    .faq-item[open] summary::after {
      content: "−";
    }
    .faq-item p {
      padding: 0 1.5rem 1.25rem;
      color: var(--text-muted);
      line-height: 1.6;
    }

    /* FINAL CTA */
    .section-final-cta {
      text-align: center;
    }
    .final-cta-box {
      background: linear-gradient(135deg, var(--gradient-start) 0%, var(--gradient-end) 100%);
      color: white;
      padding: 4rem;
      border-radius: 20px;
      max-width: 700px;
      margin: 0 auto;
    }
    .final-cta-box h2 {
      color: white;
      margin-bottom: 1rem;
    }
    .final-cta-box p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }
    .final-cta-box .btn-primary {
      background: white;
      color: var(--gradient-start);
    }

    /* FOOTER */
    footer {
      background: var(--bg-alt);
      border-top: 1px solid var(--border);
      padding: 2rem;
      text-align: center;
    }
    .footer-container {
      max-width: var(--max-width);
      margin: 0 auto;
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
    function toggleNav() {
      document.querySelector('.nav-menu').classList.toggle('active');
    }

    function toggleToc(header) {
      header.parentElement.classList.toggle('open');
    }

    document.querySelectorAll('.nav-menu a').forEach(link => {
      link.addEventListener('click', () => {
        document.querySelector('.nav-menu').classList.remove('active');
      });
    });

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
    `;
  }
}

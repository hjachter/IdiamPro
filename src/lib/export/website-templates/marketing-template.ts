'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Marketing/Promotional Website Template
 *
 * Features: Hero with CTA, feature grid, pricing tables, testimonials
 * Best for: Product launches, landing pages, promotional campaigns
 */
export class MarketingTemplate extends BaseWebsiteTemplate {
  readonly id = 'marketing';
  readonly name = 'Marketing';

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
      <div class="hero-cta">
        <a href="#${navItems[0]?.id || ''}" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
      </div>
    </div>
  </header>

  <main>
${sections.map(section => this.renderSection(section, options)).join('\n\n')}
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

  private renderSection(section: WebsiteSection, options: WebsiteTemplateOptions): string {
    const sectionName = this.cleanName(section.name);
    const layout = this.determineSectionLayout(section);

    let content = '';

    // Section intro
    if (options.includeContent && section.content) {
      const intro = this.extractFirstParagraph(section.content);
      if (intro) {
        content += `      <p class="section-intro">${intro}</p>\n`;
      }
    }

    // Render children based on layout
    if (section.children.length > 0) {
      switch (layout) {
        case 'pricing':
          content += this.renderPricing(section.children, options);
          break;
        case 'features':
          content += this.renderFeatures(section.children, options);
          break;
        case 'testimonials':
          content += this.renderTestimonials(section.children, options);
          break;
        case 'faq':
          content += this.renderFAQ(section.children, options);
          break;
        default:
          content += this.renderCards(section.children, options);
      }
    } else if (options.includeContent && section.content) {
      content += `      <div class="section-content">${this.processContent(section.content)}</div>\n`;
    }

    return `    <section id="${section.slug}" class="section section-${layout}">
      <div class="section-container">
        <h2>${this.escapeHtml(sectionName)}</h2>
${content}      </div>
    </section>`;
  }

  private determineSectionLayout(section: WebsiteSection): string {
    const name = section.name.toLowerCase();

    if (name.includes('pricing') || name.includes('subscription') || name.includes('plan')) {
      return 'pricing';
    }
    if (name.includes('testimonial') || name.includes('review') || name.includes('quote')) {
      return 'testimonials';
    }
    if (name.includes('faq') || name.includes('question')) {
      return 'faq';
    }
    if (name.includes('feature') || name.includes('capability') || name.includes('benefit')) {
      return 'features';
    }

    // Default based on child count
    if (section.children.length <= 6) {
      return 'features';
    }
    return 'cards';
  }

  private renderFeatures(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const icons = ['⚡', '🎯', '🔒', '📊', '🚀', '💡', '🔧', '📱', '☁️', '🎨'];

    const features = children.map((child, i) => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.extractFirstParagraph(child.content) : '';
      const icon = this.getIconForName(child.name) || icons[i % icons.length];

      return `        <div class="feature">
          <div class="feature-icon">${icon}</div>
          <h3>${this.escapeHtml(title)}</h3>
${description ? `          <p>${description}</p>` : ''}
        </div>`;
    });

    return `      <div class="feature-grid">\n${features.join('\n')}\n      </div>\n`;
  }

  private renderCards(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const cards = children.map(child => {
      const title = this.cleanName(child.name);
      const description = options.includeContent ? this.extractFirstParagraph(child.content) : '';
      const subItems = child.children.slice(0, 5).map(c => this.cleanName(c.name));

      return `        <div class="card">
          <h3>${this.escapeHtml(title)}</h3>
${description ? `          <p>${description}</p>` : ''}
${subItems.length > 0 ? `          <ul class="card-list">
${subItems.map(item => `            <li>${this.escapeHtml(item)}</li>`).join('\n')}
          </ul>` : ''}
        </div>`;
    });

    return `      <div class="card-grid">\n${cards.join('\n')}\n      </div>\n`;
  }

  private renderPricing(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const plans = children.map((child, i) => {
      const title = this.cleanName(child.name);
      const content = child.content || '';

      // Extract price
      const priceMatch = content.match(/\$[\d,]+(?:\/month)?|Free/i);
      const price = priceMatch ? priceMatch[0] : '';

      // Extract features
      const features = this.extractListItems(content).slice(0, 8);
      const isPopular = i === 1 || title.toLowerCase().includes('premium') || title.toLowerCase().includes('pro');

      return `        <div class="pricing-card${isPopular ? ' popular' : ''}">
${isPopular ? `          <div class="popular-badge">Most Popular</div>` : ''}
          <h3>${this.escapeHtml(title)}</h3>
          <div class="price">${this.escapeHtml(price) || 'Contact Us'}</div>
          <ul class="pricing-features">
${features.map(f => `            <li>${this.escapeHtml(f)}</li>`).join('\n')}
          </ul>
          <a href="#" class="btn btn-${isPopular ? 'primary' : 'secondary'}">${this.escapeHtml(options.ctaText)}</a>
        </div>`;
    });

    return `      <div class="pricing-grid">\n${plans.join('\n')}\n      </div>\n`;
  }

  private renderTestimonials(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const testimonials = children.map(child => {
      const name = this.cleanName(child.name);
      const quote = options.includeContent ? this.stripHtml(child.content) : '';

      return `        <div class="testimonial">
          <blockquote>"${this.escapeHtml(quote.slice(0, 300))}"</blockquote>
          <cite>— ${this.escapeHtml(name)}</cite>
        </div>`;
    });

    return `      <div class="testimonial-grid">\n${testimonials.join('\n')}\n      </div>\n`;
  }

  private renderFAQ(children: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const faqs = children.map(child => {
      const question = this.cleanName(child.name);
      const answer = options.includeContent ? this.processContent(child.content) : '';

      return `        <details class="faq-item">
          <summary>${this.escapeHtml(question)}</summary>
          <div class="faq-answer">${answer}</div>
        </details>`;
    });

    return `      <div class="faq-list">\n${faqs.join('\n')}\n      </div>\n`;
  }

  private getIconForName(name: string): string | null {
    const nameLower = name.toLowerCase();
    if (nameLower.includes('ai') || nameLower.includes('intelligent')) return '🤖';
    if (nameLower.includes('fast') || nameLower.includes('speed') || nameLower.includes('performance')) return '⚡';
    if (nameLower.includes('secure') || nameLower.includes('privacy')) return '🔒';
    if (nameLower.includes('export') || nameLower.includes('import')) return '📤';
    if (nameLower.includes('template')) return '📋';
    if (nameLower.includes('organize') || nameLower.includes('structure')) return '🗂️';
    if (nameLower.includes('platform') || nameLower.includes('device')) return '📱';
    if (nameLower.includes('cloud') || nameLower.includes('sync')) return '☁️';
    if (nameLower.includes('team') || nameLower.includes('collaborate')) return '👥';
    return null;
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
      max-width: var(--max-width);
      margin: 0 auto;
      padding: 0 1.5rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .nav-logo {
      font-weight: 700;
      font-size: 1.25rem;
      color: var(--primary);
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
      font-weight: 500;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--primary); }

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
      width: 24px;
      height: 2px;
      background: var(--text);
      transition: 0.3s;
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
        padding: 1rem 1.5rem;
        gap: 1rem;
        border-bottom: 1px solid var(--border);
      }
      .nav-menu.active { display: flex; }
    }

    /* Hero */
    .hero {
      background: linear-gradient(135deg, var(--bg-alt) 0%, var(--bg) 100%);
      padding: 8rem 1.5rem 5rem;
      text-align: center;
    }

    .hero-content {
      max-width: 800px;
      margin: 0 auto;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3.5rem);
      font-weight: 800;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, var(--text) 0%, var(--primary) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .tagline {
      font-size: clamp(1.1rem, 2.5vw, 1.5rem);
      color: var(--text-muted);
      margin-bottom: 2rem;
      font-style: italic;
    }

    .hero-cta {
      display: flex;
      gap: 1rem;
      justify-content: center;
      flex-wrap: wrap;
    }

    /* Buttons */
    .btn {
      display: inline-block;
      padding: 0.875rem 1.75rem;
      border-radius: var(--radius);
      font-weight: 600;
      font-size: 1rem;
      text-decoration: none;
      transition: all 0.2s;
      cursor: pointer;
      border: none;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
      box-shadow: var(--shadow-lg);
      text-decoration: none;
    }

    .btn-secondary {
      background: var(--bg);
      color: var(--text);
      border: 1px solid var(--border);
    }

    .btn-secondary:hover {
      background: var(--bg-alt);
      border-color: var(--primary);
      text-decoration: none;
    }

    /* Sections */
    .section {
      padding: 5rem 1.5rem;
    }

    .section:nth-child(even) {
      background: var(--bg-alt);
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section h2 {
      font-size: clamp(1.75rem, 4vw, 2.5rem);
      font-weight: 700;
      margin-bottom: 1rem;
      text-align: center;
    }

    .section-intro {
      text-align: center;
      color: var(--text-muted);
      max-width: 700px;
      margin: 0 auto 3rem;
      font-size: 1.1rem;
    }

    .section-content {
      max-width: 800px;
      margin: 0 auto;
    }

    .section-content h4 { margin-top: 1.5rem; margin-bottom: 0.5rem; }
    .section-content ul, .section-content ol { margin-left: 1.5rem; margin-bottom: 1rem; }
    .section-content p { margin-bottom: 1rem; }

    /* Feature Grid */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 2rem;
    }

    .feature {
      text-align: center;
      padding: 1.5rem;
    }

    .feature-icon {
      font-size: 2.5rem;
      margin-bottom: 1rem;
    }

    .feature h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .feature p {
      color: var(--text-muted);
      font-size: 0.95rem;
    }

    /* Card Grid */
    .card-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
    }

    .card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.5rem;
      transition: all 0.2s;
    }

    .card:hover {
      box-shadow: var(--shadow-lg);
      transform: translateY(-4px);
    }

    .card h3 {
      font-size: 1.25rem;
      margin-bottom: 0.75rem;
    }

    .card p {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 1rem;
    }

    .card-list {
      list-style: none;
      font-size: 0.9rem;
    }

    .card-list li {
      padding: 0.25rem 0;
      color: var(--text-muted);
    }

    .card-list li::before {
      content: "•";
      color: var(--primary);
      margin-right: 0.5rem;
    }

    /* Pricing */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      max-width: 900px;
      margin: 0 auto;
    }

    .pricing-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
      text-align: center;
      position: relative;
    }

    .pricing-card.popular {
      border-color: var(--primary);
      box-shadow: var(--shadow-lg);
    }

    .popular-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary);
      color: white;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 1rem;
      border-radius: 999px;
    }

    .pricing-card h3 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }

    .price {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--primary);
      margin-bottom: 1.5rem;
    }

    .pricing-features {
      list-style: none;
      margin-bottom: 2rem;
      text-align: left;
    }

    .pricing-features li {
      padding: 0.5rem 0;
      border-bottom: 1px solid var(--border);
      font-size: 0.95rem;
    }

    .pricing-features li::before {
      content: "✓";
      color: var(--primary);
      margin-right: 0.5rem;
    }

    /* Testimonials */
    .testimonial-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 2rem;
    }

    .testimonial {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 2rem;
    }

    .testimonial blockquote {
      font-size: 1.1rem;
      font-style: italic;
      margin-bottom: 1rem;
      color: var(--text);
    }

    .testimonial cite {
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* FAQ */
    .faq-list {
      max-width: 800px;
      margin: 0 auto;
    }

    .faq-item {
      border-bottom: 1px solid var(--border);
    }

    .faq-item summary {
      padding: 1.25rem 0;
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

    .faq-answer {
      padding: 0 0 1.25rem;
      color: var(--text-muted);
    }

    /* Footer */
    footer {
      background: var(--bg-alt);
      border-top: 1px solid var(--border);
      padding: 2rem 1.5rem;
      text-align: center;
    }

    .footer-content {
      max-width: var(--max-width);
      margin: 0 auto;
      color: var(--text-muted);
      font-size: 0.9rem;
    }

    /* Responsive */
    @media (max-width: 640px) {
      .hero { padding: 6rem 1rem 3rem; }
      .section { padding: 3rem 1rem; }
      .feature-grid, .card-grid, .pricing-grid, .testimonial-grid {
        grid-template-columns: 1fr;
      }
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
          const headerOffset = 80;
          const elementPosition = target.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          window.scrollTo({ top: offsetPosition, behavior: 'smooth' });
        }
      });
    });
    `;
  }
}

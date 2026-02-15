'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Blog/News Website Template
 *
 * Inspired by Medium, Substack, Ghost
 * Features: Featured article hero, reading time, author info,
 * category tags, newsletter signup, clean typography
 * Best for: Articles, updates, news feeds, content hubs
 */
export class BlogTemplate extends BaseWebsiteTemplate {
  readonly id = 'blog';
  readonly name = 'Blog';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const posts = this.extractPosts(sections);
    const categories = sections.filter(s => s.children.length > 0).map(s => this.cleanName(s.name));
    const featuredPost = posts[0];
    const recentPosts = posts.slice(1, 7);
    const totalArticles = posts.length;

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#featured">Featured</a></li>
        <li><a href="#recent">Recent</a></li>
        <li><a href="#topics">Topics</a></li>
      </ul>
      <a href="#subscribe" class="nav-cta">Subscribe</a>
    </div>
  </nav>

  <!-- HERO / FEATURED -->
  <header class="hero" id="featured">
    <div class="hero-container">
      <div class="hero-content">
        <span class="featured-badge">Featured</span>
        <h1>${this.escapeHtml(this.cleanName(featuredPost?.name || options.title))}</h1>
        <p class="hero-excerpt">${options.tagline ? this.escapeHtml(options.tagline) : 'Explore the complete guide'}</p>
        <div class="hero-meta">
          <span class="meta-item">📅 ${this.getFormattedDate()}</span>
          <span class="meta-item">⏱️ ${this.getReadingTime(featuredPost)} min read</span>
          <span class="meta-item">📚 ${featuredPost?.children.length || totalArticles} topics</span>
        </div>
        <a href="#recent" class="btn btn-primary">Read More</a>
      </div>
      <div class="hero-visual">
        <div class="hero-card">
          <span class="card-icon">📰</span>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- RECENT POSTS -->
    <section id="recent" class="section section-recent">
      <div class="section-container">
        <div class="section-header">
          <h2>Recent Articles</h2>
          <span class="article-count">${totalArticles} articles</span>
        </div>
        <div class="posts-grid">
${recentPosts.map((post, i) => this.renderPostCard(post, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- TOPICS / CATEGORIES -->
    <section id="topics" class="section section-topics">
      <div class="section-container">
        <div class="section-header">
          <h2>Browse by Topic</h2>
          <p class="section-desc">Explore articles organized by subject</p>
        </div>
        <div class="topics-grid">
${sections.map((section, i) => this.renderTopicCard(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- SUBSCRIBE -->
    <section id="subscribe" class="section section-subscribe">
      <div class="section-container">
        <div class="subscribe-box">
          <span class="subscribe-icon">✉️</span>
          <h2>Stay Updated</h2>
          <p>Get the latest articles and insights delivered to your inbox.</p>
          <form class="subscribe-form" onsubmit="return false;">
            <input type="email" placeholder="Enter your email" disabled>
            <button type="submit" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</button>
          </form>
          <span class="subscribe-note">Join ${Math.floor(totalArticles * 100)}+ readers</span>
        </div>
      </div>
    </section>

    <!-- ARCHIVE -->
    <section class="section section-archive">
      <div class="section-container">
        <h2>All Articles</h2>
        <div class="archive-list">
${posts.slice(0, 10).map((post, i) => this.renderArchiveItem(post, i, options)).join('\n')}
${posts.length > 10 ? `          <p class="archive-more">+ ${posts.length - 10} more articles</p>` : ''}
        </div>
      </div>
    </section>
  </main>

  <footer>
    <div class="footer-container">
      <div class="footer-content">
        <h3>${this.escapeHtml(options.title)}</h3>
        <p>${options.tagline ? this.escapeHtml(options.tagline) : ''}</p>
        <div class="footer-links">
          <a href="#featured">Featured</a>
          <a href="#recent">Recent</a>
          <a href="#topics">Topics</a>
          <a href="#subscribe">Subscribe</a>
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

  private extractPosts(sections: WebsiteSection[]): WebsiteSection[] {
    const posts: WebsiteSection[] = [];
    for (const section of sections) {
      if (section.children.length > 0) {
        posts.push(...section.children);
      } else {
        posts.push(section);
      }
    }
    return posts;
  }

  private getFormattedDate(): string {
    const date = new Date();
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  private getReadingTime(post: WebsiteSection | undefined): number {
    if (!post) return 5;
    return Math.max(3, Math.min(15, post.children.length * 2 + 3));
  }

  private renderPostCard(post: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(post.name);
    const icons = ['📝', '💡', '🎯', '📊', '🔍', '💭'];
    const readTime = this.getReadingTime(post);

    return `          <article class="post-card" id="${post.slug}">
            <div class="post-image">
              <span class="post-icon">${icons[index % icons.length]}</span>
            </div>
            <div class="post-content">
              <h3>${this.escapeHtml(title)}</h3>
              <div class="post-meta">
                <span>⏱️ ${readTime} min</span>
                <span>📚 ${post.children.length} topics</span>
              </div>
            </div>
          </article>`;
  }

  private renderTopicCard(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const icons = ['📖', '🎯', '⚡', '💡', '🔧', '📊'];
    const articleCount = section.children.length;

    return `          <a href="#${section.slug}" class="topic-card">
            <span class="topic-icon">${icons[index % icons.length]}</span>
            <h4>${this.escapeHtml(title)}</h4>
            <span class="topic-count">${articleCount} articles</span>
          </a>`;
  }

  private renderArchiveItem(post: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(post.name);
    const readTime = this.getReadingTime(post);

    return `          <article class="archive-item">
            <span class="archive-date">${this.getFormattedDate()}</span>
            <h4><a href="#${post.slug}">${this.escapeHtml(title)}</a></h4>
            <span class="archive-meta">${readTime} min read</span>
          </article>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables(options.colorTheme)}
      --max-width: 1000px;
      --content-width: 680px;
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
      font-size: 1.35rem;
      color: var(--text);
      text-decoration: none;
      letter-spacing: -0.02em;
    }

    .nav-menu {
      display: flex;
      list-style: none;
      gap: 2rem;
    }

    .nav-menu a {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.95rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--text); }

    .nav-cta {
      background: var(--primary);
      color: white;
      padding: 0.5rem 1.25rem;
      border-radius: 50px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }

    @media (max-width: 768px) {
      .nav-menu { display: none; }
    }

    /* HERO */
    .hero {
      padding: 10rem 2rem 5rem;
      border-bottom: 1px solid var(--border);
    }

    .hero-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    .featured-badge {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 0.3rem 0.75rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1.5rem;
    }

    .hero h1 {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      line-height: 1.2;
      margin-bottom: 1rem;
    }

    .hero-excerpt {
      font-size: 1.25rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1.5rem;
    }

    .hero-meta {
      display: flex;
      gap: 1.5rem;
      margin-bottom: 2rem;
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .hero-visual {
      display: flex;
      justify-content: center;
    }

    .hero-card {
      width: 250px;
      height: 300px;
      background: var(--bg-alt);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: var(--shadow-lg);
    }

    .card-icon {
      font-size: 5rem;
    }

    @media (max-width: 900px) {
      .hero-container { grid-template-columns: 1fr; }
      .hero-visual { display: none; }
    }

    /* BUTTONS */
    .btn {
      display: inline-block;
      padding: 0.9rem 1.75rem;
      border-radius: 50px;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s;
      border: none;
      cursor: pointer;
    }

    .btn-primary {
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
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
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 3rem;
    }

    .section-header h2 {
      font-size: 1.75rem;
      font-weight: 700;
    }

    .article-count {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    .section-desc {
      color: var(--text-muted);
      font-size: 1rem;
    }

    /* POSTS GRID */
    .posts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
    }

    .post-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      transition: all 0.3s;
      cursor: pointer;
      scroll-margin-top: 100px;
    }

    .post-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }

    .post-image {
      height: 180px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .post-icon {
      font-size: 4rem;
    }

    .post-content {
      padding: 1.5rem;
    }

    .post-content h3 {
      font-size: 1.15rem;
      font-weight: 600;
      margin-bottom: 0.75rem;
      line-height: 1.4;
    }

    .post-meta {
      display: flex;
      gap: 1rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* TOPICS */
    .section-topics {
      background: var(--bg-alt);
    }

    .section-topics .section-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 0.5rem;
    }

    .topics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.5rem;
    }

    .topic-card {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 2rem;
      text-align: center;
      text-decoration: none;
      transition: all 0.2s;
    }

    .topic-card:hover {
      border-color: var(--primary);
      transform: translateY(-4px);
      box-shadow: var(--shadow);
    }

    .topic-icon {
      font-size: 2.5rem;
      display: block;
      margin-bottom: 1rem;
    }

    .topic-card h4 {
      font-size: 1.1rem;
      color: var(--text);
      margin-bottom: 0.5rem;
    }

    .topic-count {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    /* SUBSCRIBE */
    .section-subscribe {
      text-align: center;
    }

    .subscribe-box {
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      color: white;
      padding: 4rem;
      border-radius: 20px;
      max-width: 600px;
      margin: 0 auto;
    }

    .subscribe-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 1.5rem;
    }

    .subscribe-box h2 {
      font-size: 2rem;
      margin-bottom: 0.75rem;
    }

    .subscribe-box p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .subscribe-form {
      display: flex;
      gap: 0.75rem;
      max-width: 400px;
      margin: 0 auto 1.5rem;
    }

    .subscribe-form input {
      flex: 1;
      padding: 0.9rem 1.25rem;
      border: none;
      border-radius: 50px;
      font-size: 1rem;
    }

    .subscribe-note {
      font-size: 0.85rem;
      opacity: 0.7;
    }

    @media (max-width: 600px) {
      .subscribe-form {
        flex-direction: column;
      }
    }

    /* ARCHIVE */
    .section-archive {
      border-top: 1px solid var(--border);
    }

    .section-archive h2 {
      font-size: 1.5rem;
      margin-bottom: 2rem;
    }

    .archive-list {
      max-width: var(--content-width);
    }

    .archive-item {
      display: flex;
      align-items: center;
      gap: 1.5rem;
      padding: 1.25rem 0;
      border-bottom: 1px solid var(--border);
    }

    .archive-date {
      font-size: 0.85rem;
      color: var(--text-muted);
      min-width: 90px;
    }

    .archive-item h4 {
      flex: 1;
      font-size: 1rem;
      font-weight: 500;
    }

    .archive-item h4 a {
      color: var(--text);
      text-decoration: none;
    }

    .archive-item h4 a:hover {
      color: var(--primary);
    }

    .archive-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .archive-more {
      padding-top: 1.5rem;
      color: var(--primary);
      font-style: italic;
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
      margin-bottom: 0.5rem;
    }

    .footer-content > p {
      color: var(--text-muted);
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
      font-size: 0.85rem;
      color: var(--text-muted);
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

    document.querySelectorAll('.post-card, .topic-card').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s, transform 0.5s';
      observer.observe(el);
    });
    `;
  }
}

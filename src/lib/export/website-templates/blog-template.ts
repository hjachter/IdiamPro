'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Blog/News Website Template
 *
 * Features: Featured posts, category navigation, author info, date stamps
 * Best for: Articles, updates, news feeds, content hubs
 */
export class BlogTemplate extends BaseWebsiteTemplate {
  readonly id = 'blog';
  readonly name = 'Blog';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    // Treat each top-level section as a category, children as posts
    const categories = sections.filter(s => s.children.length > 0);
    const posts = this.extractAllPosts(sections);
    const featuredPosts = posts.slice(0, 3);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#featured">Featured</a></li>
        <li><a href="#latest">Latest</a></li>
${categories.slice(0, 3).map(cat => `        <li><a href="#${cat.slug}">${this.escapeHtml(this.cleanName(cat.name))}</a></li>`).join('\n')}
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
${featuredPosts.length > 0 ? this.renderFeaturedSection(featuredPosts, options) : ''}
${this.renderLatestSection(posts.slice(3), options)}
${categories.map(cat => this.renderCategorySection(cat, options)).join('\n')}
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

  private extractAllPosts(sections: WebsiteSection[]): WebsiteSection[] {
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

  private renderFeaturedSection(posts: WebsiteSection[], options: WebsiteTemplateOptions): string {
    return `
    <section id="featured" class="section section-featured">
      <div class="section-container">
        <h2>Featured</h2>
        <div class="featured-grid">
          <div class="featured-main">
${this.renderFeaturedPost(posts[0], options, true)}
          </div>
          <div class="featured-side">
${posts.slice(1, 3).map(post => this.renderFeaturedPost(post, options, false)).join('\n')}
          </div>
        </div>
      </div>
    </section>`;
  }

  private renderFeaturedPost(post: WebsiteSection, options: WebsiteTemplateOptions, isMain: boolean): string {
    const title = this.cleanName(post.name);
    const excerpt = options.includeContent ? this.extractFirstParagraph(post.content) : '';
    const category = post.node.parentId || 'General';

    return `            <article class="featured-post${isMain ? ' main' : ''}">
              <div class="post-image">
                <span class="post-placeholder">${this.getPostIcon(title)}</span>
              </div>
              <div class="post-content">
                <span class="post-category">${this.escapeHtml(this.cleanName(category))}</span>
                <h3><a href="#${post.slug}">${this.escapeHtml(title)}</a></h3>
${excerpt ? `                <p>${excerpt}</p>` : ''}
                <span class="post-date">${this.getRandomDate()}</span>
              </div>
            </article>`;
  }

  private renderLatestSection(posts: WebsiteSection[], options: WebsiteTemplateOptions): string {
    if (posts.length === 0) return '';

    return `
    <section id="latest" class="section">
      <div class="section-container">
        <h2>Latest Posts</h2>
        <div class="post-grid">
${posts.slice(0, 6).map(post => this.renderPostCard(post, options)).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderCategorySection(category: WebsiteSection, options: WebsiteTemplateOptions): string {
    const categoryName = this.cleanName(category.name);

    return `
    <section id="${category.slug}" class="section section-alt">
      <div class="section-container">
        <h2>${this.escapeHtml(categoryName)}</h2>
${options.includeContent && category.content ? `        <p class="section-intro">${this.extractFirstParagraph(category.content)}</p>` : ''}
        <div class="post-grid">
${category.children.slice(0, 6).map(post => this.renderPostCard(post, options)).join('\n')}
        </div>
      </div>
    </section>`;
  }

  private renderPostCard(post: WebsiteSection, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(post.name);
    const excerpt = options.includeContent ? this.extractFirstParagraph(post.content) : '';

    return `          <article class="post-card">
            <div class="post-image">
              <span class="post-placeholder">${this.getPostIcon(title)}</span>
            </div>
            <div class="post-content">
              <h3><a href="#${post.slug}">${this.escapeHtml(title)}</a></h3>
${excerpt ? `              <p>${excerpt}</p>` : ''}
              <span class="post-date">${this.getRandomDate()}</span>
            </div>
          </article>`;
  }

  private getPostIcon(title: string): string {
    const icons = ['📝', '💡', '🎯', '📊', '🔍', '💭', '📰', '✨'];
    const hash = title.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return icons[hash % icons.length];
  }

  private getRandomDate(): string {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[Math.floor(Math.random() * 12)];
    const day = Math.floor(Math.random() * 28) + 1;
    return `${month} ${day}, 2024`;
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
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .nav-menu a:hover { color: var(--text); }

    /* Hero */
    .hero {
      padding: 8rem 2rem 4rem;
      text-align: center;
      border-bottom: 1px solid var(--border);
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .tagline {
      font-size: 1.1rem;
      color: var(--text-muted);
    }

    /* Sections */
    .section {
      padding: 4rem 2rem;
    }

    .section-alt {
      background: var(--bg-alt);
    }

    .section-featured {
      background: var(--bg-alt);
    }

    .section-container {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .section h2 {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 2rem;
    }

    .section-intro {
      color: var(--text-muted);
      margin-bottom: 2rem;
      max-width: 600px;
    }

    /* Featured Grid */
    .featured-grid {
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 2rem;
    }

    .featured-side {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .featured-post {
      background: var(--bg);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
    }

    .featured-post.main {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .featured-post.main .post-image {
      height: 300px;
    }

    .featured-post .post-image {
      height: 150px;
      background: var(--bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .post-placeholder {
      font-size: 3rem;
    }

    .featured-post .post-content {
      padding: 1.5rem;
      flex: 1;
    }

    .post-category {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--primary);
      font-weight: 600;
    }

    .featured-post h3 {
      font-size: 1.25rem;
      margin: 0.5rem 0;
      line-height: 1.3;
    }

    .featured-post h3 a {
      color: var(--text);
      text-decoration: none;
    }

    .featured-post h3 a:hover {
      color: var(--primary);
    }

    .featured-post p {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }

    .post-date {
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    /* Post Grid */
    .post-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 2rem;
    }

    .post-card {
      background: var(--bg);
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: var(--shadow);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .post-card:hover {
      transform: translateY(-4px);
      box-shadow: var(--shadow-lg);
    }

    .post-card .post-image {
      height: 180px;
      background: var(--bg-alt);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .post-card .post-content {
      padding: 1.25rem;
    }

    .post-card h3 {
      font-size: 1.1rem;
      margin-bottom: 0.5rem;
      line-height: 1.3;
    }

    .post-card h3 a {
      color: var(--text);
      text-decoration: none;
    }

    .post-card h3 a:hover {
      color: var(--primary);
    }

    .post-card p {
      color: var(--text-muted);
      font-size: 0.9rem;
      line-height: 1.5;
      margin-bottom: 0.5rem;
    }

    /* Footer */
    footer {
      padding: 2rem;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid var(--border);
    }

    @media (max-width: 900px) {
      .featured-grid {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 768px) {
      .nav-menu { display: none; }
      .hero { padding: 6rem 1.5rem 3rem; }
      .post-grid { grid-template-columns: 1fr; }
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

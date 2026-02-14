'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Educational Website Template
 *
 * Inspired by Coursera, Udemy, MasterClass
 * Features: Curriculum outline, module structure, learning outcomes,
 * progress-style layout, enrollment CTA
 * Best for: Courses, tutorials, learning paths, training materials
 */
export class EducationalTemplate extends BaseWebsiteTemplate {
  readonly id = 'educational';
  readonly name = 'Educational';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const totalTopics = this.countTopics(sections);
    const learningOutcomes = this.extractOutcomes(sections);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#overview">Overview</a></li>
        <li><a href="#curriculum">Curriculum</a></li>
        <li><a href="#outcomes">Outcomes</a></li>
      </ul>
      <a href="#enroll" class="nav-cta">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </nav>

  <!-- HERO -->
  <header class="hero">
    <div class="hero-container">
      <div class="hero-content">
        <div class="course-badge">Comprehensive Course</div>
        <h1>${this.escapeHtml(options.title)}</h1>
        <p class="hero-tagline">${options.tagline ? this.escapeHtml(options.tagline) : 'Master essential skills and knowledge'}</p>
        <div class="course-stats">
          <div class="stat">
            <span class="stat-icon">📚</span>
            <span class="stat-value">${sections.length} Modules</span>
          </div>
          <div class="stat">
            <span class="stat-icon">📝</span>
            <span class="stat-value">${totalTopics}+ Lessons</span>
          </div>
          <div class="stat">
            <span class="stat-icon">🎯</span>
            <span class="stat-value">Self-Paced</span>
          </div>
        </div>
        <div class="hero-cta">
          <a href="#enroll" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
          <a href="#curriculum" class="btn btn-outline">View Curriculum</a>
        </div>
      </div>
      <div class="hero-visual">
        <div class="course-card">
          <div class="card-icon">🎓</div>
          <div class="card-info">
            <span class="card-label">Course Progress</span>
            <div class="progress-bar">
              <div class="progress-fill" style="width: 0%"></div>
            </div>
            <span class="card-status">Ready to Start</span>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main>
    <!-- OVERVIEW -->
    <section id="overview" class="section section-overview">
      <div class="section-container">
        <div class="overview-grid">
          <div class="overview-content">
            <span class="section-eyebrow">About This Course</span>
            <h2>What You'll Master</h2>
            <p>${options.tagline ? this.escapeHtml(options.tagline) : 'A comprehensive learning journey.'}</p>
            <p>This course is structured into ${sections.length} comprehensive modules, each designed to build upon the previous one, creating a complete understanding of the subject matter.</p>
            <ul class="feature-list">
              <li>✓ ${totalTopics}+ detailed lessons</li>
              <li>✓ Structured learning path</li>
              <li>✓ Actionable insights</li>
              <li>✓ Comprehensive coverage</li>
            </ul>
          </div>
          <div class="overview-highlights">
${sections.slice(0, 3).map((s, i) => `            <div class="highlight-item">
              <span class="highlight-num">${String(i + 1).padStart(2, '0')}</span>
              <div class="highlight-content">
                <h4>${this.escapeHtml(this.cleanName(s.name))}</h4>
                <span>${s.children.length} lessons</span>
              </div>
            </div>`).join('\n')}
          </div>
        </div>
      </div>
    </section>

    <!-- LEARNING OUTCOMES -->
    <section id="outcomes" class="section section-outcomes">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Skills You'll Gain</span>
          <h2>Learning Outcomes</h2>
          <p class="section-desc">By the end of this course, you will:</p>
        </div>
        <div class="outcomes-grid">
${learningOutcomes.map((outcome, i) => `          <div class="outcome-card">
            <span class="outcome-icon">✓</span>
            <span class="outcome-text">${this.escapeHtml(outcome)}</span>
          </div>`).join('\n')}
        </div>
      </div>
    </section>

    <!-- CURRICULUM -->
    <section id="curriculum" class="section section-curriculum">
      <div class="section-container">
        <div class="section-header">
          <span class="section-eyebrow">Course Content</span>
          <h2>Full Curriculum</h2>
          <p class="section-desc">${sections.length} modules · ${totalTopics}+ lessons · Comprehensive coverage</p>
        </div>
        <div class="curriculum-list">
${sections.map((section, i) => this.renderModule(section, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <!-- ENROLL -->
    <section id="enroll" class="section section-enroll">
      <div class="section-container">
        <div class="enroll-box">
          <div class="enroll-content">
            <span class="section-eyebrow">Start Learning</span>
            <h2>Enroll Today</h2>
            <p>Get full access to all ${sections.length} modules and ${totalTopics}+ lessons.</p>
            <a href="#" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
          </div>
          <div class="enroll-features">
            <div class="feature">
              <span class="feature-icon">📚</span>
              <span class="feature-text">${sections.length} Modules</span>
            </div>
            <div class="feature">
              <span class="feature-icon">📝</span>
              <span class="feature-text">${totalTopics}+ Lessons</span>
            </div>
            <div class="feature">
              <span class="feature-icon">♾️</span>
              <span class="feature-text">Lifetime Access</span>
            </div>
            <div class="feature">
              <span class="feature-icon">📱</span>
              <span class="feature-text">Any Device</span>
            </div>
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

  private extractOutcomes(sections: WebsiteSection[]): string[] {
    const outcomes: string[] = [];
    for (const section of sections.slice(0, 6)) {
      outcomes.push(`Master ${this.cleanName(section.name).toLowerCase()}`);
    }
    return outcomes;
  }

  private renderModule(section: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const title = this.cleanName(section.name);
    const lessonCount = section.children.length;
    const lessons = section.children.slice(0, 5);

    return `          <div class="module" id="${section.slug}">
            <div class="module-header" onclick="toggleModule(this)">
              <div class="module-info">
                <span class="module-num">Module ${index + 1}</span>
                <h3>${this.escapeHtml(title)}</h3>
                <span class="module-meta">${lessonCount} lessons</span>
              </div>
              <span class="module-toggle">+</span>
            </div>
            <div class="module-content">
              <ul class="lesson-list">
${lessons.map((lesson, i) => `                <li class="lesson">
                  <span class="lesson-num">${index + 1}.${i + 1}</span>
                  <span class="lesson-title">${this.escapeHtml(this.cleanName(lesson.name))}</span>
                </li>`).join('\n')}
${lessonCount > 5 ? `                <li class="lesson more">+ ${lessonCount - 5} more lessons</li>` : ''}
              </ul>
            </div>
          </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --max-width: 1100px;
      --success: #10b981;
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
      color: var(--text);
      text-decoration: none;
      font-size: 0.9rem;
    }

    .nav-cta {
      background: var(--primary);
      color: white;
      padding: 0.6rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      font-size: 0.9rem;
      text-decoration: none;
    }

    @media (max-width: 768px) {
      .nav-menu { display: none; }
    }

    /* HERO */
    .hero {
      background: var(--bg-alt);
      padding: 10rem 2rem 5rem;
    }

    .hero-container {
      max-width: var(--max-width);
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.5fr 1fr;
      gap: 4rem;
      align-items: center;
    }

    .course-badge {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 0.4rem 1rem;
      border-radius: 50px;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }

    .hero h1 {
      font-size: clamp(2rem, 4vw, 3rem);
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .hero-tagline {
      font-size: 1.15rem;
      color: var(--text-muted);
      margin-bottom: 2rem;
    }

    .course-stats {
      display: flex;
      gap: 2rem;
      margin-bottom: 2.5rem;
    }

    .stat {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .stat-icon {
      font-size: 1.25rem;
    }

    .stat-value {
      font-size: 0.95rem;
      color: var(--text-muted);
    }

    .hero-cta {
      display: flex;
      gap: 1rem;
    }

    .course-card {
      background: var(--bg);
      border-radius: 16px;
      padding: 2rem;
      box-shadow: var(--shadow-lg);
    }

    .card-icon {
      font-size: 3rem;
      margin-bottom: 1rem;
    }

    .card-label {
      display: block;
      font-size: 0.85rem;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }

    .progress-bar {
      height: 8px;
      background: var(--bg-alt);
      border-radius: 4px;
      margin-bottom: 0.75rem;
    }

    .progress-fill {
      height: 100%;
      background: var(--success);
      border-radius: 4px;
    }

    .card-status {
      font-size: 0.9rem;
      font-weight: 600;
      color: var(--success);
    }

    @media (max-width: 900px) {
      .hero-container { grid-template-columns: 1fr; }
      .hero-visual { display: none; }
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
      background: var(--primary);
      color: white;
    }

    .btn-primary:hover {
      background: var(--primary-dark);
      transform: translateY(-2px);
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
      margin-bottom: 1rem;
    }

    .section-desc {
      color: var(--text-muted);
      font-size: 1.1rem;
    }

    /* OVERVIEW */
    .overview-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
      align-items: start;
    }

    .overview-content h2 {
      font-size: 2rem;
      font-weight: 700;
      margin: 0.5rem 0 1.5rem;
    }

    .overview-content p {
      color: var(--text-muted);
      line-height: 1.7;
      margin-bottom: 1rem;
    }

    .feature-list {
      list-style: none;
      margin-top: 2rem;
    }

    .feature-list li {
      padding: 0.5rem 0;
      font-weight: 500;
    }

    .overview-highlights {
      display: flex;
      flex-direction: column;
      gap: 1.5rem;
    }

    .highlight-item {
      display: flex;
      gap: 1.5rem;
      align-items: center;
      padding: 1.5rem;
      background: var(--bg-alt);
      border-radius: 12px;
    }

    .highlight-num {
      font-size: 2rem;
      font-weight: 800;
      color: var(--primary);
      opacity: 0.3;
    }

    .highlight-content h4 {
      font-size: 1.1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .highlight-content span {
      font-size: 0.9rem;
      color: var(--text-muted);
    }

    @media (max-width: 768px) {
      .overview-grid { grid-template-columns: 1fr; }
    }

    /* OUTCOMES */
    .section-outcomes {
      background: var(--bg-alt);
    }

    .outcomes-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1rem;
    }

    .outcome-card {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--bg);
      padding: 1.25rem 1.5rem;
      border-radius: 10px;
    }

    .outcome-icon {
      color: var(--success);
      font-size: 1.25rem;
      font-weight: 700;
    }

    .outcome-text {
      font-size: 0.95rem;
    }

    /* CURRICULUM */
    .curriculum-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .module {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
      scroll-margin-top: 100px;
    }

    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem;
      cursor: pointer;
      transition: background 0.2s;
    }

    .module-header:hover {
      background: var(--bg-alt);
    }

    .module-info {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .module-num {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--primary);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .module-info h3 {
      font-size: 1.1rem;
      font-weight: 600;
    }

    .module-meta {
      font-size: 0.85rem;
      color: var(--text-muted);
    }

    .module-toggle {
      font-size: 1.5rem;
      color: var(--primary);
      transition: transform 0.2s;
    }

    .module.open .module-toggle {
      transform: rotate(45deg);
    }

    .module-content {
      display: none;
      padding: 0 1.5rem 1.5rem;
      border-top: 1px solid var(--border);
      background: var(--bg-alt);
    }

    .module.open .module-content {
      display: block;
    }

    .lesson-list {
      list-style: none;
      padding-top: 1rem;
    }

    .lesson {
      display: flex;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);
    }

    .lesson:last-child {
      border-bottom: none;
    }

    .lesson-num {
      font-size: 0.85rem;
      color: var(--text-muted);
      min-width: 2.5rem;
    }

    .lesson-title {
      font-size: 0.95rem;
    }

    .lesson.more {
      color: var(--primary);
      font-style: italic;
    }

    /* ENROLL */
    .section-enroll {
      text-align: center;
    }

    .enroll-box {
      background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
      color: white;
      padding: 4rem;
      border-radius: 20px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3rem;
      align-items: center;
    }

    .enroll-content {
      text-align: left;
    }

    .enroll-content .section-eyebrow {
      color: rgba(255, 255, 255, 0.7);
    }

    .enroll-content h2 {
      font-size: 2.5rem;
      margin: 0.5rem 0 1rem;
    }

    .enroll-content p {
      font-size: 1.1rem;
      opacity: 0.9;
      margin-bottom: 2rem;
    }

    .enroll-features {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }

    .enroll-features .feature {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      background: rgba(255, 255, 255, 0.1);
      padding: 1rem 1.25rem;
      border-radius: 10px;
    }

    .feature-icon {
      font-size: 1.5rem;
    }

    .feature-text {
      font-weight: 500;
    }

    @media (max-width: 900px) {
      .enroll-box {
        grid-template-columns: 1fr;
        text-align: center;
      }
      .enroll-content { text-align: center; }
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
    function toggleModule(header) {
      const module = header.parentElement;
      module.classList.toggle('open');
    }

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

    document.querySelectorAll('.module, .outcome-card, .highlight-item').forEach(el => {
      el.style.opacity = '0';
      el.style.transform = 'translateY(20px)';
      el.style.transition = 'opacity 0.5s, transform 0.5s';
      observer.observe(el);
    });
    `;
  }
}

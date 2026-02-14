'use client';

import { BaseWebsiteTemplate, type WebsiteSection, type WebsiteTemplateOptions } from './base-template';

/**
 * Educational Website Template
 *
 * Features: Module structure, lesson cards, progress indicators, quiz sections
 * Best for: Courses, tutorials, learning paths, training materials
 */
export class EducationalTemplate extends BaseWebsiteTemplate {
  readonly id = 'educational';
  readonly name = 'Educational';

  generate(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    const modules = sections;
    const totalLessons = modules.reduce((sum, m) => sum + m.children.length, 0);

    const body = `
  <nav class="navbar">
    <div class="nav-container">
      <a href="#" class="nav-logo">${this.escapeHtml(options.title)}</a>
      <ul class="nav-menu">
        <li><a href="#overview">Overview</a></li>
        <li><a href="#curriculum">Curriculum</a></li>
        <li><a href="#enroll">Enroll</a></li>
      </ul>
    </div>
  </nav>

  <header class="hero">
    <div class="hero-content">
      <div class="course-badge">Course</div>
      <h1>${this.escapeHtml(options.title)}</h1>
${options.tagline ? `      <p class="tagline">${this.escapeHtml(options.tagline)}</p>` : ''}
      <div class="course-meta">
        <span>📚 ${modules.length} Modules</span>
        <span>📝 ${totalLessons} Lessons</span>
      </div>
      <a href="#enroll" class="btn btn-primary">${this.escapeHtml(options.ctaText)}</a>
    </div>
  </header>

  <main>
    <section id="overview" class="section">
      <div class="section-container">
        <h2>What You'll Learn</h2>
        <div class="learning-outcomes">
${this.renderLearningOutcomes(sections, options)}
        </div>
      </div>
    </section>

    <section id="curriculum" class="section section-alt">
      <div class="section-container">
        <h2>Course Curriculum</h2>
        <div class="curriculum">
${modules.map((module, i) => this.renderModule(module, i, options)).join('\n')}
        </div>
      </div>
    </section>

    <section id="enroll" class="section section-cta">
      <div class="section-container">
        <h2>Start Learning Today</h2>
        <p class="section-intro">Enroll now and begin your learning journey.</p>
        <a href="#" class="btn btn-primary btn-lg">${this.escapeHtml(options.ctaText)}</a>
      </div>
    </section>
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

  private renderLearningOutcomes(sections: WebsiteSection[], options: WebsiteTemplateOptions): string {
    // Extract key learning outcomes from sections
    const outcomes: string[] = [];

    for (const section of sections.slice(0, 4)) {
      outcomes.push(this.cleanName(section.name));
    }

    if (outcomes.length === 0) {
      outcomes.push('Master key concepts', 'Build practical skills', 'Apply your knowledge');
    }

    return outcomes.map(outcome => `          <div class="outcome">
            <span class="outcome-icon">✓</span>
            <span>${this.escapeHtml(outcome)}</span>
          </div>`).join('\n');
  }

  private renderModule(module: WebsiteSection, index: number, options: WebsiteTemplateOptions): string {
    const moduleName = this.cleanName(module.name);
    const lessons = module.children;
    const moduleNum = index + 1;

    return `          <div class="module" data-module="${moduleNum}">
            <div class="module-header" onclick="toggleModule(${moduleNum})">
              <div class="module-info">
                <span class="module-number">Module ${moduleNum}</span>
                <h3>${this.escapeHtml(moduleName)}</h3>
                <span class="module-meta">${lessons.length} lessons</span>
              </div>
              <span class="module-toggle">▼</span>
            </div>
            <div class="module-content">
${options.includeContent && module.content ? `              <p class="module-description">${this.extractFirstParagraph(module.content)}</p>` : ''}
              <ul class="lesson-list">
${lessons.map((lesson, i) => `                <li class="lesson">
                  <span class="lesson-number">${moduleNum}.${i + 1}</span>
                  <span class="lesson-title">${this.escapeHtml(this.cleanName(lesson.name))}</span>
                </li>`).join('\n')}
              </ul>
            </div>
          </div>`;
  }

  private getStyles(options: WebsiteTemplateOptions): string {
    return `
    :root {
      ${this.getBaseVariables()}
      --success: #10b981;
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

    /* Hero */
    .hero {
      background: var(--bg-alt);
      padding: 10rem 2rem 5rem;
      text-align: center;
    }

    .course-badge {
      display: inline-block;
      background: var(--primary);
      color: white;
      padding: 0.35rem 1rem;
      border-radius: 2rem;
      font-size: 0.8rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .hero h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      font-weight: 700;
      margin-bottom: 1rem;
    }

    .tagline {
      font-size: 1.2rem;
      color: var(--text-muted);
      margin-bottom: 1.5rem;
      max-width: 600px;
      margin-left: auto;
      margin-right: auto;
    }

    .course-meta {
      display: flex;
      justify-content: center;
      gap: 2rem;
      margin-bottom: 2rem;
      color: var(--text-muted);
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

    .section-cta {
      background: var(--primary);
      color: white;
      text-align: center;
    }

    .section-cta .btn-primary {
      background: white;
      color: var(--primary);
    }

    .section-cta .section-intro {
      color: rgba(255,255,255,0.9);
    }

    .section-container {
      max-width: 900px;
      margin: 0 auto;
    }

    .section h2 {
      font-size: 2rem;
      font-weight: 700;
      margin-bottom: 2rem;
      text-align: center;
    }

    .section-intro {
      text-align: center;
      color: var(--text-muted);
      font-size: 1.1rem;
      margin-bottom: 2rem;
    }

    /* Learning Outcomes */
    .learning-outcomes {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1rem;
    }

    .outcome {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: var(--bg-alt);
      border-radius: var(--radius);
    }

    .outcome-icon {
      color: var(--success);
      font-weight: bold;
      font-size: 1.25rem;
    }

    /* Curriculum */
    .curriculum {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .module {
      background: var(--bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      overflow: hidden;
    }

    .module-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.25rem 1.5rem;
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

    .module-number {
      font-size: 0.8rem;
      color: var(--primary);
      font-weight: 600;
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
      color: var(--text-muted);
      transition: transform 0.2s;
    }

    .module.collapsed .module-toggle {
      transform: rotate(-90deg);
    }

    .module-content {
      padding: 0 1.5rem 1.5rem;
      border-top: 1px solid var(--border);
    }

    .module.collapsed .module-content {
      display: none;
    }

    .module-description {
      color: var(--text-muted);
      font-size: 0.95rem;
      margin-bottom: 1rem;
      padding-top: 1rem;
    }

    .lesson-list {
      list-style: none;
    }

    .lesson {
      display: flex;
      align-items: center;
      gap: 1rem;
      padding: 0.75rem 0;
      border-bottom: 1px solid var(--border);
    }

    .lesson:last-child {
      border-bottom: none;
    }

    .lesson-number {
      font-size: 0.85rem;
      color: var(--text-muted);
      min-width: 2.5rem;
    }

    .lesson-title {
      font-size: 0.95rem;
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
      .course-meta { flex-direction: column; gap: 0.5rem; }
    }
    `;
  }

  private getScripts(): string {
    return `
    function toggleModule(num) {
      const module = document.querySelector('[data-module="' + num + '"]');
      module.classList.toggle('collapsed');
    }

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

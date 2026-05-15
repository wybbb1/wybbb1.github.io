const GITHUB_USERNAME = 'wybbb1';

const LANG_COLORS = {
  Java: '#b07219',
  JavaScript: '#f1e05a',
  TypeScript: '#3178c6',
  Python: '#3572A5',
  HTML: '#e34c26',
  CSS: '#563d7c',
  Shell: '#89e051',
  Go: '#00ADD8',
  Rust: '#dea584',
  'C++': '#f34b7d',
  C: '#555555',
};

const CATEGORY_COLORS = {
  AI:     { bg: '#f3e8ff', text: '#7c3aed', border: '#c084fc' },
  Redis:  { bg: '#ffe4e6', text: '#e11d48', border: '#fb7185' },
  JVM:    { bg: '#fff7ed', text: '#ea580c', border: '#fb923c' },
  MySQL:  { bg: '#ecfeff', text: '#0891b2', border: '#22d3ee' },
  实战:   { bg: '#ecfdf5', text: '#059669', border: '#34d399' },
  CS:     { bg: '#fefce8', text: '#ca8a04', border: '#facc15' },
};

function getCategoryColor(cat) {
  return CATEGORY_COLORS[cat] || { bg: '#dbeafe', text: '#2563eb', border: '#60a5fa' };
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ========== Blog: Recent Posts (index) ==========
async function loadRecentPosts(count) {
  const container = document.getElementById('recent-posts');
  if (!container) return;

  try {
    const res = await fetch('posts.json');
    const posts = await res.json();
    const recent = posts.slice(0, count || 3);

    container.innerHTML = recent.map(post => {
      const c = getCategoryColor(post.category);
      return `
      <a href="post.html?file=${encodeURIComponent(post.file)}" class="card" style="border-left: 3px solid ${c.border}">
        <h3>${post.title}</h3>
        <span class="card-category" style="background:${c.bg};color:${c.text}">${post.category}</span>
        <div class="card-meta">
          <span>${formatDate(post.date)}</span>
        </div>
      </a>
    `}).join('');
  } catch (e) {
    container.innerHTML = '<div class="empty">加载失败</div>';
  }
}

// ========== Blog: Full List (blog.html) ==========
let allPosts = [];

async function loadBlogList() {
  const container = document.getElementById('blog-list');
  const filtersContainer = document.getElementById('category-filters');
  if (!container) return;

  try {
    const res = await fetch('posts.json');
    allPosts = await res.json();

    const categories = [...new Set(allPosts.map(p => p.category))];

    filtersContainer.innerHTML = `<button class="filter-tab active" data-cat="all">全部</button>` +
      categories.map(cat => {
        const c = getCategoryColor(cat);
        return `<button class="filter-tab" data-cat="${cat}" style="--tab-active:${c.text};--tab-hover:${c.border}">${cat}</button>`;
      }).join('');

    filtersContainer.addEventListener('click', e => {
      if (!e.target.classList.contains('filter-tab')) return;
      filtersContainer.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.style.background = '';
        t.style.borderColor = '';
        t.style.color = '';
      });
      e.target.classList.add('active');
      const cat = e.target.dataset.cat;
      if (cat !== 'all') {
        const c = getCategoryColor(cat);
        e.target.style.background = c.text;
        e.target.style.borderColor = c.text;
      }
      renderBlogList(cat);
    });

    renderBlogList('all');
  } catch (e) {
    container.innerHTML = '<div class="empty">加载失败</div>';
  }
}

function renderBlogList(category) {
  const container = document.getElementById('blog-list');
  const filtered = category === 'all' ? allPosts : allPosts.filter(p => p.category === category);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">暂无文章</div>';
    return;
  }

  container.innerHTML = filtered.map(post => {
    const c = getCategoryColor(post.category);
    return `
    <div class="blog-item">
      <a href="post.html?file=${encodeURIComponent(post.file)}">${post.title}</a>
      <div class="blog-item-right">
        <span class="blog-item-cat" style="background:${c.bg};color:${c.text}">${post.category}</span>
        <span class="blog-item-date">${formatDate(post.date)}</span>
      </div>
    </div>
  `}).join('');
}

// ========== Post: Render Markdown (post.html) ==========
async function loadPost() {
  const params = new URLSearchParams(window.location.search);
  const file = params.get('file');
  if (!file) {
    document.getElementById('post-body').innerHTML = '<div class="empty">未指定文章</div>';
    return;
  }

  try {
    const res = await fetch(`posts/${file}`);
    if (!res.ok) throw new Error('File not found');
    const text = await res.text();

    const { title, date, category, content } = parseFrontmatter(text);

    document.getElementById('post-title').textContent = title || file;
    document.getElementById('post-date').textContent = date ? formatDate(date) : '';
    document.title = `${title || '文章'} - wybbb1`;

    const catEl = document.getElementById('post-category');
    if (category) {
      const c = getCategoryColor(category);
      catEl.textContent = category;
      catEl.style.background = c.text;
    }

    const readingTime = Math.max(1, Math.ceil(content.replace(/[#*`\[\]()>_-]/g, '').length / 400));
    document.getElementById('post-reading-time').textContent = `约 ${readingTime} 分钟阅读`;

    const html = marked.parse(content).replace(/\.\.\/images\//g, 'images/');
    const postBody = document.getElementById('post-body');
    postBody.innerHTML = html;

    addHeadingIds(postBody);
    buildTOC(postBody);
    trackActiveHeading(postBody);
  } catch (e) {
    document.getElementById('post-body').innerHTML = '<div class="empty">文章加载失败</div>';
  }
}

function parseFrontmatter(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { content: text };

  const frontmatter = match[1];
  const content = match[2];

  const title = (frontmatter.match(/title:\s*(.+)/) || [])[1]?.trim() || '';
  const date = (frontmatter.match(/date:\s*(.+)/) || [])[1]?.trim() || '';
  const rawCat = frontmatter.match(/categories:\s*\n(\s+-\s+.+\n?)+/);
  const category = rawCat ? rawCat[0].match(/-\s+(.+)/)?.[1]?.trim() || '' : '';

  return { title, date, category, content };
}

function addHeadingIds(container) {
  const headings = container.querySelectorAll('h2, h3, h4');
  const usedIds = {};
  headings.forEach(h => {
    const base = h.textContent.trim().replace(/[^\w一-龥]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
    let id = base;
    let count = 1;
    while (usedIds[id]) {
      id = `${base}-${count++}`;
    }
    usedIds[id] = true;
    h.id = id;
  });
}

function buildTOC(container) {
  const tocNav = document.getElementById('toc-nav');
  if (!tocNav) return;

  const headings = container.querySelectorAll('h2, h3, h4');
  if (headings.length === 0) {
    document.getElementById('toc-sidebar').style.display = 'none';
    return;
  }

  const items = [];
  headings.forEach(h => {
    const level = h.tagName.toLowerCase();
    items.push(`<li><a href="#${h.id}" class="toc-${level}" data-id="${h.id}">${h.textContent}</a></li>`);
  });

  tocNav.innerHTML = `<ul>${items.join('')}</ul>`;

  tocNav.addEventListener('click', e => {
    if (e.target.tagName !== 'A') return;
    e.preventDefault();
    const target = document.getElementById(e.target.dataset.id);
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function trackActiveHeading(container) {
  const tocLinks = document.querySelectorAll('#toc-nav a');
  if (tocLinks.length === 0) return;

  const headings = container.querySelectorAll('h2, h3, h4');

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = document.querySelector(`#toc-nav a[data-id="${entry.target.id}"]`);
      if (!link) return;
      if (entry.isIntersecting) {
        tocLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
      }
    });
  }, {
    rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-height')) + 20}px 0px -70% 0px`,
    threshold: 0,
  });

  headings.forEach(h => observer.observe(h));
}

// ========== Projects: GitHub API ==========
let allRepos = [];

async function loadProjects() {
  const container = document.getElementById('project-list');
  const filtersContainer = document.getElementById('lang-filters');
  if (!container) return;

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=100`);
    if (!res.ok) throw new Error('API error');
    allRepos = await res.json();

    allRepos = allRepos.filter(r => !r.fork);

    const languages = [...new Set(allRepos.map(r => r.language).filter(Boolean))];

    filtersContainer.innerHTML = `<button class="filter-tab active" data-lang="all">全部</button>` +
      languages.map(lang => `<button class="filter-tab" data-lang="${lang}">${lang}</button>`).join('');

    filtersContainer.addEventListener('click', e => {
      if (!e.target.classList.contains('filter-tab')) return;
      filtersContainer.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      renderProjects(e.target.dataset.lang);
    });

    renderProjects('all');
  } catch (e) {
    container.innerHTML = '<div class="empty">项目加载失败，请稍后再试</div>';
  }
}

function renderProjects(lang) {
  const container = document.getElementById('project-list');
  const filtered = lang === 'all' ? allRepos : allRepos.filter(r => r.language === lang);

  if (filtered.length === 0) {
    container.innerHTML = '<div class="empty">暂无项目</div>';
    return;
  }

  container.innerHTML = `<div class="card-grid">${filtered.map(repo => `
    <div class="project-card">
      <h3><a href="${repo.html_url}" target="_blank">${repo.name}</a></h3>
      <p>${repo.description || '暂无描述'}</p>
      <div class="project-meta">
        ${repo.language ? `<span><span class="lang-dot" style="background:${LANG_COLORS[repo.language] || '#ccc'}"></span> ${repo.language}</span>` : ''}
        <span>⭐ ${repo.stargazers_count}</span>
        <span>🔀 ${repo.forks_count}</span>
      </div>
    </div>
  `).join('')}</div>`;
}

// ========== Index: Featured Projects ==========
async function loadFeaturedProjects(count) {
  const container = document.getElementById('featured-projects');
  if (!container) return;

  try {
    const res = await fetch(`https://api.github.com/users/${GITHUB_USERNAME}/repos?sort=updated&per_page=${count || 4}`);
    if (!res.ok) throw new Error('API error');
    const repos = (await res.json()).filter(r => !r.fork).slice(0, count || 4);

    container.innerHTML = `<div class="card-grid">${repos.map(repo => `
      <div class="project-card">
        <h3><a href="${repo.html_url}" target="_blank">${repo.name}</a></h3>
        <p>${repo.description || '暂无描述'}</p>
        <div class="project-meta">
          ${repo.language ? `<span><span class="lang-dot" style="background:${LANG_COLORS[repo.language] || '#ccc'}"></span> ${repo.language}</span>` : ''}
          <span>⭐ ${repo.stargazers_count}</span>
        </div>
      </div>
    `).join('')}</div>`;
  } catch (e) {
    container.innerHTML = '<div class="empty">项目加载失败</div>';
  }
}

// ========== Particle System (index) ==========
function initParticles() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let particles = [];
  let animationId;

  function resize() {
    const hero = canvas.parentElement;
    canvas.width = hero.offsetWidth;
    canvas.height = hero.offsetHeight;
  }

  function createParticles() {
    const count = Math.floor((canvas.width * canvas.height) / 15000);
    particles = [];
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.5 + 0.5,
      });
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37, 99, 235, 0.25)';
      ctx.fill();

      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x;
        const dy = p.y - q.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = `rgba(37, 99, 235, ${0.12 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
    }

    animationId = requestAnimationFrame(draw);
  }

  resize();
  createParticles();
  draw();

  window.addEventListener('resize', () => {
    resize();
    createParticles();
  });
}

// ========== Typing Effect (index) ==========
function initTyping(text, element) {
  if (!element) return;

  let i = 0;
  const cursor = document.createElement('span');
  cursor.className = 'cursor';
  element.textContent = '';
  element.appendChild(cursor);

  function type() {
    if (i < text.length) {
      element.insertBefore(document.createTextNode(text[i]), cursor);
      i++;
      setTimeout(type, 80 + Math.random() * 40);
    } else {
      setTimeout(() => { cursor.style.display = 'none'; }, 2000);
    }
  }

  setTimeout(type, 400);
}

// ========== Scroll Reveal (index) ==========
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal');
  if (reveals.length === 0) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => observer.observe(el));
}

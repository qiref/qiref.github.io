(function() {
  const modal = document.getElementById('search-modal');
  const backdrop = document.getElementById('search-backdrop');
  const trigger = document.getElementById('search-trigger');
  const searchInput = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  const escBtn = document.getElementById('search-esc-btn');
  const searchResults = document.getElementById('search-results');
  const searchCount = document.getElementById('search-count');
  if (!modal || !searchInput || !searchResults) return;

  let searchIndex = null;
  let activeIndex = 0;
  let isOpen = false;

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  async function loadSearchIndex() {
    if (searchIndex) return searchIndex;
    try {
      const indexUrl = modal.dataset.searchIndex || '/index.json';
      const response = await fetch(indexUrl);
      const data = await response.json();
      searchIndex = (data.pages || []).map(p => ({
        ...p,
        cleanContent: (p.content || '').replace(/\s+/g, ' ').trim()
      }));
      return searchIndex;
    } catch (e) {
      console.error('Failed to load search index:', e);
      return [];
    }
  }

  function highlightText(text, terms) {
    const safe = escapeHtml(text);
    if (!terms.length) return safe;
    const pattern = terms.map(escapeRegExp).join('|');
    const regex = new RegExp(`(${pattern})`, 'gi');
    return safe.replace(regex, '<mark>$1</mark>');
  }

  function extractSnippet(content, terms) {
    if (!content) return '';
    if (!terms.length) {
      return content.length > 90 ? content.slice(0, 90) + '...' : content;
    }
    const lower = content.toLowerCase();
    let firstIdx = -1;
    for (const term of terms) {
      const idx = lower.indexOf(term.toLowerCase());
      if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
        firstIdx = idx;
      }
    }
    if (firstIdx === -1) {
      return content.length > 90 ? content.slice(0, 90) + '...' : content;
    }
    const start = Math.max(0, firstIdx - 28);
    const end = Math.min(content.length, firstIdx + 68);
    let snippet = content.slice(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < content.length) snippet = snippet + '...';
    return snippet;
  }

  function search(query) {
    if (!searchIndex) return { items: [], total: 0, terms: [] };
    const terms = query.trim().split(/\s+/).filter(Boolean);
    if (!terms.length) {
      return {
        items: searchIndex.slice(0, 6),
        total: searchIndex.length,
        terms: [],
        isRecent: true
      };
    }

    const scored = [];
    for (const page of searchIndex) {
      const title = (page.title || '').toLowerCase();
      const content = (page.cleanContent || '').toLowerCase();
      let score = 0;
      let matchedAll = true;

      for (const t of terms) {
        const q = t.toLowerCase();
        const inTitle = title.includes(q);
        const inContent = content.includes(q);
        if (!inTitle && !inContent) {
          matchedAll = false;
          break;
        }
        if (inTitle) score += title.startsWith(q) ? 15 : 10;
        if (inContent) score += 2;
      }

      if (matchedAll) {
        scored.push({ page, score });
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return {
      items: scored.slice(0, 10).map(s => s.page),
      total: scored.length,
      terms,
      isRecent: false
    };
  }

  function updateActiveItem(scrollIntoView) {
    const items = searchResults.querySelectorAll('.search-result-item');
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.classList.add('active');
        if (scrollIntoView) {
          item.scrollIntoView({ block: 'nearest' });
        }
      } else {
        item.classList.remove('active');
      }
    });
  }

  function renderResults(resultObj) {
    const { items, total, terms, isRecent } = resultObj;
    if (!items.length) {
      activeIndex = -1;
      searchResults.innerHTML = `<div class="search-empty">未找到与 “${escapeHtml(terms.join(' '))}” 相关的文章</div>`;
      if (searchCount) searchCount.textContent = '0 条结果';
      return;
    }

    activeIndex = 0;
    const labelHtml = isRecent ? `<div class="search-section-label">最近更新</div>` : '';
    const listHtml = items.map((page, idx) => {
      const titleHtml = highlightText(page.title || 'Untitled', terms);
      const rawSnippet = extractSnippet(page.cleanContent || '', terms);
      const summaryHtml = highlightText(rawSnippet, terms);
      const dateHtml = page.date ? `<span class="search-result-date">${escapeHtml(page.date)}</span>` : '';
      return `<a class="search-result-item${idx === 0 ? ' active' : ''}" href="${page.url}" data-index="${idx}">
        <div class="search-result-top">
          <span class="search-result-title">${titleHtml}</span>
          ${dateHtml}
        </div>
        ${summaryHtml ? `<div class="search-result-summary">${summaryHtml}</div>` : ''}
      </a>`;
    }).join('');

    searchResults.innerHTML = labelHtml + listHtml;
    if (searchCount) {
      searchCount.textContent = isRecent ? `共 ${total} 篇` : `${total} 条匹配`;
    }
  }

  async function refreshSearch() {
    const q = searchInput.value;
    if (clearBtn) clearBtn.hidden = !q.length;
    await loadSearchIndex();
    renderResults(search(q));
  }

  async function openModal() {
    if (isOpen) return;
    isOpen = true;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    await refreshSearch();
    requestAnimationFrame(() => {
      searchInput.focus();
      searchInput.select();
    });
  }

  function closeModal() {
    if (!isOpen) return;
    isOpen = false;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (trigger) {
    trigger.addEventListener('click', openModal);
  }
  if (backdrop) {
    backdrop.addEventListener('click', closeModal);
  }
  if (escBtn) {
    escBtn.addEventListener('click', closeModal);
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      searchInput.value = '';
      refreshSearch();
      searchInput.focus();
    });
  }

  let debounceTimer;
  searchInput.addEventListener('input', function() {
    if (clearBtn) clearBtn.hidden = !this.value.length;
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshSearch, 80);
  });

  searchResults.addEventListener('mousemove', function(e) {
    const item = e.target.closest('.search-result-item');
    if (!item) return;
    const idx = Number(item.dataset.index);
    if (!Number.isNaN(idx) && idx !== activeIndex) {
      activeIndex = idx;
      updateActiveItem(false);
    }
  });

  searchInput.addEventListener('keydown', function(e) {
    const items = searchResults.querySelectorAll('.search-result-item');
    const itemCount = items.length;

    switch (e.key) {
      case 'ArrowDown':
        if (!itemCount) return;
        e.preventDefault();
        activeIndex = (activeIndex + 1) % itemCount;
        updateActiveItem(true);
        break;
      case 'ArrowUp':
        if (!itemCount) return;
        e.preventDefault();
        activeIndex = activeIndex <= 0 ? itemCount - 1 : activeIndex - 1;
        updateActiveItem(true);
        break;
      case 'Enter':
        if (itemCount > 0 && activeIndex >= 0 && items[activeIndex]) {
          e.preventDefault();
          window.location.href = items[activeIndex].getAttribute('href');
        }
        break;
      case 'Escape':
        e.preventDefault();
        closeModal();
        break;
    }
  });

  document.addEventListener('keydown', function(e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (isOpen) {
        closeModal();
      } else {
        openModal();
      }
      return;
    }
    if (e.key === '/' && !isOpen) {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !document.activeElement?.isContentEditable) {
        e.preventDefault();
        openModal();
      }
      return;
    }
    if (e.key === 'Escape' && isOpen) {
      e.preventDefault();
      closeModal();
    }
  });
})();

(function() {
  const sidebar = document.getElementById('toc-sidebar');
  const linesContainer = document.getElementById('toc-lines');
  const card = document.getElementById('toc-card');
  if (!sidebar || !linesContainer || !card) return;

  const links = Array.from(card.querySelectorAll('#TableOfContents a[href^="#"]'));
  if (!links.length) {
    sidebar.style.display = 'none';
    return;
  }

  // 计算每个目录项的嵌套层级并映射对应标题元素
  const items = [];
  links.forEach(link => {
    const rawHash = link.getAttribute('href').slice(1);
    const id = decodeURIComponent(rawHash);
    const heading = document.getElementById(id);
    if (!heading) return;

    let depth = 0;
    let el = link.parentElement;
    while (el && el.id !== 'TableOfContents') {
      if (el.tagName === 'UL' || el.tagName === 'OL') depth++;
      el = el.parentElement;
    }
    const level = Math.min(Math.max(depth, 1), 3);

    const line = document.createElement('span');
    line.className = `toc-line level-${level}`;
    linesContainer.appendChild(line);

    link.setAttribute('title', link.textContent.trim());
    items.push({ link, line, heading, id });
  });

  if (!items.length) {
    sidebar.style.display = 'none';
    return;
  }

  if (items.length > 24) {
    linesContainer.classList.add('toc-lines-compact');
  }

  let activeIdx = -1;

  function setActive(index) {
    if (index === activeIdx || index < 0 || index >= items.length) return;
    if (activeIdx >= 0 && items[activeIdx]) {
      items[activeIdx].link.classList.remove('active');
      items[activeIdx].line.classList.remove('active');
    }
    activeIdx = index;
    items[activeIdx].link.classList.add('active');
    items[activeIdx].line.classList.add('active');
  }

  function updateScrollSpy() {
    const scrollY = window.scrollY || window.pageYOffset;
    const offset = 100;
    let current = 0;

    for (let i = 0; i < items.length; i++) {
      const top = items[i].heading.getBoundingClientRect().top;
      if (top <= offset) {
        current = i;
      } else {
        break;
      }
    }

    // 滚动到底部时高亮最后一项
    if (window.innerHeight + scrollY >= document.documentElement.scrollHeight - 20) {
      current = items.length - 1;
    }

    setActive(current);
  }

  let ticking = false;
  window.addEventListener('scroll', function() {
    if (!ticking) {
      window.requestAnimationFrame(function() {
        updateScrollSpy();
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });

  // 鼠标悬停展开目录时，将当前激活项滚动至目录卡片可视区域中央
  sidebar.addEventListener('mouseenter', function() {
    if (activeIdx >= 0 && items[activeIdx]) {
      const activeLink = items[activeIdx].link;
      const targetScroll = activeLink.offsetTop - card.clientHeight / 2 + activeLink.offsetHeight / 2;
      card.scrollTo({ top: Math.max(0, targetScroll), behavior: 'smooth' });
    }
  });

  // 点击目录平滑滚动
  items.forEach((item, idx) => {
    item.link.addEventListener('click', function(e) {
      e.preventDefault();
      setActive(idx);
      const top = item.heading.getBoundingClientRect().top + window.pageYOffset - 24;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', `#${encodeURIComponent(item.id)}`);
    });
  });

  updateScrollSpy();
})();

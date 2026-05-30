// Infra Learning Path — shared interactions

(function () {
  'use strict';

  // ---- Sidebar (mobile) ----
  const menuBtn = document.querySelector('.menu-btn');
  const sidebar = document.querySelector('.sidebar');
  if (menuBtn && sidebar) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar.classList.toggle('open');
    });
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') &&
          !sidebar.contains(e.target) &&
          !menuBtn.contains(e.target)) {
        sidebar.classList.remove('open');
      }
    });
  }

  // ---- Highlight active nav item based on current page ----
  const here = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.sidebar nav a').forEach(a => {
    const href = a.getAttribute('href').split('/').pop();
    if (href === here || (here === '' && href === 'index.html')) {
      a.classList.add('active');
    }
  });

  // ---- Copy-button for <pre> code blocks ----
  document.querySelectorAll('pre').forEach(pre => {
    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.type = 'button';
    btn.textContent = 'copy';
    btn.addEventListener('click', async () => {
      const code = pre.querySelector('code');
      const text = code ? code.innerText : pre.innerText;
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = 'copied!';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'copy';
          btn.classList.remove('copied');
        }, 1400);
      } catch (e) {
        btn.textContent = 'fail';
      }
    });
    pre.appendChild(btn);
  });

  // ---- Self-check checkboxes — persist to localStorage ----
  document.querySelectorAll('.selfcheck').forEach((box, boxIdx) => {
    const pageKey = `selfcheck:${location.pathname}:${boxIdx}`;
    const state = JSON.parse(localStorage.getItem(pageKey) || '{}');
    const inputs = box.querySelectorAll('input[type="checkbox"]');
    inputs.forEach((cb, i) => {
      const key = String(i);
      if (state[key]) cb.checked = true;
      cb.addEventListener('change', () => {
        state[key] = cb.checked;
        localStorage.setItem(pageKey, JSON.stringify(state));
      });
    });
  });

  // ---- Mermaid init (if present) ----
  if (window.mermaid) {
    const dark = matchMedia('(prefers-color-scheme: dark)').matches &&
                 document.documentElement.classList.contains('auto');
    window.mermaid.initialize({
      startOnLoad: true,
      theme: dark ? 'dark' : 'neutral',
      fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif',
      themeVariables: {
        primaryColor: '#fff7ed',
        primaryTextColor: '#1c1917',
        primaryBorderColor: '#c2410c',
        lineColor: '#78716c',
        secondaryColor: '#f7f5ee',
        tertiaryColor: '#fdfcf8',
        fontSize: '14px'
      },
      flowchart: { curve: 'basis', padding: 12 },
      sequence: { useMaxWidth: true, mirrorActors: false }
    });
  }
})();

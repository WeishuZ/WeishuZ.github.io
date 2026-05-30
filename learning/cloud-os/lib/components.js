/* ============================================================================
   Shared front-end framework for the book. Vanilla JS, no build, no modules.
   Works from file:// (double-click) and from a local server alike.
   Exposes a tiny global `CB` namespace.
   ========================================================================== */
(function () {
  "use strict";
  var CB = (window.CB = window.CB || {});

  /* ---------- tiny DOM helpers ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    if (attrs) for (var k in attrs) {
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on" && typeof attrs[k] === "function")
        n.addEventListener(k.slice(2).toLowerCase(), attrs[k]);
      else if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) {
      if (c == null) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  CB.el = el;
  CB.$ = function (s, r) { return (r || document).querySelector(s); };
  CB.$$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  CB.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };

  /* ---------- theme ---------- */
  var KEY = "cb-theme";
  function applyTheme(t) {
    document.documentElement.classList.toggle("dark", t === "dark");
    try { localStorage.setItem(KEY, t); } catch (e) {}
    CB.$$(".theme-ic").forEach(function (n) { n.textContent = t === "dark" ? "☀" : "☾"; });
  }
  CB.initTheme = function () {
    var saved;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    if (!saved) saved = (window.matchMedia && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
    applyTheme(saved);
  };
  CB.toggleTheme = function () {
    applyTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  };
  CB.initTheme(); // apply ASAP to avoid flash

  /* ---------- reading progress ---------- */
  CB.initProgress = function () {
    var fill = CB.$(".progress-fill");
    if (!fill) return;
    function upd() {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      fill.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    }
    document.addEventListener("scroll", upd, { passive: true });
    window.addEventListener("resize", upd);
    upd();
  };

  /* ---------- sidebar: build in-chapter section list + scroll-spy ---------- */
  CB.initSectionNav = function () {
    var host = CB.$(".toc-sections");
    if (!host) return;
    var heads = CB.$$(".col h2[id]");
    var links = heads.map(function (h) {
      var label = h.getAttribute("data-nav") || h.textContent;
      var a = el("a", { href: "#" + h.id, text: label });
      host.appendChild(a);
      return a;
    });
    if (!heads.length) return;
    var byId = {};
    links.forEach(function (a, i) { byId[heads[i].id] = a; });
    var current = null;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) current = e.target.id;
      });
      links.forEach(function (a) { a.classList.remove("active"); });
      if (current && byId[current]) byId[current].classList.add("active");
    }, { rootMargin: "-15% 0px -70% 0px", threshold: 0 });
    heads.forEach(function (h) { io.observe(h); });
  };

  /* ---------- mobile menu ---------- */
  CB.initMenu = function () {
    var sb = CB.$(".sidebar"), tg = CB.$(".menu-toggle"), sc = CB.$(".scrim");
    if (!sb || !tg) return;
    function close() { sb.classList.remove("open"); if (sc) sc.classList.remove("show"); }
    tg.addEventListener("click", function () {
      sb.classList.toggle("open"); if (sc) sc.classList.toggle("show");
    });
    if (sc) sc.addEventListener("click", close);
    CB.$$(".sidebar a").forEach(function (a) { a.addEventListener("click", close); });
  };

  /* ---------- glossary tooltips ----------
     Usage: <span class="term" data-gloss="key">系统调用</span>
     Define terms in window.CB_GLOSS = { key: {t:"Title", d:"definition html", l:"#link"} }
  ------------------------------------------------------------------------- */
  CB.initGloss = function () {
    var G = window.CB_GLOSS || {};
    var pop = el("div", { class: "gloss-pop" });
    document.body.appendChild(pop);
    var hideTimer;
    function show(target) {
      var key = target.getAttribute("data-gloss");
      var g = G[key];
      if (!g) return;
      clearTimeout(hideTimer);
      pop.innerHTML = "";
      pop.appendChild(el("span", { class: "gt", text: g.t }));
      pop.appendChild(el("span", { html: g.d }));
      if (g.l) pop.appendChild(el("a", { class: "gl", href: g.l, html: "到对应章节 →" }));
      pop.classList.add("show");
      var r = target.getBoundingClientRect();
      var pw = Math.min(window.innerWidth - 24, pop.offsetWidth || 320);
      var left = CB.clamp(r.left + r.width / 2 - pw / 2, 12, window.innerWidth - pw - 12);
      var top = r.bottom + 10;
      if (top + pop.offsetHeight > window.innerHeight - 12)
        top = r.top - pop.offsetHeight - 10;
      pop.style.left = left + "px";
      pop.style.top = Math.max(12, top) + "px";
    }
    function hide() { hideTimer = setTimeout(function () { pop.classList.remove("show"); }, 120); }
    CB.$$(".term[data-gloss]").forEach(function (t) {
      t.addEventListener("mouseenter", function () { show(t); });
      t.addEventListener("mouseleave", hide);
      t.addEventListener("click", function (e) { e.preventDefault(); show(t); });
    });
    pop.addEventListener("mouseenter", function () { clearTimeout(hideTimer); });
    pop.addEventListener("mouseleave", hide);
    document.addEventListener("scroll", function () { pop.classList.remove("show"); }, { passive: true });
  };

  /* ---------- reveal on scroll (figures fade up) ---------- */
  CB.initReveal = function () {
    if (!("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (e) {
        if (e.isIntersecting) { e.target.style.opacity = 1; e.target.style.transform = "none"; io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .05 });
    CB.$$("figure.fig").forEach(function (f) {
      if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      f.style.opacity = 0; f.style.transform = "translateY(14px)";
      f.style.transition = "opacity .6s var(--ease,ease), transform .6s var(--ease,ease)";
      io.observe(f);
    });
  };

  /* ============================================================================
     StepPlayer — the reusable engine behind every "分步流程动画".
     You give it a list of steps and a render callback; it gives you a polished
     control bar (prev / play-pause / next), keyboard arrows, a scrubber, and a
     synced narration panel. The actual drawing is yours (SVG/DOM/canvas).
     ------------------------------------------------------------------------
     new CB.StepPlayer({
       mount: HTMLElement,            // where controls + narration render
       steps: [ {title, body, ...} ],
       autoMs: 1600,                  // play interval
       onStep: function(i, step, dir) // you update your visual here
     })
  ============================================================================ */
  CB.StepPlayer = function (opts) {
    var self = this;
    this.steps = opts.steps;
    this.i = 0;
    this.playing = false;
    this.autoMs = opts.autoMs || 1700;
    this.onStep = opts.onStep || function () {};
    var mount = opts.mount;

    // narration panel
    var narr = el("div", { class: "sp-narr" });
    var bar = el("div", { class: "sp-bar" });

    var btnPrev = el("button", { class: "btn ghost", title: "上一步 (←)", html: "‹ 上一步" });
    var btnPlay = el("button", { class: "btn primary", title: "播放 (空格)" });
    var btnNext = el("button", { class: "btn", title: "下一步 (→)", html: "下一步 ›" });
    var dots = el("div", { class: "sp-dots" });
    var counter = el("span", { class: "sp-counter" });

    this.steps.forEach(function (s, idx) {
      var d = el("button", { class: "sp-dot", title: s.title || ("步骤 " + (idx + 1)),
        onclick: function () { self.go(idx); } });
      dots.appendChild(d);
    });

    bar.appendChild(btnPrev);
    bar.appendChild(btnPlay);
    bar.appendChild(btnNext);
    bar.appendChild(dots);
    bar.appendChild(counter);
    mount.appendChild(narr);
    mount.appendChild(bar);

    function renderPlayBtn() {
      btnPlay.innerHTML = self.playing ? "❚❚ 暂停" : "▶ 播放";
    }
    function render(dir) {
      var s = self.steps[self.i];
      narr.innerHTML =
        '<div class="sp-step">步骤 ' + (self.i + 1) + " / " + self.steps.length + "</div>" +
        '<div class="sp-title">' + (s.title || "") + "</div>" +
        '<div class="sp-body">' + (s.body || "") + "</div>" +
        (s.note ? '<div class="sp-note">' + s.note + "</div>" : "");
      counter.textContent = (self.i + 1) + " / " + self.steps.length;
      CB.$$(".sp-dot", dots).forEach(function (d, idx) {
        d.classList.toggle("on", idx === self.i);
        d.classList.toggle("done", idx < self.i);
      });
      btnPrev.disabled = self.i === 0;
      btnNext.disabled = self.i === self.steps.length - 1;
      self.onStep(self.i, s, dir || 0);
    }

    this.go = function (idx) {
      idx = CB.clamp(idx, 0, this.steps.length - 1);
      var dir = idx > this.i ? 1 : idx < this.i ? -1 : 0;
      this.i = idx; render(dir);
      if (this.i === this.steps.length - 1) this.pause();
    };
    this.next = function () { if (this.i < this.steps.length - 1) this.go(this.i + 1); else this.pause(); };
    this.prev = function () { this.go(this.i - 1); };
    this.play = function () {
      if (this.i === this.steps.length - 1) this.i = -1; // restart from start
      this.playing = true; renderPlayBtn();
      clearInterval(this._t);
      this._t = setInterval(function () { self.next(); }, this.autoMs);
      this.next();
    };
    this.pause = function () { this.playing = false; renderPlayBtn(); clearInterval(this._t); };
    this.toggle = function () { this.playing ? this.pause() : this.play(); };

    btnPrev.onclick = function () { self.pause(); self.prev(); };
    btnNext.onclick = function () { self.pause(); self.next(); };
    btnPlay.onclick = function () { self.toggle(); };

    // keyboard when widget is in view / focused
    mount.setAttribute("tabindex", "0");
    mount.addEventListener("keydown", function (e) {
      if (e.key === "ArrowRight") { e.preventDefault(); self.pause(); self.next(); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); self.pause(); self.prev(); }
      else if (e.key === " ") { e.preventDefault(); self.toggle(); }
    });

    renderPlayBtn();
    render(0);
    return this;
  };

  /* ---------- chapter manifest + auto sidebar ----------
     Single source of truth for the whole book's navigation. Each chapter page
     just needs <aside class="sidebar" data-chapter="N"> with an empty
     <nav class="toc-nav"></nav>; this fills it, marks the current chapter, and
     drops in the .toc-sections slot that initSectionNav() populates.
  ------------------------------------------------------------------------- */
  CB.PARTS = {
    I: "Part I · 地面", II: "Part II · 一台机器 (OS)", III: "Part III · 汇成一朵云",
    IV: "Part IV · 分布式", V: "Part V · 通往 AI 基建"
  };
  CB.CHAPTERS = [
    { p: "I",   no: 1,  slug: "ch01-what-is-cloud",      t: "云是别人的电脑" },
    { p: "II",  no: 2,  slug: "ch02-cpu-virtualization", t: "幻觉机器：虚拟化 CPU" },
    { p: "II",  no: 3,  slug: "ch03-virtual-memory",     t: "内存的海市蜃楼" },
    { p: "II",  no: 4,  slug: "ch04-concurrency",        t: "同时做很多事：并发" },
    { p: "II",  no: 5,  slug: "ch05-io-storage",         t: "I/O、文件与存储" },
    { p: "III", no: 6,  slug: "ch06-virtualization",     t: "虚拟化与 Hypervisor" },
    { p: "III", no: 7,  slug: "ch07-containers",         t: "容器：轻量的幻觉" },
    { p: "III", no: 8,  slug: "ch08-networking",         t: "网络即计算机" },
    { p: "III", no: 9,  slug: "ch09-storage-scale",      t: "规模化存储" },
    { p: "IV",  no: 10, slug: "ch10-distributed",        t: "当机器们意见不合" },
    { p: "IV",  no: 11, slug: "ch11-kubernetes",         t: "编排：Kubernetes" },
    { p: "IV",  no: 12, slug: "ch12-scaling-resilience", t: "伸缩与韧性" },
    { p: "V",   no: 13, slug: "ch13-serverless",         t: "Serverless" },
    { p: "V",   no: 14, slug: "ch14-ai-inference",       t: "GPU 与 AI 推理上云" }
  ];
  CB.renderSidebar = function () {
    var nav = CB.$(".toc-nav"); if (!nav) return;
    var sb = CB.$(".sidebar");
    var cur = sb ? +(sb.getAttribute("data-chapter") || 0) : 0;
    var lastP = null;
    CB.CHAPTERS.forEach(function (ch) {
      if (ch.p !== lastP) { nav.appendChild(el("div", { class: "toc-part", text: CB.PARTS[ch.p] })); lastP = ch.p; }
      var num = ("0" + ch.no).slice(-2);
      if (ch.no === cur) {
        nav.appendChild(el("a", { class: "toc-link current", href: "index.html" },
          [el("span", { class: "num", text: num }), document.createTextNode(" " + ch.t)]));
        nav.appendChild(el("div", { class: "toc-sections" }));
      } else {
        nav.appendChild(el("a", { class: "toc-link", href: "../" + ch.slug + "/index.html" },
          [el("span", { class: "num", text: num }), document.createTextNode(" " + ch.t)]));
      }
    });
  };

  /* ---------- boot ---------- */
  CB.boot = function () {
    CB.initProgress();
    CB.renderSidebar();
    CB.initSectionNav();
    CB.initMenu();
    CB.initGloss();
    CB.initReveal();
  };
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", CB.boot);
  else CB.boot();
})();

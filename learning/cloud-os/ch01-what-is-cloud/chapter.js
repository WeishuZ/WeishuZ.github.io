/* ============================================================================
   Chapter 1 — the interactives.
   Built on the shared CB framework (../lib/components.js).
   Four pieces: Request Journey (step animation), Stack Explorer (sim),
   Datacenter Scale (sim), Roadmap (diagram).
   ========================================================================== */
(function () {
  "use strict";
  var el = CB.el;
  var SVGNS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, kids) {
    var n = document.createElementNS(SVGNS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    (kids || []).forEach(function (c) { if (c) n.appendChild(c); });
    return n;
  }
  function easeInOut(t) { return t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  /* ========================================================================
     1) REQUEST JOURNEY  (Fig 1.1)
     ===================================================================== */
  function buildJourney() {
    var stage = document.getElementById("journey-stage");
    var ctl = document.getElementById("journey-ctl");
    if (!stage || !ctl) return;

    // node centers in a 960x300 viewBox
    var N = [
      { c: [92, 210],  w: 150, h: 80, icon: "🖥", label: "你的浏览器", sub: "客户端" },
      { c: [300, 64],  w: 126, h: 62, icon: "🧭", label: "DNS", sub: "域名 → IP" },
      { c: [378, 210], w: 152, h: 80, icon: "⚖", label: "负载均衡器", sub: "前台接待" },
      { c: [640, 210], w: 178, h: 96, icon: "⚙", label: "Web 服务器", sub: "虚拟机里的一个进程" },
      { c: [882, 210], w: 142, h: 80, icon: "🗄", label: "数据库", sub: "持久存储" }
    ];
    // edges between box-edge points: key -> [x1,y1,x2,y2, dashed]
    var E = {
      "0-1": [126, 172, 272, 92, true],
      "0-2": [167, 210, 302, 210, false],
      "2-3": [454, 210, 551, 210, false],
      "3-4": [729, 210, 811, 210, false]
    };

    var svg = s("svg", { viewBox: "0 0 960 320", role: "img", "aria-label": "请求的一生示意图" });

    // edges first (under boxes)
    var edgeEls = {};
    Object.keys(E).forEach(function (k) {
      var e = E[k];
      var ln = s("line", { x1: e[0], y1: e[1], x2: e[2], y2: e[3],
        class: "jn-edge" + (e[4] ? " dash" : "") });
      edgeEls[k] = ln; svg.appendChild(ln);
    });

    // nodes
    var groups = N.map(function (nd, i) {
      var cx = nd.c[0], cy = nd.c[1];
      var g = s("g", { class: "jn-g" });
      g.appendChild(s("rect", { x: cx - nd.w / 2, y: cy - nd.h / 2, width: nd.w, height: nd.h,
        rx: 12, class: "jn-box" }));
      var iconY = nd.h > 70 ? cy - 22 : cy - 15;
      g.appendChild(s("text", { x: cx, y: iconY, "text-anchor": "middle", class: "jn-icon" },
        [document.createTextNode(nd.icon)]));
      g.appendChild(s("text", { x: cx, y: iconY + 27, "text-anchor": "middle", class: "jn-label" },
        [document.createTextNode(nd.label)]));
      g.appendChild(s("text", { x: cx, y: iconY + 46, "text-anchor": "middle", class: "jn-sub" },
        [document.createTextNode(nd.sub)]));
      if (i === 3) {
        var inner = s("text", { x: cx, y: cy + 38, "text-anchor": "middle", class: "jn-inner" },
          [document.createTextNode("VM ▸ 进程 ▸ 内核")]);
        inner.setAttribute("data-inner", "1");
        g.appendChild(inner);
      }
      svg.appendChild(g);
      g.addEventListener("click", function () { player.pause(); player.go(focusToStep(i)); });
      return g;
    });

    var packet = s("circle", { r: 11, class: "jn-packet", cx: N[0].c[0], cy: N[0].c[1] });
    svg.appendChild(packet);
    stage.appendChild(svg);

    // animation meta, parallel to steps
    var J = [
      { focus: 0, from: null, to: 0, lit: [], resp: false },
      { focus: 1, from: 0, to: 1, lit: ["0-1"], resp: false },
      { focus: 2, from: 0, to: 2, lit: ["0-2"], resp: false },
      { focus: 3, from: 2, to: 3, lit: ["2-3"], resp: false },
      { focus: 3, from: 3, to: 3, lit: [], resp: false, inner: true },
      { focus: 4, from: 3, to: 4, lit: ["3-4"], resp: false },
      { focus: 3, from: 4, to: 3, lit: ["3-4"], resp: true },
      { focus: 0, from: 3, to: 0, lit: ["2-3", "0-2"], resp: true }
    ];
    function focusToStep(nodeIdx) {
      for (var i = 0; i < J.length; i++) if (J[i].focus === nodeIdx) return i;
      return 0;
    }

    var raf;
    function animatePacket(from, to, resp) {
      cancelAnimationFrame(raf);
      packet.classList.toggle("resp", !!resp);
      if (from == null) { // appear in place
        packet.setAttribute("cx", N[to].c[0]); packet.setAttribute("cy", N[to].c[1]);
        packet.style.opacity = 1; return;
      }
      if (from === to) { // internal pulse
        var p = N[from].c; packet.setAttribute("cx", p[0]); packet.setAttribute("cy", p[1]);
        packet.style.opacity = 1;
        var t0 = performance.now();
        (function pulse(now) {
          var k = Math.min(1, (now - t0) / 700);
          packet.setAttribute("r", 11 + Math.sin(k * Math.PI) * 8);
          if (k < 1) raf = requestAnimationFrame(pulse); else packet.setAttribute("r", 11);
        })(t0);
        return;
      }
      var a = N[from].c, b = N[to].c, t0 = performance.now(), dur = 700;
      packet.style.opacity = 1;
      (function step(now) {
        var k = easeInOut(Math.min(1, (now - t0) / dur));
        packet.setAttribute("cx", a[0] + (b[0] - a[0]) * k);
        packet.setAttribute("cy", a[1] + (b[1] - a[1]) * k);
        if (k < 1) raf = requestAnimationFrame(step);
      })(t0);
    }

    function render(i) {
      var j = J[i];
      groups.forEach(function (g, idx) {
        g.classList.toggle("active", idx === j.focus);
        g.classList.toggle("resp", idx === j.focus && j.resp);
      });
      // inner detail visible once we've revealed the server's true nature
      var innerEl = svg.querySelector('[data-inner="1"]');
      if (innerEl) innerEl.classList.toggle("show", i >= 4);
      // edges
      Object.keys(edgeEls).forEach(function (k) {
        var on = j.lit.indexOf(k) >= 0;
        edgeEls[k].classList.toggle("hot", on);
        edgeEls[k].classList.toggle("resp", on && j.resp);
      });
      animatePacket(j.from, j.to, j.resp);
    }

    var STEPS = [
      { title: "请求出发",
        body: "你在地址栏敲下网址，按下回车。一个 HTTP <b>请求</b>即将启程。此刻它还躺在你自己的电脑里。",
        note: "主角：你的浏览器（客户端）。" },
      { title: "DNS：把名字翻译成地址",
        body: "网址（如 <code>example.com</code>）是给人看的名字；机器之间只认 <b>IP 地址</b>这串数字门牌。浏览器先问 <b>DNS</b>：“这域名住哪？”DNS 回一个 IP——通常正是负载均衡器的入口。",
        note: "→ 第 8 章《网络即计算机》讲透 DNS 与寻址。" },
      { title: "穿过互联网，抵达云的门口",
        body: "拿到 IP，请求离开你的电脑，穿过运营商、骨干网，一路抵达云数据中心的入口——<b>负载均衡器</b>。",
        note: "“穿越”本身也是学问：延迟、带宽、路由（第 8 章）。" },
      { title: "负载均衡器派活",
        body: "门口的<b>负载均衡器</b>面对一排功能相同的服务器，挑一台当前最闲、还活着的，把请求转交过去。",
        note: "→ 横向扩展与容错的关键（第 12 章）。" },
      { title: "真相：它是虚拟机里的一个进程",
        body: "这台“Web 服务器”其实是某台物理机上的一台<b>虚拟机</b>；请求最终落到 VM 里的一个<b>进程</b>——你的程序。同一台物理机，可能正同时租给几十个陌生人。",
        note: "→ 进程＝第 2 章，虚拟机＝第 6 章。这是全书的地基。" },
      { title: "进程求内核办事：系统调用",
        body: "进程要数据，却<b>无权</b>直接碰硬件。于是它发起一次<b>系统调用</b>，请操作系统<b>内核</b>替它去网络上查数据库。",
        note: "→ 用户态 / 内核态的边界，第 2、5 章详解。" },
      { title: "数据库返回数据",
        body: "数据库查到结果，顺着网络把数据送回这个进程。进程拿到原料，开始拼装最终的网页 / 响应。",
        note: "→ 数据怎么存、怎么不丢？第 9 章。" },
      { title: "响应原路返回，页面出现",
        body: "进程交还拼好的响应，它沿原路——经负载均衡器、穿过互联网——回到你的浏览器，页面渲染出来。整条流水线，常常几十毫秒走完。",
        note: "你眼中的“一瞬间”，是这八步默契接力的结果。" }
    ];

    var player = new CB.StepPlayer({
      mount: ctl, steps: STEPS, autoMs: 2400,
      onStep: function (i) { render(i); }
    });
  }

  /* ========================================================================
     2) STACK EXPLORER  (Fig 1.2)
     ===================================================================== */
  function buildStack() {
    var root = document.getElementById("stack-explorer");
    if (!root) return;

    var LAYERS = [
      { name: "应用", ic: "📦", d: "你的业务逻辑、你写的那个网站 / 服务本身。" },
      { name: "数据", ic: "🗂", d: "数据库内容、用户数据。注意：无论哪种云，数据的“归属”通常都还是你的。" },
      { name: "运行时", ic: "▶", d: "语言运行环境（Python / JVM / Node）与依赖库。" },
      { name: "中间件", ic: "🧩", d: "数据库引擎、消息队列、缓存等支撑软件。" },
      { name: "操作系统", ic: "🐧", d: "如 Linux：管理硬件，提供进程 / 内存 / 文件等抽象（Part II 专讲）。" },
      { name: "虚拟化", ic: "🪞", d: "Hypervisor：把一台物理机切成多台虚拟机（第 6 章）。" },
      { name: "服务器", ic: "🖳", d: "真实的物理计算机：CPU、内存、主板。" },
      { name: "存储", ic: "💽", d: "硬盘、SSD、存储阵列（第 9 章）。" },
      { name: "网络", ic: "🔌", d: "交换机、路由、机房布线（第 8 章）。" }
    ];
    // youUpTo = highest layer index (0=top) that YOU manage
    var MODES = [
      { k: "本地自建", upto: 8, blurb: "全是你的。最大掌控，也最累——从买服务器到半夜换硬盘，全自己来。" },
      { k: "IaaS", upto: 4, blurb: "云商给你一台开好机的虚拟机，<b>操作系统往上</b>归你。要灵活、要掌控，选它。例：AWS EC2、阿里云 ECS。" },
      { k: "PaaS", upto: 1, blurb: "你<b>只管交代码和数据</b>，运维全甩给云商。要快、不想碰底层，选它。例：App Engine、Heroku。" },
      { k: "SaaS", upto: -1, blurb: "整个软件都跑好了，<b>开箱即用</b>。例：Gmail、Notion、Figma。" }
    ];

    var seg = el("div", { class: "seg se-modes" });
    var stack = el("div", { class: "se-stack" });
    var side = el("div", { class: "se-side" });
    var modeName = el("div", { class: "se-mode-name" });
    var blurb = el("div", { class: "se-blurb" });
    var hovbox = el("div", { class: "se-hovbox",
      html: '<div class="h">悬停任意一层</div><div class="n">看它是什么</div><div class="d">把鼠标移到左侧的层上，这里会解释它的作用，以及它在后面哪一章细讲。</div>' });
    side.appendChild(modeName); side.appendChild(blurb); side.appendChild(hovbox);

    var rows = [];
    var current = 1; // start on IaaS — the most instructive

    LAYERS.forEach(function (L, idx) {
      var row = el("div", { class: "se-row" }, [
        el("span", { class: "se-ic", text: L.ic }),
        el("span", { class: "se-name", text: L.name }),
        el("span", { class: "se-who" })
      ]);
      row.addEventListener("mouseenter", function () {
        hovbox.innerHTML = '<div class="h">' + (row.classList.contains("you") ? "你来管理" : "云商管理") +
          '</div><div class="n">' + L.ic + " " + L.name + '</div><div class="d">' + L.d + "</div>";
      });
      rows.push(row);
    });

    function apply(mi) {
      current = mi;
      var m = MODES[mi];
      modeName.textContent = m.k;
      blurb.innerHTML = m.blurb;
      CB.$$(".seg button", seg).forEach(function (b, i) { b.classList.toggle("on", i === mi); });
      // rebuild stack with a divider at the boundary
      stack.innerHTML = "";
      var boundaryDrawn = false;
      rows.forEach(function (row, idx) {
        var you = idx <= m.upto;
        row.classList.toggle("you", you);
        row.classList.toggle("prov", !you);
        row.querySelector(".se-who").textContent = you ? "你管" : "云商管";
        // divider sits between last "you" row and first "prov" row
        if (!boundaryDrawn && !you && idx > 0 && (idx - 1) <= m.upto) {
          stack.appendChild(el("div", { class: "se-divider", text: "责任分界线" }));
          boundaryDrawn = true;
        }
        stack.appendChild(row);
      });
      if (m.upto < 0) { // SaaS: boundary on top
        stack.insertBefore(el("div", { class: "se-divider", text: "全部由云商管理 ↑" }), stack.firstChild);
      }
    }

    MODES.forEach(function (m, i) {
      seg.appendChild(el("button", { text: m.k, onclick: function () { apply(i); } }));
    });

    var main = el("div", { class: "se-main" }, [stack, side]);
    root.appendChild(seg);
    root.appendChild(main);
    apply(current);
  }

  /* ========================================================================
     3) DATACENTER SCALE  (Fig 1.3)
     ===================================================================== */
  function buildScale() {
    var root = document.getElementById("dc-scale");
    if (!root) return;

    var STOPS = [
      { count: 1,       unit: "台服务器",        name: "1 台服务器",        dots: 1,
        insight: "一台普通服务器：几十核 CPU、几百 GB 内存。你在 IaaS 上租到的虚拟机，就寄居在这样一台宿主里。" },
      { count: 40,      unit: "台 · 1 个机架",    name: "机架 Rack",          dots: 40,
        insight: "约 40 台服务器叠进一个机柜，共享供电与顶部交换机（ToR）。机架是数据中心的“积木”。" },
      { count: 1000,    unit: "台 · 1 排机架",    name: "一排 Row",           dots: 220,
        insight: "上千台机器连成一排。它们彼此之间的网络有多快，开始直接决定你的分布式系统跑得快不快。" },
      { count: 100000,  unit: "台 · 1 座数据中心", name: "数据中心 DC",        dots: 380,
        insight: "十万台量级。到这里，“每天都有机器在坏”成了数学上的必然——软件必须把硬件故障当成常态来设计。" },
      { count: 1000000, unit: "台 · 1 个地区",     name: "地区 Region",        dots: 480,
        insight: "多座数据中心组成一个地区（含多个可用区 AZ）。跨数据中心复制，是抵御整座机房断电 / 火灾的最后防线（第 10、12 章）。" }
    ];

    var top = el("div", { class: "dc-top" }, [
      el("span", { class: "dc-count", text: "1" }),
      el("span", { class: "dc-unit" }),
      el("span", { class: "dc-stage-name" })
    ]);
    var perdot = el("div", { class: "dc-perdot" });
    var grid = el("div", { class: "dc-grid" });
    var DOTPOOL = 480;
    var dots = [];
    for (var i = 0; i < DOTPOOL; i++) {
      var d = el("div", { class: "dc-dot" });
      d.style.transitionDelay = (i % 60) * 4 + "ms";
      grid.appendChild(d); dots.push(d);
    }

    var slider = el("input", { type: "range", min: "0", max: "4", value: "0", step: "1",
      style: "width:100%" });
    var ticks = el("div", { class: "dc-ticks" });
    STOPS.forEach(function (st, i) {
      ticks.appendChild(el("button", { text: st.name, onclick: function () { slider.value = i; apply(i); } }));
    });
    var sliderWrap = el("div", { class: "dc-slider-wrap" }, [slider, ticks]);
    var insight = el("div", { class: "dc-insight" });

    var countEl = top.querySelector(".dc-count");
    var unitEl = top.querySelector(".dc-unit");
    var nameEl = top.querySelector(".dc-stage-name");

    function fmt(n) { return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
    var rafN, curShown = 1;
    function tweenCount(to) {
      cancelAnimationFrame(rafN);
      var from = curShown, t0 = performance.now(), dur = 600;
      (function step(now) {
        var k = easeInOut(Math.min(1, (now - t0) / dur));
        var v = Math.round(from + (to - from) * k);
        countEl.textContent = fmt(v);
        if (k < 1) rafN = requestAnimationFrame(step); else curShown = to;
      })(t0);
    }

    function apply(i) {
      var st = STOPS[i];
      tweenCount(st.count);
      unitEl.textContent = st.unit;
      nameEl.textContent = "▸ " + st.name;
      var pd = Math.ceil(st.count / st.dots);
      perdot.textContent = pd > 1 ? ("1 个点 ≈ " + fmt(pd) + " 台机器") : "1 个点 = 1 台机器";
      dots.forEach(function (d, idx) { d.classList.toggle("on", idx < st.dots); });
      insight.innerHTML = st.insight;
      CB.$$(".dc-ticks button", ticks).forEach(function (b, idx) { b.classList.toggle("on", idx === i); });
    }

    slider.addEventListener("input", function () { apply(+slider.value); });

    root.appendChild(top);
    root.appendChild(perdot);
    root.appendChild(grid);
    root.appendChild(sliderWrap);
    root.appendChild(insight);
    apply(0);
  }

  /* ========================================================================
     4) ROADMAP  (Fig 1.4)
     ===================================================================== */
  function buildRoadmap() {
    var root = document.getElementById("roadmap");
    if (!root) return;
    var PARTS = [
      { n: "I", cls: "", t: "地面：云是什么", d: "建立总体心智模型——就是你正在读的这一章。",
        chips: ["请求之路", "服务模型", "数据中心"], arrow: "" },
      { n: "II", cls: "dig", t: "一台机器：即时补 OS", d: "暂时下潜到底层，揭穿单机维护的那些“善意谎言”。",
        chips: ["进程·调度", "虚拟内存", "并发", "I/O"], arrow: "↓ 下挖到硅片附近" },
      { n: "III", cls: "", t: "汇成一朵云", d: "带着对单机的理解，一层层盖回成可随取随用的资源池。",
        chips: ["虚拟化", "容器", "网络", "存储"], arrow: "↑ 带着理解回到云" },
      { n: "IV", cls: "", t: "分布式系统", d: "当机器们开始互相不信任——云最硬核也最迷人的部分。",
        chips: ["CAP·共识", "Kubernetes", "伸缩·容错"], arrow: "" },
      { n: "V", cls: "peak", t: "通往 AI 基础设施", d: "前 13 章在这里汇合——你真正想去的目的地。",
        chips: ["Serverless", "GPU · vLLM 推理"], arrow: "★ 终点" }
    ];
    var wrap = el("div", { class: "rm" });
    PARTS.forEach(function (p) {
      wrap.appendChild(el("div", { class: "rm-part " + p.cls }, [
        el("div", { class: "rm-node", text: p.n }),
        el("div", { class: "rm-body" }, [
          el("div", { class: "rm-t", text: "Part " + p.n + " · " + p.t }),
          el("div", { class: "rm-d", text: p.d }),
          el("div", { class: "rm-chips" }, p.chips.map(function (c) {
            return el("span", { class: "rm-chip", text: c });
          })),
          p.arrow ? el("div", { class: "rm-arrow", text: p.arrow }) : null
        ])
      ]));
    });
    root.appendChild(wrap);
  }

  /* ---------- boot all ---------- */
  function init() { buildJourney(); buildStack(); buildScale(); buildRoadmap(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();

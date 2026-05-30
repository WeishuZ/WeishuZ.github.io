/* Shared renderer for non-interactive chapters. */
(function () {
  "use strict";
  var el = CB.el;
  var DATA = window.DB_CHAPTERS || {};

  function diagram(d) {
    if (!d) return null;
    var body;
    if (d.type === "flow") {
      body = el("div", { class: "diag-flow" }, d.items.map(function (it, i) {
        return el("div", { class: "flow-node" }, [
          el("b", { text: ("0" + (i + 1)).slice(-2) }),
          el("span", { html: it.t }),
          el("p", { html: it.d })
        ]);
      }));
    } else if (d.type === "stack") {
      body = el("div", { class: "diag-stack" }, d.items.map(function (it) {
        return el("div", { class: "stack-row" }, [el("b", { html: it.t }), el("span", { html: it.d })]);
      }));
    } else if (d.type === "split") {
      body = el("div", { class: "diag-split" }, d.items.map(function (it) {
        return el("div", { class: "split-card" }, [el("h4", { html: it.t }), el("p", { html: it.d })]);
      }));
    } else if (d.type === "table") {
      var table = el("table", { class: "diag-table" });
      table.appendChild(el("thead", {}, [el("tr", {}, d.head.map(function (h) { return el("th", { html: h }); }))]));
      table.appendChild(el("tbody", {}, d.rows.map(function (r) {
        return el("tr", {}, r.map(function (c) { return el("td", { html: c }); }));
      })));
      body = table;
    } else if (d.type === "timeline") {
      body = el("div", { class: "diag-timeline" }, d.items.map(function (it) {
        return el("div", { class: "time-item" }, [
          el("b", { html: it.k }),
          el("span", { html: it.t }),
          el("p", { html: it.d })
        ]);
      }));
    } else if (d.type === "matrix") {
      var cells = [];
      cells.push(el("div", { class: "matrix-cell head", html: d.corner || "" }));
      d.cols.forEach(function (c) { cells.push(el("div", { class: "matrix-cell head", html: c })); });
      d.rows.forEach(function (r) {
        cells.push(el("div", { class: "matrix-cell head", html: r.t }));
        r.cells.forEach(function (c) { cells.push(el("div", { class: "matrix-cell " + (c.k || ""), html: c.v })); });
      });
      body = el("div", { class: "diag-matrix", style: "--cols:" + d.cols.length }, cells);
    }
    return el("figure", { class: "fig bleed" }, [
      el("div", { class: "static-diagram" }, [
        el("div", { class: "d-head" }, [el("span", { class: "d-title", html: d.title }), el("span", { class: "d-tag", text: d.tag || "diagram" })]),
        el("div", { class: "d-body" }, [body]),
        d.note ? el("div", { class: "d-note", html: d.note }) : null
      ]),
      d.caption ? el("figcaption", { class: "fig-cap", html: d.caption }) : null
    ]);
  }

  function render() {
    var root = document.getElementById("chapter-root");
    var aside = document.querySelector(".sidebar");
    if (!root || !aside) return;
    var id = aside.getAttribute("data-chapter");
    var ch = DATA[id];
    if (!ch) return;

    root.innerHTML = "";
    root.appendChild(el("div", { class: "ch-eyebrow", text: ch.eyebrow }));
    root.appendChild(el("div", { class: "ch-number", text: ch.num }));
    root.appendChild(el("h1", { class: "ch-title", html: ch.title }));
    root.appendChild(el("p", { class: "ch-standfirst", html: ch.standfirst }));
    root.appendChild(el("div", { class: "ch-meta" }, ch.meta.map(function (m, i) {
      var nodes = [el("span", { html: "<b>" + m.k + "</b> " + m.v })];
      if (i < ch.meta.length - 1) nodes.push(el("span", { class: "dot" }));
      return nodes;
    }).flat()));

    ch.sections.forEach(function (s) {
      root.appendChild(el("h2", { id: s.id, "data-nav": s.nav, html: '<span class="sec-no">' + s.no + '</span>' + s.title }));
      (s.body || []).forEach(function (p, i) {
        root.appendChild(el("p", { class: i === 0 && s.drop ? "dropcap" : "", html: p }));
      });
      if (s.box) {
        root.appendChild(el("div", { class: "box " + (s.box.kind || "formal") }, [
          el("div", { class: "box-label", html: s.box.label }),
          el("p", { html: s.box.body })
        ]));
      }
      if (s.diagram) root.appendChild(diagram(s.diagram));
    });

    if (ch.recap) {
      root.appendChild(el("div", { class: "recap" }, [
        el("h3", { text: "本章压缩包" }),
        el("ul", {}, ch.recap.map(function (x) { return el("li", { html: x }); }))
      ]));
    }
    root.appendChild(el("div", { class: "source-note", html: '章节骨架参考 Berkeley CS186 公开课程主题；本站内容为重新组织的学习材料，不复制课程原文。' }));

    var chapters = (window.CB && CB.CHAPTERS) ? CB.CHAPTERS : [];
    var curIndex = chapters.findIndex(function (x) { return x.no === +id; });
    var prev = curIndex > 0 ? chapters[curIndex - 1] : null;
    var next = curIndex >= 0 && curIndex < chapters.length - 1 ? chapters[curIndex + 1] : null;
    root.appendChild(el("div", { class: "ch-foot" }, [
      el("a", { class: "prev", href: prev ? "../" + prev.slug + "/index.html" : "../index.html",
        html: '<span class="dir">' + (prev ? "上一章" : "目录") + '</span><span class="t">' + (prev ? prev.t : "回到全书结构") + '</span>' }),
      el("a", { class: "next", href: next ? "../" + next.slug + "/index.html" : "../index.html",
        html: '<span class="dir">' + (next ? "下一章" : "目录") + '</span><span class="t">' + (next ? next.t : "回到全书结构") + '</span>' })
    ]));
    if (window.CB && CB.renderSidebar) {
      CB.renderSidebar();
      CB.initSectionNav();
      CB.initGloss();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render);
  else render();
})();

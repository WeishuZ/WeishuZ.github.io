/* ============================================================================
   Generic lesson widgets for chapters 2-14.
   Data-driven, no fetch, works under file://.
   ========================================================================== */
(function () {
  "use strict";
  var CB = window.CB || {};
  var el = CB.el;
  if (!CB || !el) return;

  function pct(v) {
    return Math.max(0, Math.min(100, Math.round(v || 0)));
  }

  function initFlow(data) {
    var mount = document.getElementById("core-flow");
    var ctl = document.getElementById("core-flow-ctl");
    if (!mount || !ctl || !data || !data.flow) return;

    var nodes = data.flow.nodes || [];
    var rail = el("div", { class: "flow-rail" });
    var nodeEls = nodes.map(function (n, i) {
      var item = el("button", { class: "flow-node", type: "button", title: n.note || n.label }, [
        el("span", { class: "flow-idx", text: ("0" + (i + 1)).slice(-2) }),
        el("span", { class: "flow-ic", text: n.icon || "·" }),
        el("span", { class: "flow-label", text: n.label }),
        el("span", { class: "flow-sub", text: n.sub || "" })
      ]);
      item.addEventListener("click", function () {
        if (player) {
          player.pause();
          player.go(Math.min(i, player.steps.length - 1));
        }
      });
      rail.appendChild(item);
      if (i !== nodes.length - 1) rail.appendChild(el("span", { class: "flow-arrow", text: "→" }));
      return item;
    });

    mount.appendChild(rail);
    mount.appendChild(el("div", { class: "flow-insight", html: data.flow.caption || "" }));

    var player = new CB.StepPlayer({
      mount: ctl,
      steps: data.flow.steps || [],
      autoMs: data.flow.autoMs || 2300,
      onStep: function (idx, step) {
        nodeEls.forEach(function (n, i) {
          n.classList.toggle("active", i === (step.node == null ? idx : step.node));
          n.classList.toggle("past", i < (step.node == null ? idx : step.node));
        });
      }
    });
  }

  function initTradeoff(data) {
    var mount = document.getElementById("tradeoff-lab");
    if (!mount || !data || !data.lab) return;

    var seg = el("div", { class: "seg lab-seg" });
    var body = el("div", { class: "lab-body" });
    var modes = data.lab.modes || [];

    function render(i) {
      var m = modes[i] || modes[0];
      if (!m) return;
      Array.prototype.forEach.call(seg.children, function (b, idx) {
        b.classList.toggle("on", idx === i);
      });
      body.innerHTML = "";
      body.appendChild(el("div", { class: "lab-title", text: m.name }));
      body.appendChild(el("p", { class: "lab-note", html: m.note || "" }));
      var metrics = el("div", { class: "lab-metrics" });
      (m.metrics || []).forEach(function (x) {
        var row = el("div", { class: "lab-metric" }, [
          el("div", { class: "lab-metric-top" }, [
            el("span", { text: x.label }),
            el("span", { text: x.valueText || pct(x.value) + "%" })
          ]),
          el("div", { class: "lab-bar" }, [
            el("span", { class: x.warn ? "warn" : "", style: "width:" + pct(x.value) + "%" })
          ])
        ]);
        metrics.appendChild(row);
      });
      body.appendChild(metrics);
      if (m.takeaway) body.appendChild(el("div", { class: "lab-takeaway", html: m.takeaway }));
    }

    modes.forEach(function (m, i) {
      seg.appendChild(el("button", { text: m.name, onclick: function () { render(i); } }));
    });
    mount.appendChild(seg);
    mount.appendChild(body);
    render(0);
  }

  function initCheckpoints(data) {
    var mount = document.getElementById("checkpoint-cards");
    if (!mount || !data || !data.checkpoints) return;
    data.checkpoints.forEach(function (c) {
      mount.appendChild(el("div", { class: "checkpoint-card" }, [
        el("div", { class: "checkpoint-k", text: c.k }),
        el("div", { class: "checkpoint-t", text: c.t }),
        el("p", { html: c.d })
      ]));
    });
  }

  CB.initGenericChapter = function (data) {
    initFlow(data);
    initTradeoff(data);
    initCheckpoints(data);
  };

  function boot() {
    if (window.CB_CHAPTER) CB.initGenericChapter(window.CB_CHAPTER);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

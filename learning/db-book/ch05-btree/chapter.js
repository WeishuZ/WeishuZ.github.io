/* ============================================================================
   Chapter 5 — B+ tree sandbox, fan-out calculator, B+Tree vs LSM trade-off.
   Vanilla JS. No build step.
   ========================================================================== */
(function () {
  "use strict";
  var el = CB.el;
  var nextId = 0;

  function Node(leaf) {
    this.id = ++nextId;
    this.leaf = !!leaf;
    this.keys = [];
    this.children = [];
    this.next = null;
  }

  function BPTree(d) {
    this.d = d || 2;
    this.root = new Node(true);
  }

  BPTree.prototype.maxKeys = function () { return this.d * 2; };
  BPTree.prototype.minKey = function (node) {
    if (!node) return null;
    if (node.leaf) return node.keys[0];
    return this.minKey(node.children[0]);
  };
  BPTree.prototype.refresh = function (node) {
    node = node || this.root;
    if (node.leaf) return;
    for (var i = 0; i < node.children.length; i++) this.refresh(node.children[i]);
    node.keys = [];
    for (var j = 1; j < node.children.length; j++) node.keys.push(this.minKey(node.children[j]));
  };
  BPTree.prototype.findChildIndex = function (node, key) {
    var i = 0;
    while (i < node.keys.length && key >= node.keys[i]) i++;
    return i;
  };
  BPTree.prototype.pathToLeaf = function (key) {
    var path = [], node = this.root;
    while (node) {
      path.push(node);
      if (node.leaf) break;
      node = node.children[this.findChildIndex(node, key)];
    }
    return path;
  };
  BPTree.prototype.allKeys = function () {
    var node = this.root;
    while (node && !node.leaf) node = node.children[0];
    var out = [];
    while (node) {
      out = out.concat(node.keys);
      node = node.next;
    }
    return out;
  };
  BPTree.prototype.rebuild = function (keys, d) {
    nextId = 0;
    this.d = d || this.d;
    this.root = new Node(true);
    for (var i = 0; i < keys.length; i++) this.insert(keys[i], true);
    this.refresh();
  };
  BPTree.prototype.splitPath = function (path, notes, changed) {
    var node = path[path.length - 1];
    var right = new Node(node.leaf);

    if (node.leaf) {
      var splitAt = this.d;
      right.keys = node.keys.splice(splitAt);
      right.next = node.next;
      node.next = right;
      notes.push('leaf overflow: split 成 [' + node.keys.join(", ") + '] 和 [' + right.keys.join(", ") + ']，复制 separator ' + right.keys[0] + ' 到 parent');
    } else {
      var childSplit = this.d + 1;
      right.children = node.children.splice(childSplit);
      this.refresh(node);
      this.refresh(right);
      notes.push('internal overflow: 按 child pointer 拆开，把右半边的最小 key 作为 separator');
    }

    changed[node.id] = true;
    changed[right.id] = true;

    if (path.length === 1) {
      var newRoot = new Node(false);
      newRoot.children = [node, right];
      this.root = newRoot;
      this.refresh(this.root);
      changed[newRoot.id] = true;
      notes.push('root split: 树高 +1');
      return;
    }

    var parent = path[path.length - 2];
    var idx = parent.children.indexOf(node);
    parent.children.splice(idx + 1, 0, right);
    this.refresh(parent);
    changed[parent.id] = true;
    if (parent.keys.length > this.maxKeys()) this.splitPath(path.slice(0, -1), notes, changed);
  };
  BPTree.prototype.insert = function (key, silent) {
    key = Number(key);
    var notes = [], changed = {};
    if (!Number.isFinite(key)) return { ok: false, notes: ["请输入一个数字 key。"], changed: changed };
    if (this.allKeys().indexOf(key) >= 0) return { ok: false, notes: ["key " + key + " 已存在，这个沙盒默认唯一索引。"], changed: changed };
    var path = this.pathToLeaf(key);
    var leaf = path[path.length - 1];
    var pos = 0;
    while (pos < leaf.keys.length && leaf.keys[pos] < key) pos++;
    leaf.keys.splice(pos, 0, key);
    changed[leaf.id] = true;
    if (!silent) notes.push('insert ' + key + ': 先沿 root → leaf 找到目标页，再插入排序位置');
    if (leaf.keys.length > this.maxKeys()) this.splitPath(path, notes, changed);
    this.refresh();
    return { ok: true, notes: notes, changed: changed, path: path.map(function (n) { return n.id; }) };
  };
  BPTree.prototype.fixInner = function (path, notes, changed) {
    var node = path[path.length - 1];
    if (node === this.root) {
      if (!node.leaf && node.children.length === 1) {
        this.root = node.children[0];
        changed[this.root.id] = true;
        notes.push('root shrink: root 只剩一个 child，树高 -1');
      }
      return;
    }
    if (node.keys.length >= this.d) return;

    var parent = path[path.length - 2];
    var idx = parent.children.indexOf(node);
    var left = idx > 0 ? parent.children[idx - 1] : null;
    var right = idx < parent.children.length - 1 ? parent.children[idx + 1] : null;

    if (left && left.keys.length > this.d) {
      node.children.unshift(left.children.pop());
      notes.push('internal underflow: 从左 sibling 借一个 child pointer');
    } else if (right && right.keys.length > this.d) {
      node.children.push(right.children.shift());
      notes.push('internal underflow: 从右 sibling 借一个 child pointer');
    } else if (left) {
      left.children = left.children.concat(node.children);
      parent.children.splice(idx, 1);
      notes.push('internal underflow: 和左 sibling merge');
      this.fixInner(path.slice(0, -1), notes, changed);
    } else if (right) {
      node.children = node.children.concat(right.children);
      parent.children.splice(idx + 1, 1);
      notes.push('internal underflow: 和右 sibling merge');
      this.fixInner(path.slice(0, -1), notes, changed);
    }
    this.refresh();
    changed[node.id] = true;
    changed[parent.id] = true;
    if (left) changed[left.id] = true;
    if (right) changed[right.id] = true;
  };
  BPTree.prototype.fixLeaf = function (path, notes, changed) {
    var leaf = path[path.length - 1];
    if (leaf === this.root || leaf.keys.length >= this.d) return;
    var parent = path[path.length - 2];
    var idx = parent.children.indexOf(leaf);
    var left = idx > 0 ? parent.children[idx - 1] : null;
    var right = idx < parent.children.length - 1 ? parent.children[idx + 1] : null;

    if (left && left.keys.length > this.d) {
      leaf.keys.unshift(left.keys.pop());
      notes.push('leaf underflow: 从左 sibling borrow 一个 key，更新 separator');
    } else if (right && right.keys.length > this.d) {
      leaf.keys.push(right.keys.shift());
      notes.push('leaf underflow: 从右 sibling borrow 一个 key，更新 separator');
    } else if (left) {
      left.keys = left.keys.concat(leaf.keys);
      left.next = leaf.next;
      parent.children.splice(idx, 1);
      notes.push('leaf underflow: 和左 sibling merge，parent 删除一个 separator');
      this.fixInner(path.slice(0, -1), notes, changed);
    } else if (right) {
      leaf.keys = leaf.keys.concat(right.keys);
      leaf.next = right.next;
      parent.children.splice(idx + 1, 1);
      notes.push('leaf underflow: 和右 sibling merge，parent 删除一个 separator');
      this.fixInner(path.slice(0, -1), notes, changed);
    }
    this.refresh();
    changed[leaf.id] = true;
    changed[parent.id] = true;
    if (left) changed[left.id] = true;
    if (right) changed[right.id] = true;
  };
  BPTree.prototype.remove = function (key) {
    key = Number(key);
    var notes = [], changed = {};
    var path = this.pathToLeaf(key);
    var leaf = path[path.length - 1];
    var idx = leaf.keys.indexOf(key);
    if (idx < 0) return { ok: false, notes: ['delete ' + key + ': 目标 leaf 中没有这个 key。'], changed: changed, path: path.map(function (n) { return n.id; }) };
    leaf.keys.splice(idx, 1);
    changed[leaf.id] = true;
    notes.push('delete ' + key + ': 从 leaf 移除后检查是否低于 d=' + this.d);
    this.fixLeaf(path, notes, changed);
    this.refresh();
    return { ok: true, notes: notes, changed: changed, path: path.map(function (n) { return n.id; }) };
  };
  BPTree.prototype.search = function (key) {
    key = Number(key);
    var path = this.pathToLeaf(key);
    var leaf = path[path.length - 1];
    return {
      found: leaf.keys.indexOf(key) >= 0,
      path: path.map(function (n) { return n.id; }),
      leaf: leaf,
      key: key
    };
  };
  BPTree.prototype.range = function (lo, hi) {
    lo = Number(lo); hi = Number(hi);
    if (hi < lo) { var t = lo; lo = hi; hi = t; }
    var path = this.pathToLeaf(lo);
    var node = path[path.length - 1];
    var keys = [], leaves = {};
    while (node) {
      var any = false;
      for (var i = 0; i < node.keys.length; i++) {
        var k = node.keys[i];
        if (k >= lo && k <= hi) { keys.push(k); any = true; }
        if (k > hi) return { keys: keys, leaves: leaves, path: path.map(function (n) { return n.id; }) };
      }
      if (any) leaves[node.id] = true;
      node = node.next;
    }
    return { keys: keys, leaves: leaves, path: path.map(function (n) { return n.id; }) };
  };
  BPTree.prototype.levels = function () {
    var out = [], q = [{ n: this.root, depth: 0 }];
    while (q.length) {
      var cur = q.shift();
      if (!out[cur.depth]) out[cur.depth] = [];
      out[cur.depth].push(cur.n);
      if (!cur.n.leaf) for (var i = 0; i < cur.n.children.length; i++) q.push({ n: cur.n.children[i], depth: cur.depth + 1 });
    }
    return out;
  };

  function buildSandbox() {
    var mount = document.getElementById("btree-sandbox");
    if (!mount) return;
    var tree = new BPTree(2);
    var demo = [10, 20, 5, 6, 12, 30, 7, 17, 3, 4, 8, 9, 11, 13, 15, 16, 18, 22, 25, 28];
    var demoIdx = 0;
    var state = { path: {}, changed: {}, hitKey: null, rangeKeys: {}, rangeLeaves: {}, notes: [] };

    var keyInput = el("input", { class: "bt-input", type: "number", value: "12", min: "0", max: "999" });
    var rangeA = el("input", { class: "bt-input bt-range-input", type: "number", value: "6" });
    var rangeB = el("input", { class: "bt-input bt-range-input", type: "number", value: "18" });
    var order = el("input", { type: "range", min: "1", max: "4", value: "2" });
    var orderOut = el("span", { class: "chip", text: "d=2" });
    var stats = el("div", { class: "bt-stats" });
    var stage = el("div", { class: "bt-stage" });
    var chain = el("div", { class: "leaf-chain" });
    var log = el("div", { class: "bt-log" });

    function clearMarks() {
      state.path = {}; state.changed = {}; state.hitKey = null; state.rangeKeys = {}; state.rangeLeaves = {};
    }
    function pushLog(lines, kind) {
      lines.forEach(function (line) {
        state.notes.unshift({ line: line, kind: kind || "op" });
      });
      state.notes = state.notes.slice(0, 24);
    }
    function markPath(ids) { state.path = {}; (ids || []).forEach(function (id) { state.path[id] = true; }); }
    function doInsert(v, quiet) {
      clearMarks();
      var r = tree.insert(v);
      state.changed = r.changed || {};
      markPath(r.path);
      if (!quiet) pushLog(r.notes, r.ok ? "ok" : "warn");
      render();
    }
    function reset() {
      clearMarks();
      demoIdx = 0;
      tree = new BPTree(Number(order.value));
      [10, 20, 5, 6, 12, 30, 7, 17].forEach(function (k) { tree.insert(k, true); });
      pushLog(["reset: 载入经典 split 序列 10,20,5,6,12,30,7,17"], "op");
      render();
    }
    function rebuildWithOrder() {
      var keys = tree.allKeys();
      tree.rebuild(keys, Number(order.value));
      clearMarks();
      pushLog(["order 改为 d=" + order.value + "，用当前 keys 重建树形以保持 invariant"], "op");
      render();
    }

    var controls = el("div", { class: "bt-controls" }, [
      el("div", { class: "bt-control-group" }, [
        el("label", { text: "key" }), keyInput,
        el("button", { class: "btn primary", onclick: function () { doInsert(keyInput.value); }, text: "Insert" }),
        el("button", { class: "btn", onclick: function () {
          clearMarks();
          var r = tree.search(keyInput.value);
          markPath(r.path);
          state.hitKey = r.found ? Number(keyInput.value) : null;
          pushLog(['search ' + keyInput.value + ': ' + (r.found ? '命中 leaf page' : '落到 leaf，但未命中') + '，I/O path=' + r.path.length + ' pages'], r.found ? "ok" : "warn");
          render();
        }, text: "Search" }),
        el("button", { class: "btn", onclick: function () {
          clearMarks();
          var r = tree.remove(keyInput.value);
          state.changed = r.changed || {};
          markPath(r.path);
          pushLog(r.notes, r.ok ? "ok" : "warn");
          render();
        }, text: "Delete" }),
        el("span", { class: "chip", text: "range" }), rangeA, rangeB,
        el("button", { class: "btn", onclick: function () {
          clearMarks();
          var r = tree.range(rangeA.value, rangeB.value);
          markPath(r.path);
          r.keys.forEach(function (k) { state.rangeKeys[k] = true; });
          state.rangeLeaves = r.leaves;
          pushLog(['range [' + rangeA.value + ', ' + rangeB.value + ']: 先 lookup 下界，再沿 leaf chain 扫到 ' + r.keys.length + ' 个 key'], "ok");
          render();
        }, text: "Range" })
      ]),
      el("div", { class: "bt-control-group bt-demo" }, [
        el("label", { text: "order" }), order, orderOut,
        el("button", { class: "btn", onclick: function () {
          doInsert(demo[demoIdx % demo.length]);
          keyInput.value = demo[demoIdx % demo.length];
          demoIdx++;
        }, text: "Next demo" }),
        el("button", { class: "btn", onclick: reset, text: "Reset" })
      ])
    ]);

    mount.appendChild(el("div", { class: "bt-shell" }, [controls, stats, stage, chain, log]));

    order.addEventListener("input", function () {
      orderOut.textContent = "d=" + order.value;
    });
    order.addEventListener("change", rebuildWithOrder);

    function renderStats() {
      var levels = tree.levels();
      var keys = tree.allKeys();
      var leafCount = levels[levels.length - 1].length;
      stats.innerHTML = "";
      [
        ["height", levels.length, "一次 lookup 读的树页数"],
        ["keys", keys.length, "当前索引项数量"],
        ["leaves", leafCount, "leaf pages"],
        ["max keys", tree.maxKeys(), "每页最多 key 数"]
      ].forEach(function (m) {
        stats.appendChild(el("div", { class: "bt-stat" }, [
          el("b", { text: String(m[1]) }),
          el("span", { text: m[0] + " · " + m[2] })
        ]));
      });
    }
    function renderTree() {
      stage.innerHTML = "";
      var wrap = el("div", { class: "bt-levels" });
      var levels = tree.levels();
      levels.forEach(function (level, depth) {
        var label = depth === 0 ? "root" : depth === levels.length - 1 ? "leaf" : "internal";
        var nodes = el("div", { class: "bt-level-nodes" });
        level.forEach(function (node) {
          var cls = "bt-node" + (state.path[node.id] ? " hot" : "") + (state.changed[node.id] ? " changed" : "") + (state.rangeLeaves[node.id] ? " range-hit" : "");
          var box = el("div", { class: cls }, [
            el("div", { class: "bt-node-head" }, [
              el("span", { text: node.leaf ? "leaf page" : "internal page" }),
              el("span", { text: "#" + node.id })
            ]),
            el("div", { class: "bt-node-body" })
          ]);
          var body = box.querySelector(".bt-node-body");
          if (!node.keys.length) body.appendChild(el("span", { class: "muted", text: "empty" }));
          node.keys.forEach(function (k) {
            var keyCls = "bt-key" + (state.hitKey === k ? " hit" : "") + (state.rangeKeys[k] ? " range" : "");
            body.appendChild(el("span", { class: keyCls, text: String(k) }));
          });
          nodes.appendChild(box);
        });
        wrap.appendChild(el("div", { class: "bt-level" }, [
          el("div", { class: "bt-level-label", text: label }),
          nodes
        ]));
      });
      stage.appendChild(wrap);
    }
    function renderChain() {
      chain.innerHTML = "";
      var node = tree.root;
      while (node && !node.leaf) node = node.children[0];
      chain.appendChild(el("span", { class: "chip", text: "leaf chain" }));
      while (node) {
        chain.appendChild(el("span", { class: "leaf-chip" + (state.rangeLeaves[node.id] ? " hit" : ""), text: "[" + node.keys.join(", ") + "]" }));
        if (node.next) chain.appendChild(el("span", { class: "leaf-arrow", text: "→" }));
        node = node.next;
      }
    }
    function renderLog() {
      log.innerHTML = "";
      if (!state.notes.length) {
        log.appendChild(el("div", { html: '<span class="op">ready</span> 沙盒已载入。' }));
        return;
      }
      state.notes.forEach(function (n) {
        var klass = n.kind === "warn" ? "warn" : n.kind === "ok" ? "ok" : "op";
        log.appendChild(el("div", { html: '<span class="' + klass + '">●</span> ' + n.line }));
      });
    }
    function render() {
      renderStats();
      renderTree();
      renderChain();
      renderLog();
    }
    reset();
  }

  function buildFanout() {
    var mount = document.getElementById("fanout-calc");
    if (!mount) return;
    var page = slider(2048, 16384, 4096, 1024);
    var key = slider(4, 64, 8, 4);
    var ptr = slider(4, 32, 8, 4);
    var rid = slider(8, 64, 16, 4);
    var rowsExp = slider(3, 10, 9, 1);
    var result = el("div", { class: "calc-result" });
    function slider(min, max, value, step) {
      return el("input", { type: "range", min: String(min), max: String(max), value: String(value), step: String(step) });
    }
    var rows = [
      ["page size", page, "bytes"],
      ["key bytes", key, "bytes"],
      ["ptr bytes", ptr, "bytes"],
      ["RID bytes", rid, "bytes"],
      ["rows", rowsExp, "10^x"]
    ];
    var controls = el("div", { class: "calc-controls" });
    rows.forEach(function (r) {
      var out = el("output");
      r[1]._out = out;
      controls.appendChild(el("div", { class: "calc-row" }, [
        el("label", { text: r[0] }), r[1], out
      ]));
      r[1].addEventListener("input", render);
    });
    mount.appendChild(el("div", { class: "calc-grid" }, [controls, result]));
    function fmt(n) { return n >= 1e9 ? (n / 1e9).toFixed(1) + "B" : n >= 1e6 ? (n / 1e6).toFixed(1) + "M" : String(Math.round(n)); }
    function render() {
      page._out.textContent = page.value + " B";
      key._out.textContent = key.value + " B";
      ptr._out.textContent = ptr.value + " B";
      rid._out.textContent = rid.value + " B";
      rowsExp._out.textContent = "10^" + rowsExp.value;
      var p = Number(page.value), k = Number(key.value), pt = Number(ptr.value), r = Number(rid.value);
      var rowCount = Math.pow(10, Number(rowsExp.value));
      var fanout = Math.max(2, Math.floor(p / (k + pt)));
      var leafEntries = Math.max(2, Math.floor(p / (k + r)));
      var leaves = Math.ceil(rowCount / leafEntries);
      var height = leaves <= 1 ? 1 : 1 + Math.ceil(Math.log(leaves) / Math.log(fanout));
      var withCachedRoot = Math.max(1, height - 1);
      result.innerHTML = "";
      result.appendChild(el("div", { class: "big-number", text: height + " pages" }));
      result.appendChild(el("p", { html: "一次 point lookup 大约读 <b>" + height + "</b> 层；如果 root 常驻 buffer pool，热路径约 <b>" + withCachedRoot + "</b> 次 page read。" }));
      var grid = el("div", { class: "calc-metrics" }, [
        metric(fanout, "internal fan-out"),
        metric(leafEntries, "entries / leaf"),
        metric(fmt(leaves), "leaf pages"),
        metric(fmt(rowCount), "rows")
      ]);
      result.appendChild(grid);
      var bars = el("div", { class: "height-bars" });
      for (var i = 0; i < height; i++) {
        bars.appendChild(el("div", { class: "height-bar", style: "height:" + (22 + i * 16) + "%" }));
      }
      result.appendChild(bars);
    }
    function metric(v, label) {
      return el("div", { class: "calc-metric" }, [el("b", { text: String(v) }), el("span", { text: label })]);
    }
    render();
  }

  function buildTradeoff() {
    var mount = document.getElementById("lsm-tradeoff");
    if (!mount) return;
    var read = el("input", { type: "range", min: "0", max: "100", value: "70" });
    var range = el("input", { type: "range", min: "0", max: "100", value: "35" });
    var outRead = el("output"), outRange = el("output");
    var result = el("div", { class: "trade-result" });
    var controls = el("div", { class: "trade-controls" }, [
      el("div", { class: "trade-row" }, [el("label", { text: "read %" }), read, outRead]),
      el("div", { class: "trade-row" }, [el("label", { text: "range scan %" }), range, outRange])
    ]);
    read.addEventListener("input", render);
    range.addEventListener("input", render);
    mount.appendChild(el("div", { class: "trade-grid" }, [controls, result]));

    function render() {
      var rp = Number(read.value), wp = 100 - rp, rg = Number(range.value);
      outRead.textContent = rp + "%";
      outRange.textContent = rg + "%";
      var bScore = rp * .55 + rg * .45;
      var lScore = wp * .7 + (100 - rg) * .15;
      var verdict = bScore >= lScore
        ? "这个 workload 更像传统 OLTP/范围查询场景：B+ 树的稳定读延迟和 leaf chain 更占优势。"
        : "这个 workload 写入压力更强：LSM 用追加写和后台 compaction 把随机写压力挪走，吞吐更可能占优。";
      result.innerHTML = "";
      result.appendChild(el("div", { class: "trade-side" }, [
        el("div", { class: "trade-card" }, [el("b", { text: "B+ Tree" }), el("p", { text: "读路径短，范围扫描自然；更新会原地改 page，可能触发 split、page latch 和随机写。" })]),
        el("div", { class: "trade-card" }, [el("b", { text: "LSM Tree" }), el("p", { text: "写入先追加到 memtable/WAL，后台整理；读可能查多层并依赖 bloom filter。" })])
      ]));
      result.appendChild(el("div", { class: "trade-bars" }, [
        bar("B+ tree fit", Math.round(bScore)),
        bar("LSM fit", Math.round(lScore))
      ]));
      result.appendChild(el("div", { class: "trade-verdict", text: verdict }));
    }
    function bar(label, pct) {
      return el("div", {}, [
        el("div", { class: "muted", text: label + " · " + pct }),
        el("div", { class: "trade-bar" }, [el("span", { style: "width:" + Math.max(3, Math.min(100, pct)) + "%" })])
      ]);
    }
    render();
  }

  function boot() {
    buildSandbox();
    buildFanout();
    buildTradeoff();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();

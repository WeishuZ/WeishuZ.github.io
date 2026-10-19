"use strict";
const $ = (selector) => document.querySelector(selector);
const escapeText = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const numeric = (v) => typeof v === "number" && Number.isFinite(v);
const number = (v, d = 1) =>
  numeric(v) ? v.toLocaleString("en-US", { maximumFractionDigits: d }) : "—";
const bytes = (v) =>
  !numeric(v)
    ? "—"
    : v >= 1073741824
      ? number(v / 1073741824, 2) + " GiB"
      : number(v / 1048576, 1) + " MiB";
const timeLabel = (v) =>
  v
    ? new Date(v * 1000).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "—";
const dateLabel = (v) =>
  v
    ? new Date(v * 1000).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      })
    : "—";
const live = document.body.dataset.mode === "live";
const mock = document.body.dataset.mode === "mock";
const views = ["overview", "instances", "reliability", "signals"];
let payload = null,
  selected = "console",
  sequence = 0,
  pending = false,
  lastError = "";
function status(e) {
  return (
    '<span class="status ' +
    escapeText(e.state) +
    '">' +
    (e.state === "active"
      ? "Running"
      : e.state === "inactive"
        ? "Inactive"
        : escapeText(e.state)) +
    "</span>"
  );
}
function entities() {
  return payload?.latest?.entities || [];
}
function table(rows) {
  const body = rows
    .map(
      (e) =>
        '<tr class="' +
        (e.id === selected ? "selected" : "") +
        '"><td><button class="row-button" data-inspect="' +
        escapeText(e.id) +
        '">' +
        escapeText(e.name) +
        "</button></td><td>" +
        escapeText(e.provider) +
        "</td><td>" +
        status(e) +
        "</td><td>" +
        number(e.cpu_cores, 4) +
        "</td><td>" +
        bytes(e.memory_bytes) +
        "</td><td>" +
        number(e.restarts, 0) +
        '</td><td><button class="row-button" data-inspect="' +
        escapeText(e.id) +
        '" aria-label="Inspect ' +
        escapeText(e.name) +
        '">›</button></td></tr>',
    )
    .join("");
  return (
    '<table><thead><tr><th>Runtime</th><th>Provider</th><th>State</th><th>CPU cores</th><th>Memory</th><th>Restarts</th><th><span class="sr-only">Inspect</span></th></tr></thead><tbody>' +
    (body || '<tr><td colspan="7">No runtimes match this filter.</td></tr>') +
    "</tbody></table>"
  );
}
function chart(target, values, maximum, unit) {
  const valid = values.filter((p) => numeric(p.value));
  if (!valid.length) {
    $(target).innerHTML =
      '<div class="chart-empty">No valid observations in this window.</div>';
    return;
  }
  const w = 570,
    h = 220,
    l = 45,
    r = 12,
    t = 15,
    b = 34,
    first = values[0].ts,
    last = values.at(-1).ts,
    domain = Math.max(1, last - first);
  const x = (ts) => l + ((ts - first) / domain) * (w - l - r),
    y = (v) => h - b - (v / maximum) * (h - t - b);
  let path = "",
    previous = null;
  for (const p of values) {
    if (!numeric(p.value)) {
      previous = null;
      continue;
    }
    path +=
      (previous && p.ts - previous.ts <= payload.interval_seconds * 3
        ? "L"
        : "M") +
      x(p.ts).toFixed(2) +
      "," +
      y(p.value).toFixed(2) +
      " ";
    previous = p;
  }
  const grid = [0, maximum / 2, maximum]
    .map(
      (v) =>
        '<line class="grid-line" x1="' +
        l +
        '" x2="' +
        (w - r) +
        '" y1="' +
        y(v) +
        '" y2="' +
        y(v) +
        '"/><text x="' +
        (l - 7) +
        '" y="' +
        (y(v) + 4) +
        '" text-anchor="end">' +
        number(v, maximum < 0.1 ? 4 : 2) +
        unit +
        "</text>",
    )
    .join("");
  const labels = [first, first + domain / 2, last]
    .map(
      (ts, i) =>
        '<text x="' +
        (i === 0 ? l : i === 2 ? w - r : x(ts)) +
        '" y="' +
        (h - 8) +
        '" text-anchor="' +
        (i === 0 ? "start" : i === 2 ? "end" : "middle") +
        '">' +
        timeLabel(ts) +
        "</text>",
    )
    .join("");
  const dots = valid
    .map(
      (p) =>
        '<circle class="point" cx="' +
        x(p.ts) +
        '" cy="' +
        y(p.value) +
        '" r="5"><title>' +
        timeLabel(p.ts) +
        " · " +
        number(p.value, 4) +
        unit +
        "</title></circle>",
    )
    .join("");
  $(target).innerHTML =
    '<svg viewBox="0 0 ' +
    w +
    " " +
    h +
    '" role="img" aria-label="Observed time series, ' +
    valid.length +
    ' chart points">' +
    grid +
    '<path class="series" d="' +
    path +
    '"/>' +
    dots +
    labels +
    "</svg>";
}
function renderSummary() {
  const host = payload.latest?.host;
  if (!host) {
    $("#summary").innerHTML = "<p>Waiting for a complete host observation.</p>";
    return;
  }
  const services = entities().filter((e) => e.kind === "service"),
    agents = entities().filter((e) => e.kind === "agent");
  const metric = (label, value, context) =>
    '<div><span class="label">' +
    label +
    "</span><strong>" +
    value +
    "</strong><small>" +
    context +
    "</small></div>";
  $("#summary").innerHTML =
    metric(
      "CPU used",
      numeric(host.cpu_pct) ? number(host.cpu_pct, 1) + "%" : "Collecting",
      "of " + number(host.cpu_count, 0) + " vCPU",
    ) +
    metric(
      "Memory",
      bytes(host.memory_used),
      "of " + bytes(host.memory_total),
    ) +
    metric(
      "Services healthy",
      services.filter((e) => e.state === "active").length +
        " / " +
        services.length,
      "active states",
    ) +
    metric(
      "Agent runtimes active",
      agents.filter((e) => e.state === "active").length + " / " + agents.length,
      "connected inventory",
    );
  const cpu = payload.timeline.map((s) => ({
      ts: s.ts,
      value: s.host.cpu_pct,
    })),
    valid = cpu.filter((p) => numeric(p.value)).map((p) => p.value),
    max = Math.max(0, ...valid);
  $("#cpu-caption").textContent =
    "Max " +
    number(max, 1) +
    "% · " +
    payload.coverage.sample_count +
    " samples";
  $("#memory-caption").textContent =
    bytes(host.memory_used) + " of " + bytes(host.memory_total);
  chart("#cpu-chart", cpu, Math.max(5, Math.ceil(max / 5) * 5), "%");
  chart(
    "#memory-chart",
    payload.timeline.map((s) => ({
      ts: s.ts,
      value: s.host.memory_used / 1073741824,
    })),
    Math.ceil(host.memory_total / 1073741824),
    " GiB",
  );
  $("#overview-table").innerHTML = table(entities());
  const probe = payload.probes[0];
  $("#probe-summary").innerHTML =
    "<div>Local API <strong>" +
    number(probe.availability_pct, 2) +
    "%</strong><small>" +
    probe.passed +
    " / " +
    probe.samples +
    " checks</small></div><div>p95 probe <strong>" +
    number(probe.p95_ms, 1) +
    ' ms</strong></div><div class="explain">Sampled local HTTP health,<br>not user request success.</div>';
}
function renderInstances() {
  const rows = entities().filter(
    (e) =>
      ($("#kind").value === "all" || e.kind === $("#kind").value) &&
      ($("#state").value === "all" || e.state === $("#state").value),
  );
  if (rows.length && !rows.some((e) => e.id === selected))
    selected = rows[0].id;
  $("#inventory-count").textContent = rows.length + " runtimes";
  $("#instances-table").innerHTML = table(rows);
  const e = rows.find((e) => e.id === selected);
  if (!e) {
    $("#inspector").innerHTML = "<p>No runtime matches the current filter.</p>";
    $("#instance-chart").innerHTML =
      '<div class="chart-empty">No matching runtime.</div>';
    return;
  }
  const field = (label, value) =>
    "<dt>" + label + "</dt><dd>" + escapeText(value) + "</dd>";
  $("#inspector").innerHTML =
    "<h2>" +
    escapeText(e.name) +
    "</h2>" +
    status(e) +
    "<dl>" +
    field("Runtime ID", e.id) +
    field("Provider", e.provider) +
    field("Substate", e.substate) +
    field("CPU consumed", number(e.cpu_cores, 4) + " cores") +
    field(
      "CPU quota",
      numeric(e.cpu_limit)
        ? number(e.cpu_limit, 2) + " cores"
        : "Not set / unavailable",
    ) +
    field("Memory observed", bytes(e.memory_bytes)) +
    field(
      "Memory limit",
      numeric(e.memory_limit) ? bytes(e.memory_limit) : "Not set / unavailable",
    ) +
    field("Process count", number(e.processes, 0)) +
    field("Restarts", number(e.restarts, 0)) +
    field("Last exit status", number(e.exit_status, 0)) +
    field("Service result", e.reason || "Unavailable") +
    '</dl><p class="source-note">State: systemd or legacy tmux observation. Accounting: systemd counters when available, otherwise the process tree. A missing measurement is not zero usage.</p>';
  const series = payload.timeline.map((s) => ({
    ts: s.ts,
    value: s.entities.find((x) => x.id === selected)?.cpu_cores,
  }));
  const max =
    Math.max(
      0.01,
      ...series.filter((p) => numeric(p.value)).map((p) => p.value),
    ) * 1.2;
  chart("#instance-chart", series, max, "");
}
function renderReliability() {
  $("#probe-details").innerHTML = payload.probes
    .map((p) => {
      const checks = payload.timeline
        .flatMap((s) =>
          s.probes
            .filter((x) => x.id === p.id)
            .map((x) => ({ ...x, ts: s.ts })),
        )
        .slice(-90);
      const stat = (name, value) =>
        "<div>" + name + "<strong>" + value + "</strong></div>";
      const buttons = checks
        .map(
          (c) =>
            '<button class="check ' +
            (c.ok ? "" : "bad") +
            '" data-check="' +
            escapeText(p.id) +
            '" data-ts="' +
            c.ts +
            '" aria-label="' +
            escapeText(p.name) +
            ", " +
            timeLabel(c.ts) +
            ", " +
            (c.ok ? "passing" : "failed") +
            ", " +
            number(c.latency_ms, 2) +
            ' milliseconds"><span class="sr-only">' +
            timeLabel(c.ts) +
            "</span></button>",
        )
        .join("");
      return (
        '<section class="probe-panel"><div class="probe-top"><h2>' +
        escapeText(p.name) +
        "</h2><span>" +
        (p.latest?.ok ? "Reachable" : "No passing latest check") +
        '</span></div><div class="probe-stats">' +
        stat("Probe availability", number(p.availability_pct, 3) + "%") +
        stat("Recorded checks", p.passed + " / " + p.samples) +
        stat("p50 round trip", number(p.p50_ms, 2) + " ms") +
        stat("p95 round trip", number(p.p95_ms, 2) + " ms") +
        '</div><div class="check-strip" aria-label="Recorded checks for ' +
        escapeText(p.name) +
        '">' +
        buttons +
        '</div><p class="strip-note">Last ' +
        checks.length +
        " plotted observations · aggregate uses all " +
        p.samples +
        " recorded checks.</p></section>"
      );
    })
    .join("");
  const rows = payload.events
    .map(
      (e) =>
        "<tr><td>" +
        dateLabel(e.ts) +
        "</td><td>" +
        escapeText(e.entity) +
        "</td><td>" +
        escapeText(e.severity) +
        "</td><td>" +
        escapeText(e.message) +
        "</td></tr>",
    )
    .join("");
  $("#events").innerHTML =
    "<table><thead><tr><th>Observed at</th><th>Entity</th><th>Severity</th><th>Transition</th></tr></thead><tbody>" +
    (rows ||
      '<tr><td colspan="4">No state transitions recorded in this window.</td></tr>') +
    "</tbody></table>";
}
function renderSignals() {
  const rows = [
    [
      "Host resources",
      "Connected",
      "/proc/stat, /proc/meminfo, PSI, disk and network counters",
    ],
    [
      "Runtime state",
      "Connected",
      "systemd state; legacy tmux where applicable",
    ],
    [
      "Runtime resources",
      "Partial accounting",
      "systemd CPU/memory counters; process-tree fallback",
    ],
    [
      "HTTP service health",
      "Connected",
      "Recorded local HTTP probes, including failures",
    ],
    [
      "Task success and failure",
      "Not instrumented",
      "No task-outcome event source is connected",
    ],
    [
      "Task queue latency",
      "Not instrumented",
      "No queue admission or start timestamps are connected",
    ],
    [
      "GPU telemetry",
      "Not connected",
      "This deployment currently has CPU-only observations",
    ],
  ];
  $("#signal-table").innerHTML =
    "<table><thead><tr><th>Signal</th><th>Coverage</th><th>Source / boundary</th></tr></thead><tbody>" +
    rows
      .map(
        (r) =>
          "<tr><td>" +
          r[0] +
          '</td><td class="' +
          (r[1] === "Connected" ? "connected" : "missing") +
          '">' +
          r[1] +
          "</td><td>" +
          r[2] +
          "</td></tr>",
      )
      .join("") +
    "</tbody></table>";
  $("#definitions").innerHTML = Object.entries(payload.definitions)
    .map(
      ([name, definition]) =>
        "<dt>" +
        escapeText(name) +
        "</dt><dd>" +
        escapeText(definition) +
        "</dd>",
    )
    .join("");
}
function selectView() {
  if (!live && !mock) {
    document.querySelectorAll("[data-panel]").forEach((p) => (p.hidden = true));
    $("#access").hidden = false;
    return;
  }
  const requested = location.hash.slice(1),
    view = views.includes(requested) ? requested : "overview";
  document
    .querySelectorAll("[data-panel]")
    .forEach((p) => (p.hidden = p.id !== view));
  document
    .querySelectorAll("[data-view]")
    .forEach((a) =>
      a.dataset.view === view
        ? a.setAttribute("aria-current", "page")
        : a.removeAttribute("aria-current"),
    );
  document.title =
    {
      overview: "Runtime overview",
      instances: "Instance diagnostics",
      reliability: "Reliability explorer",
      signals: "Signal coverage",
    }[view] +
    (mock ? " — Agent Operations · Mock data" : " — Agent Operations");
}
function freshness() {
  if (!payload) return;
  if (mock) {
    $("#freshness").textContent = "Fixed mock scenario";
    return;
  }
  const age = Math.max(
      0,
      Math.floor(Date.now() / 1000 - payload.coverage.last_sample_at),
    ),
    frozen = payload.delivery?.mode === "snapshot";
  const stale =
    !frozen &&
    (payload.coverage.stale ||
      age >
        Math.max(30, (payload.delivery?.publish_interval_seconds || 10) * 2));
  $("#freshness").classList.toggle("stale", stale);
  $("#freshness").textContent = frozen
    ? "Captured " + dateLabel(payload.generated_at)
    : stale
      ? "Observations stale"
      : (live ? "Updated" : "Published") + " " + age + "s ago";
}
function render() {
  renderSummary();
  renderInstances();
  renderReliability();
  renderSignals();
  selectView();
  freshness();
  const c = payload.coverage;
  $("#coverage").textContent =
    "Coverage: " +
    c.sample_count +
    " observations since " +
    dateLabel(c.first_sample_at) +
    " · " +
    payload.interval_seconds +
    "-second collection · " +
    (mock
      ? "mock data · illustrative only"
      : live
        ? "private live view"
        : "read-only publication");
}
async function load() {
  if (!live && !mock) return;
  const current = ++sequence,
    windowKey = $("#window").value,
    url = "/api/v1/observations?window=" + windowKey;
  pending = true;
  $("#refresh").disabled = true;
  try {
    let data;
    if (mock) {
      if (!globalThis.AgentOperationsMock)
        throw new Error("Mock dataset unavailable");
      data = globalThis.AgentOperationsMock.snapshot(windowKey);
    } else {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok)
        throw new Error("Observation source returned HTTP " + response.status);
      data = await response.json();
    }
    if (current !== sequence) return;
    if (!data.coverage || !Array.isArray(data.timeline))
      throw new Error("Observation response is incomplete");
    payload = data;
    lastError = "";
    $("#error").hidden = true;
    render();
  } catch (error) {
    if (current !== sequence) return;
    lastError = error.message;
    $("#error").hidden = false;
    $("#error").textContent =
      lastError +
      ". " +
      (payload
        ? "Previous observations remain visible."
        : "No placeholder metrics have been substituted.");
    $("#freshness").textContent = "Source unavailable";
    $("#freshness").classList.add("stale");
  } finally {
    if (current === sequence) {
      pending = false;
      $("#refresh").disabled = false;
    }
  }
}
document.addEventListener("click", (event) => {
  const inspect = event.target.closest("[data-inspect]");
  if (inspect) {
    selected = inspect.dataset.inspect;
    location.hash = "instances";
    renderInstances();
    return;
  }
  const target = event.target.closest("[data-check]");
  if (target && payload) {
    const snapshot = payload.timeline.find(
        (s) => s.ts === Number(target.dataset.ts),
      ),
      check = snapshot?.probes.find((p) => p.id === target.dataset.check);
    if (check)
      $("#check-inspector").textContent =
        new Date(snapshot.ts * 1000).toISOString() +
        " | " +
        check.id +
        " | HTTP " +
        (check.http_status ?? "unavailable") +
        " | " +
        (check.ok ? "PASS" : "FAIL") +
        " | " +
        number(check.latency_ms, 3) +
        " ms | " +
        (check.error || "no transport error");
  }
});
$("#window").addEventListener("change", load);
$("#refresh").addEventListener("click", load);
$("#kind").addEventListener("change", () => payload && renderInstances());
$("#state").addEventListener("change", () => payload && renderInstances());
$("#export").addEventListener("click", () => {
  if (!payload) return;
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      }),
    ),
    link = document.createElement("a");
  link.href = url;
  link.download =
    (mock ? "mock-agent-observations-" : "agent-observations-") +
    payload.window +
    "-" +
    payload.generated_at +
    ".json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
window.addEventListener("hashchange", () => {
  selectView();
  window.scrollTo(0, 0);
});
setInterval(
  () => {
    if (live && !pending && !document.hidden) load();
  },
  live ? 10000 : 60000,
);
setInterval(() => {
  if (!lastError) freshness();
}, 1000);
if (!live && !mock) {
  $("#freshness").textContent = "Private deployment";
  $("#refresh").disabled = true;
  $("#export").disabled = true;
  $("#window").disabled = true;
  $("#coverage").textContent =
    "Read-only tooling · operational data is not published";
}
selectView();
load();

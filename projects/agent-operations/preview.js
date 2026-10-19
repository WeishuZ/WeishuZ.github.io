// Public interface structure only. This file has no observation client or dataset.
"use strict";
const $ = (selector) => document.querySelector(selector);
const withheld = '<span class="withheld">Withheld</span>';
const grid = (headers, content) =>
  `<table><thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead><tbody><tr><td colspan="${headers.length}" class="redaction-row">${content}</td></tr></tbody></table>`;
const chart = (description) =>
  `<div class="redacted-history"><span>History withheld</span><small>${description}</small></div>`;
const views = ["overview", "instances", "reliability", "signals"];
$("#summary").innerHTML = [
  "CPU used",
  "Memory",
  "Services healthy",
  "Agent runtimes active",
]
  .map(
    (label) =>
      `<div><span class="label">${label}</span><strong>Private</strong></div>`,
  )
  .join("");
$("#cpu-caption").textContent = "Values and sample counts withheld";
$("#memory-caption").textContent = "Usage and capacity withheld";
$("#cpu-chart").innerHTML = chart("CPU deltas · missing intervals preserved");
$("#memory-chart").innerHTML = chart(
  "Memory accounting · unavailable counters preserved",
);
const inventory = grid(
  ["Runtime", "Provider", "State", "CPU cores", "Memory", "Restarts"],
  "Inventory identities, row counts, state and accounting are private.",
);
$("#overview-table").innerHTML = inventory;
$("#instances-table").innerHTML = inventory;
$("#inventory-count").textContent = "Inventory redacted";
$("#probe-summary").innerHTML =
  `<div>Probe availability <strong>Private</strong></div><div>p95 round trip <strong>Private</strong></div><div class="explain">Recorded local health checks,<br>separate from user request success.</div>`;
const fields = [
  "Runtime ID",
  "Provider",
  "Substate",
  "CPU consumed",
  "CPU quota",
  "Memory observed",
  "Memory limit",
  "Process count",
  "Restarts",
  "Last exit status",
  "Service result",
];
$("#inspector").innerHTML =
  `<h2>Instance inspector</h2><p class="redaction-label">Identity and state redacted</p><dl>${fields.map((label) => `<dt>${label}</dt><dd>${withheld}</dd>`).join("")}</dl><p class="source-note">systemd accounting with process-tree fallback. Missing measurements remain unavailable.</p>`;
$("#instance-chart").innerHTML = chart(
  "Per-runtime CPU accounting · configured limits",
);
$("#probe-details").innerHTML =
  `<section class="probe-panel"><div class="probe-top"><h2>HTTP health checks</h2><span class="redaction-label">Probe targets and status redacted</span></div><div class="probe-stats">${["Probe availability", "Recorded checks", "p50 round trip", "p95 round trip"].map((label) => `<div>${label}<strong>Private</strong></div>`).join("")}</div><div class="redacted-history check-history"><span>Check timeline withheld</span><small>Per-check outcomes, timestamps and latency remain private</small></div><p class="strip-note">Aggregates use the full recorded window rather than plotted points.</p></section>`;
$("#events").innerHTML = grid(
  ["Observed at", "Entity", "Severity", "Transition"],
  "Transition history and runtime identities are private.",
);
const sources = [
  [
    "Host resources",
    "/proc/stat, /proc/meminfo, pressure, disk and network counters",
  ],
  ["Runtime state", "systemd state; legacy tmux reconciliation"],
  ["Runtime resources", "systemd CPU/memory accounting; process-tree fallback"],
  ["HTTP service health", "Recorded local checks, including failed checks"],
  ["Task outcomes", "Requires a separate task-outcome event source"],
  ["Queue latency", "Requires admission and execution timestamps"],
  ["GPU telemetry", "Requires a separate device telemetry source"],
];
$("#signal-table").innerHTML =
  `<table><thead><tr><th>Signal</th><th>Deployment coverage</th><th>Source contract</th></tr></thead><tbody>${sources.map(([label, source]) => `<tr><td>${label}</td><td>${withheld}</td><td>${source}</td></tr>`).join("")}</tbody></table>`;
const definitions = [
  [
    "cpu_pct",
    "Busy CPU time divided by elapsed host CPU time; the first delta is unavailable.",
  ],
  [
    "cpu_cores",
    "Consumed CPU seconds per wall second; counter resets do not create measurements.",
  ],
  [
    "memory_bytes",
    "Runtime memory accounting, with an explicit process-tree RSS fallback.",
  ],
  [
    "probe_availability",
    "Passing recorded checks divided by all recorded checks; missing samples are not successes.",
  ],
  [
    "probe_p95_ms",
    "Percentile of recorded local HTTP check round trips; separate from task latency.",
  ],
  [
    "sampling_coverage",
    "Recorded observations, expected intervals, gaps and freshness for the selected window.",
  ],
];
$("#definitions").innerHTML = definitions
  .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
  .join("");
function selectView() {
  const requested = location.hash.slice(1);
  const view = views.includes(requested) ? requested : "overview";
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.id !== view;
  });
  document.querySelectorAll("[data-view]").forEach((link) => {
    if (link.dataset.view === view) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.title = `${$("#" + view + " h1").textContent} — Redacted interface`;
}
window.addEventListener("hashchange", selectView);
selectView();

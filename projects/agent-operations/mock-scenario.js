/* Fixed synthetic scenario for the public interface. No server data or network input. */
"use strict";
(() => {
  const END = Date.parse("2026-01-15T12:00:00Z") / 1000;
  const GiB = 1024 ** 3,
    interval = 10,
    total = 8640;
  const round = (n, digits = 3) => Number(n.toFixed(digits));
  const percent = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b),
      position = (sorted.length - 1) * p;
    return sorted.length
      ? round(
          sorted[Math.floor(position)] +
            (sorted[Math.ceil(position)] - sorted[Math.floor(position)]) *
              (position % 1),
        )
      : null;
  };
  function sample(index) {
    if (index >= total - 40 && index < total - 36) return null; // Deliberate collection gap.
    const ts = END - (total - 1 - index) * interval;
    const spike = Math.max(0, 1 - Math.abs(index - (total - 48)) / 14);
    const cpu = round(42 + 11 * Math.sin(index * 0.19) + 18 * spike);
    const entity = (id, name, kind, state, cpu, memory, extra = {}) => ({
      id,
      name,
      kind,
      state,
      provider: "systemd",
      substate:
        state === "active" ? "running" : state === "failed" ? "failed" : "dead",
      cpu_cores: cpu,
      memory_bytes: memory === null ? null : Math.round(memory * GiB),
      cpu_limit: kind === "agent" ? 2 : null,
      memory_limit: kind === "agent" ? 4 * GiB : null,
      processes: state === "active" ? 6 : 0,
      restarts: 0,
      exit_status: null,
      reason:
        state === "inactive"
          ? "not-started"
          : state === "active"
            ? "success"
            : "exit-code",
      ...extra,
    });
    const failed = index >= total - 42;
    const entities = [
      entity("mock-control", "mock-control", "service", "active", 0.18, 0.48),
      entity("mock-edge", "mock-edge", "service", "active", 0.06, 0.16),
      entity(
        "mock-worker-a",
        "mock-worker-a",
        "agent",
        "active",
        round(1.2 + 0.28 * Math.sin(index * 0.12)),
        2.8,
      ),
      entity(
        "mock-worker-b",
        "mock-worker-b",
        "agent",
        "active",
        round(0.9 + 0.25 * Math.sin(index * 0.14)),
        3.2,
      ),
      entity(
        "mock-worker-c",
        "mock-worker-c",
        "agent",
        failed ? "failed" : "active",
        failed ? null : 0.72,
        failed ? null : 2.1,
        {
          restarts: failed ? 2 : 0,
          exit_status: failed ? 1 : null,
          reason: failed ? "exit-code" : "success",
        },
      ),
      entity("mock-worker-d", "mock-worker-d", "agent", "inactive", null, null),
    ];
    const probes = [
      {
        id: "mock-control-probe",
        name: "Mock control API",
        ok: index !== total - 42,
        http_status: index === total - 42 ? 503 : 200,
        latency_ms: round(9 + 5 * (1 + Math.sin(index * 0.31)) + 30 * spike),
        error: index === total - 42 ? "Synthetic HTTP 503" : "",
      },
      {
        id: "mock-edge-probe",
        name: "Mock ingress",
        ok: true,
        http_status: 200,
        latency_ms: round(4 + 2 * (1 + Math.sin(index * 0.27))),
        error: "",
      },
    ];
    return {
      ts,
      host: {
        cpu_pct: cpu,
        cpu_count: 8,
        memory_used: Math.round(
          (12.6 + 0.55 * Math.sin(index * 0.04) + spike) * GiB,
        ),
        memory_total: 32 * GiB,
      },
      entities,
      probes,
      inventory_error: null,
    };
  }
  function snapshot(windowKey = "15m") {
    const seconds = { "15m": 900, "1h": 3600, "6h": 21600, "24h": 86400 }[
      windowKey
    ];
    if (!seconds) throw new Error("Unsupported mock observation window");
    const records = Array.from({ length: seconds / interval }, (_, i) =>
      sample(total - seconds / interval + i),
    ).filter(Boolean);
    const stride = Math.max(1, Math.ceil(records.length / 720));
    const timeline = records.filter(
      (_, i) => i % stride === 0 || i === records.length - 1,
    );
    const probes = records[0].probes.map(({ id, name }) => {
      const checks = records.map((s) => s.probes.find((p) => p.id === id)),
        passed = checks.filter((c) => c.ok).length;
      return {
        id,
        name,
        samples: checks.length,
        passed,
        availability_pct: round((100 * passed) / checks.length),
        p50_ms: percent(
          checks.map((c) => c.latency_ms),
          0.5,
        ),
        p95_ms: percent(
          checks.map((c) => c.latency_ms),
          0.95,
        ),
        latest: checks.at(-1),
      };
    });
    const first = records[0].ts,
      last = records.at(-1).ts,
      expected = (last - first) / interval + 1;
    return {
      version: "mock-1",
      generated_at: END,
      window: windowKey,
      interval_seconds: interval,
      delivery: { mode: "mock" },
      mock: {
        is_mock: true,
        notice: "Mock data · illustrative only",
        source: "Fixed synthetic scenario; not production measurements",
      },
      coverage: {
        collector_started_at: END - 86400,
        first_sample_at: first,
        last_sample_at: last,
        sample_count: records.length,
        expected_samples_in_span: expected,
        missing_samples_in_span: expected - records.length,
        stale: false,
      },
      latest: records.at(-1),
      timeline,
      probes,
      events: [
        {
          ts: END - 410,
          entity: "mock-worker-c",
          severity: "warning",
          message: "Mock transition: active → failed (exit code 1)",
        },
        {
          ts: END - 400,
          entity: "mock-control-probe",
          severity: "warning",
          message: "Mock HTTP check: 503 → passing",
        },
        {
          ts: END - 360,
          entity: "mock-worker-c",
          severity: "info",
          message: "Mock restart budget reached; inspection required",
        },
      ].filter((e) => e.ts >= first),
      definitions: {
        cpu_pct:
          "Busy host CPU fraction across all vCPUs; displayed values are synthetic.",
        cpu_cores:
          "CPU seconds consumed per wall-clock second. Mock values use the same unit.",
        memory_bytes:
          "Runtime memory accounting; mock memory values are not a deployment measurement.",
        availability_pct:
          "Passing recorded local HTTP probes / all recorded probes; not agent task success.",
        latency_ms:
          "Local health-probe round-trip time, not inference latency.",
      },
      instrumentation: {
        host: "connected",
        runtime_state: "connected",
        http_health: "connected",
        task_outcomes: "not_instrumented",
        queue_latency: "not_instrumented",
        gpu: "not_connected",
      },
    };
  }
  globalThis.AgentOperationsMock = Object.freeze({
    snapshot,
    notice: "Mock data · illustrative only",
  });
})();

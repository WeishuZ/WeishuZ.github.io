# Agent Operations

A read-only observation layer for a running Agent Console deployment. The collector, persisted observations, API and interface are implemented here; no generated activity is substituted for missing instrumentation.

## Architecture

```text
Linux /proc + systemd + optional legacy tmux
                  │
                  ├── 10-second collector ── SQLite WAL (7-day retention)
                  │                              │
Local HTTP health probes ────────────────────────┘
                                                 │
                                    loopback HTTP API + private UI
                                                 │
                                           SSH forwarding
```

The existing Agent Console database is opened in SQLite read-only mode. Inventory reads only the ID, Unix account mapping and legacy session reference required to locate runtime state. Published API objects use stable aliases, discard the account/unit/session mapping, and do not contain passwords or messages.

The existing application and its database are not modified. All writes belong to the observer's own state directory. There are no runtime creation, command-execution, restart, termination or account-management endpoints.

## Interface

- **Overview:** host CPU/memory, connected service/runtime states, resource series and probe summaries.
- **Instances:** type/state filters, instance inspection, available resource accounting, configured limits, restart and exit signals.
- **Reliability:** all recorded probe denominators and percentiles, individual plotted check inspection and state transitions.
- **Signals:** metric provenance, collection boundaries and explicitly missing task/GPU instrumentation.

The interface source is in `projects/agent-operations/`. Static hosting alone does not create a working data source. The private server serves these files in live mode and queries its local observation API.

## Public portfolio preview

The public homepage and `preview.html` use a fixed synthetic scenario, clearly marked **Mock data · illustrative only**. The fixture in `mock-scenario.js` is generated locally and does not derive from private observations. The real interface renderer is shared, but its explicit mock adapter never falls back to the observation API. Mock exports include the same provenance marker.

Real metrics, identities and private screenshots stay private. The original static app entry remains access-gated, and the private observer remains loopback-only. Mock values illustrate interface behavior; they are not deployment scale, performance or availability claims.

## Collection semantics

- Host CPU is a delta of `/proc/stat`; the first observation is unavailable rather than zero.
- Runtime CPU is consumed CPU seconds per elapsed wall-clock second, in logical CPU equivalents. Counters that reset or are not available are not treated as measurements.
- Memory uses systemd accounting when available. The process-tree RSS fallback can count shared pages more than once and is documented in the API.
- systemd unlimited/sentinel values remain unavailable; CPU quota duration units are normalized.
- An active legacy tmux runtime is detected even when its systemd unit is inactive. A never-started unit is not reported as a successful completed task.
- Probe availability is passing **recorded local health checks** divided by all recorded checks. Probe p50/p95 measures local health round trips. Neither is user request latency or agent task success.
- Sampling coverage, missing intervals and freshness are retained. Missing intervals are not counted as successful health checks. Chart paths break across gaps.
- Chart series are bounded to about 720 points. Counts and percentiles are computed from all recorded checks in the selected window, in a consistent SQLite read transaction.
- Task outcomes, queue waiting time and GPU signals are explicitly not instrumented in this deployment.

## Private deployment

Requires Linux with systemd and Python 3.10+. The provided unit uses a dedicated state directory, a loopback-only listener, a CPU/memory budget and read-only filesystem hardening. Review the configured paths against the target machine before installation.

```sh
python3 server.py --web-root /path/to/projects/agent-operations
```

On the operator's computer:

```sh
ssh -N -L 127.0.0.1:8788:127.0.0.1:8788 your-vps
```

Then open `http://127.0.0.1:8788/`. No public proxy or CORS access is configured. Root privileges are used to read the existing private inventory and runtime accounting; this service is not an untrusted-code sandbox and must not be presented as providing sandbox isolation.

API routes:

- `GET /healthz`
- `GET /api/v1/observations?window=15m` (`1h`, `6h`, `24h` also supported)

Unknown static paths and unsupported windows are rejected. Other HTTP methods are not implemented. Public telemetry publication is deliberately not implemented; it requires a separate, explicit data disclosure decision.

## Validation

```sh
python3 -m unittest -v test_observer
```

Tests cover unknown counters, quota units, sampled denominators/percentiles, empty/stale windows, full aggregates after chart downsampling, read-only inventory, and legacy-runtime state reconciliation. Browser checks cover instance/probe inspection, filters, export, time windows, unavailable/stale data and desktop/mobile layouts.

## Product references

The information model takes cues from [Modal resource sizing](https://modal.com/docs/guide/sandbox-resources), [Modal observability](https://modal.com/docs/guide/developing-debugging), [CoreWeave cluster resources](https://docs.coreweave.com/docs/observability/managed-grafana/cks/cluster-resource) and [CoreWeave revision health](https://docs.coreweave.com/observability/managed-grafana/knative/revision-overview). Those products are references, not connected data providers or claims of equivalent infrastructure.

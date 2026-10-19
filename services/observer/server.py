#!/usr/bin/env python3
"""Read-only host/agent observations. No task execution or lifecycle mutations."""
import argparse
import concurrent.futures
import json
import math
import os
import re
from pathlib import Path
import shutil
import sqlite3
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, urlparse
from urllib.request import urlopen

VERSION = "0.1.0"
INTERVAL = 10
PROBES = {
    "console-api": ("Agent Console API", "http://127.0.0.1:8787/api/me", {200, 401, 403}),
    "preview-edge": ("Preview edge", "http://127.0.0.1/preview/", {200}),
}
WINDOWS = {"15m": 900, "1h": 3600, "6h": 21600, "24h": 86400}


def command(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=3)
    return result.returncode, result.stdout.strip()


def number(value):
    try:
        result = float(value)
        return result if math.isfinite(result) and result < 2**64 - 1 else None
    except (TypeError, ValueError):
        return None


def properties(unit):
    fields = ["LoadState", "ActiveState", "SubState", "MainPID", "ControlGroup", "CPUUsageNSec", "MemoryCurrent", "MemoryMax", "CPUQuotaPerSecUSec", "TasksCurrent", "NRestarts", "Result", "ExecMainStatus", "ExecMainStartTimestampMonotonic"]
    _, text = command(["systemctl", "show", unit, "--no-pager"] + ["--property=" + field for field in fields])
    return dict(line.split("=", 1) for line in text.splitlines() if "=" in line)


def quota_cores(value):
    if value in (None, "infinity", "max", ""):
        return None
    match = re.fullmatch(r"([0-9.]+)(us|ms|s|min)?", str(value))
    if not match:
        return None
    amount = number(match.group(1))
    return amount * {None: 1e-6, "us": 1e-6, "ms": .001, "s": 1, "min": 60}[match.group(2)] if amount is not None else None


def process_tree(root_pid):
    """Sum process CPU time and RSS without reading argv, environments or content."""
    processes = {}
    for path in Path("/proc").glob("[0-9]*/stat"):
        try:
            pid = int(path.parent.name)
            fields = path.read_text().rsplit(")", 1)[1].split()
            processes[pid] = (int(fields[1]), int(fields[11]) + int(fields[12]), int(fields[21]))
        except (OSError, ValueError, IndexError):
            continue
    pending, found = [root_pid], set()
    while pending:
        pid = pending.pop()
        if pid in found or pid not in processes:
            continue
        found.add(pid)
        pending.extend(child for child, values in processes.items() if values[0] == pid)
    ticks = sum(processes[pid][1] for pid in found)
    rss = sum(processes[pid][2] for pid in found) * os.sysconf("SC_PAGE_SIZE")
    return ticks / os.sysconf("SC_CLK_TCK"), rss, len(found)


def cpu_counters():
    values = [int(x) for x in Path("/proc/stat").read_text().splitlines()[0].split()[1:9]]
    return sum(values), values[3] + values[4]


def cpu_percent(previous, current):
    if previous is None:
        return None
    total = current[0] - previous[0]
    idle = current[1] - previous[1]
    return round(max(0, min(100, 100 * (total - idle) / total)), 3) if total > 0 else None


def host_sample(previous):
    counters = cpu_counters()
    memory = {line.split(":", 1)[0]: int(line.split()[1]) * 1024 for line in Path("/proc/meminfo").read_text().splitlines()}
    pressure = {}
    if Path("/proc/pressure/cpu").exists():
        pressure = dict(part.split("=", 1) for part in Path("/proc/pressure/cpu").read_text().splitlines()[0].split()[1:])
    disk = shutil.disk_usage("/")
    rx = tx = 0
    for interface in Path("/sys/class/net").iterdir():
        if interface.name != "lo":
            try:
                rx += int((interface / "statistics/rx_bytes").read_text())
                tx += int((interface / "statistics/tx_bytes").read_text())
            except OSError:
                pass
    return {
        "cpu_pct": cpu_percent(previous, counters), "cpu_count": os.cpu_count(),
        "memory_used": memory["MemTotal"] - memory["MemAvailable"], "memory_total": memory["MemTotal"],
        "load1": os.getloadavg()[0], "cpu_pressure_pct": number(pressure.get("avg10")),
        "disk_used": disk.used, "disk_total": disk.total, "rx_bytes": rx, "tx_bytes": tx,
    }, counters


def entity_sample(entity, previous, elapsed):
    data = dict(entity)
    props = properties(entity["unit"])
    data.update({"state": props.get("ActiveState", "unknown"), "substate": props.get("SubState", "unknown"),
                 "cpu_cores": None, "memory_bytes": None, "memory_limit": number(props.get("MemoryMax")),
                 "cpu_limit": quota_cores(props.get("CPUQuotaPerSecUSec")), "restarts": number(props.get("NRestarts")),
                 "processes": None, "exit_status": number(props.get("ExecMainStatus")), "reason": props.get("Result")})
    pid = int(props.get("MainPID", "0") or "0")
    if number(props.get("ExecMainStartTimestampMonotonic")) == 0:
        data.update(exit_status=None, reason="not-started")
    cumulative = None
    if props.get("LoadState") == "not-found" or props.get("ActiveState") != "active":
        legacy = entity.get("legacy")
        if legacy and shutil.which("tmux"):
            code, result = command(["tmux", "display-message", "-p", "-t", legacy, "#{pane_pid}"])
            if code == 0 and result.isdigit():
                pid = int(result)
                data.update(provider="tmux", state="active", substate="legacy-running", memory_limit=None, cpu_limit=None, restarts=None, exit_status=None, reason="legacy session active")
    if pid:
        cumulative, rss, processes = process_tree(pid)
        data.update(memory_bytes=rss, processes=processes)
    memory_current = number(props.get("MemoryCurrent")) if data["provider"] == "systemd" else None
    if memory_current is not None:
        data["memory_bytes"] = memory_current
    cgroup_cpu = number(props.get("CPUUsageNSec")) if data["provider"] == "systemd" else None
    if cgroup_cpu is not None:
        cumulative = cgroup_cpu / 1e9
    old = previous.get(entity["id"])
    if cumulative is not None and old is not None and elapsed > 0 and cumulative >= old:
        data["cpu_cores"] = round((cumulative - old) / elapsed, 5)
    data.pop("unit", None)
    data.pop("legacy", None)
    return data, cumulative


def discover(database):
    entities = [
        {"id": "console", "name": "Agent Console", "kind": "service", "provider": "systemd", "unit": "agent-console.service"},
        {"id": "edge", "name": "Web edge", "kind": "service", "provider": "systemd", "unit": "caddy.service"},
    ]
    error = None
    if database.exists():
        try:
            with sqlite3.connect(database.as_uri() + "?mode=ro", uri=True, timeout=1) as con:
                for row_id, unix_user, legacy in con.execute("SELECT id, unix_user, legacy_session FROM users ORDER BY id LIMIT 100"):
                    if not isinstance(unix_user, str) or not all(c.isalnum() or c in "_-" for c in unix_user):
                        continue
                    entities.append({"id": f"agent-{row_id:03d}", "name": f"Agent runtime {row_id:02d}", "kind": "agent", "provider": "systemd", "unit": f"agent-session@{unix_user}.service", "legacy": legacy})
        except (sqlite3.Error, ValueError):
            error = "Agent inventory unavailable"
    else:
        error = "Agent inventory database not found"
    return entities, error


def probe(item):
    key, (name, url, expected) = item
    start, status, error = time.perf_counter(), None, None
    try:
        with urlopen(url, timeout=2) as response:
            status = response.status
    except HTTPError as exc:
        status = exc.code
        exc.close()
    except (URLError, TimeoutError, OSError) as exc:
        error = type(exc).__name__
    return {"id": key, "name": name, "ok": status in expected, "http_status": status,
            "latency_ms": round((time.perf_counter() - start) * 1000, 3), "error": error}


def percentile(values, fraction):
    values = sorted(v for v in values if v is not None)
    if not values:
        return None
    position = (len(values) - 1) * fraction
    lo, hi = math.floor(position), math.ceil(position)
    return round(values[lo] + (values[hi] - values[lo]) * (position - lo), 3)


class Store:
    def __init__(self, path):
        self.path = path
        with self.connect() as con:
            con.execute("PRAGMA journal_mode=WAL")
            con.executescript("""
                CREATE TABLE IF NOT EXISTS snapshots(ts INTEGER PRIMARY KEY, host TEXT, entities TEXT, probes TEXT, inventory_error TEXT);
                CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts INTEGER, entity TEXT, severity TEXT, message TEXT);
                CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
            """)

    def connect(self):
        con = sqlite3.connect(self.path, timeout=5)
        con.row_factory = sqlite3.Row
        return con

    def write(self, snapshot):
        with self.connect() as con:
            previous_row = con.execute("SELECT entities, probes FROM snapshots ORDER BY ts DESC LIMIT 1").fetchone()
            previous = {x["id"]: x["state"] for x in json.loads(previous_row["entities"])} if previous_row else {}
            for entity in snapshot["entities"]:
                old = previous.get(entity["id"])
                if old != entity["state"]:
                    message = f"{entity['name']}: {old or 'first observation'} → {entity['state']} / {entity['substate']}"
                    severity = "warning" if entity["state"] == "failed" else "info"
                    con.execute("INSERT INTO events(ts,entity,severity,message) VALUES(?,?,?,?)", (snapshot["ts"], entity["id"], severity, message))
            previous_probes = {x["id"]: x["ok"] for x in json.loads(previous_row["probes"])} if previous_row else {}
            for observation in snapshot["probes"]:
                if previous_probes.get(observation["id"]) != observation["ok"]:
                    message = f"{observation['name']}: {'reachable' if observation['ok'] else 'probe failed'}"
                    con.execute("INSERT INTO events(ts,entity,severity,message) VALUES(?,?,?,?)", (snapshot["ts"], observation["id"], "info" if observation["ok"] else "warning", message))
            con.execute("INSERT OR REPLACE INTO snapshots VALUES(?,?,?,?,?)", (snapshot["ts"], json.dumps(snapshot["host"]), json.dumps(snapshot["entities"]), json.dumps(snapshot["probes"]), snapshot["inventory_error"]))
            con.execute("DELETE FROM snapshots WHERE ts < ?", (snapshot["ts"] - 7 * 86400,))
            con.execute("DELETE FROM events WHERE ts < ?", (snapshot["ts"] - 7 * 86400,))

    def read(self, window):
        now = int(time.time())
        with self.connect() as con:
            con.execute("BEGIN")
            count = con.execute("SELECT COUNT(*) FROM snapshots WHERE ts >= ?", (now - WINDOWS[window],)).fetchone()[0]
            rows = con.execute("SELECT * FROM snapshots WHERE ts >= ? ORDER BY ts", (now - WINDOWS[window],))
            first = con.execute("SELECT MIN(ts) FROM snapshots").fetchone()[0]
            events = [dict(row) for row in con.execute("SELECT * FROM events WHERE ts >= ? ORDER BY id DESC LIMIT 50", (now - WINDOWS[window],))]
            timeline, first_sample = [], None
            samples_by_probe = {key: [] for key in PROBES}
            stride = max(1, math.ceil(count / 720))
            for index, row in enumerate(rows):
                if first_sample is None:
                    first_sample = row["ts"]
                observations = json.loads(row["probes"])
                for observation in observations:
                    if observation["id"] in samples_by_probe:
                        samples_by_probe[observation["id"]].append(observation)
                if index % stride == 0 or index == count - 1:
                    timeline.append({"ts": row["ts"], "host": json.loads(row["host"]), "entities": json.loads(row["entities"]), "probes": observations, "inventory_error": row["inventory_error"]})
        probes = []
        for key, (name, _, _) in PROBES.items():
            samples = samples_by_probe[key]
            passing = sum(item["ok"] for item in samples)
            probes.append({"id": key, "name": name, "samples": len(samples), "passed": passing,
                           "availability_pct": round(100 * passing / len(samples), 3) if samples else None,
                           "p50_ms": percentile([x["latency_ms"] for x in samples], .5), "p95_ms": percentile([x["latency_ms"] for x in samples], .95),
                           "latest": samples[-1] if samples else None})
        latest = timeline[-1] if timeline else None
        expected = (latest["ts"] - first_sample) // INTERVAL + 1 if latest else 0
        return {"version": VERSION, "generated_at": now, "window": window, "interval_seconds": INTERVAL,
                "delivery": {"mode": "live", "publish_interval_seconds": INTERVAL},
                "coverage": {"collector_started_at": first, "first_sample_at": first_sample, "last_sample_at": latest["ts"] if latest else None, "sample_count": count, "expected_samples_in_span": expected, "missing_samples_in_span": max(0, expected - count), "stale": not latest or now - latest["ts"] > INTERVAL * 3},
                "latest": latest, "timeline": timeline, "probes": probes, "events": events,
                "definitions": {"cpu_pct": "Busy host CPU fraction across all vCPUs, sampled from /proc/stat.",
                    "cpu_cores": "CPU seconds consumed per wall-clock second; null until two valid observations.",
                    "memory_bytes": "systemd MemoryCurrent when available; otherwise sum of process-tree RSS (shared pages may be counted more than once).",
                    "availability_pct": "Passing local HTTP health probes divided by all recorded probes, not user request or agent task success.",
                    "latency_ms": "Local health-probe round-trip time, not inference or user request latency."},
                "instrumentation": {"host": "connected", "runtime_state": "connected", "http_health": "connected", "task_outcomes": "not_instrumented", "queue_latency": "not_instrumented", "gpu": "not_connected"}}


def collect(store, database, stop):
    previous_host, previous_entities, previous_time = None, {}, None
    pool = concurrent.futures.ThreadPoolExecutor(max_workers=4)
    while not stop.is_set():
        began = time.monotonic()
        try:
            host, previous_host = host_sample(previous_host)
            entities, error = discover(database)
            elapsed = began - previous_time if previous_time is not None else 0
            observed, counters = [], {}
            for entity in entities:
                data, cumulative = entity_sample(entity, previous_entities, elapsed)
                observed.append(data)
                counters[entity["id"]] = cumulative
            probes = list(pool.map(probe, PROBES.items()))
            store.write({"ts": int(time.time()), "host": host, "entities": observed, "probes": probes, "inventory_error": error})
            previous_entities, previous_time = counters, began
        except Exception as exc:
            print(f"collector_error={type(exc).__name__}", flush=True)
        stop.wait(max(1, INTERVAL - (time.monotonic() - began)))
    pool.shutdown(wait=False)


def handler(store, web_root=None):
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_):
            pass

        def do_GET(self):
            parsed = urlparse(self.path)
            if parsed.path not in ("/healthz", "/api/v1/observations"):
                if web_root:
                    name = "index.html" if parsed.path in ("/", "/index.html") else parsed.path.lstrip("/")
                    target = (web_root / name).resolve()
                    if target.is_relative_to(web_root.resolve()) and target.is_file() and target.suffix in (".html", ".css", ".js", ".woff2"):
                        body = target.read_bytes()
                        if target.suffix == ".html":
                            body = body.replace(b'data-mode="private"', b'data-mode="live"')
                        self.send_response(200)
                        self.send_header("Content-Type", {".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".woff2": "font/woff2"}[target.suffix])
                        self.send_header("Content-Length", str(len(body)))
                        self.send_header("X-Content-Type-Options", "nosniff")
                        self.end_headers()
                        self.wfile.write(body)
                        return
                self.send_error(404)
                return
            params = parse_qs(parsed.query)
            window = params.get("window", ["1h"])[0]
            if window not in WINDOWS:
                self.send_error(400, "Unsupported time window")
                return
            payload = store.read(window)
            if parsed.path == "/healthz":
                payload = {"version": VERSION, "fresh": not payload["coverage"]["stale"], "last_sample_at": payload["coverage"]["last_sample_at"]}
            body = json.dumps(payload, allow_nan=False).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(body)
    return Handler


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--state-dir", type=Path, default=Path("/var/lib/weishu-observer"))
    parser.add_argument("--agent-db", type=Path, default=Path("/var/lib/agent-console/console.db"))
    parser.add_argument("--port", type=int, default=8788)
    parser.add_argument("--web-root", type=Path)
    args = parser.parse_args()
    args.state_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    store = Store(args.state_dir / "observations.db")
    stop = threading.Event()
    threading.Thread(target=collect, args=(store, args.agent_db, stop), daemon=True).start()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), handler(store, args.web_root))
    try:
        server.serve_forever()
    finally:
        stop.set()
        server.server_close()


if __name__ == "__main__":
    main()

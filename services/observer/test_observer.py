import json
from pathlib import Path
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch

import server


class MetricIntegrityTests(unittest.TestCase):
    def test_unknown_accounting_is_not_a_real_measurement(self):
        for value in ("infinity", "[not set]", "nan", "18446744073709551615", None):
            self.assertIsNone(server.number(value))
        self.assertIsNone(server.cpu_percent(None, (1000, 200)))
        self.assertIsNone(server.cpu_percent((1000, 200), (1000, 200)))
        self.assertAlmostEqual(server.cpu_percent((1000, 200), (1100, 240)), 60)

    def test_systemd_quota_units_are_normalized(self):
        self.assertEqual(server.quota_cores("200ms"), .2)
        self.assertEqual(server.quota_cores("2s"), 2)
        self.assertEqual(server.quota_cores("500000"), .5)
        self.assertIsNone(server.quota_cores("infinity"))

    def test_active_legacy_session_is_not_hidden_by_an_inactive_unit(self):
        entity = {"id": "agent-001", "name": "Agent runtime 01", "kind": "agent", "provider": "systemd", "unit": "agent-session@test.service", "legacy": "legacy-fixture"}
        with patch.object(server, "properties", return_value={"LoadState": "loaded", "ActiveState": "inactive", "MainPID": "0", "MemoryCurrent": "0", "CPUUsageNSec": "0"}), patch.object(server.shutil, "which", return_value="/usr/bin/tmux"), patch.object(server, "command", return_value=(0, "123")), patch.object(server, "process_tree", return_value=(10, 4096, 2)):
            observed, cumulative = server.entity_sample(entity, {"agent-001": 8}, 10)
        self.assertEqual(observed["provider"], "tmux")
        self.assertEqual(observed["state"], "active")
        self.assertEqual(observed["memory_bytes"], 4096)
        self.assertEqual(observed["cpu_cores"], .2)
        self.assertEqual(cumulative, 10)
        self.assertNotIn("legacy", observed)
        self.assertNotIn("unit", observed)

    def test_never_started_unit_does_not_claim_a_successful_exit(self):
        entity = {"id": "agent-001", "name": "Agent runtime 01", "kind": "agent", "provider": "systemd", "unit": "agent-session@test.service"}
        properties = {"LoadState": "loaded", "ActiveState": "inactive", "MainPID": "0", "ExecMainStartTimestampMonotonic": "0", "ExecMainStatus": "0", "Result": "success"}
        with patch.object(server, "properties", return_value=properties):
            observed, _ = server.entity_sample(entity, {}, 10)
        self.assertIsNone(observed["exit_status"])
        self.assertEqual(observed["reason"], "not-started")

    def test_probe_success_has_a_real_denominator_and_coverage(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = server.Store(Path(temporary) / "observations.db")
            now = int(time.time())
            for index, okay in enumerate([True, False, True]):
                store.write({"ts": now - 20 + index * 10, "host": {}, "entities": [],
                             "probes": [{"id": "console-api", "name": "Agent Console API", "ok": okay, "latency_ms": [10, 30, 20][index], "http_status": 200 if okay else 500}], "inventory_error": None})
            payload = store.read("15m")
            probe = payload["probes"][0]
            self.assertEqual((probe["samples"], probe["passed"]), (3, 2))
            self.assertEqual(probe["availability_pct"], 66.667)
            self.assertEqual(probe["p50_ms"], 20)
            self.assertEqual(probe["p95_ms"], 29)
            self.assertEqual(payload["coverage"]["sample_count"], 3)
            self.assertFalse(payload["coverage"]["stale"])
            self.assertEqual(payload["instrumentation"]["task_outcomes"], "not_instrumented")
            self.assertIsNone(payload["probes"][1]["availability_pct"])
            self.assertEqual(len(payload["events"]), 3)

    def test_empty_and_stale_windows_do_not_claim_availability(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = server.Store(Path(temporary) / "observations.db")
            empty = store.read("15m")
            self.assertTrue(empty["coverage"]["stale"])
            self.assertIsNone(empty["probes"][0]["availability_pct"])
            store.write({"ts": int(time.time()) - 100, "host": {}, "entities": [], "probes": [], "inventory_error": None})
            self.assertTrue(store.read("15m")["coverage"]["stale"])

    def test_downsampled_chart_does_not_change_probe_denominator(self):
        with tempfile.TemporaryDirectory() as temporary:
            store = server.Store(Path(temporary) / "observations.db")
            now = int(time.time())
            rows = [(now - 1000 + i, "{}", "[]", json.dumps([{"id": "console-api", "name": "Agent Console API", "ok": i % 10 != 0, "latency_ms": i % 7, "http_status": 200 if i % 10 else 500}]), None) for i in range(1000)]
            with store.connect() as con:
                con.executemany("INSERT INTO snapshots VALUES(?,?,?,?,?)", rows)
            payload = store.read("1h")
            self.assertLessEqual(len(payload["timeline"]), 721)
            self.assertEqual(payload["coverage"]["sample_count"], 1000)
            self.assertEqual(payload["probes"][0]["samples"], 1000)
            self.assertEqual(payload["probes"][0]["passed"], 900)
            self.assertEqual(payload["probes"][0]["availability_pct"], 90)

    def test_inventory_is_read_only_and_does_not_fetch_passwords(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "console.db"
            with sqlite3.connect(path) as con:
                con.execute("CREATE TABLE users(id INTEGER, unix_user TEXT, legacy_session TEXT, password_hash TEXT)")
                con.execute("INSERT INTO users VALUES(1,'private_account',NULL,'secret-fixture-do-not-collect')")
            before = path.read_bytes()
            entities, error = server.discover(path)
            self.assertIsNone(error)
            self.assertEqual(entities[-1]["name"], "Agent runtime 01")
            self.assertNotIn("secret-fixture", json.dumps(entities))
            self.assertEqual(before, path.read_bytes())


if __name__ == "__main__":
    unittest.main()

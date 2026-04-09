import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimeSmokeLiveopsCheck } from "../src/analytics/runtime-smoke-liveops-check.mjs";

test("runtime smoke liveops check passes when required fields are present", () => {
  const check = buildRuntimeSmokeLiveopsCheck({
    generated_at: "2026-04-09T00:00:00.000Z",
    passed: true,
    report_path: "/tmp/runtime-smoke-report.json",
    persistent_data_path: "/tmp",
    missions: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    telemetry: [{ event_name: "session_start" }],
    liveops: {
      applied: true,
      file_found: true,
      iso_day_index: 4,
      selected_day_label: "day_4",
      active_event_ids: []
    }
  }, {
    maxAgeDays: 14,
    nowTimestamp: Date.parse("2026-04-09T12:00:00.000Z")
  });

  assert.equal(check.passed, true);
  assert.equal(check.summary.failed_checks, 0);
  assert.equal(check.extracted.selected_day_label, "day_4");
});

test("runtime smoke liveops check fails when liveops is missing", () => {
  const check = buildRuntimeSmokeLiveopsCheck({
    passed: true,
    telemetry: [{ event_name: "session_start" }],
    missions: [{ id: "m1" }]
  });

  assert.equal(check.passed, false);
  assert.ok(check.checks.some((item) => item.name === "liveops_present" && !item.ok));
  assert.ok(check.checks.some((item) => item.name === "mission_count_is_3" && !item.ok));
});

test("runtime smoke liveops check fails stale report when max age is set", () => {
  const check = buildRuntimeSmokeLiveopsCheck(
    {
      generated_at: "2026-03-01T00:00:00.000Z",
      passed: true,
      telemetry: [{ event_name: "session_start" }],
      missions: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
      liveops: {
        applied: true,
        file_found: true,
        selected_day_label: "day_1",
        active_event_ids: []
      }
    },
    {
      maxAgeDays: 7,
      nowTimestamp: Date.parse("2026-04-09T00:00:00.000Z")
    }
  );

  assert.equal(check.passed, false);
  assert.ok(check.checks.some((item) => item.name === "report_recency" && !item.ok));
});

test("runtime smoke liveops check does not enforce recency when max age is absent", () => {
  const check = buildRuntimeSmokeLiveopsCheck({
    generated_at: "2020-01-01T00:00:00.000Z",
    passed: true,
    telemetry: [{ event_name: "session_start" }],
    missions: [{ id: "m1" }, { id: "m2" }, { id: "m3" }],
    liveops: {
      applied: true,
      file_found: true,
      selected_day_label: "day_1",
      active_event_ids: []
    }
  });

  assert.equal(check.passed, true);
  assert.ok(check.checks.some((item) => item.name === "report_recency" && item.ok));
});

import test from "node:test";
import assert from "node:assert/strict";
import { convertRuntimeSmokeReport } from "../src/analytics/runtime-smoke-import.mjs";

test("runtime smoke import converts telemetry and payload json", () => {
  const converted = convertRuntimeSmokeReport({
    generated_at: "2026-04-08T00:00:00.000Z",
    passed: true,
    report_path: "/tmp/runtime-smoke-report.json",
    persistent_data_path: "/tmp",
    summary: {
      stage: 3
    },
    missions: [
      {
        id: "mission_1"
      }
    ],
    liveops: {
      applied: true,
      file_found: true,
      selected_day_label: "day_1",
      active_event_ids: []
    },
    telemetry: [
      {
        user_id: "u1",
        country: "KR",
        platform: "android",
        build_version: "0.1.0",
        session_id: "s1",
        event_time: "2026-04-08T00:00:01.000Z",
        event_name: "session_start",
        payload_json: "{\"stage\":1}"
      }
    ]
  });

  assert.equal(converted.passed, true);
  assert.equal(converted.summary.stage, 3);
  assert.equal(converted.liveops.applied, true);
  assert.equal(converted.liveops.selected_day_label, "day_1");
  assert.equal(converted.telemetry_records.length, 1);
  assert.equal(converted.telemetry_records[0].event_name, "session_start");
  assert.equal(converted.telemetry_records[0].payload.stage, 1);
});

test("runtime smoke import defaults missing fields safely", () => {
  const converted = convertRuntimeSmokeReport({
    telemetry: [{}]
  });

  assert.equal(converted.telemetry_records.length, 1);
  assert.equal(converted.telemetry_records[0].user_id, "unknown_user");
  assert.equal(converted.telemetry_records[0].event_name, "unknown_event");
  assert.deepEqual(converted.telemetry_records[0].payload, {});
});

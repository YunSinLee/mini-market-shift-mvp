import test from "node:test";
import assert from "node:assert/strict";
import { buildTelemetryReport } from "../src/analytics/telemetry-report.mjs";

function event(overrides = {}) {
  return {
    user_id: "u1",
    country: "KR",
    platform: "android",
    build_version: "0.1.0",
    session_id: "s1",
    event_time: "2026-04-08T00:00:00.000Z",
    event_name: "session_start",
    payload: {},
    ...overrides
  };
}

test("telemetry report computes participation and segmentation", () => {
  const records = [
    event({ session_id: "s1", country: "KR", platform: "android", event_name: "session_start" }),
    event({
      session_id: "s1",
      country: "KR",
      platform: "android",
      event_name: "ad_reward_granted"
    }),
    event({ session_id: "s1", country: "KR", platform: "android", event_name: "session_end" }),
    event({ session_id: "s2", country: "US", platform: "android", event_name: "session_start" }),
    event({ session_id: "s2", country: "US", platform: "android", event_name: "iap_purchase" }),
    event({ session_id: "s2", country: "US", platform: "android", event_name: "session_end" })
  ];

  const report = buildTelemetryReport(records);
  assert.equal(report.total_events, 6);
  assert.equal(report.total_sessions, 2);
  assert.equal(report.rewarded_ad_participation_rate, 0.5);
  assert.equal(report.payer_conversion_rate, 0.5);
  assert.equal(report.gates.event_missing_rate_lt_2_percent, true);
  assert.equal(report.segmentation.countries.KR.sessions, 1);
  assert.equal(report.segmentation.countries.US.sessions, 1);
});

test("telemetry report catches missing fields", () => {
  const records = [
    event({ event_name: "session_start" }),
    event({ event_name: "session_end", session_id: "" })
  ];

  const report = buildTelemetryReport(records);
  assert.equal(report.total_events, 2);
  assert.equal(report.missing_common_field_events, 1);
  assert.equal(report.gates.event_missing_rate_lt_2_percent, false);
});

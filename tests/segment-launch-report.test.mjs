import test from "node:test";
import assert from "node:assert/strict";
import { buildSegmentLaunchReport } from "../src/analytics/segment-launch-report.mjs";

function record({ user_id, country, platform, event_name, event_time }) {
  return {
    user_id,
    country,
    platform,
    build_version: "0.1.0",
    session_id: `${user_id}-${event_name}-${event_time}`,
    event_time,
    event_name,
    payload: {}
  };
}

test("segment launch report builds per-segment evaluation", () => {
  const records = [
    record({
      user_id: "kr_1",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "kr_1",
      country: "KR",
      platform: "android",
      event_name: "ad_reward_granted",
      event_time: "2026-04-01T10:00:01.000Z"
    }),
    record({
      user_id: "us_1",
      country: "US",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "us_1",
      country: "US",
      platform: "android",
      event_name: "iap_purchase",
      event_time: "2026-04-01T10:00:02.000Z"
    })
  ];

  const report = buildSegmentLaunchReport({
    records,
    targets: { cpi_target_max_usd: 2.5 },
    segments: [
      { country: "KR", platform: "android", ad_spend_usd: 700, installs: 350 },
      { country: "US", platform: "android", ad_spend_usd: 1400, installs: 650 }
    ]
  });

  assert.equal(report.summary.total_segments, 2);
  assert.equal(report.segments.length, 2);
  assert.ok(report.segments[0].snapshot);
  assert.ok(report.segments[0].gate_evaluation);
  assert.ok(report.segments[0].telemetry_report);
  assert.ok(report.segments[0].tuning_recommendation);
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildKpiSnapshot } from "../src/analytics/kpi-snapshot.mjs";

function record({
  user_id,
  country,
  platform,
  event_name,
  event_time
}) {
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

test("kpi snapshot computes retention monetization and cpi", () => {
  const records = [
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "B",
      country: "US",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "C",
      country: "KR",
      platform: "ios",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-02T10:00:00.000Z"
    }),
    record({
      user_id: "C",
      country: "KR",
      platform: "ios",
      event_name: "session_start",
      event_time: "2026-04-02T10:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-04T10:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-08T10:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "ad_reward_granted",
      event_time: "2026-04-02T10:00:01.000Z"
    }),
    record({
      user_id: "C",
      country: "KR",
      platform: "ios",
      event_name: "ad_reward_granted",
      event_time: "2026-04-02T11:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "ad_reward_granted",
      event_time: "2026-04-04T11:00:00.000Z"
    }),
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "iap_purchase",
      event_time: "2026-04-02T11:00:01.000Z"
    })
  ];

  const snapshot = buildKpiSnapshot(records, { ad_spend_usd: 9 });

  assert.equal(snapshot.installs, 3);
  assert.equal(snapshot.active_users, 3);
  assert.equal(snapshot.d1_retention, 0.6667);
  assert.equal(snapshot.d3_retention, 0.3333);
  assert.equal(snapshot.d7_retention, 0.3333);
  assert.equal(snapshot.rewarded_ad_participation, 0.4286);
  assert.equal(snapshot.payer_conversion, 0.3333);
  assert.equal(snapshot.cpi, 3);
  assert.equal(snapshot.installs_source, "telemetry_users");
  assert.equal(snapshot.telemetry_install_users, 3);
  assert.equal(snapshot.data_quality_flags.retention_window_lt_7_days, false);
  assert.ok(snapshot.segments_by_country_platform["KR|android"]);
});

test("kpi snapshot applies country and platform filters", () => {
  const records = [
    record({
      user_id: "A",
      country: "KR",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    }),
    record({
      user_id: "B",
      country: "US",
      platform: "android",
      event_name: "session_start",
      event_time: "2026-04-01T10:00:00.000Z"
    })
  ];

  const snapshot = buildKpiSnapshot(records, {
    country: "KR",
    platform: "android"
  });

  assert.equal(snapshot.installs, 1);
  assert.equal(snapshot.active_users, 1);
  assert.equal(snapshot.installs_source, "telemetry_users");
  assert.equal(Object.keys(snapshot.segments_by_country_platform).length, 1);
  assert.ok(snapshot.segments_by_country_platform["KR|android"]);
});

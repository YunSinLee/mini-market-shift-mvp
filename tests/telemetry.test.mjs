import test from "node:test";
import assert from "node:assert/strict";
import { TelemetryRecorder } from "../src/services/telemetry.mjs";

test("telemetry events include required common fields", () => {
  const telemetry = new TelemetryRecorder({
    user_id: "telemetry-user",
    country: "KR",
    platform: "android",
    build_version: "0.1.0"
  });

  telemetry.startSession("session-1");
  const record = telemetry.emit("ad_offer_shown", { reward_type: "double_income_30s" });

  assert.equal(record.user_id, "telemetry-user");
  assert.equal(record.country, "KR");
  assert.equal(record.platform, "android");
  assert.equal(record.build_version, "0.1.0");
  assert.equal(record.session_id, "session-1");
  assert.ok(typeof record.event_time === "string");
});

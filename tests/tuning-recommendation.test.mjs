import test from "node:test";
import assert from "node:assert/strict";
import { buildTuningRecommendation } from "../src/analytics/tuning-recommendation.mjs";

test("tuning recommendation includes actions on failed gates", () => {
  const snapshot = {
    installs: 1000,
    d1_retention: 0.2,
    d3_retention: 0.08,
    d7_retention: 0.04,
    rewarded_ad_participation: 0.15,
    payer_conversion: 0.005,
    cpi: 3.2,
    data_quality_flags: {
      retention_window_lt_7_days: false,
      installs_mismatch_gt_20_percent: true
    }
  };

  const gateEvaluation = {
    gate_1: {
      checks: [
        { name: "D1 retention", ok: false },
        { name: "D3 retention", ok: false },
        { name: "CPI", ok: false }
      ]
    },
    gate_2: {
      checks: [
        { name: "D7 retention", ok: false },
        { name: "Rewarded ad participation", ok: false },
        { name: "Payer conversion", ok: false }
      ]
    }
  };

  const telemetryReport = {
    missing_common_field_rate: 0.03
  };

  const recommendation = buildTuningRecommendation({
    snapshot,
    gateEvaluation,
    telemetryReport
  });

  assert.equal(recommendation.severity, "high");
  assert.ok(recommendation.actions.length >= 7);
  assert.ok(
    recommendation.actions.some((item) => item.area === "measurement"),
    "measurement action should be included for quality flags"
  );
});

test("tuning recommendation stays low when no failures", () => {
  const snapshot = {
    installs: 1500,
    d1_retention: 0.3,
    d3_retention: 0.15,
    d7_retention: 0.08,
    rewarded_ad_participation: 0.3,
    payer_conversion: 0.02,
    cpi: 1.9,
    data_quality_flags: {
      retention_window_lt_7_days: false,
      installs_mismatch_gt_20_percent: false
    }
  };

  const gateEvaluation = {
    gate_1: {
      checks: [
        { name: "D1 retention", ok: true },
        { name: "D3 retention", ok: true },
        { name: "CPI", ok: true }
      ]
    },
    gate_2: {
      checks: [
        { name: "D7 retention", ok: true },
        { name: "Rewarded ad participation", ok: true },
        { name: "Payer conversion", ok: true }
      ]
    }
  };

  const recommendation = buildTuningRecommendation({
    snapshot,
    gateEvaluation,
    telemetryReport: { missing_common_field_rate: 0 }
  });

  assert.equal(recommendation.severity, "low");
  assert.equal(recommendation.actions.length, 0);
});

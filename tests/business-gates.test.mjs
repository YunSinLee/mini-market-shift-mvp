import test from "node:test";
import assert from "node:assert/strict";
import { evaluateBusinessGates } from "../src/analytics/business-gates.mjs";

test("business gates pass with sufficient installs and metrics", () => {
  const result = evaluateBusinessGates(
    {
      installs: 1200,
      d1_retention: 0.27,
      d3_retention: 0.11,
      d7_retention: 0.065,
      rewarded_ad_participation: 0.29,
      payer_conversion: 0.012,
      cpi: 2.2
    },
    { cpi_target_max_usd: 2.5 }
  );

  assert.equal(result.gate_1.eligible, true);
  assert.equal(result.gate_1.passed, true);
  assert.equal(result.gate_2.eligible, true);
  assert.equal(result.gate_2.passed, true);
  assert.equal(result.recommended_action, "proceed_scale");
});

test("business gates require enough sample before pass", () => {
  const result = evaluateBusinessGates(
    {
      installs: 300,
      d1_retention: 0.4,
      d3_retention: 0.3,
      d7_retention: 0.2,
      rewarded_ad_participation: 0.5,
      payer_conversion: 0.1,
      cpi: 1.5
    },
    { cpi_target_max_usd: 2.5 }
  );

  assert.equal(result.gate_1.eligible, false);
  assert.equal(result.gate_1.passed, false);
  assert.equal(result.gate_2.eligible, false);
  assert.equal(result.gate_2.passed, false);
  assert.equal(
    result.recommended_action,
    "retune_onboarding_difficulty_ad_timing_then_retest"
  );
});

test("business gates accepts percentage values as 0-100 scale", () => {
  const result = evaluateBusinessGates(
    {
      installs: 1000,
      d1_retention: 26,
      d3_retention: 10,
      d7_retention: 6,
      rewarded_ad_participation: 25,
      payer_conversion: 1.1,
      cpi: 2.4
    },
    { cpi_target_max_usd: 2.5 }
  );

  assert.equal(result.gate_1.passed, true);
  assert.equal(result.gate_2.passed, true);
});

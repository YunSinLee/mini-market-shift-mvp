import test from "node:test";
import assert from "node:assert/strict";
import { buildSegmentOverridePlans } from "../src/analytics/segment-overrides.mjs";

test("segment overrides builds plans for each segment recommendation", () => {
  const result = buildSegmentOverridePlans({
    segmentReport: {
      segments: [
        {
          segment: { country: "KR", platform: "android" },
          tuning_recommendation: {
            actions: [{ priority: 1, area: "onboarding", trigger: "x" }]
          }
        },
        {
          segment: { country: "US", platform: "android" },
          tuning_recommendation: {
            actions: [{ priority: 1, area: "ad_monetization", trigger: "y" }]
          }
        }
      ]
    },
    remoteBase: {
      economy_multiplier: 1,
      ad_cooldown_sec: 90,
      rewarded_ad_multiplier: 2,
      iap_price_tier: "tier_1",
      difficulty_curve_id: "default_v1"
    },
    abBase: {
      ab_ad_frequency: "low",
      ab_offer_timing: "mid_session",
      ab_upgrade_cost_curve: "baseline"
    },
    maxActions: 2
  });

  assert.equal(result.generated_plans, 2);
  assert.equal(result.total_segments_in_report, 2);
  assert.equal(result.plans[0].segment_id, "KR-android");
  assert.ok(result.plans[0].plan.remote_override);
  assert.ok(result.plans[1].plan.ab_override);
});

test("segment overrides applies confidence guard per segment snapshot", () => {
  const result = buildSegmentOverridePlans({
    segmentReport: {
      segments: [
        {
          segment: { country: "KR", platform: "android" },
          snapshot: {
            retention_window_days: 0,
            source_event_count: 10,
            data_quality_flags: {
              installs_mismatch_gt_20_percent: true
            }
          },
          tuning_recommendation: {
            actions: [
              { priority: 1, area: "onboarding", trigger: "x" },
              { priority: 2, area: "measurement", trigger: "m1" }
            ]
          }
        }
      ]
    },
    remoteBase: {
      economy_multiplier: 1,
      ad_cooldown_sec: 90,
      rewarded_ad_multiplier: 2,
      iap_price_tier: "tier_1",
      difficulty_curve_id: "default_v1"
    },
    abBase: {
      ab_ad_frequency: "low",
      ab_offer_timing: "mid_session",
      ab_upgrade_cost_curve: "baseline"
    },
    maxActions: 2
  });

  assert.equal(result.generated_plans, 1);
  assert.equal(result.plans[0].plan.selection_mode, "measurement_only");
  assert.equal(result.plans[0].plan.applied_changes.length, 0);
});

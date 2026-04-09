import test from "node:test";
import assert from "node:assert/strict";
import { buildOverridePlan } from "../src/analytics/override-plan.mjs";

test("override plan applies top priority actions into remote and ab configs", () => {
  const plan = buildOverridePlan({
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
    recommendation: {
      actions: [
        { priority: 1, area: "onboarding", trigger: "x" },
        { priority: 2, area: "ad_monetization", trigger: "y" },
        { priority: 3, area: "iap_conversion", trigger: "z" }
      ]
    },
    maxActions: 2
  });

  assert.equal(plan.selected_actions.length, 2);
  assert.equal(plan.remote_override.difficulty_curve_id, "retention_soft_v1");
  assert.equal(plan.remote_override.ad_cooldown_sec, 60);
  assert.equal(plan.ab_override.ab_offer_timing, "mid_session");
});

test("override plan respects maxActions and tracks skipped collisions", () => {
  const plan = buildOverridePlan({
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
    recommendation: {
      actions: [
        { priority: 1, area: "onboarding", trigger: "x" },
        { priority: 2, area: "progression", trigger: "y" },
        { priority: 3, area: "long_retention", trigger: "z" }
      ]
    },
    maxActions: 3
  });

  assert.equal(plan.selected_actions.length, 3);
  assert.ok(plan.skipped_changes.length >= 1);
});

test("override plan switches to measurement-only mode on low-confidence data", () => {
  const plan = buildOverridePlan({
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
    recommendation: {
      actions: [
        { priority: 1, area: "onboarding", trigger: "x" },
        { priority: 2, area: "measurement", trigger: "m1" },
        { priority: 3, area: "measurement", trigger: "m2" }
      ]
    },
    maxActions: 2,
    context: {
      snapshot: {
        retention_window_days: 0,
        source_event_count: 1,
        data_quality_flags: {
          installs_mismatch_gt_20_percent: true
        }
      }
    }
  });

  assert.equal(plan.selection_mode, "measurement_only");
  assert.equal(plan.selected_actions.length, 2);
  assert.equal(plan.applied_changes.length, 0);
});

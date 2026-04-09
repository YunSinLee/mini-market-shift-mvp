function addAction(actions, action) {
  actions.push({
    priority: actions.length + 1,
    ...action
  });
}

function hasFailedCheck(checks, name) {
  return checks.some((check) => check.name === name && !check.ok);
}

export function buildTuningRecommendation({
  snapshot,
  gateEvaluation,
  telemetryReport = null
}) {
  const actions = [];
  const risks = [];

  const gate1Checks = gateEvaluation?.gate_1?.checks ?? [];
  const gate2Checks = gateEvaluation?.gate_2?.checks ?? [];

  const d1Fail = hasFailedCheck(gate1Checks, "D1 retention");
  const d3Fail = hasFailedCheck(gate1Checks, "D3 retention");
  const cpiFail = hasFailedCheck(gate1Checks, "CPI");

  const d7Fail = hasFailedCheck(gate2Checks, "D7 retention");
  const adParticipationFail = hasFailedCheck(
    gate2Checks,
    "Rewarded ad participation"
  );
  const payerConversionFail = hasFailedCheck(gate2Checks, "Payer conversion");

  if (d1Fail) {
    risks.push("D1 retention below launch gate");
    addAction(actions, {
      area: "onboarding",
      trigger: "D1 retention below 25%",
      changes: [
        "Compress first upgrade moment to <20 seconds.",
        "Guarantee one visible reward loop completion in first session.",
        "Lower early stage demand spikes by switching `difficulty_curve_id` variant."
      ],
      ab_flags: ["ab_upgrade_cost_curve", "ab_offer_timing"],
      remote_keys: ["difficulty_curve_id", "economy_multiplier"]
    });
  }

  if (d3Fail) {
    risks.push("D3 retention below launch gate");
    addAction(actions, {
      area: "progression",
      trigger: "D3 retention below 10%",
      changes: [
        "Delay complexity ramp between stage 6-12.",
        "Add short-term mission payout before session end.",
        "Trigger comeback bonus after inactivity."
      ],
      ab_flags: ["ab_upgrade_cost_curve"],
      remote_keys: ["difficulty_curve_id", "economy_multiplier"]
    });
  }

  if (d7Fail) {
    risks.push("D7 retention below launch gate");
    addAction(actions, {
      area: "long_retention",
      trigger: "D7 retention below 6%",
      changes: [
        "Introduce daily mission streak reward escalation.",
        "Unlock one additional station skin/reward at day-3 check-in.",
        "Rotate limited booster mission every 48h."
      ],
      ab_flags: [],
      remote_keys: ["economy_multiplier"]
    });
  }

  if (adParticipationFail) {
    risks.push("Rewarded ad participation below DAU 25%");
    addAction(actions, {
      area: "ad_monetization",
      trigger: "Rewarded ad participation below 25%",
      changes: [
        "Surface rewarded CTA right after first bottleneck.",
        "Test `ab_offer_timing` mid_session vs post_stage.",
        "Lower `ad_cooldown_sec` in KR and US separately."
      ],
      ab_flags: ["ab_offer_timing", "ab_ad_frequency"],
      remote_keys: ["ad_cooldown_sec", "rewarded_ad_multiplier"]
    });
  }

  if (payerConversionFail) {
    risks.push("Payer conversion below 1%");
    addAction(actions, {
      area: "iap_conversion",
      trigger: "Payer conversion below 1%",
      changes: [
        "Show starter bundle once after first meaningful upgrade purchase.",
        "A/B test starter bundle price tier and coin amount.",
        "Bundle ad-free with temporary 2x income booster."
      ],
      ab_flags: ["ab_offer_timing"],
      remote_keys: ["iap_price_tier", "rewarded_ad_multiplier"]
    });
  }

  if (cpiFail) {
    risks.push("CPI above target");
    addAction(actions, {
      area: "ua_efficiency",
      trigger: "CPI above target range",
      changes: [
        "Replace weak CTR creatives with top 2 hooks only.",
        "Split KR/US creative themes and store screenshots.",
        "Pause low-quality audience segments."
      ],
      ab_flags: [],
      remote_keys: []
    });
  }

  const qualityFlags = snapshot?.data_quality_flags ?? {};
  if (qualityFlags.retention_window_lt_7_days || snapshot?.d7_retention == null) {
    risks.push("Retention window too short for D7 confidence");
    addAction(actions, {
      area: "measurement",
      trigger: "D7 retention unavailable or provisional",
      changes: [
        "Hold D7 decision until cohort window reaches 7 full days.",
        "Tag report as provisional in weekly brief."
      ],
      ab_flags: [],
      remote_keys: []
    });
  }

  if (qualityFlags.installs_mismatch_gt_20_percent) {
    risks.push("Installs mismatch between UA and telemetry users");
    addAction(actions, {
      area: "measurement",
      trigger: "Installs mismatch >20%",
      changes: [
        "Reconcile MMP install source with telemetry user IDs.",
        "Audit missing `session_start` events on first-open path."
      ],
      ab_flags: [],
      remote_keys: []
    });
  }

  const missingRate = telemetryReport?.missing_common_field_rate;
  if (typeof missingRate === "number" && missingRate >= 0.02) {
    risks.push("Telemetry missing field rate above 2%");
    addAction(actions, {
      area: "telemetry",
      trigger: "Common field missing rate >= 2%",
      changes: [
        "Block release candidate until missing field rate returns under 2%.",
        "Enforce context init before first event emit."
      ],
      ab_flags: [],
      remote_keys: []
    });
  }

  const severity =
    actions.length >= 5 ? "high" : actions.length >= 3 ? "medium" : "low";

  return {
    generated_at: new Date().toISOString(),
    severity,
    risks,
    actions,
    snapshot_reference: {
      installs: snapshot?.installs ?? null,
      d1_retention: snapshot?.d1_retention ?? null,
      d3_retention: snapshot?.d3_retention ?? null,
      d7_retention: snapshot?.d7_retention ?? null,
      rewarded_ad_participation: snapshot?.rewarded_ad_participation ?? null,
      payer_conversion: snapshot?.payer_conversion ?? null,
      cpi: snapshot?.cpi ?? null
    }
  };
}

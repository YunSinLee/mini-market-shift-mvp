function toRate(value) {
  if (value == null || Number.isNaN(Number(value))) {
    return null;
  }

  const numeric = Number(value);
  if (numeric < 0) {
    return null;
  }

  if (numeric > 1) {
    return numeric / 100;
  }

  return numeric;
}

function toFixedNumber(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function check(name, ok, actual, threshold) {
  return { name, ok, actual, threshold };
}

export function evaluateBusinessGates(snapshot, options = {}) {
  const cpiTargetMax =
    options.cpi_target_max_usd ?? snapshot.cpi_target_max_usd ?? null;

  const installsParsed = Number(snapshot.installs ?? 0);
  const installs = Number.isFinite(installsParsed) ? installsParsed : 0;
  const d1 = toRate(snapshot.d1_retention);
  const d3 = toRate(snapshot.d3_retention);
  const d7 = toRate(snapshot.d7_retention);
  const rewardedAdParticipation = toRate(snapshot.rewarded_ad_participation);
  const payerConversion = toRate(snapshot.payer_conversion);
  const cpiParsed = snapshot.cpi == null ? null : Number(snapshot.cpi);
  const cpi = cpiParsed != null && Number.isFinite(cpiParsed) ? cpiParsed : null;

  const gate1Eligible = installs >= 400;
  const gate2Eligible = installs >= 1000;

  const gate1Checks = [
    check("D1 retention", d1 != null && d1 >= 0.25, d1, 0.25),
    check("D3 retention", d3 != null && d3 >= 0.1, d3, 0.1)
  ];

  if (cpiTargetMax != null) {
    gate1Checks.push(
      check("CPI", cpi != null && cpi <= cpiTargetMax, cpi, cpiTargetMax)
    );
  }

  const gate2Checks = [
    check("D7 retention", d7 != null && d7 >= 0.06, d7, 0.06),
    check(
      "Rewarded ad participation",
      rewardedAdParticipation != null && rewardedAdParticipation >= 0.25,
      rewardedAdParticipation,
      0.25
    ),
    check(
      "Payer conversion",
      payerConversion != null && payerConversion >= 0.01,
      payerConversion,
      0.01
    )
  ];

  const gate1Passed = gate1Eligible && gate1Checks.every((item) => item.ok);
  const gate2Passed = gate2Eligible && gate2Checks.every((item) => item.ok);

  const recommendedAction =
    gate1Passed && gate2Passed
      ? "proceed_scale"
      : "retune_onboarding_difficulty_ad_timing_then_retest";

  return {
    evaluated_at: new Date().toISOString(),
    snapshot: {
      installs,
      d1_retention: d1 != null ? toFixedNumber(d1) : null,
      d3_retention: d3 != null ? toFixedNumber(d3) : null,
      d7_retention: d7 != null ? toFixedNumber(d7) : null,
      rewarded_ad_participation:
        rewardedAdParticipation != null ? toFixedNumber(rewardedAdParticipation) : null,
      payer_conversion: payerConversion != null ? toFixedNumber(payerConversion) : null,
      cpi: cpi != null ? toFixedNumber(cpi) : null,
      cpi_target_max_usd: cpiTargetMax
    },
    gate_1: {
      eligible: gate1Eligible,
      passed: gate1Passed,
      min_installs_required: 400,
      checks: gate1Checks
    },
    gate_2: {
      eligible: gate2Eligible,
      passed: gate2Passed,
      min_installs_required: 1000,
      checks: gate2Checks
    },
    recommended_action: recommendedAction
  };
}

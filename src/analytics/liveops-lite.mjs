function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoWeekLabel(dateString) {
  const date = new Date(`${dateString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return "unknown-week";
  }

  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function utcDayStringNow() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function hasFailedCheck(gateEvaluation, checkName) {
  const checks = [
    ...(gateEvaluation?.gate_1?.checks ?? []),
    ...(gateEvaluation?.gate_2?.checks ?? [])
  ];
  return checks.some((check) => check?.name === checkName && check?.ok === false);
}

function inferPrimaryGoal(gateEvaluation) {
  if (
    hasFailedCheck(gateEvaluation, "D1 retention") ||
    hasFailedCheck(gateEvaluation, "D3 retention")
  ) {
    return {
      key: "retention_recovery",
      rationale: "Early retention checks failed."
    };
  }
  if (hasFailedCheck(gateEvaluation, "Rewarded ad participation")) {
    return {
      key: "ad_engagement_uplift",
      rationale: "Rewarded ad participation is below gate threshold."
    };
  }
  if (hasFailedCheck(gateEvaluation, "Payer conversion")) {
    return {
      key: "iap_conversion_uplift",
      rationale: "Payer conversion is below gate threshold."
    };
  }
  if (hasFailedCheck(gateEvaluation, "D7 retention")) {
    return {
      key: "long_retention_uplift",
      rationale: "Long retention check failed."
    };
  }
  if (hasFailedCheck(gateEvaluation, "CPI")) {
    return {
      key: "ua_efficiency_guard",
      rationale: "CPI is above target range."
    };
  }
  return {
    key: "scaling_stability",
    rationale: "No blocking gate failure detected."
  };
}

function normalizeDailyMissions(missions) {
  const normalized = Array.isArray(missions)
    ? missions
        .filter((mission) => mission && typeof mission === "object")
        .map((mission, index) => ({
          id: mission.id ?? `mission_${index + 1}`,
          name: mission.name ?? `Mission ${index + 1}`,
          type: mission.type ?? "serve_customers",
          goal: Math.max(1, Math.round(toNumber(mission.goal) ?? 1)),
          reward_coins: Math.max(10, Math.round(toNumber(mission.reward_coins) ?? 100))
        }))
    : [];

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      id: "mission_serve_customers",
      name: "Serve 120 customers",
      type: "serve_customers",
      goal: 120,
      reward_coins: 150
    },
    {
      id: "mission_watch_rewarded_ad",
      name: "Watch 2 rewarded ads",
      type: "watch_rewarded_ad",
      goal: 2,
      reward_coins: 100
    },
    {
      id: "mission_purchase_upgrade",
      name: "Purchase 2 upgrades",
      type: "purchase_upgrade",
      goal: 2,
      reward_coins: 200
    }
  ];
}

function rotate(items, offset) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }
  const start = offset % items.length;
  return [...items.slice(start), ...items.slice(0, start)];
}

function normalizeCountries(countries, segmentReport) {
  const fromOptions = Array.isArray(countries)
    ? countries.filter((item) => typeof item === "string" && item.trim())
    : [];

  if (fromOptions.length > 0) {
    return [...new Set(fromOptions)].sort();
  }

  const fromSegments = Array.isArray(segmentReport?.segments)
    ? segmentReport.segments
        .map((row) => row?.segment?.country)
        .filter((item) => typeof item === "string" && item.trim())
    : [];

  if (fromSegments.length > 0) {
    return [...new Set(fromSegments)].sort();
  }

  return ["KR", "US"];
}

function severityScore(value) {
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  return 1;
}

function rankSegments(segmentReport) {
  const rows = Array.isArray(segmentReport?.segments) ? segmentReport.segments : [];
  return [...rows]
    .map((row) => {
      const checks = [
        ...(row?.gate_evaluation?.gate_1?.checks ?? []),
        ...(row?.gate_evaluation?.gate_2?.checks ?? [])
      ];
      const failedChecks = checks.filter((check) => check?.ok === false).length;
      const cpi = toNumber(row?.snapshot?.cpi) ?? 0;
      const severity = severityScore(row?.tuning_recommendation?.severity);
      const score = failedChecks * 3 + severity + cpi;
      return {
        segment: row?.segment ?? { country: "KR", platform: "android" },
        score,
        failed_checks: failedChecks,
        severity: row?.tuning_recommendation?.severity ?? "low",
        cpi: row?.snapshot?.cpi ?? null
      };
    })
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      const aKey = `${a.segment.country}/${a.segment.platform}`;
      const bKey = `${b.segment.country}/${b.segment.platform}`;
      return aKey.localeCompare(bKey);
    });
}

function tuneMission(goal, rewardCoins, missionType, primaryGoal, dayIndex, totalDays) {
  let goalMultiplier = 1;
  let rewardMultiplier = 1;
  const ramp = totalDays <= 1 ? 0 : dayIndex / (totalDays - 1);

  if (primaryGoal === "retention_recovery") {
    goalMultiplier = dayIndex <= 2 ? 0.85 : 0.95;
    rewardMultiplier = dayIndex <= 2 ? 1.25 : 1.15;
    if (missionType === "watch_rewarded_ad") {
      rewardMultiplier += 0.1;
    }
  } else if (primaryGoal === "ad_engagement_uplift") {
    if (missionType === "watch_rewarded_ad") {
      goalMultiplier = dayIndex <= 2 ? 0.7 : 0.85;
      rewardMultiplier = 1.4;
    } else {
      goalMultiplier = 0.95;
      rewardMultiplier = 1.05;
    }
  } else if (primaryGoal === "iap_conversion_uplift") {
    if (missionType === "purchase_upgrade") {
      goalMultiplier = 0.7;
      rewardMultiplier = 1.5;
    } else if (missionType === "serve_customers") {
      goalMultiplier = 0.9;
      rewardMultiplier = 1.1;
    } else {
      rewardMultiplier = 1.15;
    }
  } else if (primaryGoal === "long_retention_uplift") {
    goalMultiplier = 1 + 0.2 * ramp;
    rewardMultiplier = 1 + 0.25 * ramp;
  } else if (primaryGoal === "scaling_stability") {
    goalMultiplier = 1.05;
    rewardMultiplier = 1.05;
  }

  const tunedGoal = Math.max(1, Math.round(goal * goalMultiplier));
  const tunedReward = Math.max(10, Math.round((rewardCoins * rewardMultiplier) / 10) * 10);
  return { tunedGoal, tunedReward };
}

function buildDailyMissionTemplates({
  missions,
  primaryGoal,
  days,
  targetCountries
}) {
  const templates = [];

  for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
    const rotated = rotate(missions, dayIndex);
    const selected = rotated.slice(0, 3);
    const missionSet = selected.map((mission) => {
      const { tunedGoal, tunedReward } = tuneMission(
        mission.goal,
        mission.reward_coins,
        mission.type,
        primaryGoal,
        dayIndex,
        days
      );
      return {
        template_id: `${mission.id}_d${String(dayIndex + 1).padStart(2, "0")}`,
        type: mission.type,
        name: mission.name,
        goal: tunedGoal,
        reward_coins: tunedReward
      };
    });

    templates.push({
      day_index: dayIndex + 1,
      day_label: `day_${dayIndex + 1}`,
      objective: primaryGoal,
      target_countries: targetCountries,
      missions: missionSet
    });
  }

  return templates;
}

function eventCatalog() {
  return [
    {
      template_id: "event_queue_rescue_weekend",
      title: "Queue Rescue Weekend",
      duration_days: 2,
      objective_keys: ["retention_recovery", "long_retention_uplift"],
      primary_kpi: "d1_retention",
      remote_config_patch: {
        economy_multiplier: 1.1,
        rewarded_ad_multiplier: 2.2,
        ad_cooldown_sec: 75
      },
      ab_flag_patch: {
        ab_offer_timing: "mid_session",
        ab_ad_frequency: "low"
      },
      notes: "Show rescue reward prompt when queue pressure is high."
    },
    {
      template_id: "event_reward_rush_48h",
      title: "Reward Rush 48h",
      duration_days: 2,
      objective_keys: [
        "ad_engagement_uplift",
        "retention_recovery",
        "scaling_stability"
      ],
      primary_kpi: "rewarded_ad_participation",
      remote_config_patch: {
        economy_multiplier: 1,
        rewarded_ad_multiplier: 2.5,
        ad_cooldown_sec: 60
      },
      ab_flag_patch: {
        ab_offer_timing: "post_stage",
        ab_ad_frequency: "low"
      },
      notes: "Increase rewarded value clarity after stage completion."
    },
    {
      template_id: "event_starter_bundle_flash",
      title: "Starter Bundle Flash",
      duration_days: 3,
      objective_keys: ["iap_conversion_uplift", "scaling_stability"],
      primary_kpi: "payer_conversion",
      remote_config_patch: {
        economy_multiplier: 1.05,
        rewarded_ad_multiplier: 2,
        iap_price_tier: "tier_1"
      },
      ab_flag_patch: {
        ab_offer_timing: "mid_session",
        ab_upgrade_cost_curve: "baseline"
      },
      notes: "Show bundle once after first major upgrade purchase."
    },
    {
      template_id: "event_efficiency_guard",
      title: "Efficiency Guard",
      duration_days: 2,
      objective_keys: ["ua_efficiency_guard"],
      primary_kpi: "cpi",
      remote_config_patch: {
        economy_multiplier: 1,
        rewarded_ad_multiplier: 2,
        ad_cooldown_sec: 90
      },
      ab_flag_patch: {
        ab_ad_frequency: "low",
        ab_offer_timing: "mid_session"
      },
      notes: "Protect CPI while preserving baseline monetization."
    }
  ];
}

function withSeverityPatch(template, severity, primaryGoal) {
  const remote = { ...template.remote_config_patch };

  if (severity === "high") {
    if (primaryGoal === "ad_engagement_uplift") {
      remote.rewarded_ad_multiplier = toNumber(remote.rewarded_ad_multiplier) != null
        ? Number((remote.rewarded_ad_multiplier + 0.3).toFixed(2))
        : 2.3;
      remote.ad_cooldown_sec = Math.max(45, Math.round((toNumber(remote.ad_cooldown_sec) ?? 75) - 15));
    }
    if (primaryGoal === "retention_recovery") {
      remote.economy_multiplier = Number(((toNumber(remote.economy_multiplier) ?? 1) + 0.05).toFixed(2));
    }
    if (primaryGoal === "iap_conversion_uplift") {
      remote.iap_price_tier = "tier_1";
    }
  }

  return {
    ...template,
    remote_config_patch: remote
  };
}

function buildWeeklyEventTemplates({
  primaryGoal,
  severity,
  weeklyEventCount,
  rankedSegments
}) {
  const catalog = eventCatalog();
  const preferred = catalog.filter((item) => item.objective_keys.includes(primaryGoal));
  const fallback = catalog.filter((item) => !item.objective_keys.includes(primaryGoal));
  const selected = [...preferred, ...fallback].slice(0, weeklyEventCount);
  const startDays = [2, 5, 7];
  const targetSegments = rankedSegments.slice(0, 2).map((item) => item.segment);

  return selected.map((template, index) => {
    const tuned = withSeverityPatch(template, severity, primaryGoal);
    return {
      event_id: `${template.template_id}_${index + 1}`,
      title: tuned.title,
      objective: primaryGoal,
      primary_kpi: tuned.primary_kpi,
      start_day: startDays[index] ?? Math.max(1, 1 + index * 2),
      duration_days: tuned.duration_days,
      target_segments:
        targetSegments.length > 0
          ? targetSegments
          : [{ country: "KR", platform: "android" }],
      remote_config_patch: tuned.remote_config_patch,
      ab_flag_patch: tuned.ab_flag_patch,
      notes: tuned.notes
    };
  });
}

function extractRewardTuningNotes(tuningRecommendation) {
  const actions = Array.isArray(tuningRecommendation?.actions)
    ? tuningRecommendation.actions
    : [];
  const notes = [];

  for (const action of actions) {
    const changes = Array.isArray(action?.changes) ? action.changes : [];
    for (const change of changes) {
      const text = String(change ?? "");
      const lowered = text.toLowerCase();
      if (
        lowered.includes("reward") ||
        lowered.includes("ad") ||
        lowered.includes("mission") ||
        lowered.includes("bundle")
      ) {
        notes.push(text);
      }
      if (notes.length >= 5) {
        return notes;
      }
    }
  }
  return notes;
}

export function buildLiveopsLitePlan({
  dailyMissions,
  segmentReport = null,
  gateEvaluation = null,
  tuningRecommendation = null,
  weekLabel = null,
  targetCountries = null,
  days = 7,
  weeklyEventCount = 2,
  startDate = null
}) {
  const normalizedMissions = normalizeDailyMissions(dailyMissions);
  const normalizedDays =
    Number.isFinite(Number(days)) && Number(days) > 0 ? Math.round(Number(days)) : 7;
  const normalizedEventCount =
    Number.isFinite(Number(weeklyEventCount)) && Number(weeklyEventCount) > 0
      ? Math.round(Number(weeklyEventCount))
      : 2;
  const safeDate = startDate ?? utcDayStringNow();
  const resolvedWeekLabel = weekLabel ?? isoWeekLabel(safeDate);
  const countries = normalizeCountries(targetCountries, segmentReport);
  const rankedSegments = rankSegments(segmentReport);
  const primaryGoal = inferPrimaryGoal(gateEvaluation);
  const severity = tuningRecommendation?.severity ?? "low";

  return {
    generated_at: new Date().toISOString(),
    week_label: resolvedWeekLabel,
    strategy: {
      primary_goal: primaryGoal.key,
      severity,
      rationale: primaryGoal.rationale,
      target_countries: countries,
      priority_segments: rankedSegments.slice(0, 2),
      recommended_action: gateEvaluation?.recommended_action ?? null
    },
    daily_mission_templates: buildDailyMissionTemplates({
      missions: normalizedMissions,
      primaryGoal: primaryGoal.key,
      days: normalizedDays,
      targetCountries: countries
    }),
    weekly_event_templates: buildWeeklyEventTemplates({
      primaryGoal: primaryGoal.key,
      severity,
      weeklyEventCount: normalizedEventCount,
      rankedSegments
    }),
    reward_tuning_notes: extractRewardTuningNotes(tuningRecommendation)
  };
}

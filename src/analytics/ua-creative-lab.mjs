function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickSeverityScore(value) {
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  return 1;
}

function segmentKey(segment) {
  return `${segment.country}/${segment.platform}`;
}

function rankSegments(segmentRows) {
  return [...segmentRows].sort((a, b) => {
    const aCpi = toNumber(a?.snapshot?.cpi) ?? 0;
    const bCpi = toNumber(b?.snapshot?.cpi) ?? 0;
    const aGatePenalty =
      (a?.gate_evaluation?.gate_1?.passed ? 0 : 2) +
      (a?.gate_evaluation?.gate_2?.passed ? 0 : 1);
    const bGatePenalty =
      (b?.gate_evaluation?.gate_1?.passed ? 0 : 2) +
      (b?.gate_evaluation?.gate_2?.passed ? 0 : 1);
    const aSeverity = pickSeverityScore(a?.tuning_recommendation?.severity);
    const bSeverity = pickSeverityScore(b?.tuning_recommendation?.severity);
    const aScore = aGatePenalty * 2 + aSeverity + aCpi;
    const bScore = bGatePenalty * 2 + bSeverity + bCpi;

    if (bScore !== aScore) {
      return bScore - aScore;
    }

    return segmentKey(a.segment).localeCompare(segmentKey(b.segment));
  });
}

function pickTopHook(marketBrief) {
  const hook = marketBrief?.summary?.top_creative_hook;
  if (typeof hook === "string" && hook.trim()) {
    return hook.trim();
  }
  return "queue_overload_then_upgrade";
}

function pickTopGenre(marketBrief) {
  const genre = marketBrief?.summary?.top_genre;
  if (typeof genre === "string" && genre.trim()) {
    return genre.trim();
  }
  return "idle_tycoon";
}

function creativeTemplates(topHook, topGenre) {
  return [
    {
      angle: "Bottleneck rescue",
      first_3_seconds: "Long queue appears, timer flashes red, instant upgrade button pops.",
      gameplay_script: [
        "Show slow station causing order collapse.",
        "Tap instant upgrade reward and recover flow.",
        "End on smooth high-throughput loop."
      ],
      monetization_message: "Rewarded ad unlocks instant throughput rescue.",
      cta: "Fix the rush now",
      hypothesis_tags: [topHook, "upgrade_relief", topGenre]
    },
    {
      angle: "30-second x2 income sprint",
      first_3_seconds: "Coins burst after activating x2 income for 30 seconds.",
      gameplay_script: [
        "Display baseline coin gain.",
        "Activate x2 rewarded option and compare gain curve.",
        "Stack one upgrade to show compounding."
      ],
      monetization_message: "Rewarded ads clearly tied to immediate coin acceleration.",
      cta: "Double your shift",
      hypothesis_tags: ["rewarded_value_clarity", "coin_surge", topGenre]
    },
    {
      angle: "Idle comeback payoff",
      first_3_seconds: "Offline earnings chest opens with one-tap collection.",
      gameplay_script: [
        "Show short AFK period and return.",
        "Collect idle income and spend on key station.",
        "Clear next stage faster than before."
      ],
      monetization_message: "Rewarded option multiplies comeback rewards at return.",
      cta: "Claim your comeback",
      hypothesis_tags: ["idle_reward", "return_session", "retention_hook"]
    },
    {
      angle: "Starter bundle value anchor",
      first_3_seconds: "Starter bundle appears next to stalled progression moment.",
      gameplay_script: [
        "Stop at a visible progression wall.",
        "Compare no-purchase path vs starter bundle path.",
        "Show immediate station unlock momentum."
      ],
      monetization_message: "Starter bundle framed as time saver, not paywall.",
      cta: "Kickstart your market",
      hypothesis_tags: ["starter_bundle", "conversion", "value_anchor"]
    },
    {
      angle: "Daily mission speedrun",
      first_3_seconds: "Three daily mission cards appear with fast completion streak.",
      gameplay_script: [
        "Complete mission 1 in under 10 seconds.",
        "Chain mission rewards into one major upgrade.",
        "Finish with clean station loop."
      ],
      monetization_message: "Rewarded ad offers optional mission boost without blocking.",
      cta: "Finish today’s missions",
      hypothesis_tags: ["daily_mission", "session_depth", "habit_loop"]
    }
  ];
}

function cycleSegment(rankedSegments, index) {
  if (rankedSegments.length === 0) {
    return {
      country: "GLOBAL",
      platform: "android"
    };
  }
  return rankedSegments[index % rankedSegments.length].segment;
}

export function buildUaCreativeBatch({
  segmentReport,
  marketBrief = null,
  count = 5
}) {
  const rows = Array.isArray(segmentReport?.segments) ? segmentReport.segments : [];
  const rankedSegments = rankSegments(rows);
  const topHook = pickTopHook(marketBrief);
  const topGenre = pickTopGenre(marketBrief);
  const templates = creativeTemplates(topHook, topGenre).slice(0, count);
  const cpiTarget = toNumber(marketBrief?.scope?.cpi_target_usd) ?? 2.5;

  const creatives = templates.map((template, index) => {
    const targetSegment = cycleSegment(rankedSegments, index);
    return {
      creative_id: `creative_${String(index + 1).padStart(2, "0")}`,
      target_segment: targetSegment,
      angle: template.angle,
      format: "short_form_video_9x16",
      first_3_seconds: template.first_3_seconds,
      gameplay_script: template.gameplay_script,
      monetization_message: template.monetization_message,
      cta: template.cta,
      hypothesis_tags: template.hypothesis_tags,
      success_metric: {
        primary: "ctr",
        target_lift_pct: 15,
        guardrail_cpi_max_usd: cpiTarget
      }
    };
  });

  const prioritySegments = rankedSegments.slice(0, 2).map((row) => ({
    segment: row.segment,
    severity: row?.tuning_recommendation?.severity ?? "low",
    cpi: row?.snapshot?.cpi ?? null
  }));

  return {
    generated_at: new Date().toISOString(),
    source_references: {
      segment_report_generated_at: segmentReport?.generated_at ?? null,
      market_brief_generated_at: marketBrief?.generated_at ?? null
    },
    strategy: {
      focus_genre: topGenre,
      focus_hook: topHook,
      priority_segments: prioritySegments
    },
    experiment_plan: {
      batch_size: creatives.length,
      test_window_days: 4,
      decision_rule:
        "Keep top 2 creatives by CTR while maintaining CPI at or below guardrail."
    },
    creatives
  };
}

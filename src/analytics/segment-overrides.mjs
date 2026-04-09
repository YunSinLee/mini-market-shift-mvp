import { buildOverridePlan } from "./override-plan.mjs";

function normalizeSegment(segment) {
  return {
    country: segment?.country ?? "unknown",
    platform: segment?.platform ?? "unknown"
  };
}

function segmentId(segment) {
  return `${segment.country}-${segment.platform}`;
}

export function buildSegmentOverridePlans({
  segmentReport,
  remoteBase,
  abBase,
  maxActions = 3,
  forceUnsafe = false
}) {
  const rows = Array.isArray(segmentReport?.segments) ? segmentReport.segments : [];
  const plans = [];

  for (const row of rows) {
    const segment = normalizeSegment(row.segment);
    const recommendation = row.tuning_recommendation;
    if (!recommendation) {
      continue;
    }

    const plan = buildOverridePlan({
      remoteBase,
      abBase,
      recommendation,
      maxActions,
      context: {
        snapshot: row.snapshot ?? null
      },
      forceUnsafe
    });

    plans.push({
      segment,
      segment_id: segmentId(segment),
      plan
    });
  }

  return {
    generated_at: new Date().toISOString(),
    max_actions: maxActions,
    force_unsafe: forceUnsafe,
    total_segments_in_report: rows.length,
    generated_plans: plans.length,
    plans
  };
}

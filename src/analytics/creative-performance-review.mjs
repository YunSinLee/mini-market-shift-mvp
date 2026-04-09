function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

export function parseCreativePerformanceCsv(csvRaw) {
  const rows = normalizeText(csvRaw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rows.length === 0) {
    return [];
  }

  const headers = splitCsvLine(rows[0]).map((header) => header.toLowerCase());
  const records = [];

  for (let i = 1; i < rows.length; i += 1) {
    const cells = splitCsvLine(rows[i]);
    const item = {};
    for (let j = 0; j < headers.length; j += 1) {
      item[headers[j]] = cells[j] ?? "";
    }
    records.push(item);
  }

  return records.map((item) => ({
    date: normalizeText(item.date, null),
    creative_id: normalizeText(item.creative_id, "unknown"),
    country: normalizeText(item.country, "US").toUpperCase(),
    platform: normalizeText(item.platform, "android").toLowerCase(),
    impressions: toNumber(item.impressions) ?? 0,
    clicks: toNumber(item.clicks) ?? 0,
    installs: toNumber(item.installs) ?? 0,
    spend_usd: toNumber(item.spend_usd) ?? 0
  }));
}

function aggregateByCreative(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = row.creative_id;
    if (!map.has(key)) {
      map.set(key, {
        creative_id: key,
        country: row.country,
        platform: row.platform,
        impressions: 0,
        clicks: 0,
        installs: 0,
        spend_usd: 0
      });
    }

    const agg = map.get(key);
    agg.impressions += row.impressions;
    agg.clicks += row.clicks;
    agg.installs += row.installs;
    agg.spend_usd += row.spend_usd;
  }

  return map;
}

function metricMedian(values) {
  const nums = values
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b);
  if (nums.length === 0) {
    return null;
  }
  const mid = Math.floor(nums.length / 2);
  if (nums.length % 2 === 0) {
    return (nums[mid - 1] + nums[mid]) / 2;
  }
  return nums[mid];
}

function pickHookPool({ marketBrief, keepRows }) {
  const hooks = [];
  const used = new Set();

  for (const row of keepRows) {
    const creative = row.creative ?? {};
    if (Array.isArray(creative.hypothesis_tags)) {
      for (const tag of creative.hypothesis_tags) {
        used.add(tag);
      }
    }
  }

  const summaryHook = normalizeText(marketBrief?.summary?.top_creative_hook, null);
  if (summaryHook) {
    hooks.push(summaryHook);
  }

  const watchlist = Array.isArray(marketBrief?.watchlist) ? marketBrief.watchlist : [];
  for (const row of watchlist) {
    const hook = normalizeText(row?.strongest_hook, null);
    if (hook && hook !== "unknown") {
      hooks.push(hook);
    }
  }

  const defaults = [
    "queue_overload_then_upgrade",
    "before_after_station_speed",
    "near_fail_then_save",
    "simple_loop_high_reward"
  ];
  hooks.push(...defaults);

  const deduped = [];
  const seen = new Set();
  for (const hook of hooks) {
    if (!hook || seen.has(hook) || used.has(hook)) {
      continue;
    }
    seen.add(hook);
    deduped.push(hook);
  }

  return deduped.length > 0 ? deduped : defaults;
}

function replacementDraft({ dropped, hook }) {
  return {
    creative_id: `${dropped.creative_id}_v2`,
    target_segment: dropped.segment,
    angle: `Hook pivot: ${hook}`,
    creative_hook: hook,
    first_3_seconds_suggestion: `Open with '${hook}' pattern in first 3 seconds, then show immediate payoff.`,
    monetization_message_suggestion:
      "Keep rewarded value explicit and measurable before showing CTA.",
    cta_suggestion: "Play now and optimize your shift."
  };
}

export function buildCreativePerformanceReview({
  creativeBatch,
  performanceRows,
  marketBrief = null,
  topN = 2,
  minImpressions = 1000
}) {
  const creatives = Array.isArray(creativeBatch?.creatives) ? creativeBatch.creatives : [];
  const aggregated = aggregateByCreative(performanceRows);

  const ranked = creatives.map((creative) => {
    const performance = aggregated.get(creative.creative_id) ?? {
      creative_id: creative.creative_id,
      country: creative?.target_segment?.country ?? "US",
      platform: creative?.target_segment?.platform ?? "android",
      impressions: 0,
      clicks: 0,
      installs: 0,
      spend_usd: 0
    };

    const ctr =
      performance.impressions > 0 ? performance.clicks / performance.impressions : null;
    const cpi = performance.installs > 0 ? performance.spend_usd / performance.installs : null;
    const guardrail = toNumber(creative?.success_metric?.guardrail_cpi_max_usd) ?? 2.5;
    const guardrailPass = cpi != null ? cpi <= guardrail : false;
    const eligible = performance.impressions >= minImpressions;
    const penalty = (eligible ? 0 : 2) + (guardrailPass ? 0 : 1);

    return {
      creative_id: creative.creative_id,
      creative,
      segment: creative?.target_segment ?? {
        country: performance.country,
        platform: performance.platform
      },
      impressions: performance.impressions,
      clicks: performance.clicks,
      installs: performance.installs,
      spend_usd: Number(performance.spend_usd.toFixed(4)),
      ctr: ctr != null ? Number(ctr.toFixed(6)) : null,
      cpi: cpi != null ? Number(cpi.toFixed(4)) : null,
      guardrail_cpi_max_usd: guardrail,
      guardrail_pass: guardrailPass,
      eligible,
      rank_penalty: penalty
    };
  });

  ranked.sort((a, b) => {
    if (a.rank_penalty !== b.rank_penalty) {
      return a.rank_penalty - b.rank_penalty;
    }
    const aCtr = a.ctr ?? -1;
    const bCtr = b.ctr ?? -1;
    if (bCtr !== aCtr) {
      return bCtr - aCtr;
    }
    const aCpi = a.cpi ?? Number.POSITIVE_INFINITY;
    const bCpi = b.cpi ?? Number.POSITIVE_INFINITY;
    if (aCpi !== bCpi) {
      return aCpi - bCpi;
    }
    return a.creative_id.localeCompare(b.creative_id);
  });

  const keep = ranked.slice(0, Math.max(1, topN));
  const keepIds = new Set(keep.map((row) => row.creative_id));
  const dropped = ranked.filter((row) => !keepIds.has(row.creative_id));
  const keepCtrMedian = metricMedian(keep.map((row) => row.ctr).filter((value) => value != null));
  const hookPool = pickHookPool({ marketBrief, keepRows: keep });

  const droppedWithReasons = dropped.map((row, index) => {
    const reasons = [];
    if (!row.eligible) {
      reasons.push("low_sample");
    }
    if (!row.guardrail_pass) {
      reasons.push("cpi_over_guardrail");
    }
    if (row.installs === 0 && row.spend_usd > 0) {
      reasons.push("no_installs");
    }
    if (row.ctr == null) {
      reasons.push("missing_ctr");
    } else if (keepCtrMedian != null && row.ctr < keepCtrMedian) {
      reasons.push("low_ctr_vs_keep_median");
    }

    const hook = hookPool[index % hookPool.length];
    return {
      creative_id: row.creative_id,
      segment: row.segment,
      reasons,
      replacement: replacementDraft({
        dropped: row,
        hook
      })
    };
  });

  return {
    generated_at: new Date().toISOString(),
    source_reference: {
      creative_batch_generated_at: creativeBatch?.generated_at ?? null
    },
    policy: {
      keep_top_n: Math.max(1, topN),
      min_impressions: minImpressions,
      sort_rule: "rank_penalty asc, ctr desc, cpi asc"
    },
    summary: {
      evaluated_creatives: ranked.length,
      kept_creatives: keep.length,
      dropped_creatives: droppedWithReasons.length
    },
    kept: keep.map((row, index) => ({
      rank: index + 1,
      creative_id: row.creative_id,
      segment: row.segment,
      ctr: row.ctr,
      cpi: row.cpi,
      impressions: row.impressions,
      guardrail_pass: row.guardrail_pass
    })),
    dropped: droppedWithReasons,
    ranking: ranked.map((row, index) => ({
      rank: index + 1,
      creative_id: row.creative_id,
      segment: row.segment,
      ctr: row.ctr,
      cpi: row.cpi,
      impressions: row.impressions,
      guardrail_pass: row.guardrail_pass,
      eligible: row.eligible,
      rank_penalty: row.rank_penalty
    }))
  };
}

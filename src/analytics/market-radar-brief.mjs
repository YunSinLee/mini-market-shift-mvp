function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeText(value, fallback = "unknown") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function normalizeOptionalText(value, fallback = "unknown") {
  const normalized = normalizeText(value, fallback);
  const lowered = normalized.toLowerCase();
  if (lowered === "n/a" || lowered === "na" || lowered === "none" || lowered === "null") {
    return fallback;
  }
  return normalized;
}

function normalizeArray(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => normalizeText(item, ""))
    .filter(Boolean);
}

function intersects(a, b) {
  const set = new Set(a);
  return b.some((item) => set.has(item));
}

function scoreSignal(signal, options) {
  const reasons = [];
  let score = 0;

  if (signal.complexity_tier === "very_easy" || signal.complexity_tier === "easy") {
    score += 3;
    reasons.push("low_complexity");
  }

  if (signal.genre.includes("idle") || signal.genre.includes("tycoon")) {
    score += 2;
    reasons.push("idle_tycoon_fit");
  }

  if (
    signal.monetization.includes("hybrid") ||
    signal.monetization.includes("rewarded_ads")
  ) {
    score += 2;
    reasons.push("hybrid_monetization");
  }

  if (intersects(signal.markets, options.targetCountries)) {
    score += 1;
    reasons.push("target_market_overlap");
  }

  if (signal.chart_delta > 0) {
    score += 1;
    reasons.push("chart_momentum_up");
  }

  if (signal.cpi_estimate != null && signal.cpi_estimate <= options.cpiTarget) {
    score += 1;
    reasons.push("cpi_within_target");
  }

  if (signal.creative_hook !== "unknown") {
    score += 1;
    reasons.push("creative_hook_observed");
  }

  return { score, reasons };
}

function countBy(items) {
  const result = new Map();
  for (const item of items) {
    result.set(item, (result.get(item) ?? 0) + 1);
  }
  return result;
}

function topEntry(counts, fallback) {
  let bestKey = fallback;
  let bestCount = 0;

  for (const [key, count] of counts.entries()) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  return {
    key: bestKey,
    count: bestCount
  };
}

function fallbackActionableUpdates(context) {
  return [
    {
      priority: 1,
      title: "Prioritize low-complexity idle hook",
      why_now: "Simple loops remain easiest to iterate within 4-8 week MVP windows.",
      action:
        "Keep 2-4 minute sessions and push first reward trigger under 20 seconds in creatives."
    },
    {
      priority: 2,
      title: "Keep rewarded-first monetization messaging",
      why_now:
        "Hybrid casual tests perform better when users understand ad-for-value exchange early.",
      action:
        "Show one explicit reward trade-off in ad creatives and onboarding before any interstitial pressure."
    },
    {
      priority: 3,
      title: "Separate KR and US creative variants",
      why_now: "CPI volatility differs by market and generic creatives dilute CTR.",
      action:
        "Ship 2 localized variants per concept and keep only top 2 hooks after first 400 installs."
    }
  ].map((item) => ({
    ...item,
    context: context
  }));
}

export function buildMarketRadarBrief({
  signals,
  weekLabel = null,
  targetCountries = ["KR", "US"],
  cpiTarget = 2.5,
  topN = 5
}) {
  const normalizedSignals = (Array.isArray(signals) ? signals : []).map((raw) => ({
    game_name: normalizeText(raw?.game_name),
    genre: normalizeText(raw?.genre),
    complexity_tier: normalizeText(raw?.complexity_tier),
    monetization: normalizeArray(raw?.monetization),
    markets: normalizeArray(raw?.markets),
    chart_delta: toNumber(raw?.chart_delta) ?? 0,
    cpi_estimate: toNumber(raw?.cpi_estimate),
    price_change: normalizeOptionalText(raw?.price_change),
    creative_hook: normalizeOptionalText(raw?.creative_hook),
    source_name: normalizeText(raw?.source_name),
    source_url: normalizeText(raw?.source_url),
    observed_at: normalizeText(raw?.observed_at)
  }));

  const gameMap = new Map();
  for (const signal of normalizedSignals) {
    const { score, reasons } = scoreSignal(signal, {
      targetCountries,
      cpiTarget
    });
    const key = signal.game_name;

    if (!gameMap.has(key)) {
      gameMap.set(key, {
        game_name: signal.game_name,
        genre: signal.genre,
        complexity_tier: signal.complexity_tier,
        markets: new Set(),
        monetization: new Set(),
        source_links: new Set(),
        score_sum: 0,
        signal_count: 0,
        reason_tags: new Set(),
        strongest_hook: "unknown",
        latest_observed_at: signal.observed_at
      });
    }

    const row = gameMap.get(key);
    row.score_sum += score;
    row.signal_count += 1;
    row.latest_observed_at =
      signal.observed_at > row.latest_observed_at
        ? signal.observed_at
        : row.latest_observed_at;
    for (const market of signal.markets) {
      row.markets.add(market);
    }
    for (const model of signal.monetization) {
      row.monetization.add(model);
    }
    row.source_links.add(signal.source_url);
    for (const reason of reasons) {
      row.reason_tags.add(reason);
    }
    if (signal.creative_hook !== "unknown") {
      row.strongest_hook = signal.creative_hook;
    }
  }

  const watchlist = [...gameMap.values()]
    .map((row) => ({
      game_name: row.game_name,
      genre: row.genre,
      complexity_tier: row.complexity_tier,
      candidate_score: Number((row.score_sum / row.signal_count).toFixed(2)),
      signal_count: row.signal_count,
      markets: [...row.markets].sort(),
      monetization: [...row.monetization].sort(),
      strongest_hook: row.strongest_hook,
      reason_tags: [...row.reason_tags].sort(),
      source_links: [...row.source_links].sort(),
      latest_observed_at: row.latest_observed_at
    }))
    .sort((a, b) => {
      if (b.candidate_score !== a.candidate_score) {
        return b.candidate_score - a.candidate_score;
      }
      if (b.signal_count !== a.signal_count) {
        return b.signal_count - a.signal_count;
      }
      return a.game_name.localeCompare(b.game_name);
    })
    .slice(0, topN)
    .map((row, index) => ({
      rank: index + 1,
      ...row
    }));

  const topGenre = topEntry(
    countBy(normalizedSignals.map((signal) => signal.genre)),
    "unknown"
  );
  const topHook = topEntry(
    countBy(
      normalizedSignals
        .map((signal) => signal.creative_hook)
        .filter((hook) => hook !== "unknown")
    ),
    "queue_overload_then_upgrade"
  );
  const hybridSignals = normalizedSignals.filter((signal) =>
    signal.monetization.includes("hybrid")
  ).length;
  const pricingSignals = normalizedSignals.filter(
    (signal) => signal.price_change !== "unknown"
  ).length;

  const context = {
    top_genre: topGenre.key,
    top_hook: topHook.key,
    hybrid_signal_share:
      normalizedSignals.length > 0
        ? Number((hybridSignals / normalizedSignals.length).toFixed(4))
        : null,
    pricing_signal_count: pricingSignals
  };

  const actionableUpdates = fallbackActionableUpdates(context);

  return {
    generated_at: new Date().toISOString(),
    week_label: weekLabel,
    scope: {
      signal_count: normalizedSignals.length,
      target_countries: targetCountries,
      cpi_target_usd: cpiTarget
    },
    summary: {
      top_genre: topGenre.key,
      top_genre_signal_count: topGenre.count,
      top_creative_hook: topHook.key,
      top_creative_hook_signal_count: topHook.count,
      hybrid_signal_count: hybridSignals,
      pricing_signal_count: pricingSignals
    },
    watchlist,
    actionable_updates: actionableUpdates
  };
}

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

function normalizeSignals(inputSignals, observedDate, keepTopN) {
  const signals = Array.isArray(inputSignals) ? inputSignals : [];
  return signals.slice(0, keepTopN).map((signal) => ({
    game_name: signal?.game_name ?? "unknown_game",
    genre: signal?.genre ?? "unknown",
    complexity_tier: signal?.complexity_tier ?? "easy",
    monetization: Array.isArray(signal?.monetization)
      ? signal.monetization
      : ["hybrid", "rewarded_ads", "iap"],
    markets: Array.isArray(signal?.markets) ? signal.markets : ["US"],
    chart_delta: 0,
    cpi_estimate: null,
    price_change: "unknown",
    creative_hook: signal?.creative_hook ?? "unknown",
    source_name: signal?.source_name ?? "update_required",
    source_url: signal?.source_url ?? "update_required",
    observed_at: observedDate,
    note: "refresh_with_latest_signal"
  }));
}

export function buildWeeklyRadarSignalScaffold({
  observedDate,
  targetCountries = ["KR", "US"],
  cpiTargetUsd = 2.5,
  sourceSignals,
  keepTopN = 8
}) {
  const weekLabel = isoWeekLabel(observedDate);
  const signals = normalizeSignals(sourceSignals, observedDate, keepTopN);

  return {
    week_label: weekLabel,
    target_countries: targetCountries,
    cpi_target_usd: cpiTargetUsd,
    update_checklist: [
      "Refresh chart_delta and cpi_estimate from this week data.",
      "Replace source_name/source_url where placeholder exists.",
      "Keep only 5-8 high-signal candidates for solo execution."
    ],
    signals
  };
}

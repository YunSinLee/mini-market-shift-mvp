import test from "node:test";
import assert from "node:assert/strict";
import { buildMarketRadarBrief } from "../src/analytics/market-radar-brief.mjs";

test("market radar brief builds ranked watchlist and 3 updates", () => {
  const brief = buildMarketRadarBrief({
    weekLabel: "2026-W15",
    targetCountries: ["KR", "US"],
    signals: [
      {
        game_name: "Mini Market",
        genre: "idle_tycoon",
        complexity_tier: "easy",
        monetization: ["hybrid", "rewarded_ads"],
        markets: ["KR", "US"],
        chart_delta: 2,
        cpi_estimate: 2.3,
        price_change: "starter_bundle",
        creative_hook: "queue_overload_then_upgrade",
        source_name: "source_a",
        source_url: "https://example.com/a",
        observed_at: "2026-04-08"
      },
      {
        game_name: "Mini Market",
        genre: "idle_tycoon",
        complexity_tier: "easy",
        monetization: ["hybrid", "iap"],
        markets: ["US"],
        chart_delta: 1,
        cpi_estimate: 2.4,
        price_change: "unknown",
        creative_hook: "before_after_station_speed",
        source_name: "source_b",
        source_url: "https://example.com/b",
        observed_at: "2026-04-09"
      },
      {
        game_name: "Sort Jam",
        genre: "sort_puzzle",
        complexity_tier: "very_easy",
        monetization: ["rewarded_ads"],
        markets: ["US"],
        chart_delta: 1,
        cpi_estimate: 2.2,
        price_change: "unknown",
        creative_hook: "near_fail_then_save",
        source_name: "source_c",
        source_url: "https://example.com/c",
        observed_at: "2026-04-09"
      }
    ]
  });

  assert.equal(brief.week_label, "2026-W15");
  assert.equal(brief.scope.signal_count, 3);
  assert.ok(brief.watchlist.length >= 2);
  assert.equal(brief.watchlist[0].game_name, "Mini Market");
  assert.equal(brief.actionable_updates.length, 3);
  assert.equal(brief.summary.top_genre, "idle_tycoon");
});

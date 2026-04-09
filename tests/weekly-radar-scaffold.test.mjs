import test from "node:test";
import assert from "node:assert/strict";
import { buildWeeklyRadarSignalScaffold } from "../src/analytics/weekly-radar-scaffold.mjs";

test("weekly radar scaffold keeps top candidates and resets refresh fields", () => {
  const scaffold = buildWeeklyRadarSignalScaffold({
    observedDate: "2026-04-09",
    targetCountries: ["KR", "US"],
    cpiTargetUsd: 2.5,
    sourceSignals: [
      {
        game_name: "Pizza Ready",
        genre: "idle_tycoon",
        complexity_tier: "easy",
        monetization: ["hybrid", "rewarded_ads", "iap"],
        markets: ["KR", "US"],
        creative_hook: "queue_overload_then_upgrade",
        source_name: "PocketGamer",
        source_url: "https://example.com/a"
      },
      {
        game_name: "Magic Sort!",
        genre: "sort_puzzle",
        complexity_tier: "very_easy",
        monetization: ["hybrid", "rewarded_ads", "iap"],
        markets: ["US"],
        creative_hook: "near_fail_then_save",
        source_name: "Sensor Tower",
        source_url: "https://example.com/b"
      }
    ],
    keepTopN: 1
  });

  assert.equal(scaffold.target_countries.length, 2);
  assert.equal(scaffold.signals.length, 1);
  assert.equal(scaffold.signals[0].game_name, "Pizza Ready");
  assert.equal(scaffold.signals[0].observed_at, "2026-04-09");
  assert.equal(scaffold.signals[0].price_change, "unknown");
  assert.equal(scaffold.signals[0].chart_delta, 0);
  assert.ok(Array.isArray(scaffold.update_checklist));
});

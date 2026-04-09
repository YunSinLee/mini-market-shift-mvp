import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCreativePerformanceReview,
  parseCreativePerformanceCsv
} from "../src/analytics/creative-performance-review.mjs";

test("creative performance parser reads csv rows", () => {
  const csv = [
    "date,creative_id,country,platform,impressions,clicks,installs,spend_usd",
    "2026-04-05,creative_01,US,android,10000,500,200,400"
  ].join("\n");

  const rows = parseCreativePerformanceCsv(csv);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].creative_id, "creative_01");
  assert.equal(rows[0].impressions, 10000);
  assert.equal(rows[0].clicks, 500);
  assert.equal(rows[0].installs, 200);
});

test("creative performance review keeps top creatives with guardrail", () => {
  const creativeBatch = {
    generated_at: "2026-04-09T00:00:00.000Z",
    creatives: [
      {
        creative_id: "creative_01",
        target_segment: { country: "US", platform: "android" },
        hypothesis_tags: ["queue_overload_then_upgrade"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      },
      {
        creative_id: "creative_02",
        target_segment: { country: "KR", platform: "android" },
        hypothesis_tags: ["rewarded_value_clarity"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      },
      {
        creative_id: "creative_03",
        target_segment: { country: "US", platform: "android" },
        hypothesis_tags: ["idle_reward"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      }
    ]
  };

  const performanceRows = parseCreativePerformanceCsv(
    [
      "date,creative_id,country,platform,impressions,clicks,installs,spend_usd",
      "2026-04-05,creative_01,US,android,12000,480,220,430",
      "2026-04-05,creative_02,KR,android,11000,520,90,320",
      "2026-04-05,creative_03,US,android,10000,300,160,320"
    ].join("\n")
  );

  const review = buildCreativePerformanceReview({
    creativeBatch,
    performanceRows,
    marketBrief: {
      summary: {
        top_creative_hook: "near_fail_then_save"
      },
      watchlist: [
        { strongest_hook: "before_after_station_speed" },
        { strongest_hook: "simple_loop_high_reward" }
      ]
    },
    topN: 2,
    minImpressions: 1000
  });

  assert.equal(review.summary.kept_creatives, 2);
  assert.equal(review.kept[0].creative_id, "creative_01");
  assert.ok(review.dropped.some((row) => row.creative_id === "creative_02"));
  assert.ok(
    review.dropped.some((row) => row.reasons.includes("cpi_over_guardrail"))
  );
  assert.ok(
    review.dropped[0].replacement.creative_hook,
    "replacement hook should be suggested"
  );
});

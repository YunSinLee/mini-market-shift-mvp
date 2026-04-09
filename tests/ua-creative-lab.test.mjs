import test from "node:test";
import assert from "node:assert/strict";
import { buildUaCreativeBatch } from "../src/analytics/ua-creative-lab.mjs";

test("ua creative batch outputs 5 creative concepts with segment targeting", () => {
  const segmentReport = {
    generated_at: "2026-04-09T00:00:00.000Z",
    segments: [
      {
        segment: { country: "KR", platform: "android" },
        snapshot: { cpi: 2.9 },
        gate_evaluation: {
          gate_1: { passed: false },
          gate_2: { passed: false }
        },
        tuning_recommendation: { severity: "high" }
      },
      {
        segment: { country: "US", platform: "android" },
        snapshot: { cpi: 2.3 },
        gate_evaluation: {
          gate_1: { passed: true },
          gate_2: { passed: false }
        },
        tuning_recommendation: { severity: "medium" }
      }
    ]
  };

  const marketBrief = {
    generated_at: "2026-04-09T01:00:00.000Z",
    scope: { cpi_target_usd: 2.5 },
    summary: {
      top_genre: "idle_tycoon",
      top_creative_hook: "queue_overload_then_upgrade"
    }
  };

  const batch = buildUaCreativeBatch({
    segmentReport,
    marketBrief,
    count: 5
  });

  assert.equal(batch.creatives.length, 5);
  assert.equal(batch.strategy.focus_genre, "idle_tycoon");
  assert.equal(batch.strategy.focus_hook, "queue_overload_then_upgrade");
  assert.equal(batch.creatives[0].target_segment.country, "KR");
  assert.ok(batch.creatives.every((item) => item.hypothesis_tags.length >= 2));
});

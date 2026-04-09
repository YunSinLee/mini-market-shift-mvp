import test from "node:test";
import assert from "node:assert/strict";
import { applyCreativeReview } from "../src/analytics/creative-review-apply.mjs";

test("creative review apply replaces dropped creatives with v2 variants", () => {
  const creativeBatch = {
    generated_at: "2026-04-09T00:00:00.000Z",
    source_references: {},
    experiment_plan: {},
    creatives: [
      {
        creative_id: "creative_01",
        target_segment: { country: "US", platform: "android" },
        angle: "A1",
        format: "short_form_video_9x16",
        first_3_seconds: "A",
        gameplay_script: ["a", "b", "c"],
        monetization_message: "msg",
        cta: "cta",
        hypothesis_tags: ["tag_a"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      },
      {
        creative_id: "creative_02",
        target_segment: { country: "KR", platform: "android" },
        angle: "A2",
        format: "short_form_video_9x16",
        first_3_seconds: "A2",
        gameplay_script: ["a2", "b2", "c2"],
        monetization_message: "msg2",
        cta: "cta2",
        hypothesis_tags: ["tag_b"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      },
      {
        creative_id: "creative_03",
        target_segment: { country: "US", platform: "android" },
        angle: "A3",
        format: "short_form_video_9x16",
        first_3_seconds: "A3",
        gameplay_script: ["a3", "b3", "c3"],
        monetization_message: "msg3",
        cta: "cta3",
        hypothesis_tags: ["tag_c"],
        success_metric: { guardrail_cpi_max_usd: 2.5 }
      }
    ]
  };

  const review = {
    generated_at: "2026-04-09T01:00:00.000Z",
    policy: { keep_top_n: 2 },
    kept: [
      { creative_id: "creative_01" },
      { creative_id: "creative_03" }
    ],
    dropped: [
      {
        creative_id: "creative_02",
        replacement: {
          creative_id: "creative_02_v2",
          target_segment: { country: "KR", platform: "android" },
          angle: "Hook pivot: near_fail_then_save",
          creative_hook: "near_fail_then_save",
          first_3_seconds_suggestion: "Open with pivot hook.",
          monetization_message_suggestion: "Show rewarded value.",
          cta_suggestion: "Play now."
        }
      }
    ]
  };

  const result = applyCreativeReview({
    creativeBatch,
    review
  });

  assert.equal(result.summary.replaced_count, 1);
  assert.equal(result.next_batch.creatives.length, 3);
  const replaced = result.next_batch.creatives.find(
    (item) => item.creative_id === "creative_02_v2"
  );
  assert.ok(replaced);
  assert.equal(replaced.variant_of, "creative_02");
  assert.ok(replaced.hypothesis_tags.includes("near_fail_then_save"));
  assert.ok(Array.isArray(replaced.gameplay_script));
});

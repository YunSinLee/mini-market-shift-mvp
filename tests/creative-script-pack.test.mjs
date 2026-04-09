import test from "node:test";
import assert from "node:assert/strict";
import { buildCreativeScriptPack } from "../src/analytics/creative-script-pack.mjs";

test("creative script pack creates per-duration markdown payloads", () => {
  const creativeBatch = {
    generated_at: "2026-04-09T00:00:00.000Z",
    creatives: [
      {
        creative_id: "creative_01",
        target_segment: {
          country: "KR",
          platform: "android"
        },
        angle: "Bottleneck rescue",
        format: "short_form_video_9x16",
        first_3_seconds: "Queue overload warning.",
        gameplay_script: [
          "Show the bottleneck.",
          "Trigger rewarded upgrade.",
          "Show recovered flow."
        ],
        monetization_message: "Rewarded ad unlocks instant throughput rescue.",
        cta: "Fix the rush now",
        hypothesis_tags: ["queue_overload_then_upgrade", "idle_tycoon"],
        success_metric: {
          primary: "ctr"
        }
      }
    ]
  };

  const pack = buildCreativeScriptPack({
    creativeBatch,
    durations: [15, 30]
  });

  assert.equal(pack.summary.creative_count, 1);
  assert.equal(pack.summary.script_file_count, 2);
  assert.equal(pack.files[0].relative_path, "KR-android/creative_01-15s.md");
  assert.ok(pack.files[0].content.includes("## Scene Plan"));
  assert.ok(pack.files[1].content.includes("00:25-00:30"));
});

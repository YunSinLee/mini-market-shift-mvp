import test from "node:test";
import assert from "node:assert/strict";
import { buildUaPackageExport } from "../src/analytics/ua-package-export.mjs";

test("ua package export builds manifest and csv", () => {
  const creativeBatch = {
    generated_at: "2026-04-09T00:00:00.000Z",
    creatives: [
      {
        creative_id: "creative_01",
        variant_of: null,
        target_segment: { country: "US", platform: "android" },
        angle: "Bottleneck rescue",
        cta: "Fix the rush now",
        hypothesis_tags: ["queue_overload_then_upgrade", "idle_tycoon"]
      },
      {
        creative_id: "creative_02_v2",
        variant_of: "creative_02",
        target_segment: { country: "KR", platform: "android" },
        angle: "Hook pivot: before_after_station_speed",
        cta: "Play now.",
        hypothesis_tags: ["before_after_station_speed", "idle_tycoon"]
      }
    ]
  };

  const scriptIndex = {
    generated_at: "2026-04-09T01:00:00.000Z",
    files: [
      {
        creative_id: "creative_01",
        duration_sec: 15,
        relative_path: "US-android/creative_01-15s.md"
      },
      {
        creative_id: "creative_01",
        duration_sec: 30,
        relative_path: "US-android/creative_01-30s.md"
      },
      {
        creative_id: "creative_02_v2",
        duration_sec: 15,
        relative_path: "KR-android/creative_02_v2-15s.md"
      },
      {
        creative_id: "creative_02_v2",
        duration_sec: 30,
        relative_path: "KR-android/creative_02_v2-30s.md"
      }
    ]
  };

  const pack = buildUaPackageExport({
    creativeBatch,
    scriptIndex,
    packageTag: "ua-package-test",
    adapterConfig: {
      meta_ads: {
        destination_url: {
          by_country: {
            KR: "https://meta.example.kr",
            US: "https://meta.example.us"
          }
        },
        cta: {
          by_country: {
            KR: "지금 플레이",
            US: "Play now"
          }
        }
      },
      tiktok_ads: {
        destination_url: {
          by_country: {
            KR: "https://tt.example.kr",
            US: "https://tt.example.us"
          }
        },
        cta: {
          by_country: {
            KR: "지금 시작",
            US: "Install now"
          }
        }
      }
    },
    includeReview: true,
    includeApply: true
  });

  assert.equal(pack.manifest.package_tag, "ua-package-test");
  assert.equal(pack.manifest.summary.creative_count, 2);
  assert.equal(pack.manifest.summary.segment_count, 2);
  assert.ok(pack.creatives_csv.includes("creative_02_v2"));
  assert.ok(pack.creatives_csv.includes("script_15s"));
  assert.ok(pack.adapters.meta_ads_csv.includes("campaign_name"));
  assert.ok(pack.adapters.meta_ads_csv.includes("creative_02_v2_KR_meta"));
  assert.ok(pack.adapters.meta_ads_csv.includes("https://meta.example.kr"));
  assert.ok(pack.adapters.meta_ads_csv.includes("지금 플레이"));
  assert.ok(pack.adapters.tiktok_ads_csv.includes("adgroup_name"));
  assert.ok(pack.adapters.tiktok_ads_csv.includes("creative_01_US_tt"));
  assert.ok(pack.adapters.tiktok_ads_csv.includes("https://tt.example.us"));
  assert.ok(pack.adapters.tiktok_ads_csv.includes("Install now"));
});

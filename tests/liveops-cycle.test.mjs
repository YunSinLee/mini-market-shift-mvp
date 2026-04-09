import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveopsCommands } from "../src/analytics/liveops-cycle.mjs";

test("liveops cycle uses simulate when no unity smoke input", () => {
  const commands = buildLiveopsCommands({
    uaPath: "docs/ua-summary.example.json",
    uaSegmentsPath: "docs/ua-segments.example.json",
    marketSignalsPath: "docs/market-signals.example.json",
    activateCountry: "KR",
    activatePlatform: "android",
    forceUnsafe: false
  });

  assert.equal(commands[0].label, "build_market_brief");
  assert.equal(commands[1].label, "simulate");
  assert.equal(commands[1].script, "src/cli/simulate.mjs");

  const labels = commands.map((item) => item.label);
  const liveopsLiteIndex = labels.indexOf("build_liveops_lite");
  const segmentIndex = labels.indexOf("build_segment_overrides");
  const creativeIndex = labels.indexOf("build_ua_creative_batch");
  const packageIndex = labels.indexOf("build_ua_package_export");
  assert.ok(liveopsLiteIndex >= 0);
  assert.ok(segmentIndex >= 0);
  assert.ok(creativeIndex > segmentIndex);
  assert.ok(packageIndex > creativeIndex);

  const liveopsLite = commands.find((item) => item.label === "build_liveops_lite");
  assert.ok(liveopsLite.args.includes("--unity-output"));
  assert.ok(
    liveopsLite.args.includes(
      "UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json"
    )
  );
});

test("liveops cycle uses import and force flags when requested", () => {
  const commands = buildLiveopsCommands({
    unitySmokeInput: "artifacts/unity/runtime-smoke-report.json",
    uaPath: "docs/ua-summary.example.json",
    uaSegmentsPath: "docs/ua-segments.example.json",
    marketSignalsPath: "docs/market-signals.example.json",
    activateCountry: "US",
    activatePlatform: "android",
    forceUnsafe: true
  });

  assert.equal(commands[1].label, "import_unity_smoke");
  assert.equal(commands[1].script, "scripts/import-runtime-smoke-report.mjs");
  assert.deepEqual(commands[1].args, [
    "--input",
    "artifacts/unity/runtime-smoke-report.json"
  ]);

  assert.equal(commands[2].label, "validate_unity_smoke_liveops");
  assert.equal(commands[2].script, "scripts/validate-runtime-smoke-liveops.mjs");
  assert.ok(commands[2].args.includes("--strict"));

  const apply = commands.find((item) => item.label === "apply_overrides");
  const bundle = commands.find((item) => item.label === "build_segment_overrides");
  assert.ok(apply.args.includes("--force-unsafe"));
  assert.ok(bundle.args.includes("--force-unsafe"));
});

test("liveops cycle can skip market and creative steps", () => {
  const commands = buildLiveopsCommands({
    skipMarket: true,
    skipCreative: true
  });

  assert.equal(commands[0].label, "simulate");
  assert.ok(!commands.some((item) => item.label === "build_market_brief"));
  assert.ok(!commands.some((item) => item.label === "build_ua_creative_batch"));
  assert.ok(!commands.some((item) => item.label === "build_creative_script_pack"));
  assert.ok(!commands.some((item) => item.label === "build_ua_package_export"));
});

test("liveops cycle can skip creative scripts only", () => {
  const commands = buildLiveopsCommands({
    skipCreativeScripts: true
  });

  assert.ok(commands.some((item) => item.label === "build_ua_creative_batch"));
  assert.ok(!commands.some((item) => item.label === "build_creative_script_pack"));
  assert.ok(!commands.some((item) => item.label === "build_ua_package_export"));
});

test("liveops cycle can include creative performance review", () => {
  const commands = buildLiveopsCommands({
    creativePerformanceCsv: "docs/ua-creative-performance.example.csv",
    creativeTopN: 2,
    creativeMinImpressions: 1000
  });

  const review = commands.find((item) => item.label === "review_creative_performance");
  assert.ok(review);
  assert.equal(review.script, "scripts/review-creative-performance.mjs");
  assert.ok(review.args.includes("--perf-csv"));
  assert.ok(review.args.includes("docs/ua-creative-performance.example.csv"));

  const apply = commands.find((item) => item.label === "apply_creative_review");
  assert.ok(apply);
  assert.equal(apply.script, "scripts/apply-creative-review.mjs");

  const nextScripts = commands.find(
    (item) => item.label === "build_creative_script_pack_next"
  );
  assert.ok(nextScripts);

  const packageExport = commands.find(
    (item) => item.label === "build_ua_package_export"
  );
  assert.ok(packageExport);
  assert.ok(packageExport.args.includes("--batch"));
  assert.ok(packageExport.args.includes("artifacts/ua/creative-batch.next.json"));
  assert.ok(packageExport.args.includes("--adapter-config"));
  assert.ok(packageExport.args.includes("config/ua-adapters.default.json"));
});

test("liveops cycle can skip creative apply even with review input", () => {
  const commands = buildLiveopsCommands({
    creativePerformanceCsv: "docs/ua-creative-performance.example.csv",
    skipCreativeApply: true
  });

  assert.ok(commands.some((item) => item.label === "review_creative_performance"));
  assert.ok(!commands.some((item) => item.label === "apply_creative_review"));
  assert.ok(!commands.some((item) => item.label === "build_creative_script_pack_next"));

  const packageExport = commands.find(
    (item) => item.label === "build_ua_package_export"
  );
  assert.ok(packageExport);
  assert.ok(packageExport.args.includes("artifacts/ua/creative-batch.json"));
});

test("liveops cycle can skip ua package", () => {
  const commands = buildLiveopsCommands({
    skipUaPackage: true
  });

  assert.ok(!commands.some((item) => item.label === "build_ua_package_export"));
});

test("liveops cycle can skip liveops lite plan build", () => {
  const commands = buildLiveopsCommands({
    skipLiveopsLite: true
  });

  assert.ok(!commands.some((item) => item.label === "build_liveops_lite"));
});

test("liveops cycle can skip unity smoke liveops check", () => {
  const commands = buildLiveopsCommands({
    unitySmokeInput: "artifacts/unity/runtime-smoke-report.json",
    skipUnityLiveopsCheck: true
  });

  assert.ok(!commands.some((item) => item.label === "validate_unity_smoke_liveops"));
});

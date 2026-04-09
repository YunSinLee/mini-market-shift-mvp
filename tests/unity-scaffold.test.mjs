import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const requiredEventNames = [
  "session_start",
  "session_end",
  "level_start",
  "level_complete",
  "upgrade_purchase",
  "ad_offer_shown",
  "ad_reward_granted",
  "iap_offer_view",
  "iap_purchase"
];

const requiredRemoteKeys = [
  "economy_multiplier",
  "ad_cooldown_sec",
  "rewarded_ad_multiplier",
  "iap_price_tier",
  "difficulty_curve_id"
];

test("unity telemetry contract includes all required events", async () => {
  const content = await readFile(
    "UnityProject/Assets/Scripts/Core/TelemetryContract.cs",
    "utf8"
  );

  for (const eventName of requiredEventNames) {
    assert.ok(
      content.includes(`\"${eventName}\"`),
      `Missing telemetry event in Unity contract: ${eventName}`
    );
  }
});

test("unity data models include required remote config keys", async () => {
  const content = await readFile(
    "UnityProject/Assets/Scripts/Core/GameModels.cs",
    "utf8"
  );

  for (const key of requiredRemoteKeys) {
    assert.ok(
      content.includes(key),
      `Missing remote config key in Unity model: ${key}`
    );
  }
});

test("unity runtime smoke and editor setup scaffolds exist", async () => {
  const smokeContent = await readFile(
    "UnityProject/Assets/Scripts/Runtime/RuntimeSmokeRunner.cs",
    "utf8"
  );
  assert.ok(smokeContent.includes("RunSmoke"), "RuntimeSmokeRunner should include RunSmoke");
  assert.ok(
    smokeContent.includes("writeReportToPersistentData"),
    "RuntimeSmokeRunner should include persistent JSON report toggle"
  );
  assert.ok(
    smokeContent.includes("runtime-smoke-report.json"),
    "RuntimeSmokeRunner should include default smoke report filename"
  );

  const menuContent = await readFile(
    "UnityProject/Assets/Scripts/Editor/MvpSceneSetupMenu.cs",
    "utf8"
  );
  assert.ok(
    menuContent.includes("Tools/Mini Market Shift/Setup MVP Scene"),
    "Scene setup menu path should exist"
  );
});

test("unity bootstrap includes liveops lite runtime wiring", async () => {
  const bootstrapContent = await readFile(
    "UnityProject/Assets/Scripts/Runtime/GameBootstrap.cs",
    "utf8"
  );
  assert.ok(
    bootstrapContent.includes("applyLiveOpsLiteFromStreamingAssets"),
    "GameBootstrap should expose liveops lite toggle"
  );
  assert.ok(
    bootstrapContent.includes("liveops-lite-plan.json"),
    "GameBootstrap should look for liveops-lite-plan.json in StreamingAssets"
  );

  const serviceContent = await readFile(
    "UnityProject/Assets/Scripts/Integrations/StreamingAssetLiveOpsLiteService.cs",
    "utf8"
  );
  assert.ok(
    serviceContent.includes("TryApply"),
    "StreamingAssetLiveOpsLiteService should expose TryApply"
  );
  assert.ok(
    serviceContent.includes("PickActiveEvents"),
    "StreamingAssetLiveOpsLiteService should select active weekly events"
  );
});

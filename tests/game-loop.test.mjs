import test from "node:test";
import assert from "node:assert/strict";
import { createTestEngine } from "./helpers.mjs";

test("core loop generates coins and serves customers", async () => {
  const { engine } = await createTestEngine();

  engine.startSession();
  for (let i = 0; i < 120; i += 1) {
    engine.tick(1);
  }
  const summary = engine.endSession();

  assert.ok(summary.served_customers > 0);
  assert.ok(summary.total_coins > 0);
});

test("rewarded ad cooldown and reward grant work", async () => {
  const { engine, telemetry } = await createTestEngine();

  engine.startSession();
  engine.tick(10);
  const first = engine.offerRewardedAd("double_income_30s");
  const second = engine.offerRewardedAd("double_income_30s");
  engine.endSession();

  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  assert.ok(telemetry.countByEvent("ad_reward_granted") >= 1);
});

test("upgrade and iap flow update economy state", async () => {
  const { engine, gameData, telemetry } = await createTestEngine();

  engine.startSession();
  engine.tick(180);
  engine.purchaseIap("starter_bundle");

  const firstUpgrade = gameData.upgrades[0];
  const purchased = engine.purchaseUpgrade(firstUpgrade.id);

  engine.endSession();

  assert.equal(purchased.ok, true);
  assert.ok(engine.state.purchasedUpgradeIds.has(firstUpgrade.id));
  assert.ok(engine.state.coins >= 0);
  assert.ok(telemetry.countByEvent("iap_purchase") >= 1);
  assert.ok(telemetry.countByEvent("upgrade_purchase") >= 1);
});

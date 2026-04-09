import test from "node:test";
import assert from "node:assert/strict";
import { loadGameData } from "../src/domain/data-loader.mjs";

test("config contract is complete and matches MVP scope", async () => {
  const data = await loadGameData();

  assert.equal(data.stations.length, 3);
  assert.equal(data.upgrades.length, 20);
  assert.equal(data.difficultyCurve.length, 30);
  assert.equal(data.dailyMissions.length, 3);
  assert.equal(data.iapProducts.length, 3);

  assert.ok(Object.hasOwn(data.remoteConfig, "economy_multiplier"));
  assert.ok(Object.hasOwn(data.abFlags, "ab_ad_frequency"));
});

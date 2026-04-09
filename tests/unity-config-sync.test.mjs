import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const files = [
  "ab-flags.default.json",
  "daily-missions.json",
  "difficulty-curve.json",
  "iap-products.json",
  "remote-config.default.json",
  "stations.json",
  "upgrades.json"
];

test("unity streaming assets config is synced from root config", async () => {
  for (const file of files) {
    const rootContent = await readFile(`config/${file}`, "utf8");
    const unityContent = await readFile(
      `UnityProject/Assets/StreamingAssets/mvp-config/${file}`,
      "utf8"
    );

    assert.equal(
      unityContent,
      rootContent,
      `Unity config file mismatch: ${file}`
    );
  }
});

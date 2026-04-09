import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";

const files = [
  "ab-flags.default.json",
  "daily-missions.json",
  "difficulty-curve.json",
  "iap-products.json",
  "remote-config.default.json",
  "stations.json",
  "upgrades.json"
];

const root = process.cwd();
const srcDir = path.join(root, "config");
const dstDir = path.join(root, "UnityProject", "Assets", "StreamingAssets", "mvp-config");

await mkdir(dstDir, { recursive: true });

for (const file of files) {
  await copyFile(path.join(srcDir, file), path.join(dstDir, file));
  console.log(`synced: ${file}`);
}

console.log("Unity StreamingAssets config sync complete.");

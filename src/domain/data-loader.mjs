import { readFile } from "node:fs/promises";
import path from "node:path";
import { validateGameData } from "../config/validate.mjs";

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

export async function loadGameData(baseDir = process.cwd()) {
  const configDir = path.resolve(baseDir, "config");

  const data = {
    remoteConfig: await readJson(path.join(configDir, "remote-config.default.json")),
    abFlags: await readJson(path.join(configDir, "ab-flags.default.json")),
    stations: await readJson(path.join(configDir, "stations.json")),
    upgrades: await readJson(path.join(configDir, "upgrades.json")),
    difficultyCurve: await readJson(path.join(configDir, "difficulty-curve.json")),
    dailyMissions: await readJson(path.join(configDir, "daily-missions.json")),
    iapProducts: await readJson(path.join(configDir, "iap-products.json"))
  };

  validateGameData(data);
  return data;
}

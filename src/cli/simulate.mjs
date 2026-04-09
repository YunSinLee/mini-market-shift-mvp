import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadGameData } from "../domain/data-loader.mjs";
import { GameEngine } from "../domain/game-engine.mjs";
import { TelemetryRecorder } from "../services/telemetry.mjs";

function parseArgs(argv) {
  let outDir = "artifacts/sim/latest";
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--out-dir" && argv[i + 1]) {
      outDir = argv[i + 1];
      i += 1;
    }
  }
  return { outDir };
}

function findFirstAffordableUpgrade(engine, upgrades) {
  return upgrades.find(
    (upgrade) =>
      !engine.state.purchasedUpgradeIds.has(upgrade.id) && engine.state.coins >= upgrade.cost
  );
}

function printEventBreakdown(records) {
  const byEvent = new Map();
  for (const record of records) {
    byEvent.set(record.event_name, (byEvent.get(record.event_name) ?? 0) + 1);
  }

  const sorted = [...byEvent.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  for (const [name, count] of sorted) {
    console.log(`- ${name}: ${count}`);
  }
}

const { outDir } = parseArgs(process.argv.slice(2));
const gameData = await loadGameData();
const telemetry = new TelemetryRecorder({
  user_id: "sim-user-kr-001",
  country: "KR",
  platform: "android",
  build_version: "0.1.0"
});

const engine = new GameEngine(gameData, telemetry);

engine.startSession();
for (let second = 1; second <= 240; second += 1) {
  engine.tick(1);

  if (second === 30) {
    engine.offerRewardedAd("double_income_30s");
  }
  if (second === 95) {
    engine.offerRewardedAd("instant_upgrade");
  }
  if (second === 170) {
    engine.offerRewardedAd("failure_recovery");
  }

  if (second % 40 === 0) {
    const affordable = findFirstAffordableUpgrade(engine, gameData.upgrades);
    if (affordable) {
      engine.purchaseUpgrade(affordable.id);
    }
  }
}

engine.viewIapOffer("starter_bundle");
engine.purchaseIap("starter_bundle");

for (const mission of engine.getDailyMissionStatus()) {
  engine.claimMission(mission.id);
}

const summary = engine.endSession();
const missionStatus = engine.getDailyMissionStatus();

console.log("Mini Market Shift simulation complete.");
console.log(JSON.stringify(summary, null, 2));
console.log("\nDaily missions:");
console.log(JSON.stringify(missionStatus, null, 2));
console.log("\nTelemetry event breakdown:");
printEventBreakdown(telemetry.records);

const resolvedOutDir = path.resolve(process.cwd(), outDir);
await mkdir(resolvedOutDir, { recursive: true });

const telemetryNdjson = telemetry.records
  .map((record) => JSON.stringify(record))
  .join("\n");

await Promise.all([
  writeFile(
    path.join(resolvedOutDir, "summary.json"),
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(resolvedOutDir, "missions.json"),
    `${JSON.stringify(missionStatus, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(resolvedOutDir, "telemetry.ndjson"),
    telemetryNdjson ? `${telemetryNdjson}\n` : "",
    "utf8"
  )
]);

console.log(`\nartifacts_written: ${resolvedOutDir}`);

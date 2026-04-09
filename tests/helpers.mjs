import { loadGameData } from "../src/domain/data-loader.mjs";
import { GameEngine } from "../src/domain/game-engine.mjs";
import { TelemetryRecorder } from "../src/services/telemetry.mjs";

export async function createTestEngine(overrides = {}) {
  const gameData = await loadGameData();
  const telemetry = new TelemetryRecorder({
    user_id: "test-user",
    country: "US",
    platform: "android",
    build_version: "test-build",
    ...overrides
  });

  const engine = new GameEngine(gameData, telemetry);
  return { gameData, telemetry, engine };
}

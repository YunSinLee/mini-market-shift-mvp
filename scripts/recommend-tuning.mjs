import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTuningRecommendation } from "../src/analytics/tuning-recommendation.mjs";

function parseArgs(argv) {
  let snapshotPath = "artifacts/launch/kpi-snapshot.generated.json";
  let gatePath = "artifacts/launch/gate-evaluation.json";
  let telemetryReportPath = "artifacts/sim/latest/telemetry-report.json";
  let outputPath = "artifacts/launch/tuning-recommendation.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--snapshot" && argv[i + 1]) {
      snapshotPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--gate" && argv[i + 1]) {
      gatePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--telemetry" && argv[i + 1]) {
      telemetryReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
    }
  }

  return {
    snapshotPath,
    gatePath,
    telemetryReportPath,
    outputPath
  };
}

async function tryReadJson(filePath) {
  try {
    const raw = await readFile(path.resolve(process.cwd(), filePath), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function printSummary(recommendation) {
  console.log("Tuning recommendation build complete.");
  console.log(`- severity: ${recommendation.severity}`);
  console.log(`- risks: ${recommendation.risks.length}`);
  console.log(`- actions: ${recommendation.actions.length}`);
  if (recommendation.actions.length > 0) {
    const top = recommendation.actions[0];
    console.log(`- top_action: [${top.area}] ${top.trigger}`);
  }
}

const { snapshotPath, gatePath, telemetryReportPath, outputPath } = parseArgs(
  process.argv.slice(2)
);

const [snapshot, gateEvaluation, telemetryReport] = await Promise.all([
  tryReadJson(snapshotPath),
  tryReadJson(gatePath),
  tryReadJson(telemetryReportPath)
]);

if (!snapshot || !gateEvaluation) {
  throw new Error(
    "snapshot and gate evaluation files are required. Run build:kpi-snapshot and evaluate:gates first."
  );
}

const recommendation = buildTuningRecommendation({
  snapshot,
  gateEvaluation,
  telemetryReport
});

const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(
  resolvedOutputPath,
  `${JSON.stringify(recommendation, null, 2)}\n`,
  "utf8"
);

printSummary(recommendation);
console.log(`report_written: ${resolvedOutputPath}`);

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { evaluateBusinessGates } from "../src/analytics/business-gates.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/launch/kpi-snapshot.json";
  let outputPath = "artifacts/launch/gate-evaluation.json";
  let targetPath = "config/kpi-targets.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--targets" && argv[i + 1]) {
      targetPath = argv[i + 1];
      i += 1;
    }
  }

  return { inputPath, outputPath, targetPath };
}

function printGateSummary(result) {
  const gate1 = result.gate_1;
  const gate2 = result.gate_2;

  console.log("Launch gate evaluation complete.");
  console.log(
    `- Gate1 eligible/passed: ${gate1.eligible}/${gate1.passed} (min installs: ${gate1.min_installs_required})`
  );
  console.log(
    `- Gate2 eligible/passed: ${gate2.eligible}/${gate2.passed} (min installs: ${gate2.min_installs_required})`
  );
  console.log(`- recommended_action: ${result.recommended_action}`);
}

function printDataQualityHints(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return;
  }

  const flags = snapshot.data_quality_flags ?? {};
  const needsWindow = flags.retention_window_lt_7_days || snapshot.d7_retention == null;
  const mismatch = flags.installs_mismatch_gt_20_percent;

  if (needsWindow) {
    console.log(
      "- warning: retention window is shorter than 7 days; D7 gate should be treated as provisional."
    );
  }

  if (mismatch) {
    console.log(
      "- warning: installs source mismatch is high (>20%); verify UA installs and telemetry cohort alignment."
    );
  }
}

const { inputPath, outputPath, targetPath } = parseArgs(process.argv.slice(2));

const [snapshotRaw, targetsRaw] = await Promise.all([
  readFile(path.resolve(process.cwd(), inputPath), "utf8"),
  readFile(path.resolve(process.cwd(), targetPath), "utf8")
]);

const snapshot = JSON.parse(snapshotRaw);
const targets = JSON.parse(targetsRaw);

const result = evaluateBusinessGates(snapshot, targets);

const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");

printGateSummary(result);
printDataQualityHints(snapshot);
console.log(`report_written: ${resolvedOutputPath}`);

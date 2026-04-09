import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildTelemetryReport } from "../src/analytics/telemetry-report.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/sim/latest/telemetry.ndjson";
  let outputPath = "artifacts/sim/latest/telemetry-report.json";

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
    }
  }

  return { inputPath, outputPath };
}

function parseTelemetry(raw) {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);
    return Array.isArray(parsed) ? parsed : [];
  }

  return trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function printSummary(report) {
  console.log("Telemetry analysis complete.");
  console.log(`- total_events: ${report.total_events}`);
  console.log(`- total_sessions: ${report.total_sessions}`);
  console.log(`- missing_common_field_rate: ${report.missing_common_field_rate}`);
  console.log(`- rewarded_ad_participation_rate: ${report.rewarded_ad_participation_rate}`);
  console.log(`- payer_conversion_rate: ${report.payer_conversion_rate}`);
  console.log(
    `- country_segments: ${Object.keys(report.segmentation.countries).join(", ") || "none"}`
  );
  console.log(
    `- platform_segments: ${Object.keys(report.segmentation.platforms).join(", ") || "none"}`
  );
}

const { inputPath, outputPath } = parseArgs(process.argv.slice(2));

const raw = await readFile(path.resolve(process.cwd(), inputPath), "utf8");
const records = parseTelemetry(raw);
const report = buildTelemetryReport(records);

const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

printSummary(report);
console.log(`report_written: ${resolvedOutputPath}`);

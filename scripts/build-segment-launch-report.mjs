import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSegmentLaunchReport } from "../src/analytics/segment-launch-report.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/sim/latest/telemetry.ndjson";
  let segmentsPath = "docs/ua-segments.example.json";
  let targetsPath = "config/kpi-targets.json";
  let outputPath = "artifacts/launch/segment-launch-report.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--segments" && argv[i + 1]) {
      segmentsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--targets" && argv[i + 1]) {
      targetsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
    }
  }

  return { inputPath, segmentsPath, targetsPath, outputPath };
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

function normalizeSegments(config) {
  const segments = Array.isArray(config?.segments) ? config.segments : [];
  return segments
    .filter((segment) => segment?.country && segment?.platform)
    .map((segment) => ({
      country: segment.country,
      platform: segment.platform,
      ad_spend_usd:
        typeof segment.ad_spend_usd === "number" ? segment.ad_spend_usd : undefined,
      installs: typeof segment.installs === "number" ? segment.installs : undefined
    }));
}

function printSummary(report) {
  console.log("Segment launch report build complete.");
  console.log(`- total_segments: ${report.summary.total_segments}`);
  console.log(`- gate1_passed_segments: ${report.summary.gate1_passed_segments}`);
  console.log(`- gate2_passed_segments: ${report.summary.gate2_passed_segments}`);

  for (const row of report.segments) {
    const key = `${row.segment.country}/${row.segment.platform}`;
    const gate1 = row.gate_evaluation.gate_1.passed ? "pass" : "fail";
    const gate2 = row.gate_evaluation.gate_2.passed ? "pass" : "fail";
    console.log(`- ${key}: gate1=${gate1}, gate2=${gate2}, severity=${row.tuning_recommendation.severity}`);
  }
}

const { inputPath, segmentsPath, targetsPath, outputPath } = parseArgs(
  process.argv.slice(2)
);

const [telemetryRaw, segmentsRaw, targetsRaw] = await Promise.all([
  readFile(path.resolve(process.cwd(), inputPath), "utf8"),
  readFile(path.resolve(process.cwd(), segmentsPath), "utf8"),
  readFile(path.resolve(process.cwd(), targetsPath), "utf8")
]);

const records = parseTelemetry(telemetryRaw);
const segments = normalizeSegments(JSON.parse(segmentsRaw));
if (segments.length === 0) {
  throw new Error("no valid segments found. Provide segments with country and platform.");
}

const targets = JSON.parse(targetsRaw);
const report = buildSegmentLaunchReport({
  records,
  targets,
  segments
});

const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

printSummary(report);
console.log(`report_written: ${resolvedOutputPath}`);

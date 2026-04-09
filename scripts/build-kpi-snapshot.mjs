import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildKpiSnapshot } from "../src/analytics/kpi-snapshot.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/sim/latest/telemetry.ndjson";
  let outputPath = "artifacts/launch/kpi-snapshot.generated.json";
  let uaPath = null;
  let country = null;
  let platform = null;

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

    if (arg === "--ua" && argv[i + 1]) {
      uaPath = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--country" && argv[i + 1]) {
      country = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === "--platform" && argv[i + 1]) {
      platform = argv[i + 1];
      i += 1;
    }
  }

  return {
    inputPath,
    outputPath,
    uaPath,
    country,
    platform
  };
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

async function tryReadUaSummary(uaPath) {
  if (!uaPath) {
    return {};
  }

  const raw = await readFile(path.resolve(process.cwd(), uaPath), "utf8");
  const parsed = JSON.parse(raw);
  return {
    ad_spend_usd:
      typeof parsed.ad_spend_usd === "number" ? parsed.ad_spend_usd : undefined,
    installs_override:
      typeof parsed.installs === "number" ? parsed.installs : undefined
  };
}

function printSummary(snapshot) {
  console.log("KPI snapshot build complete.");
  console.log(`- installs: ${snapshot.installs}`);
  console.log(`- installs_source: ${snapshot.installs_source}`);
  console.log(`- telemetry_install_users: ${snapshot.telemetry_install_users}`);
  console.log(`- active_users: ${snapshot.active_users}`);
  console.log(`- d1_retention: ${snapshot.d1_retention}`);
  console.log(`- d3_retention: ${snapshot.d3_retention}`);
  console.log(`- d7_retention: ${snapshot.d7_retention}`);
  console.log(`- rewarded_ad_participation: ${snapshot.rewarded_ad_participation}`);
  console.log(`- payer_conversion: ${snapshot.payer_conversion}`);
  console.log(`- cpi: ${snapshot.cpi}`);
  console.log(
    `- quality_flags: ${JSON.stringify(snapshot.data_quality_flags)}`
  );
}

const { inputPath, outputPath, uaPath, country, platform } = parseArgs(
  process.argv.slice(2)
);

const [telemetryRaw, uaOptions] = await Promise.all([
  readFile(path.resolve(process.cwd(), inputPath), "utf8"),
  tryReadUaSummary(uaPath)
]);

const records = parseTelemetry(telemetryRaw);

const snapshot = buildKpiSnapshot(records, {
  ...uaOptions,
  country,
  platform
});

const resolvedOutputPath = path.resolve(process.cwd(), outputPath);
await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

printSummary(snapshot);
console.log(`report_written: ${resolvedOutputPath}`);

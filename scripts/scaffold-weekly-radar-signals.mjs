import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildWeeklyRadarSignalScaffold } from "../src/analytics/weekly-radar-scaffold.mjs";

function todayUtcString() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTargetCountries(value) {
  if (typeof value !== "string" || !value.trim()) {
    return ["KR", "US"];
  }
  return value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);
}

function parseArgs(argv) {
  let fromPath = "docs/market-signals.example.json";
  const observedDate = todayUtcString();
  let date = observedDate;
  let outputPath = `artifacts/market/live-signals.${observedDate}.json`;
  let keepTop = 8;
  let cpiTarget = 2.5;
  let countries = ["KR", "US"];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--from" && argv[i + 1]) {
      fromPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--date" && argv[i + 1]) {
      date = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--top" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        keepTop = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--cpi-target" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        cpiTarget = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--countries" && argv[i + 1]) {
      countries = parseTargetCountries(argv[i + 1]);
      i += 1;
    }
  }

  return {
    fromPath,
    date,
    outputPath,
    keepTop,
    cpiTarget,
    countries
  };
}

function extractSignals(input) {
  if (Array.isArray(input?.signals)) {
    return input.signals;
  }
  return [];
}

function printSummary(outputPath, scaffold) {
  console.log("Weekly radar scaffold build complete.");
  console.log(`- week_label: ${scaffold.week_label}`);
  console.log(`- target_countries: ${scaffold.target_countries.join(",")}`);
  console.log(`- kept_signals: ${scaffold.signals.length}`);
  console.log(`scaffold_written: ${outputPath}`);
}

const args = parseArgs(process.argv.slice(2));
const resolvedFrom = path.resolve(process.cwd(), args.fromPath);
const resolvedOutput = path.resolve(process.cwd(), args.outputPath);

const sourceRaw = await readFile(resolvedFrom, "utf8");
const sourceJson = JSON.parse(sourceRaw);
const sourceSignals = extractSignals(sourceJson);

const scaffold = buildWeeklyRadarSignalScaffold({
  observedDate: args.date,
  targetCountries: args.countries,
  cpiTargetUsd: args.cpiTarget,
  sourceSignals,
  keepTopN: args.keepTop
});

await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify(scaffold, null, 2)}\n`, "utf8");

printSummary(resolvedOutput, scaffold);

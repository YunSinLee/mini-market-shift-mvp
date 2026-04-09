import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildMarketRadarBrief } from "../src/analytics/market-radar-brief.mjs";

function parseArgs(argv) {
  let inputPath = "docs/market-signals.example.json";
  let outputPath = "artifacts/market/weekly-brief.json";
  let weekLabel = null;
  let topN = 5;
  let cpiTarget = null;

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
    if (arg === "--week" && argv[i + 1]) {
      weekLabel = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--top" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        topN = parsed;
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
    }
  }

  return {
    inputPath,
    outputPath,
    weekLabel,
    topN,
    cpiTarget
  };
}

function normalizeSignalsInput(parsed) {
  const targetCountries = Array.isArray(parsed?.target_countries)
    ? parsed.target_countries.filter((item) => typeof item === "string")
    : ["KR", "US"];

  return {
    weekLabel: parsed?.week_label ?? null,
    targetCountries,
    cpiTarget:
      typeof parsed?.cpi_target_usd === "number" ? parsed.cpi_target_usd : null,
    signals: Array.isArray(parsed?.signals) ? parsed.signals : []
  };
}

function printSummary(brief, outputPath) {
  console.log("Market radar brief build complete.");
  console.log(`- week_label: ${brief.week_label ?? "n/a"}`);
  console.log(`- signals: ${brief.scope.signal_count}`);
  console.log(`- top_genre: ${brief.summary.top_genre}`);
  console.log(`- top_hook: ${brief.summary.top_creative_hook}`);
  console.log(`- watchlist_count: ${brief.watchlist.length}`);
  console.log(`brief_written: ${outputPath}`);
}

const args = parseArgs(process.argv.slice(2));
const resolvedInput = path.resolve(process.cwd(), args.inputPath);
const resolvedOutput = path.resolve(process.cwd(), args.outputPath);

const raw = await readFile(resolvedInput, "utf8");
const parsed = normalizeSignalsInput(JSON.parse(raw));

const brief = buildMarketRadarBrief({
  signals: parsed.signals,
  weekLabel: args.weekLabel ?? parsed.weekLabel,
  targetCountries: parsed.targetCountries,
  cpiTarget: args.cpiTarget ?? parsed.cpiTarget ?? 2.5,
  topN: args.topN
});

await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify(brief, null, 2)}\n`, "utf8");

printSummary(brief, resolvedOutput);

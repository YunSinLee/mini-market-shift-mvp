import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildUaCreativeBatch } from "../src/analytics/ua-creative-lab.mjs";

function parseArgs(argv) {
  let segmentReportPath = "artifacts/launch/segment-launch-report.json";
  let marketBriefPath = "artifacts/market/weekly-brief.json";
  let outputPath = "artifacts/ua/creative-batch.json";
  let count = 5;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--segment-report" && argv[i + 1]) {
      segmentReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--market-brief" && argv[i + 1]) {
      marketBriefPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--count" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        count = parsed;
      }
      i += 1;
    }
  }

  return {
    segmentReportPath,
    marketBriefPath,
    outputPath,
    count
  };
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function printSummary(batch, outputPath) {
  console.log("UA creative batch build complete.");
  console.log(`- focus_genre: ${batch.strategy.focus_genre}`);
  console.log(`- focus_hook: ${batch.strategy.focus_hook}`);
  console.log(`- creative_count: ${batch.creatives.length}`);
  for (const creative of batch.creatives) {
    const segment = `${creative.target_segment.country}/${creative.target_segment.platform}`;
    console.log(`- ${creative.creative_id}: ${creative.angle} -> ${segment}`);
  }
  console.log(`creative_batch_written: ${outputPath}`);
}

const args = parseArgs(process.argv.slice(2));
const resolvedSegmentPath = path.resolve(process.cwd(), args.segmentReportPath);
const resolvedMarketPath = path.resolve(process.cwd(), args.marketBriefPath);
const resolvedOutputPath = path.resolve(process.cwd(), args.outputPath);

const segmentReport = await readJson(resolvedSegmentPath);
let marketBrief = null;
try {
  marketBrief = await readJson(resolvedMarketPath);
} catch {
  marketBrief = null;
}

const batch = buildUaCreativeBatch({
  segmentReport,
  marketBrief,
  count: args.count
});

await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(batch, null, 2)}\n`, "utf8");

printSummary(batch, resolvedOutputPath);

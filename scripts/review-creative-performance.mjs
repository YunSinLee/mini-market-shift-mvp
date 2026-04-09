import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildCreativePerformanceReview,
  parseCreativePerformanceCsv
} from "../src/analytics/creative-performance-review.mjs";

function parseArgs(argv) {
  let batchPath = "artifacts/ua/creative-batch.json";
  let perfCsvPath = "docs/ua-creative-performance.example.csv";
  let marketBriefPath = "artifacts/market/weekly-brief.json";
  let outputPath = "artifacts/ua/creative-performance-review.json";
  let topN = 2;
  let minImpressions = 1000;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--batch" && argv[i + 1]) {
      batchPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--perf-csv" && argv[i + 1]) {
      perfCsvPath = argv[i + 1];
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
    if (arg === "--top" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        topN = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--min-impressions" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        minImpressions = parsed;
      }
      i += 1;
    }
  }

  return {
    batchPath,
    perfCsvPath,
    marketBriefPath,
    outputPath,
    topN,
    minImpressions
  };
}

function printSummary(review, outputPath) {
  console.log("Creative performance review complete.");
  console.log(`- evaluated: ${review.summary.evaluated_creatives}`);
  console.log(`- kept: ${review.summary.kept_creatives}`);
  console.log(`- dropped: ${review.summary.dropped_creatives}`);
  const top = review.kept[0];
  if (top) {
    console.log(`- top_creative: ${top.creative_id} (ctr=${top.ctr}, cpi=${top.cpi})`);
  }
  console.log(`review_written: ${outputPath}`);
}

const args = parseArgs(process.argv.slice(2));
const resolvedBatchPath = path.resolve(process.cwd(), args.batchPath);
const resolvedPerfPath = path.resolve(process.cwd(), args.perfCsvPath);
const resolvedMarketBriefPath = path.resolve(process.cwd(), args.marketBriefPath);
const resolvedOutputPath = path.resolve(process.cwd(), args.outputPath);

const [batchRaw, perfRaw] = await Promise.all([
  readFile(resolvedBatchPath, "utf8"),
  readFile(resolvedPerfPath, "utf8")
]);

let marketBrief = null;
try {
  const marketRaw = await readFile(resolvedMarketBriefPath, "utf8");
  marketBrief = JSON.parse(marketRaw);
} catch {
  marketBrief = null;
}

const creativeBatch = JSON.parse(batchRaw);
const performanceRows = parseCreativePerformanceCsv(perfRaw);

const review = buildCreativePerformanceReview({
  creativeBatch,
  performanceRows,
  marketBrief,
  topN: args.topN,
  minImpressions: args.minImpressions
});

await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
await writeFile(resolvedOutputPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");

printSummary(review, resolvedOutputPath);

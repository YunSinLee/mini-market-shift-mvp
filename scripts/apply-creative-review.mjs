import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { applyCreativeReview } from "../src/analytics/creative-review-apply.mjs";

function parseArgs(argv) {
  let batchPath = "artifacts/ua/creative-batch.json";
  let reviewPath = "artifacts/ua/creative-performance-review.json";
  let outputBatchPath = "artifacts/ua/creative-batch.next.json";
  let outputApplyPath = "artifacts/ua/creative-review-apply.json";
  let topN = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--batch" && argv[i + 1]) {
      batchPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--review" && argv[i + 1]) {
      reviewPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-batch" && argv[i + 1]) {
      outputBatchPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-apply" && argv[i + 1]) {
      outputApplyPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--top" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        topN = parsed;
      }
      i += 1;
    }
  }

  return {
    batchPath,
    reviewPath,
    outputBatchPath,
    outputApplyPath,
    topN
  };
}

function printSummary(result, batchPath, applyPath) {
  console.log("Creative review apply complete.");
  console.log(`- original: ${result.summary.original_creative_count}`);
  console.log(`- next: ${result.summary.next_creative_count}`);
  console.log(`- replaced: ${result.summary.replaced_count}`);
  if (result.changes.length > 0) {
    const first = result.changes[0];
    console.log(`- first_replacement: ${first.replaced_creative_id} -> ${first.next_creative_id}`);
  }
  console.log(`next_batch_written: ${batchPath}`);
  console.log(`apply_report_written: ${applyPath}`);
}

const args = parseArgs(process.argv.slice(2));

const resolvedBatchPath = path.resolve(process.cwd(), args.batchPath);
const resolvedReviewPath = path.resolve(process.cwd(), args.reviewPath);
const resolvedOutputBatchPath = path.resolve(process.cwd(), args.outputBatchPath);
const resolvedOutputApplyPath = path.resolve(process.cwd(), args.outputApplyPath);

const [batchRaw, reviewRaw] = await Promise.all([
  readFile(resolvedBatchPath, "utf8"),
  readFile(resolvedReviewPath, "utf8")
]);

const creativeBatch = JSON.parse(batchRaw);
const review = JSON.parse(reviewRaw);

const result = applyCreativeReview({
  creativeBatch,
  review,
  applyTopN: args.topN
});

await mkdir(path.dirname(resolvedOutputBatchPath), { recursive: true });
await mkdir(path.dirname(resolvedOutputApplyPath), { recursive: true });

await writeFile(
  resolvedOutputBatchPath,
  `${JSON.stringify(result.next_batch, null, 2)}\n`,
  "utf8"
);
await writeFile(
  resolvedOutputApplyPath,
  `${JSON.stringify(
    {
      generated_at: result.generated_at,
      summary: result.summary,
      changes: result.changes
    },
    null,
    2
  )}\n`,
  "utf8"
);

printSummary(result, resolvedOutputBatchPath, resolvedOutputApplyPath);

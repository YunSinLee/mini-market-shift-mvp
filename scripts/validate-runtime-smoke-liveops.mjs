import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildRuntimeSmokeLiveopsCheck } from "../src/analytics/runtime-smoke-liveops-check.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/unity/runtime-smoke-report.json";
  let outputPath = "artifacts/unity/runtime-smoke-liveops-check.json";
  let strict = true;
  let maxAgeDays = null;

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
    if (arg === "--no-strict") {
      strict = false;
      continue;
    }
    if (arg === "--strict") {
      strict = true;
      continue;
    }
    if (arg === "--max-age-days" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        maxAgeDays = parsed;
      }
      i += 1;
    }
  }

  return {
    inputPath,
    outputPath,
    strict,
    maxAgeDays
  };
}

const args = parseArgs(process.argv.slice(2));
const cwd = process.cwd();
const resolvedInput = path.resolve(cwd, args.inputPath);
const resolvedOutput = path.resolve(cwd, args.outputPath);

const raw = await readFile(resolvedInput, "utf8");
const report = JSON.parse(raw);
const check = buildRuntimeSmokeLiveopsCheck(report, {
  strict: args.strict,
  maxAgeDays: args.maxAgeDays
});

await mkdir(path.dirname(resolvedOutput), { recursive: true });
await writeFile(resolvedOutput, `${JSON.stringify(check, null, 2)}\n`, "utf8");

console.log("Runtime smoke liveops check complete.");
console.log(`- strict: ${check.strict}`);
console.log(`- max_age_days: ${args.maxAgeDays ?? "none"}`);
console.log(`- passed: ${check.passed}`);
console.log(`- failed_checks: ${check.summary.failed_checks}`);
console.log(`check_written: ${resolvedOutput}`);

if (check.strict && !check.passed) {
  process.exitCode = 1;
}

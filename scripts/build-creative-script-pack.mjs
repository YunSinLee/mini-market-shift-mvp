import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCreativeScriptPack } from "../src/analytics/creative-script-pack.mjs";

function parseDurations(value) {
  if (typeof value !== "string" || !value.trim()) {
    return [15, 30];
  }
  return value
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item) && item > 0);
}

function parseArgs(argv) {
  let inputPath = "artifacts/ua/creative-batch.json";
  let outputIndexPath = "artifacts/ua/script-pack.json";
  let outputRoot = "artifacts/ua/scripts";
  let durations = [15, 30];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-index" && argv[i + 1]) {
      outputIndexPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-root" && argv[i + 1]) {
      outputRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--durations" && argv[i + 1]) {
      durations = parseDurations(argv[i + 1]);
      i += 1;
    }
  }

  return {
    inputPath,
    outputIndexPath,
    outputRoot,
    durations
  };
}

function printSummary(pack, indexPath, outputRoot) {
  console.log("Creative script pack build complete.");
  console.log(`- creatives: ${pack.summary.creative_count}`);
  console.log(`- durations: ${pack.summary.duration_variants.join(",")}`);
  console.log(`- script_files: ${pack.summary.script_file_count}`);
  console.log(`scripts_written_root: ${outputRoot}`);
  console.log(`script_index_written: ${indexPath}`);
}

const args = parseArgs(process.argv.slice(2));
const resolvedInputPath = path.resolve(process.cwd(), args.inputPath);
const resolvedOutputIndexPath = path.resolve(process.cwd(), args.outputIndexPath);
const resolvedOutputRoot = path.resolve(process.cwd(), args.outputRoot);

const raw = await readFile(resolvedInputPath, "utf8");
const creativeBatch = JSON.parse(raw);

const pack = buildCreativeScriptPack({
  creativeBatch,
  durations: args.durations
});

for (const item of pack.files) {
  const absolutePath = path.resolve(resolvedOutputRoot, item.relative_path);
  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, item.content, "utf8");
}

const indexOutput = {
  generated_at: pack.generated_at,
  source_generated_at: pack.source_generated_at,
  summary: pack.summary,
  files: pack.files.map((item) => ({
    creative_id: item.creative_id,
    duration_sec: item.duration_sec,
    segment: item.segment,
    relative_path: item.relative_path
  }))
};

await mkdir(path.dirname(resolvedOutputIndexPath), { recursive: true });
await writeFile(
  resolvedOutputIndexPath,
  `${JSON.stringify(indexOutput, null, 2)}\n`,
  "utf8"
);

printSummary(indexOutput, resolvedOutputIndexPath, resolvedOutputRoot);

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { convertRuntimeSmokeReport } from "../src/analytics/runtime-smoke-import.mjs";

function parseArgs(argv) {
  let inputPath = "artifacts/unity/runtime-smoke-report.json";
  let outDir = "artifacts/sim/latest";
  let metaPath = "artifacts/unity/runtime-smoke-import-meta.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input" && argv[i + 1]) {
      inputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--out-dir" && argv[i + 1]) {
      outDir = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--meta-out" && argv[i + 1]) {
      metaPath = argv[i + 1];
      i += 1;
    }
  }

  return {
    inputPath,
    outDir,
    metaPath
  };
}

const { inputPath, outDir, metaPath } = parseArgs(process.argv.slice(2));

const raw = await readFile(path.resolve(process.cwd(), inputPath), "utf8");
const report = JSON.parse(raw);
const converted = convertRuntimeSmokeReport(report);

const resolvedOutDir = path.resolve(process.cwd(), outDir);
const resolvedMetaPath = path.resolve(process.cwd(), metaPath);

await Promise.all([
  mkdir(resolvedOutDir, { recursive: true }),
  mkdir(path.dirname(resolvedMetaPath), { recursive: true })
]);

const telemetryNdjson = converted.telemetry_records
  .map((record) => JSON.stringify(record))
  .join("\n");

await Promise.all([
  writeFile(
    path.join(resolvedOutDir, "summary.json"),
    `${JSON.stringify(converted.summary ?? {}, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(resolvedOutDir, "missions.json"),
    `${JSON.stringify(converted.missions, null, 2)}\n`,
    "utf8"
  ),
  writeFile(
    path.join(resolvedOutDir, "telemetry.ndjson"),
    telemetryNdjson ? `${telemetryNdjson}\n` : "",
    "utf8"
  ),
  writeFile(
    resolvedMetaPath,
    `${JSON.stringify(
      {
        generated_at: converted.generated_at,
        smoke_generated_at: converted.smoke_generated_at,
        passed: converted.passed,
        source_report_path: converted.source_report_path,
        persistent_data_path: converted.persistent_data_path,
        liveops_applied: converted.liveops?.applied ?? null,
        liveops_file_found: converted.liveops?.file_found ?? null,
        liveops_selected_day_label: converted.liveops?.selected_day_label ?? null,
        liveops_active_event_count: Array.isArray(converted.liveops?.active_event_ids)
          ? converted.liveops.active_event_ids.length
          : null,
        imported_events: converted.telemetry_records.length
      },
      null,
      2
    )}\n`,
    "utf8"
  )
]);

console.log("Runtime smoke import complete.");
console.log(`- imported_events: ${converted.telemetry_records.length}`);
console.log(`- passed: ${converted.passed}`);
console.log(`- out_dir: ${resolvedOutDir}`);
console.log(`- meta_file: ${resolvedMetaPath}`);

import { cp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildUaPackageExport } from "../src/analytics/ua-package-export.mjs";

async function fileExists(filePath) {
  try {
    await readFile(filePath, "utf8");
    return true;
  } catch {
    return false;
  }
}

async function pathExists(targetPath) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

function todayTag() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function parseArgs(argv) {
  let batchPath = "artifacts/ua/creative-batch.next.json";
  let scriptIndexPath = "artifacts/ua/script-pack.next.json";
  let scriptsRoot = "artifacts/ua/scripts.next";
  let outputRoot = "artifacts/ua/publish";
  let adapterConfigPath = "config/ua-adapters.default.json";
  let tag = `ua-package-${todayTag()}`;
  let reviewPath = "artifacts/ua/creative-performance-review.json";
  let applyPath = "artifacts/ua/creative-review-apply.json";
  let zip = true;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--batch" && argv[i + 1]) {
      batchPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--script-index" && argv[i + 1]) {
      scriptIndexPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--scripts-root" && argv[i + 1]) {
      scriptsRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output-root" && argv[i + 1]) {
      outputRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--adapter-config" && argv[i + 1]) {
      adapterConfigPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--tag" && argv[i + 1]) {
      tag = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--review" && argv[i + 1]) {
      reviewPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--apply" && argv[i + 1]) {
      applyPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--no-zip") {
      zip = false;
    }
  }

  return {
    batchPath,
    scriptIndexPath,
    scriptsRoot,
    outputRoot,
    adapterConfigPath,
    tag,
    reviewPath,
    applyPath,
    zip
  };
}

async function readJson(filePath) {
  const raw = await readFile(filePath, "utf8");
  return JSON.parse(raw);
}

async function resolvePreferredFile(primaryPath, fallbackPath) {
  const primaryExists = await fileExists(primaryPath);
  if (primaryExists) {
    return primaryPath;
  }
  return fallbackPath;
}

function runZip({ cwd, tag }) {
  return new Promise((resolve) => {
    const zipFile = `${tag}.zip`;
    const child = spawn("zip", ["-rq", zipFile, tag], {
      cwd,
      stdio: "inherit"
    });
    child.on("close", (code) => {
      resolve({
        ok: code === 0,
        zipFile
      });
    });
  });
}

function buildReadme(manifest) {
  const lines = [];
  lines.push(`# UA Package: ${manifest.package_tag}`);
  lines.push("");
  lines.push(`- Generated: ${manifest.generated_at}`);
  lines.push(`- Creative Count: ${manifest.summary.creative_count}`);
  lines.push(`- Durations: ${manifest.summary.durations_sec.join(",")} sec`);
  lines.push(`- Segments: ${manifest.summary.segments.join(", ")}`);
  lines.push("");
  lines.push("## Files");
  lines.push("- manifest.json");
  lines.push("- creatives.csv");
  lines.push("- adops/adapters/meta_ads.csv");
  lines.push("- adops/adapters/tiktok_ads.csv");
  lines.push("- scripts/<country>-<platform>/<creative_id>-<duration>s.md");
  if (manifest.summary.includes_performance_review) {
    lines.push("- analysis/creative-performance-review.json");
  }
  if (manifest.summary.includes_review_apply) {
    lines.push("- analysis/creative-review-apply.json");
  }
  lines.push("");
  lines.push("## Usage");
  lines.push("- Upload scripts and metadata to ad ops workspace.");
  lines.push("- Track creative_id exactly as listed in creatives.csv.");
  return `${lines.join("\n")}\n`;
}

function printSummary({ packageDir, zipPath, manifest }) {
  console.log("UA package build complete.");
  console.log(`- tag: ${manifest.package_tag}`);
  console.log(`- creatives: ${manifest.summary.creative_count}`);
  console.log(`- durations: ${manifest.summary.durations_sec.join(",")}`);
  console.log(`- segments: ${manifest.summary.segments.join(", ")}`);
  console.log(`package_dir: ${packageDir}`);
  if (zipPath) {
    console.log(`package_zip: ${zipPath}`);
  } else {
    console.log("package_zip: skipped");
  }
}

const args = parseArgs(process.argv.slice(2));
const cwd = process.cwd();

const resolvedOutputRoot = path.resolve(cwd, args.outputRoot);
const resolvedAdapterConfigPath = path.resolve(cwd, args.adapterConfigPath);
const resolvedPrimaryBatch = path.resolve(cwd, args.batchPath);
const resolvedPrimaryScriptIndex = path.resolve(cwd, args.scriptIndexPath);
const resolvedPrimaryScriptsRoot = path.resolve(cwd, args.scriptsRoot);

const resolvedBatch = await resolvePreferredFile(
  resolvedPrimaryBatch,
  path.resolve(cwd, "artifacts/ua/creative-batch.json")
);
const resolvedScriptIndex = await resolvePreferredFile(
  resolvedPrimaryScriptIndex,
  path.resolve(cwd, "artifacts/ua/script-pack.json")
);
const [creativeBatch, scriptIndex] = await Promise.all([
  readJson(resolvedBatch),
  readJson(resolvedScriptIndex)
]);

let resolvedScriptsRoot = resolvedPrimaryScriptsRoot;
const firstRel = scriptIndex?.files?.[0]?.relative_path;
if (typeof firstRel === "string") {
  const checkPrimary = path.resolve(resolvedPrimaryScriptsRoot, firstRel);
  if (!(await pathExists(checkPrimary))) {
    resolvedScriptsRoot = path.resolve(cwd, "artifacts/ua/scripts");
  }
}

const resolvedReviewPath = path.resolve(cwd, args.reviewPath);
const resolvedApplyPath = path.resolve(cwd, args.applyPath);

const includeReview = await fileExists(resolvedReviewPath);
const includeApply = await fileExists(resolvedApplyPath);
let adapterConfig = null;
if (await fileExists(resolvedAdapterConfigPath)) {
  adapterConfig = await readJson(resolvedAdapterConfigPath);
}

const built = buildUaPackageExport({
  creativeBatch,
  scriptIndex,
  packageTag: args.tag,
  adapterConfig,
  includeReview,
  includeApply
});

const packageDir = path.resolve(resolvedOutputRoot, args.tag);
await rm(packageDir, { recursive: true, force: true });
await mkdir(packageDir, { recursive: true });

const scriptsDestRoot = path.resolve(packageDir, "scripts");
for (const item of scriptIndex.files ?? []) {
  const rel = item?.relative_path;
  if (typeof rel !== "string" || !rel.trim()) {
    continue;
  }
  const src = path.resolve(resolvedScriptsRoot, rel);
  const dest = path.resolve(scriptsDestRoot, rel);
  await mkdir(path.dirname(dest), { recursive: true });
  await cp(src, dest);
}

await writeFile(
  path.resolve(packageDir, "manifest.json"),
  `${JSON.stringify(built.manifest, null, 2)}\n`,
  "utf8"
);
await writeFile(path.resolve(packageDir, "creatives.csv"), built.creatives_csv, "utf8");

const adaptersDir = path.resolve(packageDir, "adops/adapters");
await mkdir(adaptersDir, { recursive: true });
await writeFile(
  path.resolve(adaptersDir, "meta_ads.csv"),
  built.adapters.meta_ads_csv,
  "utf8"
);
await writeFile(
  path.resolve(adaptersDir, "tiktok_ads.csv"),
  built.adapters.tiktok_ads_csv,
  "utf8"
);

await writeFile(path.resolve(packageDir, "README.md"), buildReadme(built.manifest), "utf8");

if (includeReview || includeApply) {
  const analysisDir = path.resolve(packageDir, "analysis");
  await mkdir(analysisDir, { recursive: true });
  if (includeReview) {
    await cp(resolvedReviewPath, path.resolve(analysisDir, "creative-performance-review.json"));
  }
  if (includeApply) {
    await cp(resolvedApplyPath, path.resolve(analysisDir, "creative-review-apply.json"));
  }
}

let zipPath = null;
if (args.zip) {
  await mkdir(resolvedOutputRoot, { recursive: true });
  const zipped = await runZip({
    cwd: resolvedOutputRoot,
    tag: args.tag
  });
  if (zipped.ok) {
    zipPath = path.resolve(resolvedOutputRoot, zipped.zipFile);
  }
}

printSummary({
  packageDir,
  zipPath,
  manifest: built.manifest
});

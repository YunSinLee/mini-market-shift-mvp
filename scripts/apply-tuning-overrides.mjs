import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildOverridePlan } from "../src/analytics/override-plan.mjs";

function parseArgs(argv) {
  let recommendationPath = "artifacts/launch/tuning-recommendation.json";
  let snapshotPath = "artifacts/launch/kpi-snapshot.generated.json";
  let segmentReportPath = "artifacts/launch/segment-launch-report.json";
  let remoteBasePath = "config/remote-config.default.json";
  let abBasePath = "config/ab-flags.default.json";
  let remoteOutPath =
    "UnityProject/Assets/StreamingAssets/mvp-config/remote-config.override.json";
  let abOutPath = "UnityProject/Assets/StreamingAssets/mvp-config/ab-flags.override.json";
  let planOutPath = "artifacts/launch/override-plan.json";
  let country = null;
  let platform = null;
  let maxActions = 3;
  let dryRun = false;
  let forceUnsafe = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--recommendation" && argv[i + 1]) {
      recommendationPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--segment-report" && argv[i + 1]) {
      segmentReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--snapshot" && argv[i + 1]) {
      snapshotPath = argv[i + 1];
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
      continue;
    }
    if (arg === "--remote-base" && argv[i + 1]) {
      remoteBasePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ab-base" && argv[i + 1]) {
      abBasePath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--remote-out" && argv[i + 1]) {
      remoteOutPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ab-out" && argv[i + 1]) {
      abOutPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--plan-out" && argv[i + 1]) {
      planOutPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--max-actions" && argv[i + 1]) {
      maxActions = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--force-unsafe") {
      forceUnsafe = true;
    }
  }

  return {
    recommendationPath,
    snapshotPath,
    segmentReportPath,
    remoteBasePath,
    abBasePath,
    remoteOutPath,
    abOutPath,
    planOutPath,
    country,
    platform,
    maxActions,
    dryRun,
    forceUnsafe
  };
}

async function readJson(filePath) {
  const raw = await readFile(path.resolve(process.cwd(), filePath), "utf8");
  return JSON.parse(raw);
}

async function tryReadJson(filePath) {
  try {
    return await readJson(filePath);
  } catch {
    return null;
  }
}

function selectRecommendation({
  directRecommendation,
  globalSnapshot,
  segmentReport,
  country,
  platform
}) {
  if (!country || !platform || !segmentReport?.segments) {
    return {
      recommendation: directRecommendation,
      snapshot: globalSnapshot,
      source: "global_recommendation"
    };
  }

  const row = segmentReport.segments.find(
    (segment) =>
      segment?.segment?.country === country &&
      segment?.segment?.platform === platform
  );

  if (!row?.tuning_recommendation) {
    return {
      recommendation: directRecommendation,
      snapshot: globalSnapshot,
      source: "global_recommendation"
    };
  }

  return {
    recommendation: row.tuning_recommendation,
    snapshot: row.snapshot ?? null,
    source: `segment:${country}/${platform}`
  };
}

function printSummary(plan, source) {
  console.log("Override plan build complete.");
  console.log(`- source: ${source}`);
  console.log(`- selection_mode: ${plan.selection_mode}`);
  console.log(`- low_confidence_data: ${plan.low_confidence_data}`);
  console.log(`- selected_actions: ${plan.selected_actions.length}`);
  console.log(`- applied_changes: ${plan.applied_changes.length}`);
  console.log(`- skipped_changes: ${plan.skipped_changes.length}`);
}

const options = parseArgs(process.argv.slice(2));

const [directRecommendation, globalSnapshot, segmentReport, remoteBase, abBase] = await Promise.all([
  readJson(options.recommendationPath),
  tryReadJson(options.snapshotPath),
  tryReadJson(options.segmentReportPath),
  readJson(options.remoteBasePath),
  readJson(options.abBasePath)
]);

const selected = selectRecommendation({
  directRecommendation,
  globalSnapshot,
  segmentReport,
  country: options.country,
  platform: options.platform
});

const plan = buildOverridePlan({
  remoteBase,
  abBase,
  recommendation: selected.recommendation,
  maxActions: options.maxActions,
  context: {
    snapshot: selected.snapshot
  },
  forceUnsafe: options.forceUnsafe
});

const remoteOut = path.resolve(process.cwd(), options.remoteOutPath);
const abOut = path.resolve(process.cwd(), options.abOutPath);
const planOut = path.resolve(process.cwd(), options.planOutPath);

if (!options.dryRun) {
  await Promise.all([
    mkdir(path.dirname(remoteOut), { recursive: true }),
    mkdir(path.dirname(abOut), { recursive: true }),
    mkdir(path.dirname(planOut), { recursive: true })
  ]);

  await Promise.all([
    writeFile(remoteOut, `${JSON.stringify(plan.remote_override, null, 2)}\n`, "utf8"),
    writeFile(abOut, `${JSON.stringify(plan.ab_override, null, 2)}\n`, "utf8"),
    writeFile(
      planOut,
      `${JSON.stringify({ ...plan, source: selected.source }, null, 2)}\n`,
      "utf8"
    )
  ]);
}

printSummary(plan, selected.source);
console.log(`remote_override: ${remoteOut}`);
console.log(`ab_override: ${abOut}`);
console.log(`plan_report: ${planOut}`);

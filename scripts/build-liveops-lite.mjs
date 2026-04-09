import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildLiveopsLitePlan } from "../src/analytics/liveops-lite.mjs";

function parseArgs(argv) {
  let dailyMissionsPath = "config/daily-missions.json";
  let segmentReportPath = "artifacts/launch/segment-launch-report.json";
  let gateEvaluationPath = "artifacts/launch/gate-evaluation.json";
  let tuningRecommendationPath = "artifacts/launch/tuning-recommendation.json";
  let outputPath = "artifacts/liveops/liveops-lite-plan.json";
  let unityOutputPath = null;
  let weekLabel = null;
  let countries = null;
  let days = 7;
  let weeklyEventCount = 2;
  let startDate = null;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--daily-missions" && argv[i + 1]) {
      dailyMissionsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--segment-report" && argv[i + 1]) {
      segmentReportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--gate" && argv[i + 1]) {
      gateEvaluationPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--tuning" && argv[i + 1]) {
      tuningRecommendationPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--output" && argv[i + 1]) {
      outputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--unity-output" && argv[i + 1]) {
      unityOutputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--week" && argv[i + 1]) {
      weekLabel = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--countries" && argv[i + 1]) {
      countries = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--days" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        days = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--events" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        weeklyEventCount = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--start-date" && argv[i + 1]) {
      startDate = argv[i + 1];
      i += 1;
    }
  }

  const targetCountries =
    typeof countries === "string" && countries.trim()
      ? countries
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
      : null;

  return {
    dailyMissionsPath,
    segmentReportPath,
    gateEvaluationPath,
    tuningRecommendationPath,
    outputPath,
    unityOutputPath,
    weekLabel,
    targetCountries,
    days,
    weeklyEventCount,
    startDate
  };
}

async function readJsonOrNull(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function printSummary(plan, outputPath) {
  console.log("LiveOps lite plan build complete.");
  console.log(`- week_label: ${plan.week_label}`);
  console.log(`- primary_goal: ${plan.strategy.primary_goal}`);
  console.log(`- mission_days: ${plan.daily_mission_templates.length}`);
  console.log(`- weekly_events: ${plan.weekly_event_templates.length}`);
  console.log(`liveops_lite_written: ${outputPath}`);
}

const args = parseArgs(process.argv.slice(2));
const cwd = process.cwd();
const resolvedDailyMissionsPath = path.resolve(cwd, args.dailyMissionsPath);
const resolvedSegmentReportPath = path.resolve(cwd, args.segmentReportPath);
const resolvedGatePath = path.resolve(cwd, args.gateEvaluationPath);
const resolvedTuningPath = path.resolve(cwd, args.tuningRecommendationPath);
const resolvedOutputPath = path.resolve(cwd, args.outputPath);
const resolvedUnityOutputPath = args.unityOutputPath
  ? path.resolve(cwd, args.unityOutputPath)
  : null;

const dailyMissions = await readJsonOrNull(resolvedDailyMissionsPath);
const segmentReport = await readJsonOrNull(resolvedSegmentReportPath);
const gateEvaluation = await readJsonOrNull(resolvedGatePath);
const tuningRecommendation = await readJsonOrNull(resolvedTuningPath);

const plan = buildLiveopsLitePlan({
  dailyMissions,
  segmentReport,
  gateEvaluation,
  tuningRecommendation,
  weekLabel: args.weekLabel,
  targetCountries: args.targetCountries,
  days: args.days,
  weeklyEventCount: args.weeklyEventCount,
  startDate: args.startDate
});

await mkdir(path.dirname(resolvedOutputPath), { recursive: true });
const payload = `${JSON.stringify(plan, null, 2)}\n`;
await writeFile(resolvedOutputPath, payload, "utf8");

if (resolvedUnityOutputPath) {
  await mkdir(path.dirname(resolvedUnityOutputPath), { recursive: true });
  await writeFile(resolvedUnityOutputPath, payload, "utf8");
  console.log(`liveops_lite_unity_written: ${resolvedUnityOutputPath}`);
}

printSummary(plan, resolvedOutputPath);

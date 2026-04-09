import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { buildLiveopsCommands } from "../src/analytics/liveops-cycle.mjs";

function parseArgs(argv) {
  let unitySmokeInput = null;
  let uaPath = "docs/ua-summary.example.json";
  let uaSegmentsPath = "docs/ua-segments.example.json";
  let marketSignalsPath = "docs/market-signals.example.json";
  let activateCountry = "KR";
  let activatePlatform = "android";
  let reportPath = "artifacts/launch/liveops-cycle-report.json";
  let creativeCount = 5;
  let skipMarket = false;
  let skipCreative = false;
  let skipCreativeScripts = false;
  let skipCreativeApply = false;
  let skipUaPackage = false;
  let skipLiveopsLite = false;
  let uaPackageTag = "ua-package-latest";
  let uaAdapterConfigPath = "config/ua-adapters.default.json";
  let liveopsLiteOutputPath = "artifacts/liveops/liveops-lite-plan.json";
  let liveopsLiteUnityOutputPath =
    "UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json";
  let skipUnityLiveopsCheck = false;
  let unityLiveopsCheckOutputPath = "artifacts/unity/runtime-smoke-liveops-check.json";
  let creativePerformanceCsv = null;
  let creativeTopN = 2;
  let creativeMinImpressions = 1000;
  let forceUnsafe = false;
  let dryRun = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--unity-smoke-input" && argv[i + 1]) {
      unitySmokeInput = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ua" && argv[i + 1]) {
      uaPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ua-segments" && argv[i + 1]) {
      uaSegmentsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--market-signals" && argv[i + 1]) {
      marketSignalsPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--activate-country" && argv[i + 1]) {
      activateCountry = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--activate-platform" && argv[i + 1]) {
      activatePlatform = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--report-out" && argv[i + 1]) {
      reportPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--creative-count" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        creativeCount = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--skip-market") {
      skipMarket = true;
      continue;
    }
    if (arg === "--skip-creative") {
      skipCreative = true;
      continue;
    }
    if (arg === "--skip-creative-scripts") {
      skipCreativeScripts = true;
      continue;
    }
    if (arg === "--skip-creative-apply") {
      skipCreativeApply = true;
      continue;
    }
    if (arg === "--skip-ua-package") {
      skipUaPackage = true;
      continue;
    }
    if (arg === "--skip-liveops-lite") {
      skipLiveopsLite = true;
      continue;
    }
    if (arg === "--ua-package-tag" && argv[i + 1]) {
      uaPackageTag = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--ua-adapter-config" && argv[i + 1]) {
      uaAdapterConfigPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--liveops-lite-output" && argv[i + 1]) {
      liveopsLiteOutputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--liveops-lite-unity-output" && argv[i + 1]) {
      liveopsLiteUnityOutputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--skip-unity-liveops-check") {
      skipUnityLiveopsCheck = true;
      continue;
    }
    if (arg === "--unity-liveops-check-output" && argv[i + 1]) {
      unityLiveopsCheckOutputPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--creative-performance-csv" && argv[i + 1]) {
      creativePerformanceCsv = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--creative-top" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        creativeTopN = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--creative-min-impressions" && argv[i + 1]) {
      const parsed = Number(argv[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) {
        creativeMinImpressions = parsed;
      }
      i += 1;
      continue;
    }
    if (arg === "--force-unsafe") {
      forceUnsafe = true;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }

  return {
    unitySmokeInput,
    uaPath,
    uaSegmentsPath,
    marketSignalsPath,
    activateCountry,
    activatePlatform,
    reportPath,
    creativeCount,
    skipMarket,
    skipCreative,
    skipCreativeScripts,
    skipCreativeApply,
    skipUaPackage,
    skipLiveopsLite,
    uaPackageTag,
    uaAdapterConfigPath,
    liveopsLiteOutputPath,
    liveopsLiteUnityOutputPath,
    skipUnityLiveopsCheck,
    unityLiveopsCheckOutputPath,
    creativePerformanceCsv,
    creativeTopN,
    creativeMinImpressions,
    forceUnsafe,
    dryRun
  };
}

function runNodeScript(scriptPath, args, cwd) {
  return new Promise((resolve) => {
    const startedAt = new Date().toISOString();
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd,
      stdio: "inherit"
    });

    child.on("close", (code) => {
      resolve({
        started_at: startedAt,
        ended_at: new Date().toISOString(),
        exit_code: code
      });
    });
  });
}

function printPlan(commands) {
  console.log("LiveOps cycle plan:");
  for (const command of commands) {
    const joinedArgs = command.args.map((item) => JSON.stringify(item)).join(" ");
    console.log(`- ${command.label}: node ${command.script} ${joinedArgs}`);
  }
}

const options = parseArgs(process.argv.slice(2));
const cwd = process.cwd();
const commands = buildLiveopsCommands({
  unitySmokeInput: options.unitySmokeInput,
  uaPath: options.uaPath,
  uaSegmentsPath: options.uaSegmentsPath,
  marketSignalsPath: options.marketSignalsPath,
  activateCountry: options.activateCountry,
  activatePlatform: options.activatePlatform,
  creativeCount: options.creativeCount,
  skipMarket: options.skipMarket,
  skipCreative: options.skipCreative,
  skipCreativeScripts: options.skipCreativeScripts,
  skipCreativeApply: options.skipCreativeApply,
  skipUaPackage: options.skipUaPackage,
  skipLiveopsLite: options.skipLiveopsLite,
  uaPackageTag: options.uaPackageTag,
  uaAdapterConfigPath: options.uaAdapterConfigPath,
  liveopsLiteOutputPath: options.liveopsLiteOutputPath,
  liveopsLiteUnityOutputPath: options.liveopsLiteUnityOutputPath,
  skipUnityLiveopsCheck: options.skipUnityLiveopsCheck,
  unityLiveopsCheckOutputPath: options.unityLiveopsCheckOutputPath,
  creativePerformanceCsv: options.creativePerformanceCsv,
  creativeTopN: options.creativeTopN,
  creativeMinImpressions: options.creativeMinImpressions,
  forceUnsafe: options.forceUnsafe
});

printPlan(commands);

const report = {
  generated_at: new Date().toISOString(),
  options: {
    unity_smoke_input: options.unitySmokeInput,
    ua_path: options.uaPath,
    ua_segments_path: options.uaSegmentsPath,
    market_signals_path: options.marketSignalsPath,
    activate_country: options.activateCountry,
    activate_platform: options.activatePlatform,
    creative_count: options.creativeCount,
    skip_market: options.skipMarket,
    skip_creative: options.skipCreative,
    skip_creative_scripts: options.skipCreativeScripts,
    skip_creative_apply: options.skipCreativeApply,
    skip_ua_package: options.skipUaPackage,
    skip_liveops_lite: options.skipLiveopsLite,
    ua_package_tag: options.uaPackageTag,
    ua_adapter_config: options.uaAdapterConfigPath,
    liveops_lite_output: options.liveopsLiteOutputPath,
    liveops_lite_unity_output: options.liveopsLiteUnityOutputPath,
    skip_unity_liveops_check: options.skipUnityLiveopsCheck,
    unity_liveops_check_output: options.unityLiveopsCheckOutputPath,
    creative_performance_csv: options.creativePerformanceCsv,
    creative_top_n: options.creativeTopN,
    creative_min_impressions: options.creativeMinImpressions,
    force_unsafe: options.forceUnsafe,
    dry_run: options.dryRun
  },
  commands: [],
  success: true
};

if (!options.dryRun) {
  for (const command of commands) {
    const run = await runNodeScript(command.script, command.args, cwd);
    report.commands.push({
      label: command.label,
      script: command.script,
      args: command.args,
      ...run
    });

    if (run.exit_code !== 0) {
      report.success = false;
      break;
    }
  }
}

if (options.dryRun) {
  for (const command of commands) {
    report.commands.push({
      label: command.label,
      script: command.script,
      args: command.args,
      started_at: null,
      ended_at: null,
      exit_code: null
    });
  }
}

const resolvedReportPath = path.resolve(cwd, options.reportPath);
await mkdir(path.dirname(resolvedReportPath), { recursive: true });
await writeFile(resolvedReportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

console.log(`liveops_report: ${resolvedReportPath}`);
console.log(`liveops_success: ${report.success}`);

if (!report.success) {
  process.exitCode = 1;
}

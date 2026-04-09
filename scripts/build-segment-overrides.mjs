import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildSegmentOverridePlans } from "../src/analytics/segment-overrides.mjs";

function parseArgs(argv) {
  let segmentReportPath = "artifacts/launch/segment-launch-report.json";
  let remoteBasePath = "config/remote-config.default.json";
  let abBasePath = "config/ab-flags.default.json";
  let outRoot = "artifacts/overrides";
  let maxActions = 3;
  let forceUnsafe = false;

  let activateCountry = null;
  let activatePlatform = null;
  let unityRemoteOut =
    "UnityProject/Assets/StreamingAssets/mvp-config/remote-config.override.json";
  let unityAbOut = "UnityProject/Assets/StreamingAssets/mvp-config/ab-flags.override.json";

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--segment-report" && argv[i + 1]) {
      segmentReportPath = argv[i + 1];
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
    if (arg === "--out-root" && argv[i + 1]) {
      outRoot = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--max-actions" && argv[i + 1]) {
      maxActions = Number(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === "--force-unsafe") {
      forceUnsafe = true;
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
    if (arg === "--unity-remote-out" && argv[i + 1]) {
      unityRemoteOut = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--unity-ab-out" && argv[i + 1]) {
      unityAbOut = argv[i + 1];
      i += 1;
    }
  }

  return {
    segmentReportPath,
    remoteBasePath,
    abBasePath,
    outRoot,
    maxActions,
    forceUnsafe,
    activateCountry,
    activatePlatform,
    unityRemoteOut,
    unityAbOut
  };
}

async function readJson(filePath) {
  const raw = await readFile(path.resolve(process.cwd(), filePath), "utf8");
  return JSON.parse(raw);
}

function findActivationPlan(plans, country, platform) {
  if (!country || !platform) {
    return null;
  }
  return plans.find(
    (item) =>
      item.segment.country === country && item.segment.platform === platform
  );
}

function printSummary(result, activatedPlan) {
  console.log("Segment override build complete.");
  console.log(`- generated_plans: ${result.generated_plans}`);
  console.log(`- max_actions: ${result.max_actions}`);
  console.log(`- force_unsafe: ${result.force_unsafe}`);

  for (const item of result.plans) {
    const key = `${item.segment.country}/${item.segment.platform}`;
    console.log(
      `- ${key}: mode=${item.plan.selection_mode}, applied_changes=${item.plan.applied_changes.length}`
    );
  }

  if (activatedPlan) {
    const key = `${activatedPlan.segment.country}/${activatedPlan.segment.platform}`;
    console.log(`- activated_segment: ${key}`);
  }
}

const options = parseArgs(process.argv.slice(2));

const [segmentReport, remoteBase, abBase] = await Promise.all([
  readJson(options.segmentReportPath),
  readJson(options.remoteBasePath),
  readJson(options.abBasePath)
]);

const result = buildSegmentOverridePlans({
  segmentReport,
  remoteBase,
  abBase,
  maxActions: options.maxActions,
  forceUnsafe: options.forceUnsafe
});

const outRootPath = path.resolve(process.cwd(), options.outRoot);
await mkdir(outRootPath, { recursive: true });

for (const item of result.plans) {
  const segmentDir = path.join(outRootPath, item.segment_id);
  await mkdir(segmentDir, { recursive: true });
  await Promise.all([
    writeFile(
      path.join(segmentDir, "remote-config.override.json"),
      `${JSON.stringify(item.plan.remote_override, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      path.join(segmentDir, "ab-flags.override.json"),
      `${JSON.stringify(item.plan.ab_override, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      path.join(segmentDir, "override-plan.json"),
      `${JSON.stringify(item.plan, null, 2)}\n`,
      "utf8"
    )
  ]);
}

await writeFile(
  path.join(outRootPath, "segment-override-index.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8"
);

const activatedPlan = findActivationPlan(
  result.plans,
  options.activateCountry,
  options.activatePlatform
);

if (activatedPlan) {
  const unityRemotePath = path.resolve(process.cwd(), options.unityRemoteOut);
  const unityAbPath = path.resolve(process.cwd(), options.unityAbOut);
  await Promise.all([
    mkdir(path.dirname(unityRemotePath), { recursive: true }),
    mkdir(path.dirname(unityAbPath), { recursive: true })
  ]);

  await Promise.all([
    writeFile(
      unityRemotePath,
      `${JSON.stringify(activatedPlan.plan.remote_override, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      unityAbPath,
      `${JSON.stringify(activatedPlan.plan.ab_override, null, 2)}\n`,
      "utf8"
    ),
    writeFile(
      path.join(outRootPath, "active-segment.json"),
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          country: activatedPlan.segment.country,
          platform: activatedPlan.segment.platform,
          segment_id: activatedPlan.segment_id
        },
        null,
        2
      )}\n`,
      "utf8"
    )
  ]);
}

printSummary(result, activatedPlan);
console.log(`output_root: ${outRootPath}`);

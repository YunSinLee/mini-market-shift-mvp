export function buildLiveopsCommands(options = {}) {
  const commands = [];
  const unitySmokeInput = options.unitySmokeInput ?? null;
  const uaPath = options.uaPath ?? "docs/ua-summary.example.json";
  const uaSegmentsPath = options.uaSegmentsPath ?? "docs/ua-segments.example.json";
  const marketSignalsPath =
    options.marketSignalsPath ?? "docs/market-signals.example.json";
  const activateCountry = options.activateCountry ?? "KR";
  const activatePlatform = options.activatePlatform ?? "android";
  const creativeCount = Number.isFinite(options.creativeCount)
    ? options.creativeCount
    : 5;
  const skipMarket = Boolean(options.skipMarket);
  const skipCreative = Boolean(options.skipCreative);
  const skipCreativeScripts = Boolean(options.skipCreativeScripts);
  const skipCreativeApply = Boolean(options.skipCreativeApply);
  const skipUaPackage = Boolean(options.skipUaPackage);
  const uaPackageTag = options.uaPackageTag ?? "ua-package-latest";
  const uaAdapterConfigPath =
    options.uaAdapterConfigPath ?? "config/ua-adapters.default.json";
  const creativePerformanceCsv = options.creativePerformanceCsv ?? null;
  const creativeTopN = Number.isFinite(options.creativeTopN)
    ? options.creativeTopN
    : 2;
  const creativeMinImpressions = Number.isFinite(options.creativeMinImpressions)
    ? options.creativeMinImpressions
    : 1000;
  const skipUnityLiveopsCheck = Boolean(options.skipUnityLiveopsCheck);
  const unityLiveopsCheckOutputPath =
    options.unityLiveopsCheckOutputPath ??
    "artifacts/unity/runtime-smoke-liveops-check.json";
  const skipLiveopsLite = Boolean(options.skipLiveopsLite);
  const liveopsLiteOutputPath =
    options.liveopsLiteOutputPath ?? "artifacts/liveops/liveops-lite-plan.json";
  const liveopsLiteUnityOutputPath =
    options.liveopsLiteUnityOutputPath ??
    "UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json";
  const forceUnsafe = Boolean(options.forceUnsafe);

  if (!skipMarket) {
    commands.push({
      label: "build_market_brief",
      script: "scripts/build-market-radar-brief.mjs",
      args: ["--input", marketSignalsPath]
    });
  }

  if (unitySmokeInput) {
    commands.push({
      label: "import_unity_smoke",
      script: "scripts/import-runtime-smoke-report.mjs",
      args: ["--input", unitySmokeInput]
    });

    if (!skipUnityLiveopsCheck) {
      commands.push({
        label: "validate_unity_smoke_liveops",
        script: "scripts/validate-runtime-smoke-liveops.mjs",
        args: [
          "--input",
          unitySmokeInput,
          "--output",
          unityLiveopsCheckOutputPath,
          "--strict"
        ]
      });
    }
  } else {
    commands.push({
      label: "simulate",
      script: "src/cli/simulate.mjs",
      args: []
    });
  }

  commands.push(
    {
      label: "analyze_telemetry",
      script: "scripts/analyze-telemetry.mjs",
      args: []
    },
    {
      label: "build_kpi_snapshot",
      script: "scripts/build-kpi-snapshot.mjs",
      args: ["--ua", uaPath]
    },
    {
      label: "evaluate_gates",
      script: "scripts/evaluate-launch-gates.mjs",
      args: ["--input", "artifacts/launch/kpi-snapshot.generated.json"]
    },
    {
      label: "recommend_tuning",
      script: "scripts/recommend-tuning.mjs",
      args: []
    },
    {
      label: "build_segment_report",
      script: "scripts/build-segment-launch-report.mjs",
      args: ["--segments", uaSegmentsPath]
    }
  );

  if (!skipLiveopsLite) {
    commands.push({
      label: "build_liveops_lite",
      script: "scripts/build-liveops-lite.mjs",
      args: [
        "--daily-missions",
        "config/daily-missions.json",
        "--segment-report",
        "artifacts/launch/segment-launch-report.json",
        "--gate",
        "artifacts/launch/gate-evaluation.json",
        "--tuning",
        "artifacts/launch/tuning-recommendation.json",
        "--output",
        liveopsLiteOutputPath,
        "--unity-output",
        liveopsLiteUnityOutputPath
      ]
    });
  }

  const applyArgs = ["--country", activateCountry, "--platform", activatePlatform];
  const bundleArgs = [
    "--activate-country",
    activateCountry,
    "--activate-platform",
    activatePlatform
  ];

  if (forceUnsafe) {
    applyArgs.push("--force-unsafe");
    bundleArgs.push("--force-unsafe");
  }

  commands.push(
    {
      label: "apply_overrides",
      script: "scripts/apply-tuning-overrides.mjs",
      args: applyArgs
    },
    {
      label: "build_segment_overrides",
      script: "scripts/build-segment-overrides.mjs",
      args: bundleArgs
    }
  );

  if (!skipCreative) {
    const creativeArgs = [
      "--segment-report",
      "artifacts/launch/segment-launch-report.json",
      "--count",
      String(creativeCount)
    ];

    if (!skipMarket) {
      creativeArgs.push("--market-brief", "artifacts/market/weekly-brief.json");
    }

    commands.push({
      label: "build_ua_creative_batch",
      script: "scripts/build-ua-creative-batch.mjs",
      args: creativeArgs
    });

    if (!skipCreativeScripts) {
      commands.push({
        label: "build_creative_script_pack",
        script: "scripts/build-creative-script-pack.mjs",
        args: [
          "--input",
          "artifacts/ua/creative-batch.json",
          "--output-index",
          "artifacts/ua/script-pack.json",
          "--output-root",
          "artifacts/ua/scripts"
        ]
      });
    }

    if (creativePerformanceCsv) {
      commands.push({
        label: "review_creative_performance",
        script: "scripts/review-creative-performance.mjs",
        args: [
          "--batch",
          "artifacts/ua/creative-batch.json",
          "--perf-csv",
          creativePerformanceCsv,
          "--market-brief",
          "artifacts/market/weekly-brief.json",
          "--top",
          String(creativeTopN),
          "--min-impressions",
          String(creativeMinImpressions),
          "--output",
          "artifacts/ua/creative-performance-review.json"
        ]
      });

      if (!skipCreativeApply) {
        commands.push({
          label: "apply_creative_review",
          script: "scripts/apply-creative-review.mjs",
          args: [
            "--batch",
            "artifacts/ua/creative-batch.json",
            "--review",
            "artifacts/ua/creative-performance-review.json",
            "--top",
            String(creativeTopN),
            "--output-batch",
            "artifacts/ua/creative-batch.next.json",
            "--output-apply",
            "artifacts/ua/creative-review-apply.json"
          ]
        });

        if (!skipCreativeScripts) {
          commands.push({
            label: "build_creative_script_pack_next",
            script: "scripts/build-creative-script-pack.mjs",
            args: [
              "--input",
              "artifacts/ua/creative-batch.next.json",
              "--output-index",
              "artifacts/ua/script-pack.next.json",
              "--output-root",
              "artifacts/ua/scripts.next"
            ]
          });
        }
      }
    }

    if (!skipUaPackage && !skipCreativeScripts) {
      const useNext = Boolean(creativePerformanceCsv) && !skipCreativeApply;
      const packageArgs = [
        "--batch",
        useNext ? "artifacts/ua/creative-batch.next.json" : "artifacts/ua/creative-batch.json",
        "--script-index",
        useNext ? "artifacts/ua/script-pack.next.json" : "artifacts/ua/script-pack.json",
        "--scripts-root",
        useNext ? "artifacts/ua/scripts.next" : "artifacts/ua/scripts",
        "--output-root",
        "artifacts/ua/publish",
        "--adapter-config",
        uaAdapterConfigPath,
        "--tag",
        uaPackageTag
      ];

      if (creativePerformanceCsv) {
        packageArgs.push("--review", "artifacts/ua/creative-performance-review.json");
      }
      if (useNext) {
        packageArgs.push("--apply", "artifacts/ua/creative-review-apply.json");
      }

      commands.push({
        label: "build_ua_package_export",
        script: "scripts/build-ua-package.mjs",
        args: packageArgs
      });
    }
  }

  return commands;
}

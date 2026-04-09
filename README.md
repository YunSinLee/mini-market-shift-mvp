# Mini Market Shift MVP Scaffold

This repository implements a runnable MVP core for a mobile hybrid-casual idle tycoon game plan.

## Quick start
```bash
npm run gate
npm run sync:unity-config
npm run simulate
npm run analyze:telemetry
npm run import:unity-smoke -- --input tests/fixtures/runtime-smoke-report.sample.json
npm run check:unity-liveops -- --input tests/fixtures/runtime-smoke-report.sample.json
npm run ci:pr
npm run build:kpi-snapshot -- --ua docs/ua-summary.example.json
npm run evaluate:gates -- --input artifacts/launch/kpi-snapshot.generated.json
npm run recommend:tuning
npm run build:segment-report -- --segments docs/ua-segments.example.json
npm run apply:overrides -- --country KR --platform android
npm run build:segment-overrides -- --activate-country KR --activate-platform android
npm run build:market-brief -- --input docs/market-signals.example.json
npm run build:creative-batch -- --segment-report artifacts/launch/segment-launch-report.json
npm run build:creative-scripts -- --input artifacts/ua/creative-batch.json
npm run review:creative-performance -- --batch artifacts/ua/creative-batch.json --perf-csv docs/ua-creative-performance.example.csv
npm run apply:creative-review -- --batch artifacts/ua/creative-batch.json --review artifacts/ua/creative-performance-review.json
npm run build:liveops-lite
npm run build:ua-package -- --batch artifacts/ua/creative-batch.next.json --script-index artifacts/ua/script-pack.next.json --scripts-root artifacts/ua/scripts.next
npm run scaffold:market-signals -- --from docs/market-signals.example.json
npm run run:liveops-cycle -- --unity-smoke-input tests/fixtures/runtime-smoke-report.sample.json
npm test
```

`build:ua-package` outputs adapter-ready CSVs for upload workflows:
- `adops/adapters/meta_ads.csv`
- `adops/adapters/tiktok_ads.csv`
- channel/country URL+CTA are loaded from `config/ua-adapters.default.json` (override with `--adapter-config`)

PR gate runtime smoke input:
- `docs/runtime-smoke/runtime-smoke-report.device.json`
- CI checks liveops structure and report recency (`max-age-days=14`).
- If PR has `hotfix` label, recency policy relaxes to `max-age-days=30`.
- If PR has `hotfix` label, workflow adds/updates a PR comment with:
  - applied `max-age-days`
  - source report `generated_at`
  - gate pass/fail summary
- PR template checklist:
  - `.github/pull_request_template.md`
- Branch protection setup:
  - `docs/github-branch-protection.md`
  - CLI apply helper: `npm run gh:apply-branch-protection -- --repo <owner/name> --branch main`

## What is implemented
- Core loop simulation: customer demand -> throughput processing -> coin growth.
- Scope lock data: 3 stations, 20 upgrades, 30 difficulty stages, 3 daily missions.
- Monetization primitives:
  - Rewarded ads (`double_income_30s`, `instant_upgrade`, `failure_recovery`)
  - Minimal interstitial policy (session-end frequency by AB flag)
  - 3 IAP products (`remove_ads`, `starter_bundle`, `booster_bundle`)
- Telemetry contract with required common fields.
- Remote config and AB flag validation.
- Day 1 engine gate automation (Unity selected by weighted score).
- Soft-launch KPI workflow:
  - telemetry report generation
  - Gate 1 / Gate 2 business pass/fail evaluation
- Agent A market radar workflow:
  - weekly market signals -> ranked watchlist + 3 actionable updates
- Agent E UA creative workflow:
  - segment performance -> 5 creative hypotheses with CTR/CPI guardrails
  - creative batch -> KR/US segment-specific 15s/30s script files
  - performance csv -> keep top2 / replace low performers recommendation
- Agent F LiveOps lite workflow:
  - 7-day mission rotation templates
  - 2 weekly event templates with remote config / AB patch suggestions

## Directory guide
- `config/`: remote config, AB flags, economy content data.
- `src/domain/`: game engine and mission logic.
- `src/services/`: telemetry recorder.
- `src/cli/`: simulation runner.
- `scripts/`: engine gate, telemetry analysis, and launch gate evaluation.
- `tests/`: Node test suite.
- `docs/`: implementation and launch planning docs.
- `UnityProject/Assets/Scripts/`: Unity runtime, services, integrations.
- `UnityProject/Assets/StreamingAssets/mvp-config/`: runtime JSON data used by Unity.

## Notes
- This is an engine-agnostic runtime core built in Node for fast validation.
- Unity scene wiring is scaffolded via `GameBootstrap` + `GameLoopPresenter`.
- Unity editor auto-setup menu is available:
  - `Tools/Mini Market Shift/Setup MVP Scene`
- Runtime smoke flow scaffold is included via `RuntimeSmokeRunner`.
- Ad SDK / IAP SDK wrappers are provided as placeholders:
  - `AdMobAdService`
  - `UnityIapStoreService`
- Production SDK enablement:
  - Add `GOOGLE_MOBILE_ADS` define when AdMob package is installed.
  - Add `UNITY_PURCHASING` define when Unity IAP package is installed.
- Full setup instructions:
  - `docs/unity-integration-guide.md`
  - `docs/unity-sdk-checklist.md`
  - `docs/launch-analysis-guide.md`

# Launch Analysis Guide

## 1) Run simulation and write artifacts
```bash
npm run simulate
```

Outputs:
- `artifacts/sim/latest/summary.json`
- `artifacts/sim/latest/missions.json`
- `artifacts/sim/latest/telemetry.ndjson`

## 2) Build telemetry quality report
```bash
npm run analyze:telemetry
```

Outputs:
- `artifacts/sim/latest/telemetry-report.json`

Checks included:
- Missing event common field rate (`< 2%`)
- Country/platform segmentation availability
- Rewarded ad participation rate by session
- Payer conversion rate by session

If using Unity device smoke output:

```bash
npm run import:unity-smoke -- --input <runtime-smoke-report.json>
```

This writes:
- `artifacts/sim/latest/telemetry.ndjson`
- `artifacts/sim/latest/summary.json`
- `artifacts/sim/latest/missions.json`

Validate Unity smoke `liveops` section:

```bash
npm run check:unity-liveops -- --input <runtime-smoke-report.json>
```

Outputs:
- `artifacts/unity/runtime-smoke-liveops-check.json`
- strict mode default: exits non-zero when `liveops` apply checklist fails.
- optional freshness guard:
  - `--max-age-days <n>` (example: `--max-age-days 14`)
- PR CI default input:
  - `docs/runtime-smoke/runtime-smoke-report.device.json`
  - policy: 14 days by default, 30 days when PR has `hotfix` label

## 3) Evaluate launch business gates
Build KPI snapshot from telemetry first:

```bash
npm run build:kpi-snapshot -- --ua docs/ua-summary.example.json
```

Outputs:
- `artifacts/launch/kpi-snapshot.generated.json`
- includes `data_quality_flags`:
  - `uses_install_override`
  - `retention_window_lt_7_days`
  - `installs_mismatch_gt_20_percent`

Then run gate evaluation:

```bash
npm run evaluate:gates -- --input artifacts/launch/kpi-snapshot.generated.json
```

Outputs:
- `artifacts/launch/gate-evaluation.json`

Generate tuning actions from gate outcome:

```bash
npm run recommend:tuning
```

Outputs:
- `artifacts/launch/tuning-recommendation.json`

Apply top recommended actions to Unity override files:

```bash
npm run apply:overrides -- --country KR --platform android
```

Outputs:
- `UnityProject/Assets/StreamingAssets/mvp-config/remote-config.override.json`
- `UnityProject/Assets/StreamingAssets/mvp-config/ab-flags.override.json`
- `artifacts/launch/override-plan.json`
- Note: low-confidence data (short retention window / low event count / high install mismatch) triggers measurement-only mode by default.
- To force full application despite low-confidence data, add `--force-unsafe`.

Build KR/US Android split report:

```bash
npm run build:segment-report -- --segments docs/ua-segments.example.json
```

Outputs:
- `artifacts/launch/segment-launch-report.json`

Build LiveOps Lite weekly templates (Agent F):

```bash
npm run build:liveops-lite
```

Outputs:
- `artifacts/liveops/liveops-lite-plan.json`
- `UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json` (when `--unity-output` is used; enabled by default in `run:liveops-cycle`)
- Includes:
  - 7-day daily mission rotation templates
  - 2 weekly event templates with remote config and AB flag patches
  - reward tuning notes extracted from gate/tuning outputs

Build weekly market radar brief (Agent A):

```bash
npm run build:market-brief -- --input docs/market-signals.example.json
```

Outputs:
- `artifacts/market/weekly-brief.json`

Build weekly UA creative batch (Agent E):

```bash
npm run build:creative-batch -- --segment-report artifacts/launch/segment-launch-report.json
```

Outputs:
- `artifacts/ua/creative-batch.json`

Generate 15s/30s creative scripts from batch:

```bash
npm run build:creative-scripts -- --input artifacts/ua/creative-batch.json
```

Outputs:
- `artifacts/ua/script-pack.json`
- `artifacts/ua/scripts/<country>-<platform>/<creative_id>-15s.md`
- `artifacts/ua/scripts/<country>-<platform>/<creative_id>-30s.md`

Review creative performance and decide keep/replacement:

```bash
npm run review:creative-performance -- --batch artifacts/ua/creative-batch.json --perf-csv docs/ua-creative-performance.example.csv
```

Outputs:
- `artifacts/ua/creative-performance-review.json`
- Includes:
  - ranked creatives by guardrail + CTR
  - keep top N (default 2)
  - dropped creative reasons and replacement draft

Apply replacement draft to next creative batch:

```bash
npm run apply:creative-review -- --batch artifacts/ua/creative-batch.json --review artifacts/ua/creative-performance-review.json
```

Outputs:
- `artifacts/ua/creative-batch.next.json`
- `artifacts/ua/creative-review-apply.json`

Build final ad-ops package (manifest + csv + scripts + zip):

```bash
npm run build:ua-package -- --batch artifacts/ua/creative-batch.next.json --script-index artifacts/ua/script-pack.next.json --scripts-root artifacts/ua/scripts.next --tag ua-package-week15
```

Outputs:
- `artifacts/ua/publish/<tag>/manifest.json`
- `artifacts/ua/publish/<tag>/creatives.csv`
- `artifacts/ua/publish/<tag>/adops/adapters/meta_ads.csv`
- `artifacts/ua/publish/<tag>/adops/adapters/tiktok_ads.csv`
- `artifacts/ua/publish/<tag>/scripts/...`
- `artifacts/ua/publish/<tag>.zip`
- Adapter URL/CTA config:
  - default file: `config/ua-adapters.default.json`
  - override: `--adapter-config <path.json>`

Scaffold next weekly market signal file:

```bash
npm run scaffold:market-signals -- --from docs/market-signals.example.json
```

Outputs:
- `artifacts/market/live-signals.<YYYY-MM-DD>.json`

Build per-segment override sets and optionally activate one segment to Unity:

```bash
npm run build:segment-overrides -- --activate-country KR --activate-platform android
```

Outputs:
- `artifacts/overrides/<country>-<platform>/remote-config.override.json`
- `artifacts/overrides/<country>-<platform>/ab-flags.override.json`
- `artifacts/overrides/segment-override-index.json`
- (if activated) Unity override files under `Assets/StreamingAssets/mvp-config/`
- same confidence guard applies; use `--force-unsafe` only when intentionally overriding safety checks.

Single command runner:

```bash
npm run run:liveops-cycle -- --unity-smoke-input <runtime-smoke-report.json>
```

Outputs:
- `artifacts/launch/liveops-cycle-report.json`
- Includes market brief + liveops lite + creative batch steps by default.
- Optional:
  - `--skip-market`
  - `--skip-creative`
  - `--skip-creative-scripts`
  - `--skip-liveops-lite`
  - `--skip-unity-liveops-check`
  - `--market-signals <signals.json>`
  - `--liveops-lite-output <path.json>`
  - `--liveops-lite-unity-output <path.json>`
  - `--unity-liveops-check-output <path.json>`
  - `--creative-count <n>`
  - `--creative-performance-csv <performance.csv>`
  - `--creative-top <n>`
  - `--creative-min-impressions <n>`
  - `--skip-creative-apply`
  - `--skip-ua-package`
  - `--ua-package-tag <tag>`
  - `--ua-adapter-config <path.json>`

Gate logic:
- Gate 1 (`>= 400 installs`): `D1 >= 25%`, `D3 >= 10%`, `CPI <= target`
- Gate 2 (`>= 1000 installs`): `D7 >= 6%`, `rewarded ad participation >= 25%`, `payer conversion >= 1%`

CPI target source:
- `config/kpi-targets.json` (`cpi_target_max_usd`)

Optional:
- KR Android only snapshot:
  - `npm run build:kpi-snapshot -- --country KR --platform android --ua docs/ua-summary.example.json`

# Sub-Agent Operating Model (Solo-Friendly)

## Agent A: Market Radar (explorer)
- Input: top chart shifts, competitor ad creatives, pricing changes.
- Output: weekly market brief with 3 actionable updates.
- Runtime commands:
  - `npm run scaffold:market-signals -- --from docs/market-signals.example.json`
  - `npm run build:market-brief -- --input docs/market-signals.example.json`

## Agent B: Core Loop Builder (worker)
- Ownership: movement-less idle flow, customer processing, station throughput.
- Output: playable core loop increment.

## Agent C: Economy and Monetization (worker)
- Ownership: upgrade curve, rewarded ad payoff, IAP pricing balance.
- Output: economy changelog + tuning proposal.

## Agent D: Telemetry and Experiment (worker)
- Ownership: event quality, dashboard-ready schema, AB flag integrity.
- Output: instrumentation report + event QA.
- Runtime commands:
  - `npm run analyze:telemetry`
  - `npm run build:kpi-snapshot -- --ua <ua_summary.json>`
  - `npm run evaluate:gates -- --input <kpi_snapshot.json>`
  - `npm run recommend:tuning`
  - `npm run build:segment-report -- --segments <ua_segments.json>`
  - `npm run apply:overrides -- --country <KR|US> --platform android`
  - `npm run build:segment-overrides -- --activate-country <KR|US> --activate-platform android`
  - optional force flag: `--force-unsafe` (only when data confidence is verified)

## Agent E: UA Creative Lab (explorer/worker)
- Ownership: short-form hooks, playable ad concepts, CTR/CPI notes.
- Output: weekly 5-creative batch with hypothesis tags.
- Runtime commands:
  - `npm run build:creative-batch -- --segment-report artifacts/launch/segment-launch-report.json`
  - `npm run build:creative-scripts -- --input artifacts/ua/creative-batch.json`
  - `npm run review:creative-performance -- --batch artifacts/ua/creative-batch.json --perf-csv docs/ua-creative-performance.example.csv`
  - `npm run apply:creative-review -- --batch artifacts/ua/creative-batch.json --review artifacts/ua/creative-performance-review.json`
  - `npm run build:ua-package -- --batch artifacts/ua/creative-batch.next.json --script-index artifacts/ua/script-pack.next.json --scripts-root artifacts/ua/scripts.next`
  - optional market context: `--market-brief artifacts/market/weekly-brief.json`

## Agent F: LiveOps Lite (optional)
- Ownership: reusable daily/weekly mission templates.
- Output: event template catalog and reward tuning notes.
- Runtime commands:
  - `npm run build:liveops-lite`
  - optional overrides:
    - `node scripts/build-liveops-lite.mjs --days 7 --events 2 --countries KR,US`
    - `node scripts/build-liveops-lite.mjs --unity-output UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json`

# 4-8 Week Execution Roadmap

## Week 1
- Run engine gate and lock Unity.
- Finish core simulation loop and telemetry baseline.
- Validate remote config + AB keys.

## Week 2
- Tune upgrades and 30-stage difficulty curve.
- Integrate rewarded ad cooldown + reward paths.
- Run first balancing pass.

## Week 3
- Lock 3 IAP products.
- Finish mission reward loop.
- Add instrumentation checks for all required events.

## Week 4
- Android-first soft launch prep for KR/US.
- Create 3-5 UA creative variants and test hypotheses.
- Market/creative commands:
  - `npm run scaffold:market-signals -- --from docs/market-signals.example.json`
  - `npm run build:market-brief -- --input docs/market-signals.example.json`
  - `npm run build:creative-batch -- --segment-report artifacts/launch/segment-launch-report.json`
  - `npm run build:creative-scripts -- --input artifacts/ua/creative-batch.json`

## Week 5-8
- Iterate by retention/monetization signals.
- Prioritize onboarding, ad fatigue control, and purchase conversion.
- Add small content increments only after KPI bottlenecks are resolved.

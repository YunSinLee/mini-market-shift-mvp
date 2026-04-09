# Test and KPI Gates

## Functional gates
- No core loop deadlock during active sessions.
- Upgrade application mismatch: 0.
- Rewarded ad grant mismatch target: < 1%.
- IAP fulfillment mismatch: 0.

## Data quality gates
- Required event fields present on 100% of events.
- Event schema load/validation succeeds.
- Country/platform segmentation possible from raw event stream.
- Automated check command: `npm run analyze:telemetry`.

## Business gates
- Gate 1 (>= 400 installs): D1 >= 25%, D3 >= 10%.
- Gate 2 (>= 1,000 installs): D7 >= 6%, rewarded ad participation >= 25% DAU, payer conversion >= 1%.
- KPI snapshot build command: `npm run build:kpi-snapshot -- --ua <ua_summary.json>`.
- Automated evaluation command: `npm run evaluate:gates -- --input <kpi_snapshot.json>`.
- Tuning recommendation command: `npm run recommend:tuning`.
- KR/US split report command: `npm run build:segment-report -- --segments <ua_segments.json>`.
- Override apply command: `npm run apply:overrides -- --country <KR|US> --platform android`.
- Segment override bundle command: `npm run build:segment-overrides -- --activate-country <KR|US> --activate-platform android`.
- Both override commands default to confidence-safe mode; use `--force-unsafe` only when sample quality is known to be sufficient.

If business gates fail:
- Retune onboarding, difficulty pacing, ad timing.
- Re-test before any genre pivot.

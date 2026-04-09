# Unity Integration Guide

## 1) Scene setup
- Fast path: run Unity editor menu `Tools/Mini Market Shift/Setup MVP Scene`.
  - Auto-creates and wires:
    - `GameBootstrap`
    - `GameLoopPresenter`
    - `RuntimeSmokeRunner`

- Create an empty object `GameBootstrap` and attach:
  - `MiniMarketShift.Runtime.GameBootstrap`
- Preferred flow: leave TextAsset fields empty and use StreamingAssets fallback.
- If you prefer explicit assignment, assign TextAssets from `Assets/StreamingAssets/mvp-config`:
  - `remote-config.default.json`
  - `ab-flags.default.json`
  - `stations.json`
  - `upgrades.json`
  - `difficulty-curve.json`
  - `daily-missions.json`
  - `iap-products.json`

- Create another object `GameLoopPresenter` and attach:
  - `MiniMarketShift.Runtime.GameLoopPresenter`
- Drag `GameBootstrap` object reference into presenter.

`GameBootstrap` runtime options:
- `useStreamingAssetsFallback = true`: auto-load config files if TextAssets are not assigned.
- `applyRemoteOverridesFromStreamingAssets = true`: applies optional runtime overrides when files exist:
  - `remote-config.override.json`
  - `ab-flags.override.json`
- `applyLiveOpsLiteFromStreamingAssets = true`: applies optional day/event runtime patches when file exists:
  - `liveops-lite-plan.json`
  - expected location: `Assets/StreamingAssets/mvp-config/liveops-lite-plan.json`

## 2) UI wiring
Connect button `OnClick` to presenter methods:
- `OnRewardDoubleIncome`
- `OnRewardInstantUpgrade`
- `OnRewardFailureRecovery`
- `OnBuyRemoveAds`
- `OnBuyStarterBundle`
- `OnBuyBoosterBundle`
- `OnBuyFirstAffordableUpgrade`
- `OnClaimCompletedMissions`

## 3) SDK switching
In `GameBootstrap`:
- `useMockMonetizationServices = true`: local simulation mode.
- `useMockMonetizationServices = false`: switches to `AdMobAdService` and `UnityIapStoreService`.

When using AdMob service:
- Fill placement unit ids in `GameBootstrap` inspector:
  - `rewardedDoubleIncomeUnitId`
  - `rewardedInstantUpgradeUnitId`
  - `rewardedFailureRecoveryUnitId`
  - `interstitialSessionEndUnitId`
- Enable `GOOGLE_MOBILE_ADS` scripting define when AdMob package is installed.

When using Unity IAP service:
- Enable `UNITY_PURCHASING` scripting define with Unity IAP package installed.

## 4) Telemetry validation
`UnityTelemetryService` enforces allowed events from `TelemetryContract` and stores all records in-memory.
If Firebase Analytics package is enabled, switch to `FirebaseTelemetryService` and add `FIREBASE_ANALYTICS` define.

## 5) Runtime smoke
- Enable `RuntimeSmokeRunner.runOnStart = true` in scene to run an automated in-play smoke flow:
  - starts session
  - simulates ticks and upgrades
  - applies ad reward + starter IAP
  - validates end-session summary
- Check Console for `[RuntimeSmokeRunner] Smoke passed`.
- JSON report bridge:
  - `RuntimeSmokeRunner.writeReportToPersistentData = true`
  - report file: `Application.persistentDataPath/runtime-smoke-report.json`
  - report payload includes:
    - session summary
    - mission status
    - liveops activation summary (if enabled)
    - telemetry records

Validate smoke liveops checklist from repo root:
```bash
npm run check:unity-liveops -- --input <runtime-smoke-report.json>
```

For PR CI gate, place the latest device report at:
- `docs/runtime-smoke/runtime-smoke-report.device.json`

## 6) Config sync
Run from repo root:
```bash
npm run sync:unity-config
```
This copies root `config/*.json` into Unity `StreamingAssets`.

To generate and deploy weekly LiveOps template into Unity StreamingAssets:
```bash
npm run build:liveops-lite -- --unity-output UnityProject/Assets/StreamingAssets/mvp-config/liveops-lite-plan.json
```

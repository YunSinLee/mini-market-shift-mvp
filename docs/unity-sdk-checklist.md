# Unity SDK Wiring Checklist

## Ads (AdMob / mediation)
- `AdMobAdService` now has load/show flow implemented behind `GOOGLE_MOBILE_ADS`.
- Ensure scripting define is enabled and unit IDs are mapped in `GameBootstrap`.
- Keep reward grant finalization in `MiniMarketEngine.OfferRewardedAd` (do not duplicate economy writes in SDK callbacks).

## IAP (Unity IAP)
- `UnityIapStoreService` now initializes catalog and routes purchase callbacks when `UNITY_PURCHASING` is enabled.
- Keep economy mutation in `MiniMarketEngine.PurchaseIap` (SDK success only confirms transaction).

## Analytics (Firebase or other)
- Swap `UnityTelemetryService` with provider-backed implementation.
- Preserve event names and common fields in `TelemetryContract`.
- Use `RuntimeSmokeRunner` JSON report (`runtime-smoke-report.json`) to verify on-device telemetry shape before soft launch.

## Remote Config / A/B
- Optional runtime override is implemented via `StreamingAssetOverridesRemoteConfigService`.
- Drop override files into `Assets/StreamingAssets/mvp-config/`:
  - `remote-config.override.json`
  - `ab-flags.override.json`
- Optional liveops day/event patch is implemented via `StreamingAssetLiveOpsLiteService`.
- Drop liveops plan file into `Assets/StreamingAssets/mvp-config/`:
  - `liveops-lite-plan.json`
- Keep runtime keys stable:
  - `economy_multiplier`
  - `ad_cooldown_sec`
  - `rewarded_ad_multiplier`
  - `iap_price_tier`
  - `difficulty_curve_id`
  - `ab_ad_frequency`
  - `ab_offer_timing`
  - `ab_upgrade_cost_curve`

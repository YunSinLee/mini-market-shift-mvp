# Mini Market Shift MVP Spec

## Core loop
- Customer order handling -> coin gain -> facility/staff upgrade -> throughput growth.

## Scope locks
- Platform: mobile-first.
- Stations: 3 (`prep_counter`, `cook_line`, `checkout`).
- Upgrades: 20.
- Difficulty stages: 30.
- Daily missions: 3.
- Session target: 2-4 minutes.

## Monetization
- Rewarded ads: `double_income_30s`, `instant_upgrade`, `failure_recovery`.
- Interstitial ads: minimal, session-end only, frequency controlled by AB flag.
- IAPs: `remove_ads`, `starter_bundle`, `booster_bundle`.

## Remote config contract
- `economy_multiplier`
- `ad_cooldown_sec`
- `rewarded_ad_multiplier`
- `iap_price_tier`
- `difficulty_curve_id`

## Experiment flags
- `ab_ad_frequency`
- `ab_offer_timing`
- `ab_upgrade_cost_curve`

## Telemetry events
- `session_start`, `session_end`
- `level_start`, `level_complete`
- `upgrade_purchase`
- `ad_offer_shown`, `ad_reward_granted`
- `iap_offer_view`, `iap_purchase`

All events carry common fields:
- `user_id`, `country`, `platform`, `build_version`, `session_id`, `event_time`

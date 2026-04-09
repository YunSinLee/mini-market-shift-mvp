using System;
using System.Collections.Generic;
using System.Globalization;
using System.Linq;
using System.Text;
using MiniMarketShift.Services;

namespace MiniMarketShift.Core
{
    public sealed class MiniMarketEngine
    {
        private const float BaseDemandPerMin = 20f;
        private const float BaseOrderValue = 5f;

        private readonly GameDataBundle _data;
        private readonly ITelemetryService _telemetry;
        private readonly MissionTracker _missionTracker;

        private bool _sessionActive;
        private float _lastRewardedAdAtSec;
        private float _pendingDemand;
        private float _pendingCapacity;

        public GameState State { get; }

        public MiniMarketEngine(GameDataBundle data, ITelemetryService telemetry)
        {
            _data = data ?? throw new ArgumentNullException(nameof(data));
            _telemetry = telemetry ?? throw new ArgumentNullException(nameof(telemetry));
            _missionTracker = new MissionTracker(data.dailyMissions ?? throw new ArgumentNullException(nameof(data.dailyMissions)));

            State = new GameState();
            foreach (var station in _data.stations)
            {
                State.stations.Add(new StationRuntime
                {
                    id = station.id,
                    multiplier = 1f,
                    flatThroughput = 0f
                });
            }

            _lastRewardedAdAtSec = float.NegativeInfinity;
            _sessionActive = false;
        }

        public string StartSession()
        {
            if (_sessionActive)
            {
                throw new InvalidOperationException("Session is already active.");
            }

            _sessionActive = true;
            State.sessionsPlayed += 1;
            State.currentSessionSeconds = 0f;
            State.currentSessionRevenue = 0f;
            _pendingDemand = 0f;
            _pendingCapacity = 0f;

            var sessionId = Guid.NewGuid().ToString("N");
            _telemetry.StartSession(sessionId, Payload(("starting_stage", State.stage)));
            _telemetry.Emit(TelemetryContract.LevelStart, Payload(("stage", State.stage)));

            return sessionId;
        }

        public TickResult Tick(float seconds)
        {
            if (!_sessionActive)
            {
                throw new InvalidOperationException("Call StartSession before Tick.");
            }

            if (seconds <= 0f)
            {
                return new TickResult
                {
                    served = 0,
                    failed = 0,
                    coins = Round2(State.coins),
                    stage = State.stage
                };
            }

            State.currentSessionSeconds += seconds;
            var stageRow = _data.difficultyCurve[State.stage - 1];

            var demandPerSec = (BaseDemandPerMin * stageRow.demand_multiplier * _data.remoteConfig.economy_multiplier) / 60f;
            var capacityPerSec = CalculateCurrentThroughputPerMin() / 60f;

            _pendingDemand += demandPerSec * seconds;
            _pendingCapacity += capacityPerSec * seconds;

            var demandUnits = (int)Math.Floor(_pendingDemand);
            var capacityUnits = (int)Math.Floor(_pendingCapacity);
            var served = Math.Min(demandUnits, capacityUnits);
            var failed = Math.Max(0, demandUnits - capacityUnits);

            _pendingDemand -= demandUnits;
            _pendingCapacity -= capacityUnits;

            if (served > 0)
            {
                var income = served * GetCurrentOrderValue();
                State.coins += income;
                State.currentSessionRevenue += income;
                State.totalServedCustomers += served;
                _missionTracker.RegisterAction("serve_customers", served);
                CheckStageProgression();
            }

            if (failed > 0)
            {
                State.totalFailedCustomers += failed;
            }

            return new TickResult
            {
                served = served,
                failed = failed,
                coins = Round2(State.coins),
                stage = State.stage
            };
        }

        public RewardAdResult OfferRewardedAd(string rewardType)
        {
            if (!_sessionActive)
            {
                return new RewardAdResult
                {
                    ok = false,
                    reason = "no_active_session"
                };
            }

            var nowSec = State.currentSessionSeconds;
            if (nowSec - _lastRewardedAdAtSec < _data.remoteConfig.ad_cooldown_sec)
            {
                return new RewardAdResult
                {
                    ok = false,
                    reason = "cooldown_active"
                };
            }

            _telemetry.Emit(
                TelemetryContract.AdOfferShown,
                Payload(
                    ("reward_type", rewardType),
                    ("offer_timing", _data.abFlags.ab_offer_timing)
                )
            );

            float rewardValue;
            switch (rewardType)
            {
                case "double_income_30s":
                    State.activeIncomeBoostUntilSec = Math.Max(State.activeIncomeBoostUntilSec, nowSec + 30f);
                    rewardValue = 30f;
                    break;
                case "instant_upgrade":
                    State.instantUpgradeCredits += 1;
                    rewardValue = 1f;
                    break;
                case "failure_recovery":
                    var recovered = Math.Min(10, State.totalFailedCustomers);
                    State.totalFailedCustomers -= recovered;
                    var recoveredCoins = recovered * GetCurrentOrderValue();
                    State.coins += recoveredCoins;
                    State.currentSessionRevenue += recoveredCoins;
                    rewardValue = recovered;
                    break;
                default:
                    return new RewardAdResult
                    {
                        ok = false,
                        reason = "unsupported_reward_type"
                    };
            }

            _lastRewardedAdAtSec = nowSec;
            _missionTracker.RegisterAction("watch_rewarded_ad", 1);

            _telemetry.Emit(
                TelemetryContract.AdRewardGranted,
                Payload(
                    ("reward_type", rewardType),
                    ("reward_value", rewardValue)
                )
            );

            return new RewardAdResult
            {
                ok = true,
                reward_type = rewardType,
                reward_value = rewardValue
            };
        }

        public PurchaseUpgradeResult PurchaseUpgrade(string upgradeId)
        {
            var upgrade = _data.upgrades.FirstOrDefault(item => item.id == upgradeId);
            if (upgrade == null)
            {
                return new PurchaseUpgradeResult { ok = false, reason = "upgrade_not_found" };
            }

            if (State.purchasedUpgradeIds.Contains(upgradeId))
            {
                return new PurchaseUpgradeResult { ok = false, reason = "already_purchased" };
            }

            var cost = GetUpgradeCost(upgrade.cost);
            if (State.coins < cost)
            {
                return new PurchaseUpgradeResult { ok = false, reason = "insufficient_coins" };
            }

            State.coins -= cost;
            ApplyUpgrade(upgrade);
            State.purchasedUpgradeIds.Add(upgradeId);
            _missionTracker.RegisterAction("purchase_upgrade", 1);

            _telemetry.Emit(
                TelemetryContract.UpgradePurchase,
                Payload(
                    ("upgrade_id", upgradeId),
                    ("category", upgrade.category),
                    ("cost", Round2(cost)),
                    ("coins_after", Round2(State.coins))
                )
            );

            return new PurchaseUpgradeResult
            {
                ok = true,
                upgrade_id = upgradeId,
                cost = Round2(cost)
            };
        }

        public ViewIapOfferResult ViewIapOffer(string productId)
        {
            var product = _data.iapProducts.FirstOrDefault(item => item.id == productId);
            if (product == null)
            {
                return new ViewIapOfferResult { ok = false, reason = "product_not_found" };
            }

            _telemetry.Emit(
                TelemetryContract.IapOfferView,
                Payload(
                    ("product_id", product.id),
                    ("iap_price_tier", _data.remoteConfig.iap_price_tier),
                    ("base_price_usd", product.base_price_usd)
                )
            );

            return new ViewIapOfferResult
            {
                ok = true,
                product = product
            };
        }

        public PurchaseIapResult PurchaseIap(string productId)
        {
            var product = _data.iapProducts.FirstOrDefault(item => item.id == productId);
            if (product == null)
            {
                return new PurchaseIapResult { ok = false, reason = "product_not_found" };
            }

            State.coins += product.coins;
            State.boosterTokens += product.booster_tokens;
            if (product.ad_free)
            {
                State.adFree = true;
            }

            _telemetry.Emit(
                TelemetryContract.IapPurchase,
                Payload(
                    ("product_id", product.id),
                    ("kind", product.kind),
                    ("price_usd", product.base_price_usd),
                    ("coins_added", product.coins),
                    ("booster_tokens_added", product.booster_tokens),
                    ("ad_free_enabled", product.ad_free)
                )
            );

            return new PurchaseIapResult
            {
                ok = true,
                product_id = productId
            };
        }

        public List<MissionStatus> GetDailyMissionStatus()
        {
            return _missionTracker.GetStatus();
        }

        public ClaimMissionResult ClaimMission(string missionId)
        {
            var reward = _missionTracker.Claim(missionId);
            if (reward > 0)
            {
                State.coins += reward;
                return new ClaimMissionResult
                {
                    ok = true,
                    reward_coins = reward
                };
            }

            return new ClaimMissionResult
            {
                ok = false,
                reward_coins = 0
            };
        }

        public SessionSummary EndSession(IAdService adService)
        {
            if (!_sessionActive)
            {
                throw new InvalidOperationException("No active session to end.");
            }

            var showInterstitial = adService != null && adService.ShouldShowInterstitial(
                State.sessionsPlayed,
                State.adFree,
                _data.abFlags.ab_ad_frequency
            );

            if (showInterstitial)
            {
                adService.ShowInterstitial("session_end_interstitial");
            }

            _telemetry.EndSession(
                Payload(
                    ("stage", State.stage),
                    ("served_customers", State.totalServedCustomers),
                    ("failed_customers", State.totalFailedCustomers),
                    ("session_revenue", Round2(State.currentSessionRevenue)),
                    ("coins", Round2(State.coins)),
                    ("interstitial_shown", showInterstitial)
                )
            );

            _sessionActive = false;

            return new SessionSummary
            {
                stage = State.stage,
                session_seconds = Round2(State.currentSessionSeconds),
                session_revenue = Round2(State.currentSessionRevenue),
                total_coins = Round2(State.coins),
                served_customers = State.totalServedCustomers,
                failed_customers = State.totalFailedCustomers,
                interstitial_shown = showInterstitial
            };
        }

        private void CheckStageProgression()
        {
            while (State.stage < _data.difficultyCurve.Count)
            {
                var currentStageGoal = _data.difficultyCurve[State.stage - 1].completion_goal_customers;
                if (State.totalServedCustomers < currentStageGoal)
                {
                    break;
                }

                var completedStage = State.stage;
                _telemetry.Emit(
                    TelemetryContract.LevelComplete,
                    Payload(
                        ("stage", completedStage),
                        ("served_customers", State.totalServedCustomers)
                    )
                );

                State.stage += 1;
                _telemetry.Emit(TelemetryContract.LevelStart, Payload(("stage", State.stage)));
            }
        }

        private float CalculateCurrentThroughputPerMin()
        {
            var stationThroughput = 0f;
            foreach (var stationConfig in _data.stations)
            {
                var runtimeStation = State.stations.First(station => station.id == stationConfig.id);
                stationThroughput += stationConfig.base_throughput_per_min * runtimeStation.multiplier + runtimeStation.flatThroughput;
            }

            return stationThroughput * State.globalThroughputMultiplier * State.staffMultiplier;
        }

        private float GetCurrentOrderValue()
        {
            var stageMultiplier = _data.difficultyCurve[State.stage - 1].order_value_multiplier;
            var adMultiplier = State.currentSessionSeconds <= State.activeIncomeBoostUntilSec
                ? _data.remoteConfig.rewarded_ad_multiplier
                : 1f;

            return BaseOrderValue * stageMultiplier * State.orderValueMultiplier * adMultiplier;
        }

        private float GetUpgradeCost(float baseCost)
        {
            var cost = baseCost;
            if (_data.abFlags.ab_upgrade_cost_curve == "discount_10")
            {
                cost = (float)Math.Ceiling(baseCost * 0.9f);
            }

            if (State.instantUpgradeCredits > 0)
            {
                State.instantUpgradeCredits -= 1;
                return 0f;
            }

            return cost;
        }

        private void ApplyUpgrade(UpgradeDefinition upgrade)
        {
            switch (upgrade.category)
            {
                case "station_multiplier":
                {
                    var station = State.stations.First(item => item.id == upgrade.target_station);
                    station.multiplier *= upgrade.multiplier;
                    break;
                }
                case "station_flat":
                {
                    var station = State.stations.First(item => item.id == upgrade.target_station);
                    station.flatThroughput += upgrade.flat_throughput;
                    break;
                }
                case "global_throughput_multiplier":
                    State.globalThroughputMultiplier *= upgrade.multiplier;
                    break;
                case "order_value_multiplier":
                    State.orderValueMultiplier *= upgrade.multiplier;
                    break;
                case "staff_multiplier":
                    State.staffMultiplier *= upgrade.multiplier;
                    break;
                default:
                    throw new InvalidOperationException($"Unsupported upgrade category: {upgrade.category}");
            }
        }

        private static float Round2(float value)
        {
            return (float)Math.Round(value, 2, MidpointRounding.AwayFromZero);
        }

        private static string Payload(params (string key, object value)[] fields)
        {
            var sb = new StringBuilder();
            sb.Append('{');
            for (var i = 0; i < fields.Length; i++)
            {
                var (key, value) = fields[i];
                if (i > 0)
                {
                    sb.Append(',');
                }

                sb.Append('"').Append(EscapeJson(key)).Append('"').Append(':').Append(ToJsonValue(value));
            }
            sb.Append('}');
            return sb.ToString();
        }

        private static string ToJsonValue(object value)
        {
            if (value == null)
            {
                return "null";
            }

            switch (value)
            {
                case bool boolValue:
                    return boolValue ? "true" : "false";
                case string stringValue:
                    return $"\"{EscapeJson(stringValue)}\"";
                case int intValue:
                    return intValue.ToString(CultureInfo.InvariantCulture);
                case float floatValue:
                    return floatValue.ToString("0.###", CultureInfo.InvariantCulture);
                case double doubleValue:
                    return doubleValue.ToString("0.###", CultureInfo.InvariantCulture);
                default:
                    return $"\"{EscapeJson(value.ToString())}\"";
            }
        }

        private static string EscapeJson(string text)
        {
            return text
                .Replace("\\", "\\\\")
                .Replace("\"", "\\\"");
        }
    }
}

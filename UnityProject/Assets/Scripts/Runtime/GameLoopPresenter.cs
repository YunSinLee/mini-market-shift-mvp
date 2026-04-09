using System.Linq;
using MiniMarketShift.Core;
using UnityEngine;

namespace MiniMarketShift.Runtime
{
    public sealed class GameLoopPresenter : MonoBehaviour
    {
        [SerializeField] private GameBootstrap bootstrap;
        [SerializeField] private bool autoStartSession = true;
        [SerializeField] private float tickMultiplier = 1f;

        private bool _sessionActive;

        private void Start()
        {
            if (bootstrap == null)
            {
                bootstrap = FindObjectOfType<GameBootstrap>();
            }

            if (bootstrap == null)
            {
                Debug.LogError("[GameLoopPresenter] GameBootstrap not found.");
                enabled = false;
                return;
            }

            if (autoStartSession)
            {
                StartGameplaySession();
            }
        }

        private void Update()
        {
            if (!_sessionActive)
            {
                return;
            }

            bootstrap.Engine.Tick(Time.deltaTime * tickMultiplier);
        }

        public void StartGameplaySession()
        {
            if (_sessionActive)
            {
                return;
            }

            var sessionId = bootstrap.Engine.StartSession();
            _sessionActive = true;
            Debug.Log($"[GameLoopPresenter] Session started: {sessionId}");
        }

        public void EndGameplaySession()
        {
            if (!_sessionActive)
            {
                return;
            }

            var summary = bootstrap.Engine.EndSession(bootstrap.AdService);
            _sessionActive = false;

            Debug.Log(
                $"[GameLoopPresenter] Session ended. stage={summary.stage}, " +
                $"coins={summary.total_coins}, revenue={summary.session_revenue}, " +
                $"served={summary.served_customers}, failed={summary.failed_customers}"
            );
        }

        public void OnRewardDoubleIncome()
        {
            TriggerReward("double_income_30s");
        }

        public void OnRewardInstantUpgrade()
        {
            TriggerReward("instant_upgrade");
        }

        public void OnRewardFailureRecovery()
        {
            TriggerReward("failure_recovery");
        }

        public void OnBuyRemoveAds()
        {
            PurchaseProduct("remove_ads");
        }

        public void OnBuyStarterBundle()
        {
            PurchaseProduct("starter_bundle");
        }

        public void OnBuyBoosterBundle()
        {
            PurchaseProduct("booster_bundle");
        }

        public void OnBuyFirstAffordableUpgrade()
        {
            foreach (var upgrade in bootstrap.Data.upgrades)
            {
                if (bootstrap.Engine.State.purchasedUpgradeIds.Contains(upgrade.id))
                {
                    continue;
                }

                var result = bootstrap.Engine.PurchaseUpgrade(upgrade.id);
                if (result.ok)
                {
                    return;
                }

                if (result.reason != "insufficient_coins")
                {
                    Debug.LogWarning(
                        $"[GameLoopPresenter] Upgrade failed: id={upgrade.id}, reason={result.reason}"
                    );
                }
            }

            Debug.Log("[GameLoopPresenter] No affordable upgrade available.");
        }

        public void OnClaimCompletedMissions()
        {
            foreach (var mission in bootstrap.Engine.GetDailyMissionStatus())
            {
                if (!mission.completed || mission.claimed)
                {
                    continue;
                }

                var claimResult = bootstrap.Engine.ClaimMission(mission.id);
                if (claimResult.ok)
                {
                    Debug.Log($"[GameLoopPresenter] Claimed mission {mission.id}, +{claimResult.reward_coins} coins");
                }
            }
        }

        private void TriggerReward(string rewardType)
        {
            if (!_sessionActive)
            {
                Debug.LogWarning("[GameLoopPresenter] Reward requested without active session.");
                return;
            }

            bootstrap.AdService.ShowRewarded(rewardType, success =>
            {
                if (!success)
                {
                    Debug.LogWarning($"[GameLoopPresenter] Rewarded ad failed: {rewardType}");
                    return;
                }

                var result = bootstrap.Engine.OfferRewardedAd(rewardType);
                if (!result.ok)
                {
                    Debug.LogWarning($"[GameLoopPresenter] Reward not granted: {result.reason}");
                }
            });
        }

        private void PurchaseProduct(string productId)
        {
            bootstrap.Engine.ViewIapOffer(productId);

            bootstrap.IapService.Purchase(productId, (success, error) =>
            {
                if (!success)
                {
                    Debug.LogWarning($"[GameLoopPresenter] IAP failed: {productId}, reason={error}");
                    return;
                }

                var result = bootstrap.Engine.PurchaseIap(productId);
                if (!result.ok)
                {
                    Debug.LogWarning($"[GameLoopPresenter] IAP apply failed: {result.reason}");
                }
            });
        }

        private void OnApplicationPause(bool pauseStatus)
        {
            if (pauseStatus)
            {
                EndGameplaySession();
            }
        }

        private void OnApplicationQuit()
        {
            EndGameplaySession();
        }
    }
}

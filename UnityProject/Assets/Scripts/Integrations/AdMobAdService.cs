using System;
using System.Collections.Generic;
using MiniMarketShift.Services;
using UnityEngine;

#if GOOGLE_MOBILE_ADS
using GoogleMobileAds.Api;
#endif

namespace MiniMarketShift.Integrations
{
    public sealed class AdMobAdService : IAdService
    {
        private readonly bool _forceMockSuccess;
        private readonly Dictionary<string, string> _rewardedUnitsByPlacement;
        private readonly Dictionary<string, string> _interstitialUnitsByPlacement;

        public AdMobAdService(
            bool forceMockSuccess = true,
            Dictionary<string, string> rewardedUnitsByPlacement = null,
            Dictionary<string, string> interstitialUnitsByPlacement = null
        )
        {
            _forceMockSuccess = forceMockSuccess;
            _rewardedUnitsByPlacement = rewardedUnitsByPlacement ?? new Dictionary<string, string>();
            _interstitialUnitsByPlacement = interstitialUnitsByPlacement ?? new Dictionary<string, string>();
        }

        public void Initialize()
        {
#if GOOGLE_MOBILE_ADS
            MobileAds.Initialize(_ =>
            {
                Debug.Log("[AdMobAdService] AdMob initialized.");
            });
#else
            Debug.LogWarning("[AdMobAdService] GOOGLE_MOBILE_ADS define is not enabled. Using fallback behavior.");
#endif
        }

        public void ShowRewarded(string placementId, Action<bool> onFinished)
        {
#if GOOGLE_MOBILE_ADS
            if (!_rewardedUnitsByPlacement.TryGetValue(placementId, out var adUnitId))
            {
                Debug.LogWarning($"[AdMobAdService] Missing rewarded ad unit for placement: {placementId}");
                onFinished?.Invoke(false);
                return;
            }

            var request = new AdRequest();
            RewardedAd.Load(adUnitId, request, (rewardedAd, loadError) =>
            {
                if (loadError != null || rewardedAd == null)
                {
                    Debug.LogWarning($"[AdMobAdService] Rewarded load failed ({placementId}): {loadError}");
                    onFinished?.Invoke(false);
                    return;
                }

                var rewarded = false;
                rewardedAd.OnAdFullScreenContentClosed += () =>
                {
                    onFinished?.Invoke(rewarded);
                    rewardedAd.Destroy();
                };
                rewardedAd.OnAdFullScreenContentFailed += adError =>
                {
                    Debug.LogWarning($"[AdMobAdService] Rewarded show failed ({placementId}): {adError}");
                    onFinished?.Invoke(false);
                    rewardedAd.Destroy();
                };
                rewardedAd.Show(_ => { rewarded = true; });
            });
#else
            Debug.Log($"[AdMobAdService] Fallback rewarded path: {placementId}");
            onFinished?.Invoke(_forceMockSuccess);
#endif
        }

        public bool ShouldShowInterstitial(int sessionsPlayed, bool adFree, string adFrequencyFlag)
        {
            if (adFree || adFrequencyFlag == "off")
            {
                return false;
            }

            if (adFrequencyFlag == "low")
            {
                return sessionsPlayed % 3 == 0;
            }
            if (adFrequencyFlag == "medium")
            {
                return sessionsPlayed % 2 == 0;
            }

            return true;
        }

        public void ShowInterstitial(string placementId)
        {
#if GOOGLE_MOBILE_ADS
            if (!_interstitialUnitsByPlacement.TryGetValue(placementId, out var adUnitId))
            {
                Debug.LogWarning($"[AdMobAdService] Missing interstitial ad unit for placement: {placementId}");
                return;
            }

            var request = new AdRequest();
            InterstitialAd.Load(adUnitId, request, (interstitialAd, loadError) =>
            {
                if (loadError != null || interstitialAd == null)
                {
                    Debug.LogWarning($"[AdMobAdService] Interstitial load failed ({placementId}): {loadError}");
                    return;
                }

                interstitialAd.OnAdFullScreenContentClosed += () => interstitialAd.Destroy();
                interstitialAd.OnAdFullScreenContentFailed += _ => interstitialAd.Destroy();
                interstitialAd.Show();
            });
#else
            Debug.Log($"[AdMobAdService] Fallback interstitial path: {placementId}");
#endif
        }
    }
}

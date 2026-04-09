using System;
using MiniMarketShift.Services;
using UnityEngine;

namespace MiniMarketShift.Integrations
{
    public sealed class MockAdService : IAdService
    {
        public void Initialize()
        {
            Debug.Log("[MockAdService] initialized");
        }

        public void ShowRewarded(string placementId, Action<bool> onFinished)
        {
            Debug.Log($"[MockAdService] rewarded shown: {placementId}");
            onFinished?.Invoke(true);
        }

        public bool ShouldShowInterstitial(int sessionsPlayed, bool adFree, string adFrequencyFlag)
        {
            if (adFree)
            {
                return false;
            }

            if (adFrequencyFlag == "off")
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
            Debug.Log($"[MockAdService] interstitial shown: {placementId}");
        }
    }
}

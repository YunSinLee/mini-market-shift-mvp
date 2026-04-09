using System;

namespace MiniMarketShift.Services
{
    public interface IAdService
    {
        void Initialize();
        void ShowRewarded(string placementId, Action<bool> onFinished);
        bool ShouldShowInterstitial(int sessionsPlayed, bool adFree, string adFrequencyFlag);
        void ShowInterstitial(string placementId);
    }
}

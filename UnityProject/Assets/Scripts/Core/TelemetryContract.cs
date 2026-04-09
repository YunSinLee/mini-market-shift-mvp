using System.Collections.Generic;

namespace MiniMarketShift.Core
{
    public static class TelemetryContract
    {
        public const string SessionStart = "session_start";
        public const string SessionEnd = "session_end";
        public const string LevelStart = "level_start";
        public const string LevelComplete = "level_complete";
        public const string UpgradePurchase = "upgrade_purchase";
        public const string AdOfferShown = "ad_offer_shown";
        public const string AdRewardGranted = "ad_reward_granted";
        public const string IapOfferView = "iap_offer_view";
        public const string IapPurchase = "iap_purchase";

        public static readonly HashSet<string> AllowedEvents = new HashSet<string>
        {
            SessionStart,
            SessionEnd,
            LevelStart,
            LevelComplete,
            UpgradePurchase,
            AdOfferShown,
            AdRewardGranted,
            IapOfferView,
            IapPurchase
        };
    }
}

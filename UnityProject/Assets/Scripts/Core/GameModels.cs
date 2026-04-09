using System;
using System.Collections.Generic;

namespace MiniMarketShift.Core
{
    [Serializable]
    public class StationDefinition
    {
        public string id;
        public string name;
        public float base_throughput_per_min;
    }

    [Serializable]
    public class UpgradeDefinition
    {
        public string id;
        public string name;
        public string category;
        public string target_station;
        public float cost;
        public float multiplier;
        public float flat_throughput;
    }

    [Serializable]
    public class DifficultyRow
    {
        public int stage;
        public float demand_multiplier;
        public float order_value_multiplier;
        public int completion_goal_customers;
    }

    [Serializable]
    public class MissionDefinition
    {
        public string id;
        public string name;
        public string type;
        public int goal;
        public int reward_coins;
    }

    [Serializable]
    public class IapProductDefinition
    {
        public string id;
        public string name;
        public string kind;
        public float base_price_usd;
        public int coins;
        public bool ad_free;
        public int booster_tokens;
    }

    [Serializable]
    public class RemoteConfig
    {
        public float economy_multiplier = 1f;
        public float ad_cooldown_sec = 90f;
        public float rewarded_ad_multiplier = 2f;
        public string iap_price_tier = "tier_1";
        public string difficulty_curve_id = "default_v1";
    }

    [Serializable]
    public class AbFlags
    {
        public string ab_ad_frequency = "low";
        public string ab_offer_timing = "mid_session";
        public string ab_upgrade_cost_curve = "baseline";
    }

    [Serializable]
    public class LiveOpsTargetSegment
    {
        public string country;
        public string platform;
    }

    [Serializable]
    public class LiveOpsPrioritySegment
    {
        public LiveOpsTargetSegment segment;
        public float score;
        public int failed_checks;
        public string severity;
        public float cpi;
    }

    [Serializable]
    public class LiveOpsStrategy
    {
        public string primary_goal;
        public string severity;
        public string rationale;
        public List<string> target_countries = new List<string>();
        public List<LiveOpsPrioritySegment> priority_segments = new List<LiveOpsPrioritySegment>();
        public string recommended_action;
    }

    [Serializable]
    public class LiveOpsMissionTemplate
    {
        public string template_id;
        public string type;
        public string name;
        public int goal;
        public int reward_coins;
    }

    [Serializable]
    public class LiveOpsDailyMissionTemplate
    {
        public int day_index;
        public string day_label;
        public string objective;
        public List<string> target_countries = new List<string>();
        public List<LiveOpsMissionTemplate> missions = new List<LiveOpsMissionTemplate>();
    }

    [Serializable]
    public class LiveOpsRemoteConfigPatch
    {
        public float economy_multiplier = float.NaN;
        public float ad_cooldown_sec = float.NaN;
        public float rewarded_ad_multiplier = float.NaN;
        public string iap_price_tier;
        public string difficulty_curve_id;
    }

    [Serializable]
    public class LiveOpsAbFlagPatch
    {
        public string ab_ad_frequency;
        public string ab_offer_timing;
        public string ab_upgrade_cost_curve;
    }

    [Serializable]
    public class LiveOpsWeeklyEventTemplate
    {
        public string event_id;
        public string title;
        public string objective;
        public string primary_kpi;
        public int start_day;
        public int duration_days;
        public List<LiveOpsTargetSegment> target_segments = new List<LiveOpsTargetSegment>();
        public LiveOpsRemoteConfigPatch remote_config_patch;
        public LiveOpsAbFlagPatch ab_flag_patch;
        public string notes;
    }

    [Serializable]
    public class LiveOpsLitePlan
    {
        public string generated_at;
        public string week_label;
        public LiveOpsStrategy strategy;
        public List<LiveOpsDailyMissionTemplate> daily_mission_templates = new List<LiveOpsDailyMissionTemplate>();
        public List<LiveOpsWeeklyEventTemplate> weekly_event_templates = new List<LiveOpsWeeklyEventTemplate>();
        public List<string> reward_tuning_notes = new List<string>();
    }

    [Serializable]
    public class LiveOpsRuntimeActivation
    {
        public bool applied;
        public bool file_found;
        public string source_path;
        public int iso_day_index;
        public string selected_day_label;
        public string selected_primary_goal;
        public List<string> active_event_ids = new List<string>();
        public List<string> notes = new List<string>();
    }

    public sealed class GameDataBundle
    {
        public RemoteConfig remoteConfig;
        public AbFlags abFlags;
        public List<StationDefinition> stations;
        public List<UpgradeDefinition> upgrades;
        public List<DifficultyRow> difficultyCurve;
        public List<MissionDefinition> dailyMissions;
        public List<IapProductDefinition> iapProducts;
    }

    [Serializable]
    public class GameConfigTextAssets
    {
        public UnityEngine.TextAsset remoteConfigJson;
        public UnityEngine.TextAsset abFlagsJson;
        public UnityEngine.TextAsset stationsJson;
        public UnityEngine.TextAsset upgradesJson;
        public UnityEngine.TextAsset difficultyJson;
        public UnityEngine.TextAsset missionsJson;
        public UnityEngine.TextAsset iapJson;
    }

    [Serializable]
    public class StationRuntime
    {
        public string id;
        public float multiplier = 1f;
        public float flatThroughput = 0f;
    }

    [Serializable]
    public class GameState
    {
        public int stage = 1;
        public float coins = 0f;
        public bool adFree = false;
        public int boosterTokens = 0;
        public int totalServedCustomers = 0;
        public int totalFailedCustomers = 0;
        public float currentSessionRevenue = 0f;
        public float currentSessionSeconds = 0f;
        public int sessionsPlayed = 0;
        public float globalThroughputMultiplier = 1f;
        public float orderValueMultiplier = 1f;
        public float staffMultiplier = 1f;
        public int instantUpgradeCredits = 0;
        public float activeIncomeBoostUntilSec = 0f;
        public List<StationRuntime> stations = new List<StationRuntime>();
        public HashSet<string> purchasedUpgradeIds = new HashSet<string>();
    }

    [Serializable]
    public class SessionSummary
    {
        public int stage;
        public float session_seconds;
        public float session_revenue;
        public float total_coins;
        public int served_customers;
        public int failed_customers;
        public bool interstitial_shown;
    }

    [Serializable]
    public class RewardAdResult
    {
        public bool ok;
        public string reason;
        public string reward_type;
        public float reward_value;
    }

    [Serializable]
    public class PurchaseUpgradeResult
    {
        public bool ok;
        public string reason;
        public string upgrade_id;
        public float cost;
    }

    [Serializable]
    public class ViewIapOfferResult
    {
        public bool ok;
        public string reason;
        public IapProductDefinition product;
    }

    [Serializable]
    public class PurchaseIapResult
    {
        public bool ok;
        public string reason;
        public string product_id;
    }

    [Serializable]
    public class MissionStatus
    {
        public string id;
        public string name;
        public string type;
        public int progress;
        public int goal;
        public int reward_coins;
        public bool completed;
        public bool claimed;
    }

    [Serializable]
    public class ClaimMissionResult
    {
        public bool ok;
        public int reward_coins;
    }

    [Serializable]
    public class TickResult
    {
        public int served;
        public int failed;
        public float coins;
        public int stage;
    }

    [Serializable]
    public class TelemetryEventRecord
    {
        public string user_id;
        public string country;
        public string platform;
        public string build_version;
        public string session_id;
        public string event_time;
        public string event_name;
        public string payload_json;
    }
}

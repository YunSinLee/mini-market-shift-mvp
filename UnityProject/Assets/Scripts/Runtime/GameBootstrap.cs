using System.Collections.Generic;
using System.IO;
using MiniMarketShift.Core;
using MiniMarketShift.Integrations;
using MiniMarketShift.Services;
using UnityEngine;

namespace MiniMarketShift.Runtime
{
    public sealed class GameBootstrap : MonoBehaviour
    {
        [Header("Config Assets")]
        [SerializeField] private TextAsset remoteConfigJson;
        [SerializeField] private TextAsset abFlagsJson;
        [SerializeField] private TextAsset stationsJson;
        [SerializeField] private TextAsset upgradesJson;
        [SerializeField] private TextAsset difficultyJson;
        [SerializeField] private TextAsset missionsJson;
        [SerializeField] private TextAsset iapJson;

        [Header("Config Loading")]
        [SerializeField] private bool useStreamingAssetsFallback = true;
        [SerializeField] private string streamingAssetsConfigFolder = "mvp-config";
        [SerializeField] private bool applyRemoteOverridesFromStreamingAssets = true;
        [SerializeField] private bool applyLiveOpsLiteFromStreamingAssets = true;
        [SerializeField] private string liveOpsLiteFileName = "liveops-lite-plan.json";

        [Header("Context")]
        [SerializeField] private string userId = "local-user";
        [SerializeField] private string country = "KR";
        [SerializeField] private string platform = "android";
        [SerializeField] private string buildVersion = "0.1.0";

        [Header("Services")]
        [SerializeField] private bool useMockMonetizationServices = true;

        [Header("AdMob Placement Unit IDs")]
        [SerializeField] private string rewardedDoubleIncomeUnitId = "";
        [SerializeField] private string rewardedInstantUpgradeUnitId = "";
        [SerializeField] private string rewardedFailureRecoveryUnitId = "";
        [SerializeField] private string interstitialSessionEndUnitId = "";

        public GameDataBundle Data { get; private set; }
        public MiniMarketEngine Engine { get; private set; }
        public ITelemetryService TelemetryService { get; private set; }
        public IAdService AdService { get; private set; }
        public IIapService IapService { get; private set; }
        public LiveOpsRuntimeActivation LiveOpsActivation { get; private set; }

        private void Awake()
        {
            Data = GameDataLoader.Load(new GameConfigTextAssets
            {
                remoteConfigJson = ResolveConfigAsset(remoteConfigJson, "remote-config.default.json"),
                abFlagsJson = ResolveConfigAsset(abFlagsJson, "ab-flags.default.json"),
                stationsJson = ResolveConfigAsset(stationsJson, "stations.json"),
                upgradesJson = ResolveConfigAsset(upgradesJson, "upgrades.json"),
                difficultyJson = ResolveConfigAsset(difficultyJson, "difficulty-curve.json"),
                missionsJson = ResolveConfigAsset(missionsJson, "daily-missions.json"),
                iapJson = ResolveConfigAsset(iapJson, "iap-products.json")
            });

            if (applyRemoteOverridesFromStreamingAssets)
            {
                ApplyRemoteOverrides();
            }

            if (applyLiveOpsLiteFromStreamingAssets)
            {
                ApplyLiveOpsLite();
            }

            TelemetryService = new UnityTelemetryService();
            TelemetryService.ConfigureContext(userId, country, platform, buildVersion);

            if (useMockMonetizationServices)
            {
                AdService = new MockAdService();
                IapService = new MockIapService();
            }
            else
            {
                AdService = new AdMobAdService(
                    forceMockSuccess: false,
                    rewardedUnitsByPlacement: BuildRewardedPlacementMap(),
                    interstitialUnitsByPlacement: BuildInterstitialPlacementMap()
                );
                IapService = new UnityIapStoreService();
            }

            AdService.Initialize();
            IapService.Initialize(Data.iapProducts);

            Engine = new MiniMarketEngine(Data, TelemetryService);

            Debug.Log("[GameBootstrap] Mini Market Shift runtime initialized.");
        }

        private void ApplyRemoteOverrides()
        {
            var remote = Data.remoteConfig;
            var flags = Data.abFlags;
            var overrideService = new StreamingAssetOverridesRemoteConfigService(
                folderName: streamingAssetsConfigFolder
            );

            if (overrideService.TryOverride(ref remote, ref flags))
            {
                Data.remoteConfig = remote;
                Data.abFlags = flags;
            }
        }

        private void ApplyLiveOpsLite()
        {
            var remote = Data.remoteConfig;
            var flags = Data.abFlags;
            var missions = Data.dailyMissions;

            var service = new StreamingAssetLiveOpsLiteService(
                folderName: streamingAssetsConfigFolder,
                fileName: liveOpsLiteFileName
            );

            if (service.TryApply(
                ref remote,
                ref flags,
                ref missions,
                country,
                platform,
                out var activation
            ))
            {
                Data.remoteConfig = remote;
                Data.abFlags = flags;
                Data.dailyMissions = missions;
                LiveOpsActivation = activation;

                var eventCount = activation.active_event_ids != null ? activation.active_event_ids.Count : 0;
                Debug.Log(
                    $"[GameBootstrap] LiveOps Lite applied. day={activation.iso_day_index}, " +
                    $"template={activation.selected_day_label}, active_events={eventCount}"
                );
                return;
            }

            LiveOpsActivation = activation;
            if (activation != null && activation.file_found)
            {
                Debug.LogWarning("[GameBootstrap] LiveOps Lite file found but no patch was applied.");
            }
        }

        private TextAsset ResolveConfigAsset(TextAsset assignedAsset, string fileName)
        {
            if (assignedAsset != null)
            {
                return assignedAsset;
            }

            if (!useStreamingAssetsFallback)
            {
                return null;
            }

            var fullPath = Path.Combine(Application.streamingAssetsPath, streamingAssetsConfigFolder, fileName);
            if (!File.Exists(fullPath))
            {
                Debug.LogWarning($"[GameBootstrap] Missing config file in StreamingAssets: {fullPath}");
                return null;
            }

            var text = File.ReadAllText(fullPath);
            return new TextAsset(text);
        }

        private Dictionary<string, string> BuildRewardedPlacementMap()
        {
            var map = new Dictionary<string, string>();
            TryAddMap(map, "double_income_30s", rewardedDoubleIncomeUnitId);
            TryAddMap(map, "instant_upgrade", rewardedInstantUpgradeUnitId);
            TryAddMap(map, "failure_recovery", rewardedFailureRecoveryUnitId);
            return map;
        }

        private Dictionary<string, string> BuildInterstitialPlacementMap()
        {
            var map = new Dictionary<string, string>();
            TryAddMap(map, "session_end_interstitial", interstitialSessionEndUnitId);
            return map;
        }

        private static void TryAddMap(Dictionary<string, string> map, string key, string value)
        {
            if (!string.IsNullOrWhiteSpace(value))
            {
                map[key] = value.Trim();
            }
        }
    }
}

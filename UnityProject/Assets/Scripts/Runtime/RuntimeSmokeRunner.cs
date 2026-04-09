using System;
using System.Collections;
using System.Collections.Generic;
using System.IO;
using MiniMarketShift.Core;
using UnityEngine;

namespace MiniMarketShift.Runtime
{
    public sealed class RuntimeSmokeRunner : MonoBehaviour
    {
        [SerializeField] private GameBootstrap bootstrap;
        [SerializeField] private bool runOnStart = false;
        [SerializeField] private int simulatedSeconds = 120;
        [SerializeField] private bool autoRunRewardedAd = true;
        [SerializeField] private bool autoRunStarterIap = true;
        [SerializeField] private bool writeReportToPersistentData = true;
        [SerializeField] private string reportFileName = "runtime-smoke-report.json";
        [SerializeField] private bool includeTelemetryRecords = true;
        [SerializeField] private bool includeMissionStatus = true;

        private void Start()
        {
            if (!runOnStart)
            {
                return;
            }

            if (bootstrap == null)
            {
                bootstrap = FindObjectOfType<GameBootstrap>();
            }

            if (bootstrap == null)
            {
                Debug.LogError("[RuntimeSmokeRunner] GameBootstrap not found.");
                return;
            }

            StartCoroutine(RunSmoke());
        }

        private IEnumerator RunSmoke()
        {
            var sessionId = bootstrap.Engine.StartSession();
            Debug.Log($"[RuntimeSmokeRunner] Session started: {sessionId}");

            for (var i = 0; i < simulatedSeconds; i++)
            {
                bootstrap.Engine.Tick(1f);

                if (autoRunRewardedAd && i == 20)
                {
                    var rewardResult = bootstrap.Engine.OfferRewardedAd("double_income_30s");
                    Debug.Log($"[RuntimeSmokeRunner] Reward result ok={rewardResult.ok} reason={rewardResult.reason}");
                }

                if (i % 40 == 0)
                {
                    TryBuyFirstAffordableUpgrade();
                }

                yield return null;
            }

            if (autoRunStarterIap)
            {
                bootstrap.Engine.ViewIapOffer("starter_bundle");
                var iapResult = bootstrap.Engine.PurchaseIap("starter_bundle");
                Debug.Log($"[RuntimeSmokeRunner] Starter IAP result ok={iapResult.ok} reason={iapResult.reason}");
            }

            foreach (var mission in bootstrap.Engine.GetDailyMissionStatus())
            {
                if (mission.completed && !mission.claimed)
                {
                    bootstrap.Engine.ClaimMission(mission.id);
                }
            }

            var missionStatus = bootstrap.Engine.GetDailyMissionStatus();
            var summary = bootstrap.Engine.EndSession(bootstrap.AdService);
            var passed = ValidateSummary(summary);

            if (writeReportToPersistentData)
            {
                WriteReport(summary, missionStatus, passed);
            }
        }

        private void TryBuyFirstAffordableUpgrade()
        {
            var state = bootstrap.Engine.State;
            foreach (var upgrade in bootstrap.Data.upgrades)
            {
                if (state.purchasedUpgradeIds.Contains(upgrade.id))
                {
                    continue;
                }

                var result = bootstrap.Engine.PurchaseUpgrade(upgrade.id);
                if (!result.ok)
                {
                    if (result.reason != "insufficient_coins")
                    {
                        Debug.LogWarning(
                            $"[RuntimeSmokeRunner] Upgrade purchase failed: id={upgrade.id}, reason={result.reason}"
                        );
                    }
                    continue;
                }
                return;
            }
        }

        private static bool ValidateSummary(SessionSummary summary)
        {
            var loopOk = summary.served_customers > 0 && summary.total_coins >= 0f;
            if (!loopOk)
            {
                Debug.LogError("[RuntimeSmokeRunner] Core loop smoke failed.");
                return false;
            }

            Debug.Log(
                "[RuntimeSmokeRunner] Smoke passed: " +
                $"stage={summary.stage}, coins={summary.total_coins}, revenue={summary.session_revenue}, " +
                $"served={summary.served_customers}, failed={summary.failed_customers}, interstitial={summary.interstitial_shown}"
            );

            return true;
        }

        private void WriteReport(SessionSummary summary, List<MissionStatus> missionStatus, bool passed)
        {
            try
            {
                var reportPath = Path.Combine(Application.persistentDataPath, reportFileName);
                var report = new RuntimeSmokeReport
                {
                    generated_at = DateTime.UtcNow.ToString("O"),
                    passed = passed,
                    persistent_data_path = Application.persistentDataPath,
                    report_path = reportPath,
                    summary = summary,
                    missions = includeMissionStatus ? missionStatus : new List<MissionStatus>(),
                    liveops = bootstrap.LiveOpsActivation,
                    telemetry = includeTelemetryRecords
                        ? new List<TelemetryEventRecord>(bootstrap.TelemetryService.Records)
                        : new List<TelemetryEventRecord>()
                };

                var json = JsonUtility.ToJson(report, true);
                File.WriteAllText(reportPath, json);
                Debug.Log($"[RuntimeSmokeRunner] Smoke report written: {reportPath}");
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[RuntimeSmokeRunner] Failed to write smoke report: {ex.Message}");
            }
        }

        [Serializable]
        private sealed class RuntimeSmokeReport
        {
            public string generated_at;
            public bool passed;
            public string persistent_data_path;
            public string report_path;
            public SessionSummary summary;
            public List<MissionStatus> missions;
            public LiveOpsRuntimeActivation liveops;
            public List<TelemetryEventRecord> telemetry;
        }
    }
}

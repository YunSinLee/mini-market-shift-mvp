using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using MiniMarketShift.Core;
using UnityEngine;

namespace MiniMarketShift.Integrations
{
    public sealed class StreamingAssetLiveOpsLiteService
    {
        private readonly string _folderName;
        private readonly string _fileName;

        public StreamingAssetLiveOpsLiteService(
            string folderName = "mvp-config",
            string fileName = "liveops-lite-plan.json"
        )
        {
            _folderName = string.IsNullOrWhiteSpace(folderName) ? "mvp-config" : folderName.Trim();
            _fileName = string.IsNullOrWhiteSpace(fileName) ? "liveops-lite-plan.json" : fileName.Trim();
        }

        public bool TryApply(
            ref RemoteConfig remoteConfig,
            ref AbFlags abFlags,
            ref List<MissionDefinition> missions,
            string country,
            string platform,
            out LiveOpsRuntimeActivation activation
        )
        {
            var fullPath = Path.Combine(Application.streamingAssetsPath, _folderName, _fileName);
            activation = new LiveOpsRuntimeActivation
            {
                applied = false,
                file_found = false,
                source_path = fullPath,
                iso_day_index = GetIsoDayIndexUtc()
            };

            if (!File.Exists(fullPath))
            {
                activation.notes.Add("liveops_file_missing");
                return false;
            }

            activation.file_found = true;

            LiveOpsLitePlan plan;
            try
            {
                var json = File.ReadAllText(fullPath);
                plan = JsonUtility.FromJson<LiveOpsLitePlan>(json);
            }
            catch (Exception ex)
            {
                activation.notes.Add($"parse_error:{ex.Message}");
                return false;
            }

            if (plan == null)
            {
                activation.notes.Add("parse_error:null_plan");
                return false;
            }

            activation.selected_primary_goal = plan.strategy != null ? plan.strategy.primary_goal : null;

            var dayTemplate = PickDayTemplate(plan, activation.iso_day_index);
            if (dayTemplate != null && dayTemplate.missions != null && dayTemplate.missions.Count > 0)
            {
                missions = dayTemplate.missions.Select(item => new MissionDefinition
                {
                    id = string.IsNullOrWhiteSpace(item.template_id)
                        ? $"mission_{Guid.NewGuid().ToString("N").Substring(0, 8)}"
                        : item.template_id,
                    name = item.name,
                    type = item.type,
                    goal = Mathf.Max(1, item.goal),
                    reward_coins = Mathf.Max(1, item.reward_coins)
                }).ToList();

                activation.selected_day_label = dayTemplate.day_label;
                activation.applied = true;
                activation.notes.Add("daily_mission_template_applied");
            }
            else
            {
                activation.notes.Add("daily_mission_template_not_found");
            }

            var activeEvents = PickActiveEvents(plan, activation.iso_day_index, country, platform);
            foreach (var weeklyEvent in activeEvents)
            {
                if (!string.IsNullOrWhiteSpace(weeklyEvent.event_id))
                {
                    activation.active_event_ids.Add(weeklyEvent.event_id);
                }

                ApplyRemotePatch(weeklyEvent.remote_config_patch, ref remoteConfig, activation.notes);
                ApplyAbPatch(weeklyEvent.ab_flag_patch, ref abFlags, activation.notes);
            }

            if (activeEvents.Count > 0)
            {
                activation.applied = true;
            }

            return activation.applied;
        }

        private static LiveOpsDailyMissionTemplate PickDayTemplate(LiveOpsLitePlan plan, int dayIndex)
        {
            var templates = plan.daily_mission_templates ?? new List<LiveOpsDailyMissionTemplate>();
            if (templates.Count == 0)
            {
                return null;
            }

            var exact = templates.FirstOrDefault(template => template.day_index == dayIndex);
            if (exact != null)
            {
                return exact;
            }

            var ordered = templates.OrderBy(template => template.day_index).ToList();
            var moduloIndex = (dayIndex - 1) % ordered.Count;
            return ordered[moduloIndex];
        }

        private static List<LiveOpsWeeklyEventTemplate> PickActiveEvents(
            LiveOpsLitePlan plan,
            int dayIndex,
            string country,
            string platform
        )
        {
            var rows = plan.weekly_event_templates ?? new List<LiveOpsWeeklyEventTemplate>();
            var active = new List<LiveOpsWeeklyEventTemplate>();

            foreach (var row in rows)
            {
                if (!IsDayActive(dayIndex, row.start_day, row.duration_days))
                {
                    continue;
                }

                if (!MatchesSegment(row.target_segments, country, platform))
                {
                    continue;
                }

                active.Add(row);
            }

            return active;
        }

        private static bool IsDayActive(int currentDay, int startDay, int durationDays)
        {
            if (startDay < 1 || startDay > 7 || durationDays <= 0)
            {
                return false;
            }

            for (var i = 0; i < durationDays; i++)
            {
                var candidate = ((startDay - 1 + i) % 7) + 1;
                if (candidate == currentDay)
                {
                    return true;
                }
            }

            return false;
        }

        private static bool MatchesSegment(List<LiveOpsTargetSegment> targetSegments, string country, string platform)
        {
            if (targetSegments == null || targetSegments.Count == 0)
            {
                return true;
            }

            foreach (var segment in targetSegments)
            {
                if (segment == null)
                {
                    continue;
                }

                var countryOk = string.Equals(
                    segment.country ?? string.Empty,
                    country ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase
                );
                var platformOk = string.Equals(
                    segment.platform ?? string.Empty,
                    platform ?? string.Empty,
                    StringComparison.OrdinalIgnoreCase
                );

                if (countryOk && platformOk)
                {
                    return true;
                }
            }

            return false;
        }

        private static void ApplyRemotePatch(
            LiveOpsRemoteConfigPatch patch,
            ref RemoteConfig remoteConfig,
            List<string> notes
        )
        {
            if (patch == null || remoteConfig == null)
            {
                return;
            }

            if (!float.IsNaN(patch.economy_multiplier) && patch.economy_multiplier > 0f)
            {
                remoteConfig.economy_multiplier = patch.economy_multiplier;
                notes.Add("remote_patch:economy_multiplier");
            }

            if (!float.IsNaN(patch.ad_cooldown_sec) && patch.ad_cooldown_sec > 0f)
            {
                remoteConfig.ad_cooldown_sec = patch.ad_cooldown_sec;
                notes.Add("remote_patch:ad_cooldown_sec");
            }

            if (!float.IsNaN(patch.rewarded_ad_multiplier) && patch.rewarded_ad_multiplier > 0f)
            {
                remoteConfig.rewarded_ad_multiplier = patch.rewarded_ad_multiplier;
                notes.Add("remote_patch:rewarded_ad_multiplier");
            }

            if (!string.IsNullOrWhiteSpace(patch.iap_price_tier))
            {
                remoteConfig.iap_price_tier = patch.iap_price_tier;
                notes.Add("remote_patch:iap_price_tier");
            }

            if (!string.IsNullOrWhiteSpace(patch.difficulty_curve_id))
            {
                remoteConfig.difficulty_curve_id = patch.difficulty_curve_id;
                notes.Add("remote_patch:difficulty_curve_id");
            }
        }

        private static void ApplyAbPatch(LiveOpsAbFlagPatch patch, ref AbFlags abFlags, List<string> notes)
        {
            if (patch == null || abFlags == null)
            {
                return;
            }

            if (!string.IsNullOrWhiteSpace(patch.ab_ad_frequency))
            {
                abFlags.ab_ad_frequency = patch.ab_ad_frequency;
                notes.Add("ab_patch:ab_ad_frequency");
            }

            if (!string.IsNullOrWhiteSpace(patch.ab_offer_timing))
            {
                abFlags.ab_offer_timing = patch.ab_offer_timing;
                notes.Add("ab_patch:ab_offer_timing");
            }

            if (!string.IsNullOrWhiteSpace(patch.ab_upgrade_cost_curve))
            {
                abFlags.ab_upgrade_cost_curve = patch.ab_upgrade_cost_curve;
                notes.Add("ab_patch:ab_upgrade_cost_curve");
            }
        }

        private static int GetIsoDayIndexUtc()
        {
            var day = (int)DateTime.UtcNow.DayOfWeek;
            return day == 0 ? 7 : day;
        }
    }
}

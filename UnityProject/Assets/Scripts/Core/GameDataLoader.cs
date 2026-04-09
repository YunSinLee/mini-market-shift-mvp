using System;
using System.Collections.Generic;
using MiniMarketShift.Utilities;
using UnityEngine;

namespace MiniMarketShift.Core
{
    public static class GameDataLoader
    {
        public static GameDataBundle Load(GameConfigTextAssets assets)
        {
            if (assets == null)
            {
                throw new InvalidOperationException("GameConfigTextAssets must be assigned.");
            }

            var data = new GameDataBundle
            {
                remoteConfig = ParseObject<RemoteConfig>(assets.remoteConfigJson, "remoteConfigJson"),
                abFlags = ParseObject<AbFlags>(assets.abFlagsJson, "abFlagsJson"),
                stations = ParseArray<StationDefinition>(assets.stationsJson, "stationsJson"),
                upgrades = ParseArray<UpgradeDefinition>(assets.upgradesJson, "upgradesJson"),
                difficultyCurve = ParseArray<DifficultyRow>(assets.difficultyJson, "difficultyJson"),
                dailyMissions = ParseArray<MissionDefinition>(assets.missionsJson, "missionsJson"),
                iapProducts = ParseArray<IapProductDefinition>(assets.iapJson, "iapJson")
            };

            Validate(data);
            return data;
        }

        private static T ParseObject<T>(TextAsset asset, string fieldName) where T : class
        {
            if (asset == null)
            {
                throw new InvalidOperationException($"Missing TextAsset: {fieldName}");
            }

            var parsed = JsonUtility.FromJson<T>(asset.text);
            if (parsed == null)
            {
                throw new InvalidOperationException($"Invalid JSON object in: {fieldName}");
            }
            return parsed;
        }

        private static List<T> ParseArray<T>(TextAsset asset, string fieldName)
        {
            if (asset == null)
            {
                throw new InvalidOperationException($"Missing TextAsset: {fieldName}");
            }

            var parsed = JsonArrayUtility.FromJson<T>(asset.text);
            return new List<T>(parsed);
        }

        private static void Validate(GameDataBundle data)
        {
            if (data.stations.Count != 3)
            {
                throw new InvalidOperationException("Expected 3 stations for MVP scope.");
            }
            if (data.upgrades.Count != 20)
            {
                throw new InvalidOperationException("Expected 20 upgrades for MVP scope.");
            }
            if (data.difficultyCurve.Count != 30)
            {
                throw new InvalidOperationException("Expected 30 difficulty stages for MVP scope.");
            }
            if (data.dailyMissions.Count != 3)
            {
                throw new InvalidOperationException("Expected 3 daily missions for MVP scope.");
            }
            if (data.iapProducts.Count != 3)
            {
                throw new InvalidOperationException("Expected 3 IAP products for MVP scope.");
            }
        }
    }
}

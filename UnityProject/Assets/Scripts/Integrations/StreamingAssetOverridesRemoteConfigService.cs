using System;
using System.IO;
using MiniMarketShift.Core;
using MiniMarketShift.Services;
using UnityEngine;

namespace MiniMarketShift.Integrations
{
    public sealed class StreamingAssetOverridesRemoteConfigService : IRemoteConfigService
    {
        private readonly string _folderName;
        private readonly string _remoteOverrideFileName;
        private readonly string _abOverrideFileName;

        public StreamingAssetOverridesRemoteConfigService(
            string folderName = "mvp-config",
            string remoteOverrideFileName = "remote-config.override.json",
            string abOverrideFileName = "ab-flags.override.json"
        )
        {
            _folderName = folderName;
            _remoteOverrideFileName = remoteOverrideFileName;
            _abOverrideFileName = abOverrideFileName;
        }

        public bool TryOverride(ref RemoteConfig remoteConfig, ref AbFlags abFlags)
        {
            var baseDir = Path.Combine(Application.streamingAssetsPath, _folderName);
            var remotePath = Path.Combine(baseDir, _remoteOverrideFileName);
            var abPath = Path.Combine(baseDir, _abOverrideFileName);

            if (!File.Exists(remotePath) || !File.Exists(abPath))
            {
                return false;
            }

            try
            {
                var remoteJson = File.ReadAllText(remotePath);
                var abJson = File.ReadAllText(abPath);

                var parsedRemote = JsonUtility.FromJson<RemoteConfig>(remoteJson);
                var parsedAb = JsonUtility.FromJson<AbFlags>(abJson);
                if (parsedRemote == null || parsedAb == null)
                {
                    Debug.LogWarning("[StreamingAssetOverridesRemoteConfigService] override json parse failed.");
                    return false;
                }

                remoteConfig = parsedRemote;
                abFlags = parsedAb;
                Debug.Log("[StreamingAssetOverridesRemoteConfigService] remote overrides applied.");
                return true;
            }
            catch (Exception ex)
            {
                Debug.LogWarning($"[StreamingAssetOverridesRemoteConfigService] override load failed: {ex.Message}");
                return false;
            }
        }
    }
}


using MiniMarketShift.Core;
using MiniMarketShift.Services;
using UnityEngine;

namespace MiniMarketShift.Integrations
{
    public sealed class JsonRemoteConfigService : IRemoteConfigService
    {
        private readonly RemoteConfig _overrideConfig;
        private readonly AbFlags _overrideFlags;

        public JsonRemoteConfigService(RemoteConfig overrideConfig, AbFlags overrideFlags)
        {
            _overrideConfig = overrideConfig;
            _overrideFlags = overrideFlags;
        }

        public bool TryOverride(ref RemoteConfig remoteConfig, ref AbFlags abFlags)
        {
            if (_overrideConfig == null || _overrideFlags == null)
            {
                return false;
            }

            remoteConfig = _overrideConfig;
            abFlags = _overrideFlags;
            Debug.Log("[JsonRemoteConfigService] remote config override applied");
            return true;
        }
    }
}

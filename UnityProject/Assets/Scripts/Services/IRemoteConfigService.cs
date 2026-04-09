using MiniMarketShift.Core;

namespace MiniMarketShift.Services
{
    public interface IRemoteConfigService
    {
        bool TryOverride(ref RemoteConfig remoteConfig, ref AbFlags abFlags);
    }
}

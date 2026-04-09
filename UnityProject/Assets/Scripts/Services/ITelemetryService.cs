using System.Collections.Generic;
using MiniMarketShift.Core;

namespace MiniMarketShift.Services
{
    public interface ITelemetryService
    {
        IReadOnlyList<TelemetryEventRecord> Records { get; }
        void ConfigureContext(string userId, string country, string platform, string buildVersion);
        void StartSession(string sessionId, string payloadJson);
        void Emit(string eventName, string payloadJson);
        void EndSession(string payloadJson);
    }
}

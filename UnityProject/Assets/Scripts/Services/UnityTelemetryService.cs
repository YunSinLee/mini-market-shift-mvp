using System;
using System.Collections.Generic;
using MiniMarketShift.Core;
using UnityEngine;

namespace MiniMarketShift.Services
{
    public sealed class UnityTelemetryService : ITelemetryService
    {
        private readonly List<TelemetryEventRecord> _records = new List<TelemetryEventRecord>();

        private string _userId;
        private string _country;
        private string _platform;
        private string _buildVersion;
        private string _sessionId;

        public IReadOnlyList<TelemetryEventRecord> Records => _records;

        public void ConfigureContext(string userId, string country, string platform, string buildVersion)
        {
            _userId = userId;
            _country = country;
            _platform = platform;
            _buildVersion = buildVersion;
        }

        public void StartSession(string sessionId, string payloadJson)
        {
            _sessionId = sessionId;
            Emit(TelemetryContract.SessionStart, payloadJson);
        }

        public void Emit(string eventName, string payloadJson)
        {
            if (!TelemetryContract.AllowedEvents.Contains(eventName))
            {
                throw new InvalidOperationException($"Unknown telemetry event: {eventName}");
            }

            if (string.IsNullOrEmpty(_sessionId))
            {
                throw new InvalidOperationException("Telemetry session is not started.");
            }

            var record = new TelemetryEventRecord
            {
                user_id = _userId,
                country = _country,
                platform = _platform,
                build_version = _buildVersion,
                session_id = _sessionId,
                event_time = DateTime.UtcNow.ToString("O"),
                event_name = eventName,
                payload_json = payloadJson
            };

            _records.Add(record);
            Debug.Log($"[Telemetry] {eventName}: {payloadJson}");
        }

        public void EndSession(string payloadJson)
        {
            Emit(TelemetryContract.SessionEnd, payloadJson);
            _sessionId = null;
        }
    }
}

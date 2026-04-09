function parsePayload(payloadJson) {
  if (typeof payloadJson !== "string" || payloadJson.trim() === "") {
    return {};
  }

  try {
    const parsed = JSON.parse(payloadJson);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function normalizeRecord(record) {
  return {
    user_id: record.user_id ?? "unknown_user",
    country: record.country ?? "unknown_country",
    platform: record.platform ?? "unknown_platform",
    build_version: record.build_version ?? "unknown_build",
    session_id: record.session_id ?? "unknown_session",
    event_time: record.event_time ?? new Date().toISOString(),
    event_name: record.event_name ?? "unknown_event",
    payload_json:
      typeof record.payload_json === "string" ? record.payload_json : "{}",
    payload: parsePayload(record.payload_json)
  };
}

export function convertRuntimeSmokeReport(report) {
  const telemetryInput = Array.isArray(report?.telemetry) ? report.telemetry : [];
  const telemetryRecords = telemetryInput.map(normalizeRecord);
  const liveops =
    report?.liveops && typeof report.liveops === "object" ? report.liveops : null;

  return {
    generated_at: new Date().toISOString(),
    smoke_generated_at: report?.generated_at ?? null,
    passed: Boolean(report?.passed),
    source_report_path: report?.report_path ?? null,
    persistent_data_path: report?.persistent_data_path ?? null,
    summary: report?.summary ?? null,
    missions: Array.isArray(report?.missions) ? report.missions : [],
    liveops,
    telemetry_records: telemetryRecords
  };
}

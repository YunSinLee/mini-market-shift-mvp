function hasNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function check(name, ok, details = null) {
  return {
    name,
    ok: Boolean(ok),
    details
  };
}

function parseIsoDate(value) {
  if (!hasNonEmptyString(value)) {
    return null;
  }
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export function buildRuntimeSmokeLiveopsCheck(report, options = {}) {
  const strict = options.strict !== false;
  const parsedMaxAge = options.maxAgeDays;
  const maxAgeDays =
    parsedMaxAge == null
      ? null
      : Number.isFinite(Number(parsedMaxAge)) && Number(parsedMaxAge) > 0
      ? Number(parsedMaxAge)
      : null;
  const nowTimestamp = Number.isFinite(Number(options.nowTimestamp))
    ? Number(options.nowTimestamp)
    : Date.now();
  const missions = Array.isArray(report?.missions) ? report.missions : [];
  const telemetry = Array.isArray(report?.telemetry) ? report.telemetry : [];
  const liveops = report?.liveops && typeof report.liveops === "object" ? report.liveops : null;
  const reportTimestamp = parseIsoDate(report?.generated_at);
  const ageDays =
    reportTimestamp == null ? null : (nowTimestamp - reportTimestamp) / (1000 * 60 * 60 * 24);
  const recencyOk =
    maxAgeDays == null
      ? true
      : ageDays != null && ageDays >= 0 && ageDays <= maxAgeDays;

  const checks = [
    check("smoke_passed", report?.passed === true, { value: report?.passed ?? null }),
    check("telemetry_non_empty", telemetry.length > 0, { value: telemetry.length }),
    check("liveops_present", liveops != null),
    check("liveops_file_found", liveops?.file_found === true, {
      value: liveops?.file_found ?? null
    }),
    check("liveops_applied", liveops?.applied === true, {
      value: liveops?.applied ?? null
    }),
    check("selected_day_label_set", hasNonEmptyString(liveops?.selected_day_label), {
      value: liveops?.selected_day_label ?? null
    }),
    check(
      "active_event_ids_array",
      Array.isArray(liveops?.active_event_ids),
      { value: liveops?.active_event_ids ?? null }
    ),
    check("mission_count_is_3", missions.length === 3, {
      value: missions.length
    }),
    check("report_recency", recencyOk, {
      generated_at: report?.generated_at ?? null,
      age_days: ageDays == null ? null : Number(ageDays.toFixed(3)),
      max_age_days: maxAgeDays
    })
  ];

  const failedChecks = checks.filter((item) => !item.ok);
  const passed = failedChecks.length === 0;

  return {
    generated_at: new Date().toISOString(),
    strict,
    passed,
    summary: {
      total_checks: checks.length,
      passed_checks: checks.length - failedChecks.length,
      failed_checks: failedChecks.length
    },
    checks,
    extracted: {
      source_report_generated_at: report?.generated_at ?? null,
      source_report_path: report?.report_path ?? null,
      persistent_data_path: report?.persistent_data_path ?? null,
      telemetry_count: telemetry.length,
      report_age_days: ageDays == null ? null : Number(ageDays.toFixed(3)),
      iso_day_index: liveops?.iso_day_index ?? null,
      selected_day_label: liveops?.selected_day_label ?? null,
      active_event_count: Array.isArray(liveops?.active_event_ids)
        ? liveops.active_event_ids.length
        : null
    }
  };
}

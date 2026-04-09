import { buildKpiSnapshot } from "./kpi-snapshot.mjs";
import { evaluateBusinessGates } from "./business-gates.mjs";
import { buildTelemetryReport } from "./telemetry-report.mjs";
import { buildTuningRecommendation } from "./tuning-recommendation.mjs";

function filterSegmentRecords(records, country, platform) {
  return records.filter(
    (record) => record.country === country && record.platform === platform
  );
}

export function buildSegmentLaunchReport({
  records,
  targets,
  segments
}) {
  const rows = [];

  for (const segment of segments) {
    const country = segment.country;
    const platform = segment.platform;

    const segmentRecords = filterSegmentRecords(records, country, platform);
    const snapshot = buildKpiSnapshot(segmentRecords, {
      country,
      platform,
      ad_spend_usd: segment.ad_spend_usd,
      installs_override: segment.installs
    });

    const gateEvaluation = evaluateBusinessGates(snapshot, targets);
    const telemetryReport = buildTelemetryReport(segmentRecords);
    const recommendation = buildTuningRecommendation({
      snapshot,
      gateEvaluation,
      telemetryReport
    });

    rows.push({
      segment: {
        country,
        platform
      },
      snapshot,
      gate_evaluation: gateEvaluation,
      telemetry_report: telemetryReport,
      tuning_recommendation: recommendation
    });
  }

  const gate1PassedCount = rows.filter((row) => row.gate_evaluation.gate_1.passed).length;
  const gate2PassedCount = rows.filter((row) => row.gate_evaluation.gate_2.passed).length;

  return {
    generated_at: new Date().toISOString(),
    summary: {
      total_segments: rows.length,
      gate1_passed_segments: gate1PassedCount,
      gate2_passed_segments: gate2PassedCount
    },
    segments: rows
  };
}

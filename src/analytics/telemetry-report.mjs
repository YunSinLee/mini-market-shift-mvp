import { ALLOWED_EVENTS } from "../constants/events.mjs";

export const REQUIRED_COMMON_FIELDS = [
  "user_id",
  "country",
  "platform",
  "build_version",
  "session_id",
  "event_time"
];

function toFixedNumber(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function withSessionCountryPlatform(sessionMeta, record) {
  const key = record.session_id;
  if (!key || sessionMeta.has(key)) {
    return;
  }

  sessionMeta.set(key, {
    country: record.country,
    platform: record.platform
  });
}

function buildSegmentTemplate() {
  return {
    sessions: 0,
    rewarded_ad_sessions: 0,
    payer_sessions: 0,
    rewarded_ad_participation_rate: 0,
    payer_conversion_rate: 0
  };
}

function finalizeSegmentRates(segment) {
  if (segment.sessions <= 0) {
    return segment;
  }

  segment.rewarded_ad_participation_rate = toFixedNumber(
    segment.rewarded_ad_sessions / segment.sessions
  );
  segment.payer_conversion_rate = toFixedNumber(
    segment.payer_sessions / segment.sessions
  );
  return segment;
}

function upsertSegment(map, key) {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const created = buildSegmentTemplate();
  map.set(key, created);
  return created;
}

export function buildTelemetryReport(records) {
  const byEvent = new Map();
  const missingFieldCounts = Object.fromEntries(
    REQUIRED_COMMON_FIELDS.map((field) => [field, 0])
  );
  const unknownEventNames = new Set();

  const sessionIds = new Set();
  const adRewardSessions = new Set();
  const payerSessions = new Set();
  const sessionMeta = new Map();

  let invalidCommonFieldEvents = 0;

  for (const record of records) {
    const eventName = record?.event_name ?? "unknown_event";
    byEvent.set(eventName, (byEvent.get(eventName) ?? 0) + 1);

    if (!ALLOWED_EVENTS.has(eventName)) {
      unknownEventNames.add(eventName);
    }

    let missing = false;
    for (const field of REQUIRED_COMMON_FIELDS) {
      if (!record?.[field]) {
        missing = true;
        missingFieldCounts[field] += 1;
      }
    }

    if (missing) {
      invalidCommonFieldEvents += 1;
    }

    if (record?.session_id) {
      sessionIds.add(record.session_id);
      withSessionCountryPlatform(sessionMeta, record);

      if (eventName === "ad_reward_granted") {
        adRewardSessions.add(record.session_id);
      }

      if (eventName === "iap_purchase") {
        payerSessions.add(record.session_id);
      }
    }
  }

  const totalEvents = records.length;
  const totalSessions = sessionIds.size;
  const rewardedAdParticipationRate =
    totalSessions > 0 ? toFixedNumber(adRewardSessions.size / totalSessions) : 0;
  const payerConversionRate =
    totalSessions > 0 ? toFixedNumber(payerSessions.size / totalSessions) : 0;

  const countrySegments = new Map();
  const platformSegments = new Map();

  for (const sessionId of sessionIds) {
    const meta = sessionMeta.get(sessionId) ?? { country: "unknown", platform: "unknown" };

    const country = meta.country || "unknown";
    const platform = meta.platform || "unknown";

    const countrySegment = upsertSegment(countrySegments, country);
    countrySegment.sessions += 1;
    if (adRewardSessions.has(sessionId)) {
      countrySegment.rewarded_ad_sessions += 1;
    }
    if (payerSessions.has(sessionId)) {
      countrySegment.payer_sessions += 1;
    }

    const platformSegment = upsertSegment(platformSegments, platform);
    platformSegment.sessions += 1;
    if (adRewardSessions.has(sessionId)) {
      platformSegment.rewarded_ad_sessions += 1;
    }
    if (payerSessions.has(sessionId)) {
      platformSegment.payer_sessions += 1;
    }
  }

  const countries = Object.fromEntries(
    [...countrySegments.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [key, finalizeSegmentRates(value)])
  );

  const platforms = Object.fromEntries(
    [...platformSegments.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => [key, finalizeSegmentRates(value)])
  );

  const eventsByName = Object.fromEntries(
    [...byEvent.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  );

  const missingCommonFieldRate =
    totalEvents > 0 ? toFixedNumber(invalidCommonFieldEvents / totalEvents) : 0;

  return {
    generated_at: new Date().toISOString(),
    total_events: totalEvents,
    total_sessions: totalSessions,
    events_by_name: eventsByName,
    missing_common_field_events: invalidCommonFieldEvents,
    missing_common_field_rate: missingCommonFieldRate,
    missing_common_field_counts: missingFieldCounts,
    unknown_event_names: [...unknownEventNames].sort(),
    rewarded_ad_sessions: adRewardSessions.size,
    rewarded_ad_participation_rate: rewardedAdParticipationRate,
    payer_sessions: payerSessions.size,
    payer_conversion_rate: payerConversionRate,
    segmentation: {
      countries,
      platforms
    },
    gates: {
      event_missing_rate_lt_2_percent: missingCommonFieldRate < 0.02,
      country_platform_segmentation_available:
        Object.keys(countries).length > 0 && Object.keys(platforms).length > 0
    }
  };
}

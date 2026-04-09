function toDayString(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function fromDayString(dayString) {
  const date = new Date(`${dayString}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

function addDays(dayString, days) {
  const date = fromDayString(dayString);
  if (!date) {
    return null;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return toDayString(date.toISOString());
}

function toFixed(value, digits = 4) {
  return Number(value.toFixed(digits));
}

function mapOfSetsPush(map, key, value) {
  if (!key || !value) {
    return;
  }
  if (!map.has(key)) {
    map.set(key, new Set());
  }
  map.get(key).add(value);
}

function buildCore(records, options = {}) {
  const sessionByUserFirstDay = new Map();
  const activeDaysByUser = new Map();
  const dauByDay = new Map();
  const rewardedUsersByDay = new Map();
  const payerUsersByDay = new Map();
  const uniquePayers = new Set();

  let minDay = null;
  let maxDay = null;

  for (const record of records) {
    const userId = record?.user_id;
    const day = toDayString(record?.event_time);
    if (!userId || !day) {
      continue;
    }

    if (!minDay || day < minDay) {
      minDay = day;
    }
    if (!maxDay || day > maxDay) {
      maxDay = day;
    }

    if (record.event_name === "session_start") {
      const knownFirstDay = sessionByUserFirstDay.get(userId);
      if (!knownFirstDay || day < knownFirstDay) {
        sessionByUserFirstDay.set(userId, day);
      }

      mapOfSetsPush(activeDaysByUser, userId, day);
      mapOfSetsPush(dauByDay, day, userId);
    }

    if (record.event_name === "ad_reward_granted") {
      mapOfSetsPush(rewardedUsersByDay, day, userId);
    }

    if (record.event_name === "iap_purchase") {
      mapOfSetsPush(payerUsersByDay, day, userId);
      uniquePayers.add(userId);
    }
  }

  const installsBase = sessionByUserFirstDay.size;
  const installsOverride = options.installs_override;
  const usesInstallOverride =
    typeof installsOverride === "number" && installsOverride >= 0;
  const installs =
    usesInstallOverride ? installsOverride : installsBase;

  const activeUsers = activeDaysByUser.size;
  const cohortUsers = [...sessionByUserFirstDay.entries()];
  const latestDay = maxDay;

  function retentionAt(offsetDays) {
    if (!latestDay) {
      return null;
    }

    let eligible = 0;
    let retained = 0;

    for (const [userId, installDay] of cohortUsers) {
      const targetDay = addDays(installDay, offsetDays);
      if (!targetDay) {
        continue;
      }

      if (targetDay > latestDay) {
        continue;
      }

      eligible += 1;
      const activeDays = activeDaysByUser.get(userId);
      if (activeDays?.has(targetDay)) {
        retained += 1;
      }
    }

    if (eligible === 0) {
      return null;
    }
    return toFixed(retained / eligible);
  }

  let totalDau = 0;
  let totalRewardedParticipants = 0;
  let totalPayerParticipants = 0;

  for (const [day, users] of dauByDay.entries()) {
    const dau = users.size;
    totalDau += dau;
    totalRewardedParticipants += rewardedUsersByDay.get(day)?.size ?? 0;
    totalPayerParticipants += payerUsersByDay.get(day)?.size ?? 0;
  }

  const rewardedAdParticipation =
    totalDau > 0 ? toFixed(totalRewardedParticipants / totalDau) : null;
  const payerParticipationByDau =
    totalDau > 0 ? toFixed(totalPayerParticipants / totalDau) : null;
  const payerConversion = activeUsers > 0 ? toFixed(uniquePayers.size / activeUsers) : null;

  const adSpendUsd =
    typeof options.ad_spend_usd === "number" && options.ad_spend_usd >= 0
      ? options.ad_spend_usd
      : null;
  const cpi = adSpendUsd != null && installs > 0 ? toFixed(adSpendUsd / installs) : null;

  const mismatchRatio =
    installsBase > 0 && installs > 0 ? toFixed(Math.abs(installs - installsBase) / installs) : null;
  const retentionCoverageDays =
    minDay && maxDay
      ? Math.floor(
          (fromDayString(maxDay).getTime() - fromDayString(minDay).getTime()) /
            (1000 * 60 * 60 * 24)
        )
      : 0;
  const dataQualityFlags = {
    uses_install_override: usesInstallOverride,
    retention_window_lt_7_days: retentionCoverageDays < 7,
    installs_mismatch_gt_20_percent: mismatchRatio != null ? mismatchRatio > 0.2 : false
  };

  return {
    installs,
    installs_source: usesInstallOverride ? "override" : "telemetry_users",
    telemetry_install_users: installsBase,
    active_users: activeUsers,
    d1_retention: retentionAt(1),
    d3_retention: retentionAt(3),
    d7_retention: retentionAt(7),
    rewarded_ad_participation: rewardedAdParticipation,
    payer_conversion: payerConversion,
    payer_participation_by_dau: payerParticipationByDau,
    cpi,
    ad_spend_usd: adSpendUsd,
    install_user_mismatch_ratio: mismatchRatio,
    retention_window_days: retentionCoverageDays,
    data_quality_flags: dataQualityFlags,
    analysis_start_day: minDay,
    analysis_end_day: maxDay,
    source_event_count: records.length,
    cohort_user_count: cohortUsers.length
  };
}

export function buildKpiSnapshot(records, options = {}) {
  const countryFilter = options.country ?? null;
  const platformFilter = options.platform ?? null;

  const filteredRecords = records.filter((record) => {
    if (countryFilter && record.country !== countryFilter) {
      return false;
    }
    if (platformFilter && record.platform !== platformFilter) {
      return false;
    }
    return true;
  });

  const core = buildCore(filteredRecords, options);

  const segmentKeys = new Set();
  for (const record of filteredRecords) {
    if (!record?.country || !record?.platform) {
      continue;
    }
    segmentKeys.add(`${record.country}|${record.platform}`);
  }

  const segments = {};
  for (const key of [...segmentKeys].sort()) {
    const [country, platform] = key.split("|");
    const segmentRecords = filteredRecords.filter(
      (record) => record.country === country && record.platform === platform
    );
    segments[key] = buildCore(segmentRecords, options);
  }

  return {
    generated_at: new Date().toISOString(),
    filters: {
      country: countryFilter,
      platform: platformFilter
    },
    ...core,
    segments_by_country_platform: segments
  };
}

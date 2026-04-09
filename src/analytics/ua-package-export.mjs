function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function buildScriptMap(scriptIndex) {
  const files = Array.isArray(scriptIndex?.files) ? scriptIndex.files : [];
  const map = new Map();

  for (const item of files) {
    const creativeId = normalizeText(item?.creative_id, "");
    if (!creativeId) {
      continue;
    }
    if (!map.has(creativeId)) {
      map.set(creativeId, new Map());
    }
    map.get(creativeId).set(Number(item.duration_sec), normalizeText(item.relative_path, ""));
  }

  return map;
}

function collectDurations(scriptMap) {
  const set = new Set();
  for (const durationMap of scriptMap.values()) {
    for (const duration of durationMap.keys()) {
      if (Number.isFinite(duration)) {
        set.add(duration);
      }
    }
  }
  return [...set].sort((a, b) => a - b);
}

function toCsvRow(values) {
  return values
    .map((value) => {
      const text = String(value ?? "");
      if (text.includes(",") || text.includes('"') || text.includes("\n")) {
        return `"${text.replace(/"/g, '""')}"`;
      }
      return text;
    })
    .join(",");
}

function buildCsv(creatives, durations) {
  const durationColumns = durations.map((duration) => `script_${duration}s`);
  const header = [
    "creative_id",
    "country",
    "platform",
    "angle",
    "variant_of",
    ...durationColumns,
    "cta",
    "hook_tags"
  ];

  const lines = [toCsvRow(header)];
  for (const row of creatives) {
    const durationValues = durations.map(
      (duration) => row.scripts_by_duration?.[`${duration}s`] ?? ""
    );
    lines.push(
      toCsvRow([
        row.creative_id,
        row.segment.country,
        row.segment.platform,
        row.angle,
        row.variant_of ?? "",
        ...durationValues,
        row.cta,
        row.hook_tags.join("|")
      ])
    );
  }
  return `${lines.join("\n")}\n`;
}

function localeForCountry(country) {
  const upper = normalizeText(country, "US").toUpperCase();
  if (upper === "KR") {
    return "ko-KR";
  }
  return "en-US";
}

function defaultPrimaryText({ locale, angle }) {
  if (locale === "ko-KR") {
    return `2~4분 안에 처리량을 끌어올리는 ${angle} 플레이를 확인해보세요.`;
  }
  return `See how this ${angle} hook drives throughput gains in under 4 minutes.`;
}

function defaultHeadline(locale) {
  if (locale === "ko-KR") {
    return "Mini Market Shift 지금 플레이";
  }
  return "Play Mini Market Shift Now";
}

function defaultTiktokText(locale, angle) {
  if (locale === "ko-KR") {
    return `${angle} 콘셉트로 전환율을 테스트합니다.`;
  }
  return `Testing ${angle} concept for CTR and CPI efficiency.`;
}

function resolveAdapterValue({
  adapterConfig,
  channel,
  key,
  country,
  platform,
  fallback
}) {
  const channelConfig = adapterConfig?.[channel];
  const keyConfig = channelConfig?.[key];

  if (typeof keyConfig === "string" && keyConfig.trim()) {
    return keyConfig.trim();
  }
  if (!keyConfig || typeof keyConfig !== "object") {
    return fallback;
  }

  const normalizedCountry = normalizeText(country, "").toUpperCase();
  const normalizedPlatform = normalizeText(platform, "").toLowerCase();
  const countryPlatformKey = `${normalizedCountry}/${normalizedPlatform}`;

  const byCountryPlatform = keyConfig.by_country_platform;
  if (
    byCountryPlatform &&
    typeof byCountryPlatform === "object" &&
    typeof byCountryPlatform[countryPlatformKey] === "string" &&
    byCountryPlatform[countryPlatformKey].trim()
  ) {
    return byCountryPlatform[countryPlatformKey].trim();
  }

  const byCountry = keyConfig.by_country;
  if (
    byCountry &&
    typeof byCountry === "object" &&
    typeof byCountry[normalizedCountry] === "string" &&
    byCountry[normalizedCountry].trim()
  ) {
    return byCountry[normalizedCountry].trim();
  }

  const byPlatform = keyConfig.by_platform;
  if (
    byPlatform &&
    typeof byPlatform === "object" &&
    typeof byPlatform[normalizedPlatform] === "string" &&
    byPlatform[normalizedPlatform].trim()
  ) {
    return byPlatform[normalizedPlatform].trim();
  }

  if (typeof keyConfig.default === "string" && keyConfig.default.trim()) {
    return keyConfig.default.trim();
  }

  return fallback;
}

function buildMetaAdapterCsv(creatives, packageTag, adapterConfig) {
  const header = [
    "ad_name",
    "campaign_name",
    "ad_set_name",
    "country",
    "platform",
    "locale",
    "creative_id",
    "primary_text",
    "headline",
    "cta",
    "destination_url",
    "script_15s",
    "script_30s",
    "labels"
  ];

  const lines = [toCsvRow(header)];
  for (const row of creatives) {
    const locale = localeForCountry(row.segment.country);
    const campaign = `${packageTag}_${row.segment.country}_android`;
    const adSet = `${row.segment.country}_hybrid_casual`;
    lines.push(
      toCsvRow([
        `${row.creative_id}_${row.segment.country}_meta`,
        campaign,
        adSet,
        row.segment.country,
        row.segment.platform,
        locale,
        row.creative_id,
        defaultPrimaryText({ locale, angle: row.angle }),
        defaultHeadline(locale),
        resolveAdapterValue({
          adapterConfig,
          channel: "meta_ads",
          key: "cta",
          country: row.segment.country,
          platform: row.segment.platform,
          fallback: row.cta
        }),
        resolveAdapterValue({
          adapterConfig,
          channel: "meta_ads",
          key: "destination_url",
          country: row.segment.country,
          platform: row.segment.platform,
          fallback: "https://example.com/mini-market-shift"
        }),
        row.scripts_by_duration?.["15s"] ?? "",
        row.scripts_by_duration?.["30s"] ?? "",
        row.hook_tags.join("|")
      ])
    );
  }

  return `${lines.join("\n")}\n`;
}

function buildTiktokAdapterCsv(creatives, packageTag, adapterConfig) {
  const header = [
    "adgroup_name",
    "ad_name",
    "country",
    "platform",
    "locale",
    "creative_id",
    "text",
    "cta",
    "landing_page_url",
    "video_script_15s",
    "video_script_30s",
    "tags"
  ];

  const lines = [toCsvRow(header)];
  for (const row of creatives) {
    const locale = localeForCountry(row.segment.country);
    lines.push(
      toCsvRow([
        `${packageTag}_${row.segment.country}_tt`,
        `${row.creative_id}_${row.segment.country}_tt`,
        row.segment.country,
        row.segment.platform,
        locale,
        row.creative_id,
        defaultTiktokText(locale, row.angle),
        resolveAdapterValue({
          adapterConfig,
          channel: "tiktok_ads",
          key: "cta",
          country: row.segment.country,
          platform: row.segment.platform,
          fallback: row.cta
        }),
        resolveAdapterValue({
          adapterConfig,
          channel: "tiktok_ads",
          key: "destination_url",
          country: row.segment.country,
          platform: row.segment.platform,
          fallback: "https://example.com/mini-market-shift"
        }),
        row.scripts_by_duration?.["15s"] ?? "",
        row.scripts_by_duration?.["30s"] ?? "",
        row.hook_tags.join("|")
      ])
    );
  }

  return `${lines.join("\n")}\n`;
}

function uniqueSegments(creatives) {
  const set = new Set();
  for (const row of creatives) {
    set.add(`${row.segment.country}/${row.segment.platform}`);
  }
  return [...set].sort();
}

export function buildUaPackageExport({
  creativeBatch,
  scriptIndex,
  packageTag = "latest",
  adapterConfig = null,
  includeReview = false,
  includeApply = false
}) {
  const creatives = Array.isArray(creativeBatch?.creatives) ? creativeBatch.creatives : [];
  const scriptMap = buildScriptMap(scriptIndex);
  const durations = collectDurations(scriptMap);

  const manifestCreatives = creatives.map((creative) => {
    const durationMap = scriptMap.get(creative.creative_id) ?? new Map();
    const scriptsByDuration = {};
    for (const duration of durations) {
      const key = `${duration}s`;
      scriptsByDuration[key] = durationMap.get(duration) ?? null;
    }

    return {
      creative_id: creative.creative_id,
      variant_of: creative?.variant_of ?? null,
      segment: {
        country: creative?.target_segment?.country ?? "GLOBAL",
        platform: creative?.target_segment?.platform ?? "android"
      },
      angle: normalizeText(creative?.angle, ""),
      cta: normalizeText(creative?.cta, ""),
      hook_tags: Array.isArray(creative?.hypothesis_tags)
        ? creative.hypothesis_tags
            .map((item) => normalizeText(item, ""))
            .filter(Boolean)
        : [],
      scripts_by_duration: scriptsByDuration
    };
  });

  const manifest = {
    generated_at: new Date().toISOString(),
    package_tag: packageTag,
    package_type: "ua_creative_publish",
    source_reference: {
      creative_batch_generated_at: creativeBatch?.generated_at ?? null,
      script_pack_generated_at: scriptIndex?.generated_at ?? null
    },
    summary: {
      creative_count: manifestCreatives.length,
      durations_sec: durations,
      segment_count: uniqueSegments(manifestCreatives).length,
      segments: uniqueSegments(manifestCreatives),
      includes_performance_review: includeReview,
      includes_review_apply: includeApply
    },
    creatives: manifestCreatives
  };

  const csv = buildCsv(manifestCreatives, durations);
  const metaAdapterCsv = buildMetaAdapterCsv(
    manifestCreatives,
    packageTag,
    adapterConfig
  );
  const tiktokAdapterCsv = buildTiktokAdapterCsv(
    manifestCreatives,
    packageTag,
    adapterConfig
  );
  return {
    manifest,
    creatives_csv: csv,
    adapters: {
      meta_ads_csv: metaAdapterCsv,
      tiktok_ads_csv: tiktokAdapterCsv
    }
  };
}

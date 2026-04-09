const REQUIRED_REMOTE_CONFIG = [
  "economy_multiplier",
  "ad_cooldown_sec",
  "rewarded_ad_multiplier",
  "iap_price_tier",
  "difficulty_curve_id"
];

const REQUIRED_AB_FLAGS = [
  "ab_ad_frequency",
  "ab_offer_timing",
  "ab_upgrade_cost_curve"
];

function assertObject(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
}

export function validateRemoteConfig(remoteConfig) {
  assertObject(remoteConfig, "remoteConfig");
  for (const key of REQUIRED_REMOTE_CONFIG) {
    if (!(key in remoteConfig)) {
      throw new Error(`remoteConfig is missing required key: ${key}`);
    }
  }
  if (remoteConfig.economy_multiplier <= 0) {
    throw new Error("economy_multiplier must be > 0");
  }
  if (remoteConfig.ad_cooldown_sec < 0) {
    throw new Error("ad_cooldown_sec must be >= 0");
  }
  if (remoteConfig.rewarded_ad_multiplier < 1) {
    throw new Error("rewarded_ad_multiplier must be >= 1");
  }
}

export function validateAbFlags(abFlags) {
  assertObject(abFlags, "abFlags");
  for (const key of REQUIRED_AB_FLAGS) {
    if (!(key in abFlags)) {
      throw new Error(`abFlags is missing required key: ${key}`);
    }
  }
}

export function validateGameData(data) {
  validateRemoteConfig(data.remoteConfig);
  validateAbFlags(data.abFlags);

  if (!Array.isArray(data.stations) || data.stations.length !== 3) {
    throw new Error("stations must contain exactly 3 station definitions");
  }
  if (!Array.isArray(data.upgrades) || data.upgrades.length !== 20) {
    throw new Error("upgrades must contain exactly 20 upgrade definitions");
  }
  if (!Array.isArray(data.difficultyCurve) || data.difficultyCurve.length !== 30) {
    throw new Error("difficultyCurve must contain exactly 30 stage rows");
  }
  if (!Array.isArray(data.dailyMissions) || data.dailyMissions.length !== 3) {
    throw new Error("dailyMissions must contain exactly 3 mission rows");
  }
  if (!Array.isArray(data.iapProducts) || data.iapProducts.length !== 3) {
    throw new Error("iapProducts must contain exactly 3 products");
  }
}

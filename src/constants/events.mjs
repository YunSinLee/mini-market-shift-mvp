export const ALLOWED_EVENTS = new Set([
  "session_start",
  "session_end",
  "level_start",
  "level_complete",
  "upgrade_purchase",
  "ad_offer_shown",
  "ad_reward_granted",
  "iap_offer_view",
  "iap_purchase"
]);

export const REQUIRED_EVENT_CONTEXT_FIELDS = [
  "user_id",
  "country",
  "platform",
  "build_version"
];

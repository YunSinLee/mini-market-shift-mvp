function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function applyIfUnset(target, key, value, source, applied, skipped) {
  if (Object.hasOwn(target, key)) {
    skipped.push({
      key,
      value,
      source,
      reason: "already_set_by_higher_priority_action"
    });
    return;
  }

  target[key] = value;
  applied.push({
    key,
    value,
    source
  });
}

function actionPatch(action, remoteBase, currentRemote) {
  switch (action.area) {
    case "onboarding":
      return {
        remote: {
          economy_multiplier: round(clamp(remoteBase.economy_multiplier * 0.9, 0.5, 2)),
          difficulty_curve_id: "retention_soft_v1"
        },
        ab: {
          ab_upgrade_cost_curve: "discount_10",
          ab_offer_timing: "mid_session"
        }
      };
    case "progression":
      return {
        remote: {
          economy_multiplier: round(clamp(remoteBase.economy_multiplier * 0.95, 0.5, 2)),
          difficulty_curve_id: "retention_soft_v2"
        },
        ab: {
          ab_upgrade_cost_curve: "discount_10"
        }
      };
    case "long_retention":
      return {
        remote: {
          economy_multiplier: round(clamp(remoteBase.economy_multiplier * 1.05, 0.5, 2))
        },
        ab: {}
      };
    case "ad_monetization":
      return {
        remote: {
          ad_cooldown_sec: Math.floor(clamp(remoteBase.ad_cooldown_sec * 0.67, 20, 300)),
          rewarded_ad_multiplier: round(
            clamp(Math.max(currentRemote.rewarded_ad_multiplier, 2.2), 1, 5)
          )
        },
        ab: {
          ab_offer_timing: "post_stage",
          ab_ad_frequency: "low"
        }
      };
    case "iap_conversion":
      return {
        remote: {
          iap_price_tier: "tier_intro",
          rewarded_ad_multiplier: round(
            clamp(Math.max(currentRemote.rewarded_ad_multiplier, 2.5), 1, 5)
          )
        },
        ab: {
          ab_offer_timing: "mid_session"
        }
      };
    default:
      return {
        remote: {},
        ab: {}
      };
  }
}

function finalizeRemote(remoteBase, remoteDraft) {
  const remote = { ...remoteBase, ...remoteDraft };
  if (typeof remote.economy_multiplier === "number") {
    remote.economy_multiplier = round(clamp(remote.economy_multiplier, 0.5, 2));
  }
  if (typeof remote.ad_cooldown_sec === "number") {
    remote.ad_cooldown_sec = Math.floor(clamp(remote.ad_cooldown_sec, 20, 300));
  }
  if (typeof remote.rewarded_ad_multiplier === "number") {
    remote.rewarded_ad_multiplier = round(clamp(remote.rewarded_ad_multiplier, 1, 5));
  }
  return remote;
}

function isLowConfidenceData(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return false;
  }

  const retentionWindowDays =
    typeof snapshot.retention_window_days === "number"
      ? snapshot.retention_window_days
      : 0;
  const sourceEventCount =
    typeof snapshot.source_event_count === "number"
      ? snapshot.source_event_count
      : 0;
  const flags = snapshot.data_quality_flags ?? {};

  return (
    retentionWindowDays < 7 ||
    sourceEventCount < 200 ||
    flags.installs_mismatch_gt_20_percent === true
  );
}

function pickActions(actions, maxActions, snapshot, forceUnsafe) {
  const capped = Math.max(0, maxActions);
  const lowConfidence = isLowConfidenceData(snapshot);
  if (!lowConfidence || forceUnsafe) {
    return {
      selectedActions: actions.slice(0, capped),
      selectionMode: lowConfidence && forceUnsafe ? "forced_full" : "full"
    };
  }

  const measurementOnly = actions
    .filter((action) => action.area === "measurement")
    .slice(0, capped);

  return {
    selectedActions: measurementOnly,
    selectionMode: "measurement_only"
  };
}

export function buildOverridePlan({
  remoteBase,
  abBase,
  recommendation,
  maxActions = 3,
  context = {},
  forceUnsafe = false
}) {
  const actions = Array.isArray(recommendation?.actions)
    ? [...recommendation.actions].sort((a, b) => a.priority - b.priority)
    : [];

  const { selectedActions, selectionMode } = pickActions(
    actions,
    maxActions,
    context.snapshot,
    forceUnsafe
  );
  const remoteDraft = {};
  const abDraft = {};
  const applied = [];
  const skipped = [];

  for (const action of selectedActions) {
    const patch = actionPatch(action, remoteBase, {
      ...remoteBase,
      ...remoteDraft
    });

    for (const [key, value] of Object.entries(patch.remote)) {
      applyIfUnset(remoteDraft, key, value, action.area, applied, skipped);
    }
    for (const [key, value] of Object.entries(patch.ab)) {
      applyIfUnset(abDraft, key, value, action.area, applied, skipped);
    }
  }

  const remoteOverride = finalizeRemote(remoteBase, remoteDraft);
  const abOverride = { ...abBase, ...abDraft };

  return {
    generated_at: new Date().toISOString(),
    max_actions: maxActions,
    selection_mode: selectionMode,
    low_confidence_data: isLowConfidenceData(context.snapshot),
    force_unsafe: forceUnsafe,
    selected_actions: selectedActions.map((action) => ({
      priority: action.priority,
      area: action.area,
      trigger: action.trigger
    })),
    applied_changes: applied,
    skipped_changes: skipped,
    remote_override: remoteOverride,
    ab_override: abOverride
  };
}

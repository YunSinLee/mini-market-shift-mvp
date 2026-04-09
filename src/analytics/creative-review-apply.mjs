function normalizeText(value, fallback = "") {
  if (typeof value !== "string") {
    return fallback;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function uniqueId(baseId, taken) {
  if (!taken.has(baseId)) {
    taken.add(baseId);
    return baseId;
  }

  let cursor = 2;
  while (taken.has(`${baseId}_${cursor}`)) {
    cursor += 1;
  }
  const next = `${baseId}_${cursor}`;
  taken.add(next);
  return next;
}

function mergeTags(tags, hook) {
  const input = Array.isArray(tags) ? tags : [];
  const set = new Set();
  for (const tag of input) {
    if (typeof tag === "string" && tag.trim()) {
      set.add(tag.trim());
    }
  }
  if (hook) {
    set.add(hook);
  }
  return [...set];
}

function gameplayTemplate(hook) {
  return [
    `Open with '${hook}' pressure in the first 3 seconds.`,
    "Present rewarded-or-upgrade decision with clear value difference.",
    "Show immediate throughput and coin gain improvement."
  ];
}

function buildReplacementCreative({
  originalCreative,
  replacementDraft,
  usedIds
}) {
  const hook = normalizeText(replacementDraft?.creative_hook, "queue_overload_then_upgrade");
  const proposedId = normalizeText(
    replacementDraft?.creative_id,
    `${originalCreative.creative_id}_v2`
  );
  const creativeId = uniqueId(proposedId, usedIds);

  return {
    creative_id: creativeId,
    target_segment: replacementDraft?.target_segment ?? originalCreative.target_segment,
    angle: replacementDraft?.angle ?? `Hook pivot: ${hook}`,
    format: originalCreative.format ?? "short_form_video_9x16",
    first_3_seconds:
      replacementDraft?.first_3_seconds_suggestion ??
      originalCreative.first_3_seconds,
    gameplay_script: gameplayTemplate(hook),
    monetization_message:
      replacementDraft?.monetization_message_suggestion ??
      originalCreative.monetization_message,
    cta: replacementDraft?.cta_suggestion ?? originalCreative.cta,
    hypothesis_tags: mergeTags(originalCreative.hypothesis_tags, hook),
    success_metric: {
      ...(originalCreative.success_metric ?? {})
    },
    variant_of: originalCreative.creative_id
  };
}

export function applyCreativeReview({
  creativeBatch,
  review,
  applyTopN = null
}) {
  const originalCreatives = Array.isArray(creativeBatch?.creatives)
    ? creativeBatch.creatives
    : [];
  const droppedRows = Array.isArray(review?.dropped) ? review.dropped : [];
  const keptRows = Array.isArray(review?.kept) ? review.kept : [];
  const reviewTopN =
    Number.isFinite(applyTopN) && applyTopN > 0
      ? applyTopN
      : Number(review?.policy?.keep_top_n) || keptRows.length || 2;
  const keepSet = new Set(keptRows.slice(0, reviewTopN).map((row) => row.creative_id));
  const replacementMap = new Map();
  for (const row of droppedRows) {
    if (row?.creative_id && row?.replacement) {
      replacementMap.set(row.creative_id, row.replacement);
    }
  }

  const usedIds = new Set();
  const nextCreatives = [];
  const changes = [];

  for (const creative of originalCreatives) {
    if (!creative?.creative_id) {
      continue;
    }

    if (keepSet.has(creative.creative_id) || !replacementMap.has(creative.creative_id)) {
      const stableId = uniqueId(creative.creative_id, usedIds);
      const keptCreative =
        stableId === creative.creative_id
          ? creative
          : { ...creative, creative_id: stableId };
      nextCreatives.push(keptCreative);
      continue;
    }

    const replacementDraft = replacementMap.get(creative.creative_id);
    const nextCreative = buildReplacementCreative({
      originalCreative: creative,
      replacementDraft,
      usedIds
    });
    nextCreatives.push(nextCreative);
    changes.push({
      replaced_creative_id: creative.creative_id,
      next_creative_id: nextCreative.creative_id,
      segment: nextCreative.target_segment,
      replacement_hook: replacementDraft.creative_hook ?? null
    });
  }

  const nextBatch = {
    ...creativeBatch,
    generated_at: new Date().toISOString(),
    source_references: {
      ...(creativeBatch?.source_references ?? {}),
      performance_review_generated_at: review?.generated_at ?? null
    },
    experiment_plan: {
      ...(creativeBatch?.experiment_plan ?? {}),
      applied_review_round: {
        keep_top_n: reviewTopN,
        replaced_count: changes.length
      }
    },
    creatives: nextCreatives
  };

  return {
    generated_at: new Date().toISOString(),
    summary: {
      original_creative_count: originalCreatives.length,
      next_creative_count: nextCreatives.length,
      replaced_count: changes.length,
      kept_top_n: reviewTopN
    },
    changes,
    next_batch: nextBatch
  };
}

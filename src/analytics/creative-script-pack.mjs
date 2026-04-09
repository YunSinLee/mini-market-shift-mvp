function normalizeDurations(durations) {
  if (!Array.isArray(durations) || durations.length === 0) {
    return [15, 30];
  }
  const result = durations
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);
  return result.length > 0 ? result : [15, 30];
}

function segmentKey(segment) {
  const country = segment?.country ?? "GLOBAL";
  const platform = segment?.platform ?? "android";
  return `${country}-${platform}`;
}

function localizeKoreanCta(cta) {
  const map = {
    "Fix the rush now": "지금 병목을 해결해!",
    "Double your shift": "지금 수익을 두 배로!",
    "Claim your comeback": "복귀 보상을 받아!",
    "Kickstart your market": "지금 시장을 가속해!",
    "Finish today’s missions": "오늘 미션을 끝내자!"
  };
  return map[cta] ?? "지금 바로 시작해!";
}

function voiceOverForCountry(country, creative, durationSec) {
  if (country === "KR") {
    const localizedCta = localizeKoreanCta(creative.cta);
    if (durationSec <= 15) {
      return [
        "손님 줄이 터진다, 지금 처리 못 하면 손해!",
        "보상형 광고를 보면 즉시 처리량과 보상이 커진다.",
        localizedCta
      ];
    }

    return [
      "초반 3초: 대기열 폭주 상황을 바로 보여준다.",
      "업그레이드 또는 보상형 선택 후 처리량이 어떻게 바뀌는지 비교한다.",
      "보상형 선택의 가치가 바로 보이도록 수치 변화를 노출한다.",
      `마지막 2초는 '${localizedCta}' 콜투액션으로 마무리한다.`
    ];
  }

  if (durationSec <= 15) {
    return [
      "Queue is overflowing, fix it now.",
      `${creative.monetization_message}`,
      `${creative.cta}.`
    ];
  }

  return [
    "Open with immediate pressure in the first 3 seconds.",
    "Show the before/after gain after the rewarded or upgrade decision.",
    `State value clearly: ${creative.monetization_message}`,
    `Close with CTA: ${creative.cta}.`
  ];
}

function sceneTemplate(creative, durationSec) {
  if (durationSec <= 15) {
    return [
      {
        at: "00:00-00:03",
        shot: creative.first_3_seconds
      },
      {
        at: "00:03-00:09",
        shot: creative.gameplay_script[0] ?? "Show core gameplay pressure."
      },
      {
        at: "00:09-00:13",
        shot: creative.gameplay_script[1] ?? "Apply rewarded/upgrade action."
      },
      {
        at: "00:13-00:15",
        shot: `${creative.gameplay_script[2] ?? "Show payoff."} CTA: ${creative.cta}`
      }
    ];
  }

  return [
    {
      at: "00:00-00:03",
      shot: creative.first_3_seconds
    },
    {
      at: "00:03-00:10",
      shot: creative.gameplay_script[0] ?? "Show baseline flow."
    },
    {
      at: "00:10-00:18",
      shot: creative.gameplay_script[1] ?? "Show player decision point."
    },
    {
      at: "00:18-00:25",
      shot: creative.gameplay_script[2] ?? "Show performance payoff."
    },
    {
      at: "00:25-00:30",
      shot: `${creative.monetization_message} CTA: ${creative.cta}`
    }
  ];
}

function markdownForScript({ creative, durationSec, segment }) {
  const country = segment?.country ?? "GLOBAL";
  const platform = segment?.platform ?? "android";
  const lines = [];
  const sceneRows = sceneTemplate(creative, durationSec);
  const voices = voiceOverForCountry(country, creative, durationSec);

  lines.push(`# ${creative.creative_id} (${durationSec}s)`);
  lines.push("");
  lines.push(`- Segment: ${country}/${platform}`);
  lines.push(`- Angle: ${creative.angle}`);
  lines.push(`- Format: ${creative.format}`);
  lines.push(`- Primary KPI: ${creative.success_metric?.primary ?? "ctr"}`);
  lines.push("");
  lines.push("## Scene Plan");
  for (const row of sceneRows) {
    lines.push(`- ${row.at}: ${row.shot}`);
  }
  lines.push("");
  lines.push("## Voiceover");
  for (const line of voices) {
    lines.push(`- ${line}`);
  }
  lines.push("");
  lines.push("## Tags");
  lines.push(`- ${Array.isArray(creative.hypothesis_tags) ? creative.hypothesis_tags.join(", ") : ""}`);

  return `${lines.join("\n")}\n`;
}

export function buildCreativeScriptPack({
  creativeBatch,
  durations = [15, 30]
}) {
  const creatives = Array.isArray(creativeBatch?.creatives) ? creativeBatch.creatives : [];
  const normalizedDurations = normalizeDurations(durations);
  const files = [];

  for (const creative of creatives) {
    for (const durationSec of normalizedDurations) {
      const segment = creative?.target_segment ?? { country: "GLOBAL", platform: "android" };
      const segmentFolder = segmentKey(segment);
      const fileName = `${creative.creative_id}-${durationSec}s.md`;
      const relativePath = `${segmentFolder}/${fileName}`;

      files.push({
        creative_id: creative.creative_id,
        duration_sec: durationSec,
        segment,
        relative_path: relativePath,
        content: markdownForScript({
          creative,
          durationSec,
          segment
        })
      });
    }
  }

  return {
    generated_at: new Date().toISOString(),
    source_generated_at: creativeBatch?.generated_at ?? null,
    summary: {
      creative_count: creatives.length,
      duration_variants: normalizedDurations,
      script_file_count: files.length
    },
    files
  };
}

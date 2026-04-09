import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const WEIGHTS = {
  sdk_fit: 40,
  dev_speed: 40,
  stability_perf: 20
};

const CANDIDATES = {
  Unity: {
    sdk_fit: 9.2,
    dev_speed: 8.5,
    stability_perf: 8.4,
    notes: "Highest ad/analytics SDK coverage for mobile hybrid-casual shipping."
  },
  Godot: {
    sdk_fit: 7.1,
    dev_speed: 8.8,
    stability_perf: 8.2,
    notes: "Fast iteration, but ad monetization integrations are narrower for this scope."
  }
};

function weightedScore(raw) {
  const sum =
    raw.sdk_fit * WEIGHTS.sdk_fit +
    raw.dev_speed * WEIGHTS.dev_speed +
    raw.stability_perf * WEIGHTS.stability_perf;
  return Number((sum / 100).toFixed(2));
}

const resultRows = Object.entries(CANDIDATES).map(([name, row]) => ({
  engine: name,
  ...row,
  weighted_score: weightedScore(row)
}));

resultRows.sort((a, b) => b.weighted_score - a.weighted_score);

const topScore = resultRows[0].weighted_score;
const topEngines = resultRows
  .filter((row) => row.weighted_score === topScore)
  .map((row) => row.engine);

const selectedEngine = topEngines.length > 1 ? "Unity" : topEngines[0];

const result = {
  weights: WEIGHTS,
  evaluated_at: new Date().toISOString(),
  candidates: resultRows,
  selected_engine: selectedEngine,
  tie_break_rule: "If weighted score ties, select Unity"
};

const docsDir = path.resolve(process.cwd(), "docs");
await mkdir(docsDir, { recursive: true });
await writeFile(
  path.join(docsDir, "engine-gate-result.json"),
  `${JSON.stringify(result, null, 2)}\n`,
  "utf8"
);

console.log("Engine Gate Result");
for (const row of resultRows) {
  console.log(
    `- ${row.engine}: ${row.weighted_score} (sdk ${row.sdk_fit}, speed ${row.dev_speed}, stability ${row.stability_perf})`
  );
}
console.log(`Selected: ${selectedEngine}`);

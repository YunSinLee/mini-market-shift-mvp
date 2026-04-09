import test from "node:test";
import assert from "node:assert/strict";
import { buildLiveopsLitePlan } from "../src/analytics/liveops-lite.mjs";

const baseMissions = [
  {
    id: "mission_serve_customers",
    name: "Serve 120 customers",
    type: "serve_customers",
    goal: 120,
    reward_coins: 150
  },
  {
    id: "mission_watch_rewarded_ad",
    name: "Watch 2 rewarded ads",
    type: "watch_rewarded_ad",
    goal: 2,
    reward_coins: 100
  },
  {
    id: "mission_purchase_upgrade",
    name: "Purchase 2 upgrades",
    type: "purchase_upgrade",
    goal: 2,
    reward_coins: 200
  }
];

test("liveops lite plan prioritizes retention recovery when D1 fails", () => {
  const plan = buildLiveopsLitePlan({
    dailyMissions: baseMissions,
    segmentReport: {
      segments: [
        {
          segment: { country: "KR", platform: "android" },
          snapshot: { cpi: 2.1 },
          gate_evaluation: {
            gate_1: { checks: [{ name: "D1 retention", ok: false }] },
            gate_2: { checks: [] }
          },
          tuning_recommendation: { severity: "high" }
        },
        {
          segment: { country: "US", platform: "android" },
          snapshot: { cpi: 2.4 },
          gate_evaluation: {
            gate_1: { checks: [{ name: "D1 retention", ok: true }] },
            gate_2: { checks: [{ name: "Payer conversion", ok: false }] }
          },
          tuning_recommendation: { severity: "medium" }
        }
      ]
    },
    gateEvaluation: {
      gate_1: {
        checks: [
          { name: "D1 retention", ok: false },
          { name: "D3 retention", ok: true },
          { name: "CPI", ok: true }
        ]
      },
      gate_2: {
        checks: [
          { name: "D7 retention", ok: true },
          { name: "Rewarded ad participation", ok: true },
          { name: "Payer conversion", ok: true }
        ]
      }
    },
    tuningRecommendation: {
      severity: "high",
      actions: [
        {
          changes: [
            "Introduce daily mission streak reward escalation.",
            "Surface rewarded CTA right after first bottleneck."
          ]
        }
      ]
    },
    weekLabel: "2026-W15",
    days: 7,
    weeklyEventCount: 2,
    startDate: "2026-04-09"
  });

  assert.equal(plan.week_label, "2026-W15");
  assert.equal(plan.strategy.primary_goal, "retention_recovery");
  assert.equal(plan.daily_mission_templates.length, 7);
  assert.equal(plan.weekly_event_templates.length, 2);
  assert.equal(plan.weekly_event_templates[0].target_segments.length, 2);
  assert.ok(plan.reward_tuning_notes.length >= 1);
});

test("liveops lite plan falls back to defaults when inputs are missing", () => {
  const plan = buildLiveopsLitePlan({});

  assert.equal(plan.strategy.primary_goal, "scaling_stability");
  assert.deepEqual(plan.strategy.target_countries, ["KR", "US"]);
  assert.equal(plan.daily_mission_templates.length, 7);
  assert.equal(plan.daily_mission_templates[0].missions.length, 3);
  assert.equal(plan.weekly_event_templates.length, 2);
});

import { randomUUID } from "node:crypto";
import { MissionTracker } from "./mission-tracker.mjs";

export class GameEngine {
  constructor(gameData, telemetry) {
    this.config = gameData.remoteConfig;
    this.abFlags = gameData.abFlags;
    this.stationsConfig = gameData.stations;
    this.upgrades = gameData.upgrades;
    this.difficultyCurve = gameData.difficultyCurve;
    this.iapProducts = gameData.iapProducts;
    this.telemetry = telemetry;

    this.baseDemandPerMin = 20;
    this.baseOrderValue = 5;

    this._missionTracker = new MissionTracker(gameData.dailyMissions);

    this.state = {
      stage: 1,
      coins: 0,
      adFree: false,
      boosterTokens: 0,
      totalServedCustomers: 0,
      totalFailedCustomers: 0,
      currentSessionRevenue: 0,
      currentSessionSeconds: 0,
      sessionsPlayed: 0,
      globalThroughputMultiplier: 1,
      orderValueMultiplier: 1,
      staffMultiplier: 1,
      instantUpgradeCredits: 0,
      activeIncomeBoostUntilSec: 0,
      stations: this.stationsConfig.map((station) => ({
        id: station.id,
        multiplier: 1,
        flatThroughput: 0
      })),
      purchasedUpgradeIds: new Set()
    };

    this.sessionActive = false;
    this.lastRewardedAdAtSec = -Infinity;
    this.pendingDemand = 0;
    this.pendingCapacity = 0;
  }

  startSession() {
    if (this.sessionActive) {
      throw new Error("session is already active");
    }

    this.sessionActive = true;
    this.state.sessionsPlayed += 1;
    this.state.currentSessionSeconds = 0;
    this.state.currentSessionRevenue = 0;
    this.pendingDemand = 0;
    this.pendingCapacity = 0;

    const sessionId = randomUUID();
    this.telemetry.startSession(sessionId, { starting_stage: this.state.stage });
    this.telemetry.emit("level_start", { stage: this.state.stage });

    return sessionId;
  }

  endSession() {
    if (!this.sessionActive) {
      throw new Error("no active session");
    }

    const interstitialShown =
      !this.state.adFree && this._shouldShowInterstitialAfterSession();

    this.telemetry.endSession({
      stage: this.state.stage,
      served_customers: this.state.totalServedCustomers,
      failed_customers: this.state.totalFailedCustomers,
      session_revenue: Number(this.state.currentSessionRevenue.toFixed(2)),
      coins: Number(this.state.coins.toFixed(2)),
      interstitial_shown: interstitialShown
    });

    this.sessionActive = false;

    return {
      stage: this.state.stage,
      session_seconds: this.state.currentSessionSeconds,
      session_revenue: Number(this.state.currentSessionRevenue.toFixed(2)),
      total_coins: Number(this.state.coins.toFixed(2)),
      served_customers: this.state.totalServedCustomers,
      failed_customers: this.state.totalFailedCustomers,
      interstitial_shown: interstitialShown
    };
  }

  tick(seconds = 1) {
    if (!this.sessionActive) {
      throw new Error("startSession must be called before tick");
    }

    this.state.currentSessionSeconds += seconds;

    const stageRow = this.difficultyCurve[this.state.stage - 1];
    const demandPerSec =
      (this.baseDemandPerMin *
        stageRow.demand_multiplier *
        this.config.economy_multiplier) /
      60;
    const capacityPerSec = this._calculateCurrentThroughputPerMin() / 60;

    this.pendingDemand += demandPerSec * seconds;
    this.pendingCapacity += capacityPerSec * seconds;

    const demandUnits = Math.floor(this.pendingDemand);
    const capacityUnits = Math.floor(this.pendingCapacity);
    const served = Math.min(demandUnits, capacityUnits);
    const failed = Math.max(0, demandUnits - capacityUnits);

    this.pendingDemand -= demandUnits;
    this.pendingCapacity -= capacityUnits;

    if (served > 0) {
      const income = served * this._getCurrentOrderValue();
      this.state.coins += income;
      this.state.currentSessionRevenue += income;
      this.state.totalServedCustomers += served;
      this._missionTracker.registerAction("serve_customers", served);
      this._checkStageProgression();
    }

    if (failed > 0) {
      this.state.totalFailedCustomers += failed;
    }

    return {
      served,
      failed,
      coins: Number(this.state.coins.toFixed(2)),
      stage: this.state.stage
    };
  }

  offerRewardedAd(rewardType) {
    if (!this.sessionActive) {
      throw new Error("rewarded ads are only available during active sessions");
    }

    const nowSec = this.state.currentSessionSeconds;
    if (nowSec - this.lastRewardedAdAtSec < this.config.ad_cooldown_sec) {
      return {
        ok: false,
        reason: "cooldown_active"
      };
    }

    this.telemetry.emit("ad_offer_shown", {
      reward_type: rewardType,
      offer_timing: this.abFlags.ab_offer_timing
    });

    let rewardValue = 0;
    if (rewardType === "double_income_30s") {
      this.state.activeIncomeBoostUntilSec = Math.max(
        this.state.activeIncomeBoostUntilSec,
        nowSec + 30
      );
      rewardValue = 30;
    } else if (rewardType === "instant_upgrade") {
      this.state.instantUpgradeCredits += 1;
      rewardValue = 1;
    } else if (rewardType === "failure_recovery") {
      const recovered = Math.min(10, this.state.totalFailedCustomers);
      this.state.totalFailedCustomers -= recovered;
      const recoveredCoins = recovered * this._getCurrentOrderValue();
      this.state.coins += recoveredCoins;
      this.state.currentSessionRevenue += recoveredCoins;
      rewardValue = recovered;
    } else {
      throw new Error(`unsupported rewarded ad type: ${rewardType}`);
    }

    this.lastRewardedAdAtSec = nowSec;
    this._missionTracker.registerAction("watch_rewarded_ad", 1);

    this.telemetry.emit("ad_reward_granted", {
      reward_type: rewardType,
      reward_value: rewardValue
    });

    return {
      ok: true,
      reward_type: rewardType,
      reward_value: rewardValue
    };
  }

  purchaseUpgrade(upgradeId) {
    const upgrade = this.upgrades.find((item) => item.id === upgradeId);
    if (!upgrade) {
      return { ok: false, reason: "upgrade_not_found" };
    }
    if (this.state.purchasedUpgradeIds.has(upgradeId)) {
      return { ok: false, reason: "already_purchased" };
    }

    const cost = this._getUpgradeCost(upgrade.cost);
    if (this.state.coins < cost) {
      return { ok: false, reason: "insufficient_coins" };
    }

    this.state.coins -= cost;
    this._applyUpgrade(upgrade);
    this.state.purchasedUpgradeIds.add(upgradeId);
    this._missionTracker.registerAction("purchase_upgrade", 1);

    this.telemetry.emit("upgrade_purchase", {
      upgrade_id: upgradeId,
      category: upgrade.category,
      cost,
      coins_after: Number(this.state.coins.toFixed(2))
    });

    return { ok: true, upgrade_id: upgradeId, cost };
  }

  viewIapOffer(productId) {
    const product = this.iapProducts.find((item) => item.id === productId);
    if (!product) {
      return { ok: false, reason: "product_not_found" };
    }

    this.telemetry.emit("iap_offer_view", {
      product_id: product.id,
      iap_price_tier: this.config.iap_price_tier,
      base_price_usd: product.base_price_usd
    });

    return { ok: true, product };
  }

  purchaseIap(productId) {
    const product = this.iapProducts.find((item) => item.id === productId);
    if (!product) {
      return { ok: false, reason: "product_not_found" };
    }

    this.state.coins += product.coins;
    this.state.boosterTokens += product.booster_tokens;
    if (product.ad_free) {
      this.state.adFree = true;
    }

    this.telemetry.emit("iap_purchase", {
      product_id: product.id,
      kind: product.kind,
      price_usd: product.base_price_usd,
      coins_added: product.coins,
      booster_tokens_added: product.booster_tokens,
      ad_free_enabled: product.ad_free
    });

    return { ok: true, product_id: product.id };
  }

  getDailyMissionStatus() {
    return this._missionTracker.getStatus();
  }

  claimMission(missionId) {
    const reward = this._missionTracker.claim(missionId);
    if (reward > 0) {
      this.state.coins += reward;
      return { ok: true, reward_coins: reward };
    }
    return { ok: false, reward_coins: 0 };
  }

  _checkStageProgression() {
    while (this.state.stage < this.difficultyCurve.length) {
      const currentStageGoal =
        this.difficultyCurve[this.state.stage - 1].completion_goal_customers;
      if (this.state.totalServedCustomers < currentStageGoal) {
        break;
      }

      const completedStage = this.state.stage;
      this.telemetry.emit("level_complete", {
        stage: completedStage,
        served_customers: this.state.totalServedCustomers
      });

      this.state.stage += 1;
      this.telemetry.emit("level_start", { stage: this.state.stage });
    }
  }

  _calculateCurrentThroughputPerMin() {
    const stationThroughput = this.stationsConfig.reduce((sum, stationConfig) => {
      const runtimeStation = this.state.stations.find(
        (station) => station.id === stationConfig.id
      );
      const stationValue =
        stationConfig.base_throughput_per_min * runtimeStation.multiplier +
        runtimeStation.flatThroughput;
      return sum + stationValue;
    }, 0);

    return (
      stationThroughput *
      this.state.globalThroughputMultiplier *
      this.state.staffMultiplier
    );
  }

  _getCurrentOrderValue() {
    const stageMultiplier = this.difficultyCurve[this.state.stage - 1].order_value_multiplier;
    const adMultiplier =
      this.state.currentSessionSeconds <= this.state.activeIncomeBoostUntilSec
        ? this.config.rewarded_ad_multiplier
        : 1;

    return (
      this.baseOrderValue *
      stageMultiplier *
      this.state.orderValueMultiplier *
      adMultiplier
    );
  }

  _getUpgradeCost(baseCost) {
    let cost = baseCost;

    if (this.abFlags.ab_upgrade_cost_curve === "discount_10") {
      cost = Math.ceil(baseCost * 0.9);
    }

    if (this.state.instantUpgradeCredits > 0) {
      this.state.instantUpgradeCredits -= 1;
      return 0;
    }

    return cost;
  }

  _applyUpgrade(upgrade) {
    if (upgrade.category === "station_multiplier") {
      const station = this.state.stations.find(
        (item) => item.id === upgrade.target_station
      );
      station.multiplier *= upgrade.multiplier;
      return;
    }

    if (upgrade.category === "station_flat") {
      const station = this.state.stations.find(
        (item) => item.id === upgrade.target_station
      );
      station.flatThroughput += upgrade.flat_throughput;
      return;
    }

    if (upgrade.category === "global_throughput_multiplier") {
      this.state.globalThroughputMultiplier *= upgrade.multiplier;
      return;
    }

    if (upgrade.category === "order_value_multiplier") {
      this.state.orderValueMultiplier *= upgrade.multiplier;
      return;
    }

    if (upgrade.category === "staff_multiplier") {
      this.state.staffMultiplier *= upgrade.multiplier;
      return;
    }

    throw new Error(`unsupported upgrade category: ${upgrade.category}`);
  }

  _shouldShowInterstitialAfterSession() {
    if (this.abFlags.ab_ad_frequency === "off") {
      return false;
    }
    if (this.abFlags.ab_ad_frequency === "low") {
      return this.state.sessionsPlayed % 3 === 0;
    }
    if (this.abFlags.ab_ad_frequency === "medium") {
      return this.state.sessionsPlayed % 2 === 0;
    }
    return true;
  }
}

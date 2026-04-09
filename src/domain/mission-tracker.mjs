export class MissionTracker {
  constructor(missions) {
    this.missions = missions.map((mission) => ({
      ...mission,
      progress: 0,
      claimed: false
    }));
  }

  registerAction(type, amount = 1) {
    for (const mission of this.missions) {
      if (mission.type === type) {
        mission.progress += amount;
      }
    }
  }

  getStatus() {
    return this.missions.map((mission) => ({
      id: mission.id,
      name: mission.name,
      type: mission.type,
      progress: mission.progress,
      goal: mission.goal,
      reward_coins: mission.reward_coins,
      completed: mission.progress >= mission.goal,
      claimed: mission.claimed
    }));
  }

  claim(missionId) {
    const mission = this.missions.find((item) => item.id === missionId);
    if (!mission || mission.claimed || mission.progress < mission.goal) {
      return 0;
    }

    mission.claimed = true;
    return mission.reward_coins;
  }
}

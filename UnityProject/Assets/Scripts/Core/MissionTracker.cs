using System.Collections.Generic;
using System.Linq;

namespace MiniMarketShift.Core
{
    internal sealed class MissionTracker
    {
        private readonly List<MissionRuntime> _missions;

        public MissionTracker(IEnumerable<MissionDefinition> missions)
        {
            _missions = missions.Select(m => new MissionRuntime(m)).ToList();
        }

        public void RegisterAction(string type, int amount)
        {
            foreach (var mission in _missions)
            {
                if (mission.Type == type)
                {
                    mission.Progress += amount;
                }
            }
        }

        public List<MissionStatus> GetStatus()
        {
            return _missions.Select(m => new MissionStatus
            {
                id = m.Id,
                name = m.Name,
                type = m.Type,
                progress = m.Progress,
                goal = m.Goal,
                reward_coins = m.RewardCoins,
                completed = m.Progress >= m.Goal,
                claimed = m.Claimed
            }).ToList();
        }

        public int Claim(string missionId)
        {
            var mission = _missions.FirstOrDefault(m => m.Id == missionId);
            if (mission == null || mission.Claimed || mission.Progress < mission.Goal)
            {
                return 0;
            }

            mission.Claimed = true;
            return mission.RewardCoins;
        }

        private sealed class MissionRuntime
        {
            public string Id { get; }
            public string Name { get; }
            public string Type { get; }
            public int Goal { get; }
            public int RewardCoins { get; }
            public int Progress { get; set; }
            public bool Claimed { get; set; }

            public MissionRuntime(MissionDefinition definition)
            {
                Id = definition.id;
                Name = definition.name;
                Type = definition.type;
                Goal = definition.goal;
                RewardCoins = definition.reward_coins;
                Progress = 0;
                Claimed = false;
            }
        }
    }
}

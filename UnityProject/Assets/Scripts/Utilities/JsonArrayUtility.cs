using System;
using UnityEngine;

namespace MiniMarketShift.Utilities
{
    public static class JsonArrayUtility
    {
        [Serializable]
        private sealed class Wrapper<T>
        {
            public T[] Items;
        }

        public static T[] FromJson<T>(string json)
        {
            var wrapped = $"{{\"Items\":{json}}}";
            var result = JsonUtility.FromJson<Wrapper<T>>(wrapped);
            return result?.Items ?? Array.Empty<T>();
        }
    }
}

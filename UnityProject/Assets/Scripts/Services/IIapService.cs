using System;
using System.Collections.Generic;
using MiniMarketShift.Core;

namespace MiniMarketShift.Services
{
    public interface IIapService
    {
        void Initialize(IReadOnlyList<IapProductDefinition> products);
        void Purchase(string productId, Action<bool, string> onComplete);
    }
}

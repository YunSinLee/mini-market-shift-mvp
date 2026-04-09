using System;
using System.Collections.Generic;
using MiniMarketShift.Core;
using MiniMarketShift.Services;
using UnityEngine;

namespace MiniMarketShift.Integrations
{
    public sealed class MockIapService : IIapService
    {
        private readonly HashSet<string> _products = new HashSet<string>();

        public void Initialize(IReadOnlyList<IapProductDefinition> products)
        {
            _products.Clear();
            foreach (var product in products)
            {
                _products.Add(product.id);
            }
            Debug.Log($"[MockIapService] initialized with {_products.Count} products");
        }

        public void Purchase(string productId, Action<bool, string> onComplete)
        {
            var exists = _products.Contains(productId);
            Debug.Log($"[MockIapService] purchase attempt: {productId}, exists={exists}");
            onComplete?.Invoke(exists, exists ? null : "product_not_found");
        }
    }
}

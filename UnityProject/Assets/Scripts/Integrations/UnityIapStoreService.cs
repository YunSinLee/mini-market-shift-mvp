using System;
using System.Collections.Generic;
using System.Linq;
using MiniMarketShift.Core;
using MiniMarketShift.Services;
using UnityEngine;

#if UNITY_PURCHASING
using UnityEngine.Purchasing;
using UnityEngine.Purchasing.Extension;
#endif

namespace MiniMarketShift.Integrations
{
#if UNITY_PURCHASING
    public sealed class UnityIapStoreService : IIapService, IStoreListener
    {
        private readonly HashSet<string> _products = new HashSet<string>();
        private readonly Dictionary<string, Action<bool, string>> _pendingPurchaseCallbacks =
            new Dictionary<string, Action<bool, string>>();

        private IStoreController _storeController;
        private IExtensionProvider _extensionProvider;

        public void Initialize(IReadOnlyList<IapProductDefinition> products)
        {
            _products.Clear();
            foreach (var product in products)
            {
                _products.Add(product.id);
            }

            var module = StandardPurchasingModule.Instance();
            var builder = ConfigurationBuilder.Instance(module);
            foreach (var product in products)
            {
                var productType =
                    product.kind == "non_consumable"
                        ? ProductType.NonConsumable
                        : ProductType.Consumable;

                builder.AddProduct(product.id, productType);
            }

            UnityPurchasing.Initialize(this, builder);
        }

        public void Purchase(string productId, Action<bool, string> onComplete)
        {
            if (!_products.Contains(productId))
            {
                onComplete?.Invoke(false, "product_not_found");
                return;
            }

            if (_storeController == null)
            {
                onComplete?.Invoke(false, "iap_not_initialized");
                return;
            }

            _pendingPurchaseCallbacks[productId] = onComplete;
            _storeController.InitiatePurchase(productId);
        }

        public void OnInitialized(IStoreController controller, IExtensionProvider extensions)
        {
            _storeController = controller;
            _extensionProvider = extensions;
            Debug.Log("[UnityIapStoreService] Unity IAP initialized.");
        }

        public void OnInitializeFailed(InitializationFailureReason error)
        {
            Debug.LogError($"[UnityIapStoreService] IAP initialization failed: {error}");
            foreach (var callback in _pendingPurchaseCallbacks.Values.ToList())
            {
                callback?.Invoke(false, "iap_initialize_failed");
            }
            _pendingPurchaseCallbacks.Clear();
        }

        public void OnInitializeFailed(InitializationFailureReason error, string message)
        {
            Debug.LogError($"[UnityIapStoreService] IAP initialization failed: {error}, {message}");
            OnInitializeFailed(error);
        }

        public PurchaseProcessingResult ProcessPurchase(PurchaseEventArgs e)
        {
            if (_pendingPurchaseCallbacks.TryGetValue(e.purchasedProduct.definition.id, out var callback))
            {
                callback?.Invoke(true, null);
                _pendingPurchaseCallbacks.Remove(e.purchasedProduct.definition.id);
            }
            return PurchaseProcessingResult.Complete;
        }

        public void OnPurchaseFailed(Product product, PurchaseFailureReason failureReason)
        {
            var id = product?.definition?.id ?? "unknown_product";
            if (_pendingPurchaseCallbacks.TryGetValue(id, out var callback))
            {
                callback?.Invoke(false, $"purchase_failed:{failureReason}");
                _pendingPurchaseCallbacks.Remove(id);
                return;
            }

            Debug.LogWarning($"[UnityIapStoreService] Purchase failed: {id}, reason={failureReason}");
        }
    }
#else
    public sealed class UnityIapStoreService : IIapService
    {
        private readonly HashSet<string> _products = new HashSet<string>();

        public void Initialize(IReadOnlyList<IapProductDefinition> products)
        {
            _products.Clear();
            foreach (var product in products)
            {
                _products.Add(product.id);
            }
            Debug.LogWarning("[UnityIapStoreService] UNITY_PURCHASING define is not enabled. Using fallback behavior.");
        }

        public void Purchase(string productId, Action<bool, string> onComplete)
        {
            if (!_products.Contains(productId))
            {
                onComplete?.Invoke(false, "product_not_found");
                return;
            }

            Debug.Log($"[UnityIapStoreService] Fallback purchase path: {productId}");
            onComplete?.Invoke(true, null);
        }
    }
#endif
}

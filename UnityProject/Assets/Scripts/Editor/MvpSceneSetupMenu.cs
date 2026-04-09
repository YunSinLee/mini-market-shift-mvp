#if UNITY_EDITOR
using MiniMarketShift.Runtime;
using UnityEditor;
using UnityEngine;

namespace MiniMarketShift.Editor
{
    public static class MvpSceneSetupMenu
    {
        private const string MenuPath = "Tools/Mini Market Shift/Setup MVP Scene";

        [MenuItem(MenuPath)]
        public static void SetupScene()
        {
            var bootstrap = FindOrCreateBootstrap();
            var presenter = FindOrCreatePresenter(bootstrap);
            var smokeRunner = FindOrCreateSmokeRunner(bootstrap);

            Selection.activeGameObject = bootstrap.gameObject;
            EditorUtility.SetDirty(bootstrap.gameObject);
            EditorUtility.SetDirty(presenter.gameObject);
            EditorUtility.SetDirty(smokeRunner.gameObject);

            Debug.Log("[MvpSceneSetupMenu] Scene setup completed. Configure SDK fields in GameBootstrap inspector.");
        }

        private static GameBootstrap FindOrCreateBootstrap()
        {
            var existing = Object.FindObjectOfType<GameBootstrap>();
            if (existing != null)
            {
                return existing;
            }

            var go = new GameObject("GameBootstrap");
            return go.AddComponent<GameBootstrap>();
        }

        private static GameLoopPresenter FindOrCreatePresenter(GameBootstrap bootstrap)
        {
            var existing = Object.FindObjectOfType<GameLoopPresenter>();
            if (existing != null)
            {
                WireBootstrapReference(existing, bootstrap);
                return existing;
            }

            var go = new GameObject("GameLoopPresenter");
            var presenter = go.AddComponent<GameLoopPresenter>();
            WireBootstrapReference(presenter, bootstrap);
            return presenter;
        }

        private static RuntimeSmokeRunner FindOrCreateSmokeRunner(GameBootstrap bootstrap)
        {
            var existing = Object.FindObjectOfType<RuntimeSmokeRunner>();
            if (existing != null)
            {
                WireBootstrapReference(existing, bootstrap);
                return existing;
            }

            var go = new GameObject("RuntimeSmokeRunner");
            var runner = go.AddComponent<RuntimeSmokeRunner>();
            WireBootstrapReference(runner, bootstrap);
            return runner;
        }

        private static void WireBootstrapReference(Object target, GameBootstrap bootstrap)
        {
            var so = new SerializedObject(target);
            var prop = so.FindProperty("bootstrap");
            if (prop != null)
            {
                prop.objectReferenceValue = bootstrap;
                so.ApplyModifiedPropertiesWithoutUndo();
            }
        }
    }
}
#endif

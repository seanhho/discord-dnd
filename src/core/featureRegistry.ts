import type { FeatureRegistry, FeatureSlice } from './types.js';

/**
 * Create a feature registry instance
 * This is the central registry for all feature slices in the application
 */
export function createFeatureRegistry(): FeatureRegistry {
  const features = new Map<string, FeatureSlice>();

  return {
    register(feature: FeatureSlice): void {
      if (features.has(feature.name)) {
        throw new Error(
          `Feature "${feature.name}" is already registered. Feature names must be unique.`
        );
      }
      features.set(feature.name, feature);
    },

    getAll(): FeatureSlice[] {
      return Array.from(features.values());
    },

    getByName(name: string): FeatureSlice | undefined {
      return features.get(name);
    },
  };
}

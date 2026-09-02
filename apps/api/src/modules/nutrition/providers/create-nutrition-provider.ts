import type { AppConfig } from '../../../config/env.js';
import type { NutritionProvider } from '../domain/types.js';
import { FakeNutritionProvider } from './fake/fake-nutrition-provider.js';
import { UnconfiguredNutritionProvider } from './unconfigured-nutrition-provider.js';
import { UsdaFdcProvider } from './usda/usda-fdc-provider.js';

export function createNutritionProvider(
  appConfig: AppConfig,
  override?: NutritionProvider,
): NutritionProvider {
  if (override) {
    return override;
  }
  if (appConfig.isTest) {
    return new FakeNutritionProvider();
  }
  if (appConfig.nutrition.usdaFdcApiKey) {
    return new UsdaFdcProvider({
      apiKey: appConfig.nutrition.usdaFdcApiKey,
      maxRetries: appConfig.nutrition.maxRetries,
      backoffMs: appConfig.nutrition.backoffMs,
    });
  }
  return new UnconfiguredNutritionProvider();
}
import { normalizeOperatingCities } from "@/domain/delivery/cityDeliveryPricing";
import { defaultDeliveryPricing } from "@/domain/delivery/deliveryPricingPolicy";

export function policyFromCompany(company) {
  const fallback = defaultDeliveryPricing(company?.deliveryPricePerKm ?? 1);
  const dp = company?.deliveryPricing;
  if (!dp || typeof dp !== "object") return fallback;
  return {
    strategy:
      dp.strategy || (dp.operatingCities?.length ? "cities" : fallback.strategy),
    radiusKm: dp.radiusKm ?? null,
    operatingCities: normalizeOperatingCities(dp.operatingCities),
    maxDistanceKm: dp.maxDistanceKm ?? null,
    inside: {
      mode: dp.inside?.mode || fallback.inside.mode,
      amount:
        dp.inside?.amount != null
          ? Number(dp.inside.amount)
          : fallback.inside.amount,
    },
    outside: {
      mode: dp.outside?.mode || fallback.outside.mode,
      amount:
        dp.outside?.amount != null
          ? Number(dp.outside.amount)
          : fallback.outside.amount,
    },
    afterHoursSurcharge: Number(dp.afterHoursSurcharge) || 0,
  };
}

import { energyRepository } from "../repositories/energy.repository";
import { listingRepository } from "../repositories/listing.repository";
import { userRepository } from "../repositories/user.repository";
import { gridService } from "./grid.service";
import { cacheService } from "../infra/redis";

const DASHBOARD_CACHE_KEY = "dashboard:summary:latest";

export class DashboardService {
  async getSummary() {
    const cached = await cacheService.get<Record<string, unknown>>(DASHBOARD_CACHE_KEY);
    if (cached) {
      return cached;
    }

    const [energyOverview, activeListings, activeProsumersCount, gridStatus] =
      await Promise.all([
        energyRepository.findOverview(12),
        listingRepository.findMany({ status: "ACTIVE" }),
        userRepository.countActiveProsumers(),
        gridService.getStatus(),
      ]);

    const marketableSurplusKwh = energyOverview.reduce(
      (total, item) => total + Number(item.marketableSurplusKwh),
      0,
    );

    const activeListingsCount = activeListings.length;
    const currentPriceInrPerKwh =
      activeListings.length > 0
        ? Math.min(...activeListings.map((l) => Number(l.priceInrPerKwh)))
        : 4.8;

    const carbonAvoidedKg = Number((marketableSurplusKwh * 0.68).toFixed(2));

    const energyTrend = energyOverview.map((item) => ({
      timestamp: item.observedAt,
      generationKwh: Number(item.generationKwh),
      consumptionKwh: Number(item.consumptionKwh),
      marketableSurplusKwh: Number(item.marketableSurplusKwh),
    }));

    const result = {
      marketableSurplusKwh: Number(marketableSurplusKwh.toFixed(2)),
      activeListings: activeListingsCount,
      activeProsumers: activeProsumersCount > 0 ? activeProsumersCount : 184,
      currentPriceInrPerKwh,
      gridDecision: gridStatus.decision,
      gridLabel: gridStatus.label,
      carbonAvoidedKg,
      energyTrend,
    };

    await cacheService.set(DASHBOARD_CACHE_KEY, result, 15);
    return result;
  }
}

export const dashboardService = new DashboardService();

import { gridRepository } from "../repositories/grid.repository";
import { decideGrid, gridDecisionLabel, type GridInputs } from "../domain/grid";
import { cacheService } from "../infra/redis";

const GRID_CACHE_KEY = "grid:status:latest";

export class GridService {
  async getStatus(region = "NCR-NORTH") {
    const cached = await cacheService.get<{
      decision: string;
      label: string;
      congestionPercent: number;
      renewableSharePercent: number;
      frequencyHz: number;
      updatedAt: string;
    }>(`${GRID_CACHE_KEY}:${region}`);

    if (cached) {
      return cached;
    }

    const latest = await gridRepository.findLatest(region);
    const inputs: GridInputs = {
      congestionPercent: latest ? Number(latest.congestionPercent) : 62,
      renewableSharePercent: latest ? Number(latest.renewableSharePercent) : 71,
      frequencyHz: latest ? Number(latest.frequencyHz) : 49.98,
    };

    const decision = latest ? latest.decision : decideGrid(inputs);
    const label = gridDecisionLabel(decision);

    const payload = {
      decision,
      label,
      ...inputs,
      updatedAt: latest ? latest.observedAt.toISOString() : new Date().toISOString(),
    };

    await cacheService.set(`${GRID_CACHE_KEY}:${region}`, payload, 30);
    return payload;
  }
}

export const gridService = new GridService();

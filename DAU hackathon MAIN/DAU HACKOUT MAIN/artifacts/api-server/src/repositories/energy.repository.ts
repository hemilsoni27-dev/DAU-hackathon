import { prisma } from "../lib/prisma";
import type { EnergyData } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class EnergyRepository {
  async findOverview(limit = 12): Promise<EnergyData[]> {
    return prisma.energyData.findMany({
      take: limit,
      orderBy: { observedAt: "asc" },
    });
  }

  async create(data: {
    solarSystemId: string;
    generationKwh: number | string | Decimal;
    consumptionKwh: number | string | Decimal;
    marketableSurplusKwh: number | string | Decimal;
    observedAt?: Date;
    source?: string;
  }): Promise<EnergyData> {
    return prisma.energyData.create({
      data: {
        solarSystemId: data.solarSystemId,
        generationKwh: new Decimal(data.generationKwh.toString()),
        consumptionKwh: new Decimal(data.consumptionKwh.toString()),
        marketableSurplusKwh: new Decimal(data.marketableSurplusKwh.toString()),
        observedAt: data.observedAt ?? new Date(),
        source: data.source ?? "prototype",
      },
    });
  }
}

export const energyRepository = new EnergyRepository();

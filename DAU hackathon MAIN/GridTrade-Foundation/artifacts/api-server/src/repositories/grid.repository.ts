import { prisma } from "../lib/prisma";
import type { GridData, GridDecision } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class GridRepository {
  async findLatest(region = "NCR-NORTH"): Promise<GridData | null> {
    return prisma.gridData.findFirst({
      where: { region },
      orderBy: { observedAt: "desc" },
    });
  }

  async create(data: {
    region: string;
    congestionPercent: number | Decimal;
    renewableSharePercent: number | Decimal;
    frequencyHz: number | Decimal;
    decision: GridDecision;
    observedAt?: Date;
  }): Promise<GridData> {
    return prisma.gridData.create({
      data: {
        region: data.region,
        congestionPercent: new Decimal(data.congestionPercent.toString()),
        renewableSharePercent: new Decimal(data.renewableSharePercent.toString()),
        frequencyHz: new Decimal(data.frequencyHz.toString()),
        decision: data.decision,
        observedAt: data.observedAt ?? new Date(),
      },
    });
  }
}

export const gridRepository = new GridRepository();

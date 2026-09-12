import { prisma } from "../lib/prisma";
import type { Demand, DemandStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class DemandRepository {
  async findById(id: string): Promise<(Demand & { buyer: { displayName: string; email: string } }) | null> {
    return prisma.demand.findUnique({
      where: { id },
      include: { buyer: { select: { displayName: true, email: true } } },
    });
  }

  async findMany(params?: {
    status?: DemandStatus;
    buyerId?: string;
    limit?: number;
  }): Promise<(Demand & { buyer: { displayName: string } })[]> {
    return prisma.demand.findMany({
      where: {
        ...(params?.status ? { status: params.status } : {}),
        ...(params?.buyerId ? { buyerId: params.buyerId } : {}),
      },
      take: params?.limit ?? 50,
      orderBy: { createdAt: "desc" },
      include: {
        buyer: { select: { displayName: true } },
      },
    });
  }

  async create(data: {
    buyerId: string;
    quantityKwh: number | string | Decimal;
    maxPriceInrPerKwh: number | string | Decimal;
    availableFrom: Date;
    availableUntil: Date;
    status?: DemandStatus;
  }): Promise<Demand> {
    return prisma.demand.create({
      data: {
        buyerId: data.buyerId,
        quantityKwh: new Decimal(data.quantityKwh.toString()),
        allocatedKwh: new Decimal(0),
        maxPriceInrPerKwh: new Decimal(data.maxPriceInrPerKwh.toString()),
        availableFrom: data.availableFrom,
        availableUntil: data.availableUntil,
        status: data.status ?? "OPEN",
      },
    });
  }

  async updateStatus(id: string, status: DemandStatus): Promise<Demand> {
    return prisma.demand.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Concurrency-safe energy allocation.
   * Atomically increments allocatedKwh if remaining capacity permits.
   */
  async allocateEnergy(id: string, deltaKwh: number): Promise<Demand> {
    const demand = await prisma.demand.findUnique({ where: { id } });
    if (!demand) {
      throw new Error("Demand not found");
    }

    const currentAlloc = Number(demand.allocatedKwh);
    const totalQty = Number(demand.quantityKwh);
    const newAlloc = currentAlloc + deltaKwh;

    if (newAlloc > totalQty + 0.0001) {
      throw new Error(`Cannot allocate ${deltaKwh} kWh: Exceeds requested demand quantity`);
    }

    const nextStatus: DemandStatus =
      newAlloc >= totalQty - 0.0001 ? "FULLY_MATCHED" : "PARTIALLY_MATCHED";

    return prisma.demand.update({
      where: { id },
      data: {
        allocatedKwh: new Decimal(newAlloc.toFixed(4)),
        status: nextStatus,
      },
    });
  }
}

export const demandRepository = new DemandRepository();

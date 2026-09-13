import { demandRepository } from "../repositories/demand.repository";
import { auditRepository } from "../repositories/audit.repository";
import { eventPublisher } from "../realtime/events";
import { assertPositiveEnergy, assertValidAvailability } from "../domain/energy";
import { AppError } from "../middleware/errors";
import { assertCanModifyResource, type AuthContext } from "../middleware/auth";
import type { DemandStatus } from "@prisma/client";

export class DemandService {
  async getDemands(params?: { status?: string; buyerId?: string; limit?: number }) {
    const records = await demandRepository.findMany({
      status: params?.status as DemandStatus | undefined,
      buyerId: params?.buyerId,
      limit: params?.limit,
    });

    return records.map((record) => {
      const quantityKwh = Number(record.quantityKwh);
      const allocatedKwh = Number(record.allocatedKwh);
      return {
        id: record.id,
        buyerId: record.buyerId,
        buyerName: record.buyer.displayName,
        quantityKwh,
        allocatedKwh,
        remainingKwh: Math.max(0, quantityKwh - allocatedKwh),
        maxPriceInrPerKwh: Number(record.maxPriceInrPerKwh),
        availableFrom: record.availableFrom,
        availableUntil: record.availableUntil,
        status: record.status,
        createdAt: record.createdAt,
      };
    });
  }

  async getDemandById(id: string) {
    const record = await demandRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "Demand request not found", 404);
    }
    const quantityKwh = Number(record.quantityKwh);
    const allocatedKwh = Number(record.allocatedKwh);
    return {
      id: record.id,
      buyerId: record.buyerId,
      buyerName: record.buyer.displayName,
      quantityKwh,
      allocatedKwh,
      remainingKwh: Math.max(0, quantityKwh - allocatedKwh),
      maxPriceInrPerKwh: Number(record.maxPriceInrPerKwh),
      availableFrom: record.availableFrom,
      availableUntil: record.availableUntil,
      status: record.status,
      createdAt: record.createdAt,
    };
  }

  async createDemand(
    authContext: AuthContext,
    input: {
      quantityKwh: number;
      maxPriceInrPerKwh: number;
      availableFrom: Date | string;
      availableUntil: Date | string;
    },
  ) {
    assertPositiveEnergy(String(input.quantityKwh), "quantityKwh");
    const from = new Date(input.availableFrom);
    const until = new Date(input.availableUntil);
    assertValidAvailability(from, until);

    const record = await demandRepository.create({
      buyerId: authContext.userId,
      quantityKwh: input.quantityKwh,
      maxPriceInrPerKwh: input.maxPriceInrPerKwh,
      availableFrom: from,
      availableUntil: until,
      status: "OPEN",
    });

    // Persistence First, then Audit & Event
    await auditRepository.logAction({
      actorId: authContext.userId,
      action: "DEMAND_CREATED",
      entityType: "Demand",
      entityId: record.id,
      metadata: { quantityKwh: input.quantityKwh, maxPriceInrPerKwh: input.maxPriceInrPerKwh },
    });

    await eventPublisher.publish({
      type: "alert.created",
      alertId: `demand-${record.id}`,
      severity: "info",
      occurredAt: new Date().toISOString(),
    });

    return {
      id: record.id,
      buyerId: record.buyerId,
      buyerName: authContext.displayName,
      quantityKwh: Number(record.quantityKwh),
      allocatedKwh: 0,
      remainingKwh: Number(record.quantityKwh),
      maxPriceInrPerKwh: Number(record.maxPriceInrPerKwh),
      availableFrom: record.availableFrom,
      availableUntil: record.availableUntil,
      status: record.status,
      createdAt: record.createdAt,
    };
  }

  async cancelDemand(authContext: AuthContext, id: string) {
    const record = await demandRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "Demand request not found", 404);
    }

    assertCanModifyResource(authContext, record.buyerId, "demand");

    if (record.status === "CLOSED" || record.status === "CANCELLED") {
      throw new AppError("INVALID_STATE", `Demand is already ${record.status}`, 400);
    }

    const updated = await demandRepository.updateStatus(id, "CANCELLED");

    await auditRepository.logAction({
      actorId: authContext.userId,
      action: "DEMAND_CANCELLED",
      entityType: "Demand",
      entityId: id,
    });

    return {
      id: updated.id,
      status: updated.status,
    };
  }
}

export const demandService = new DemandService();

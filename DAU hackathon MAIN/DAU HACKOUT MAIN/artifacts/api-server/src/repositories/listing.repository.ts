import { prisma } from "../lib/prisma";
import type { Listing, ListingStatus, GridDecision, Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export interface ListingFilterParams {
  status?: ListingStatus;
  sellerId?: string;
  minEnergy?: number;
  maxEnergy?: number;
  minPrice?: number;
  maxPrice?: number;
  availableFrom?: Date;
  availableUntil?: Date;
  limit?: number;
}

export class ListingRepository {
  async findById(
    id: string,
  ): Promise<
    (Listing & { seller: { displayName: string; email: string }; solarSystem: { name: string; location: string } }) | null
  > {
    return prisma.listing.findUnique({
      where: { id },
      include: {
        seller: { select: { displayName: true, email: true } },
        solarSystem: { select: { name: true, location: true } },
      },
    });
  }

  async findMany(
    params?: ListingFilterParams,
  ): Promise<
    (Listing & { seller: { displayName: string }; solarSystem: { name: string; location: string } })[]
  > {
    const where: Prisma.ListingWhereInput = {
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.sellerId ? { sellerId: params.sellerId } : {}),
      ...(params?.minEnergy || params?.maxEnergy
        ? {
            quantityKwh: {
              ...(params?.minEnergy ? { gte: new Decimal(params.minEnergy) } : {}),
              ...(params?.maxEnergy ? { lte: new Decimal(params.maxEnergy) } : {}),
            },
          }
        : {}),
      ...(params?.minPrice || params?.maxPrice
        ? {
            priceInrPerKwh: {
              ...(params?.minPrice ? { gte: new Decimal(params.minPrice) } : {}),
              ...(params?.maxPrice ? { lte: new Decimal(params.maxPrice) } : {}),
            },
          }
        : {}),
      ...(params?.availableFrom ? { availableFrom: { gte: params.availableFrom } } : {}),
      ...(params?.availableUntil ? { availableUntil: { lte: params.availableUntil } } : {}),
    };

    return prisma.listing.findMany({
      where,
      take: params?.limit ?? 50,
      orderBy: { createdAt: "desc" },
      include: {
        seller: { select: { displayName: true } },
        solarSystem: { select: { name: true, location: true } },
      },
    });
  }

  async create(data: {
    sellerId: string;
    solarSystemId: string;
    quantityKwh: number | string | Decimal;
    priceInrPerKwh: number | string | Decimal;
    availableFrom: Date;
    availableUntil: Date;
    status?: ListingStatus;
    gridDecision?: GridDecision;
  }): Promise<Listing> {
    return prisma.listing.create({
      data: {
        sellerId: data.sellerId,
        solarSystemId: data.solarSystemId,
        quantityKwh: new Decimal(data.quantityKwh.toString()),
        allocatedKwh: new Decimal(0),
        priceInrPerKwh: new Decimal(data.priceInrPerKwh.toString()),
        availableFrom: data.availableFrom,
        availableUntil: data.availableUntil,
        status: data.status ?? "ACTIVE",
        gridDecision: data.gridDecision ?? "APPROVED",
      },
    });
  }

  async updateStatus(id: string, status: ListingStatus): Promise<Listing> {
    return prisma.listing.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Concurrency-safe energy allocation.
   * Atomically increments allocatedKwh if remaining capacity permits.
   */
  async allocateEnergy(id: string, deltaKwh: number): Promise<Listing> {
    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      throw new Error("Listing not found");
    }

    const currentAlloc = Number(listing.allocatedKwh);
    const totalQty = Number(listing.quantityKwh);
    const newAlloc = currentAlloc + deltaKwh;

    if (newAlloc > totalQty + 0.0001) {
      throw new Error(`Cannot allocate ${deltaKwh} kWh: Exceeds available listing quantity`);
    }

    const nextStatus: ListingStatus =
      newAlloc >= totalQty - 0.0001 ? "FULLY_MATCHED" : "PARTIALLY_MATCHED";

    return prisma.listing.update({
      where: { id },
      data: {
        allocatedKwh: new Decimal(newAlloc.toFixed(4)),
        status: nextStatus,
      },
    });
  }
}

export const listingRepository = new ListingRepository();

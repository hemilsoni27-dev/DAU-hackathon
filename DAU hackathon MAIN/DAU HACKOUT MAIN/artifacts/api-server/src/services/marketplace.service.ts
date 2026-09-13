import { listingRepository, type ListingFilterParams } from "../repositories/listing.repository";
import { solarRepository } from "../repositories/solar.repository";
import { auditRepository } from "../repositories/audit.repository";
import { eventPublisher } from "../realtime/events";
import { gridService } from "./grid.service";
import { assertPositiveEnergy, assertValidAvailability } from "../domain/energy";
import { AppError } from "../middleware/errors";
import { assertCanModifyResource, type AuthContext } from "../middleware/auth";
import type { ListingStatus } from "@prisma/client";

export class MarketplaceService {
  async getListings(params?: ListingFilterParams) {
    const records = await listingRepository.findMany(params);

    return records.map((record) => {
      const quantityKwh = Number(record.quantityKwh);
      const allocatedKwh = Number(record.allocatedKwh);
      return {
        id: record.id,
        sellerId: record.sellerId,
        sellerName: record.solarSystem?.name || record.seller.displayName,
        location: record.solarSystem?.location || "Delhi-NCR",
        gridArea: "NCR-NORTH",
        quantityKwh,
        allocatedKwh,
        remainingKwh: Math.max(0, quantityKwh - allocatedKwh),
        priceInrPerKwh: Number(record.priceInrPerKwh),
        status: record.status,
        availableFrom: record.availableFrom,
        availableUntil: record.availableUntil,
        gridDecision: record.gridDecision,
        createdAt: record.createdAt,
      };
    });
  }

  async getListingById(id: string) {
    const record = await listingRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "Listing not found", 404);
    }
    const quantityKwh = Number(record.quantityKwh);
    const allocatedKwh = Number(record.allocatedKwh);
    return {
      id: record.id,
      sellerId: record.sellerId,
      sellerName: record.solarSystem?.name || record.seller.displayName,
      location: record.solarSystem?.location || "Delhi-NCR",
      gridArea: "NCR-NORTH",
      quantityKwh,
      allocatedKwh,
      remainingKwh: Math.max(0, quantityKwh - allocatedKwh),
      priceInrPerKwh: Number(record.priceInrPerKwh),
      status: record.status,
      availableFrom: record.availableFrom,
      availableUntil: record.availableUntil,
      gridDecision: record.gridDecision,
      createdAt: record.createdAt,
    };
  }

  async createListing(
    authContext: AuthContext,
    input: {
      solarSystemId: string;
      quantityKwh: number;
      priceInrPerKwh: number;
      availableFrom: Date | string;
      availableUntil: Date | string;
    },
  ) {
    // 1. Verify solar system ownership
    const solarSystem = await solarRepository.findById(input.solarSystemId);
    if (!solarSystem) {
      throw new AppError("NOT_FOUND", "Solar system not found", 404);
    }

    assertCanModifyResource(authContext, solarSystem.ownerId, "solar system");

    // 2. Validate domain assertions
    assertPositiveEnergy(String(input.quantityKwh), "quantityKwh");
    const from = new Date(input.availableFrom);
    const until = new Date(input.availableUntil);
    assertValidAvailability(from, until);

    // 3. Grid decision check
    const gridStatus = await gridService.getStatus();
    const gridDecision = gridStatus.decision as "APPROVED" | "ADJUSTED" | "RESTRICTED";

    if (gridDecision === "RESTRICTED") {
      throw new AppError(
        "GRID_RESTRICTED",
        "Current grid conditions do not allow publishing new listings in this zone",
        400,
      );
    }

    // 4. Persist to DB
    const record = await listingRepository.create({
      sellerId: authContext.userId,
      solarSystemId: input.solarSystemId,
      quantityKwh: input.quantityKwh,
      priceInrPerKwh: input.priceInrPerKwh,
      availableFrom: from,
      availableUntil: until,
      status: "ACTIVE",
      gridDecision,
    });

    // 5. Persistence First -> Audit & Realtime Events
    await auditRepository.logAction({
      actorId: authContext.userId,
      action: "LISTING_CREATED",
      entityType: "Listing",
      entityId: record.id,
      metadata: { quantityKwh: input.quantityKwh, priceInrPerKwh: input.priceInrPerKwh },
    });

    await eventPublisher.publish({
      type: "listing.created",
      listingId: record.id,
      occurredAt: new Date().toISOString(),
    });

    return {
      id: record.id,
      sellerId: record.sellerId,
      sellerName: solarSystem.name,
      location: solarSystem.location,
      gridArea: "NCR-NORTH",
      quantityKwh: Number(record.quantityKwh),
      allocatedKwh: 0,
      remainingKwh: Number(record.quantityKwh),
      priceInrPerKwh: Number(record.priceInrPerKwh),
      status: record.status,
      availableFrom: record.availableFrom,
      availableUntil: record.availableUntil,
      gridDecision: record.gridDecision,
      createdAt: record.createdAt,
    };
  }

  async closeListing(authContext: AuthContext, id: string) {
    const record = await listingRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "Listing not found", 404);
    }

    assertCanModifyResource(authContext, record.sellerId, "listing");
    const updated = await listingRepository.updateStatus(id, "CLOSED");

    await auditRepository.logAction({
      actorId: authContext.userId,
      action: "LISTING_CLOSED",
      entityType: "Listing",
      entityId: id,
    });

    await eventPublisher.publish({
      type: "listing.closed",
      listingId: id,
      occurredAt: new Date().toISOString(),
    });

    return { id: updated.id, status: updated.status };
  }

  async cancelListing(authContext: AuthContext, id: string) {
    const record = await listingRepository.findById(id);
    if (!record) {
      throw new AppError("NOT_FOUND", "Listing not found", 404);
    }

    assertCanModifyResource(authContext, record.sellerId, "listing");
    const updated = await listingRepository.updateStatus(id, "CANCELLED");

    await auditRepository.logAction({
      actorId: authContext.userId,
      action: "LISTING_CANCELLED",
      entityType: "Listing",
      entityId: id,
    });

    return { id: updated.id, status: updated.status };
  }
}

export const marketplaceService = new MarketplaceService();

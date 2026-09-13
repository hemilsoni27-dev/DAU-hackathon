import { prisma } from "../lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { tradeIntelligenceService } from "./trade-intelligence.service";
import { auditRepository } from "../repositories/audit.repository";
import { eventPublisher } from "../realtime/events";
import {
  canonicalizeTransaction,
  calculateBlockHash,
  GENESIS_PREVIOUS_HASH,
  type CanonicalTransactionData,
} from "../domain/ledger";
import { AppError } from "../middleware/errors";

export type ExecuteTradeInput = {
  buyerId: string;
  listingId: string;
  demandId?: string;
  requestedKwh: number;
};

export class TradeService {
  async executeTrade(input: ExecuteTradeInput) {
    const { buyerId, listingId, demandId, requestedKwh } = input;

    if (!requestedKwh || requestedKwh <= 0) {
      throw new AppError("BAD_REQUEST", "Trade requested energy must be greater than zero", 400);
    }

    // 1. Transactional Atomic Lock & Validation
    const result = await prisma.$transaction(async (tx) => {
      // a. Fetch and Lock Listing
      const listing = await tx.listing.findUnique({
        where: { id: listingId },
        include: { seller: true },
      });

      if (!listing) {
        throw new AppError("NOT_FOUND", "Marketplace listing not found", 404);
      }

      if (listing.status !== "ACTIVE" && listing.status !== "PARTIALLY_MATCHED") {
        throw new AppError("BAD_REQUEST", `Listing is no longer active (status: ${listing.status})`, 400);
      }

      if (listing.sellerId === buyerId) {
        throw new AppError("BAD_REQUEST", "Prosumers cannot execute trades against their own listings", 400);
      }

      const listingRemainingKwh = listing.quantityKwh.minus(listing.allocatedKwh).toNumber();
      if (listingRemainingKwh < 0.001) {
        throw new AppError("CONFLICT", "Listing energy has already been fully allocated", 409);
      }

      // b. Fetch and Lock Demand (if specified)
      let demand = null;
      if (demandId) {
        demand = await tx.demand.findUnique({
          where: { id: demandId },
          include: { buyer: true },
        });

        if (!demand) {
          throw new AppError("NOT_FOUND", "Consumer demand not found", 404);
        }

        if (demand.buyerId !== buyerId) {
          throw new AppError("FORBIDDEN", "You are not authorized to trade using this consumer demand", 403);
        }

        if (demand.status !== "OPEN" && demand.status !== "PARTIALLY_MATCHED") {
          throw new AppError("BAD_REQUEST", `Consumer demand is no longer open (status: ${demand.status})`, 400);
        }
      }

      // c. Fresh Re-evaluation of Dynamic Price & Grid Condition
      const intelligence = await tradeIntelligenceService.getTradeIntelligence(
        listingId,
        demandId,
        requestedKwh
      );

      const { gridDecision, pricing } = intelligence;

      // d. Enforce Grid Restriction Rules
      if (gridDecision.status === "RESTRICTED") {
        await tx.auditLog.create({
          data: {
            actorId: buyerId,
            action: "TRADE_RESTRICTED",
            entityType: "Listing",
            entityId: listingId,
            metadata: {
              reason: gridDecision.explanation,
              congestionLevel: gridDecision.congestionLevel.toNumber(),
            },
          },
        });

        throw new AppError(
          "UNPROCESSABLE_ENTITY",
          `Trade execution restricted by grid condition: ${gridDecision.explanation}`,
          422
        );
      }

      // e. Determine Final Quantity KWh after Grid Constraints
      let finalKwh = requestedKwh;
      if (gridDecision.status === "ADJUSTED" && gridDecision.constraints.maxEnergyKwh) {
        finalKwh = Math.min(requestedKwh, gridDecision.constraints.maxEnergyKwh.toNumber());
      }
      finalKwh = Math.min(finalKwh, listingRemainingKwh);

      if (demand) {
        const demandRemainingKwh = demand.quantityKwh.minus(demand.allocatedKwh).toNumber();
        finalKwh = Math.min(finalKwh, demandRemainingKwh);
      }

      if (finalKwh < 0.001) {
        throw new AppError("CONFLICT", "Insufficient available energy to execute trade", 409);
      }

      // f. Update Listing Allocation Atomically
      const newListingAllocated = listing.allocatedKwh.add(new Decimal(finalKwh.toFixed(4)));
      const isListingFullyAllocated = newListingAllocated.gte(listing.quantityKwh);
      const newListingStatus = isListingFullyAllocated ? "FULLY_MATCHED" : "PARTIALLY_MATCHED";

      await tx.listing.update({
        where: { id: listingId },
        data: {
          allocatedKwh: newListingAllocated,
          status: newListingStatus,
        },
      });

      // g. Update Demand Allocation (if applicable)
      if (demand) {
        const newDemandAllocated = demand.allocatedKwh.add(new Decimal(finalKwh.toFixed(4)));
        const isDemandFullyAllocated = newDemandAllocated.gte(demand.quantityKwh);
        const newDemandStatus = isDemandFullyAllocated ? "FULLY_MATCHED" : "PARTIALLY_MATCHED";

        await tx.demand.update({
          where: { id: demand.id },
          data: {
            allocatedKwh: newDemandAllocated,
            status: newDemandStatus,
          },
        });
      }

      // h. Compute Financial Amounts
      const agreedPriceInrPerKwh = pricing.recommendedPricePerKwh.toNumber();
      const energyAmountInr = Number((finalKwh * agreedPriceInrPerKwh).toFixed(4));
      const wheelingFeeInr = Number((energyAmountInr * 0.02).toFixed(4));
      const netAmountInr = Number((energyAmountInr + wheelingFeeInr).toFixed(4));

      // i. Create Trade Record
      const trade = await tx.trade.create({
        data: {
          listingId,
          buyerId,
          demandId: demand?.id ?? null,
          quantityKwh: new Decimal(finalKwh.toFixed(4)),
          agreedPriceInrPerKwh: new Decimal(agreedPriceInrPerKwh.toFixed(4)),
          gridDecision: gridDecision.status,
          gridDataId: gridDecision.gridDataId ?? null,
          gridReasonCode: gridDecision.reasonCode,
          wheelingFeeInr: new Decimal(wheelingFeeInr.toFixed(4)),
          netAmountInr: new Decimal(netAmountInr.toFixed(4)),
          status: "CONFIRMED",
        },
      });

      // j. Create Transaction and Ledger Block Hash
      const settledAt = new Date();
      const transaction = await tx.transaction.create({
        data: {
          tradeId: trade.id,
          amountInr: new Decimal(netAmountInr.toFixed(4)),
          status: "confirmed",
          settledAt,
        },
      });

      // Find previous block for deterministic hash-chaining
      const lastBlock = await tx.hashRecord.findFirst({
        orderBy: { blockIndex: "desc" },
      });

      const nextBlockIndex = lastBlock ? lastBlock.blockIndex + 1 : 0;
      const previousHash = lastBlock ? lastBlock.hash : GENESIS_PREVIOUS_HASH;

      const canonicalData: CanonicalTransactionData = {
        blockIndex: nextBlockIndex,
        transactionId: transaction.id,
        tradeId: trade.id,
        buyerId,
        sellerId: listing.sellerId,
        quantityKwh: new Decimal(finalKwh.toFixed(4)).toFixed(4),
        agreedPriceInrPerKwh: new Decimal(agreedPriceInrPerKwh.toFixed(4)).toFixed(4),
        amountInr: new Decimal(energyAmountInr.toFixed(4)).toFixed(4),
        wheelingFeeInr: new Decimal(wheelingFeeInr.toFixed(4)).toFixed(4),
        netAmountInr: new Decimal(netAmountInr.toFixed(4)).toFixed(4),
        previousHash,
        settledAt: settledAt.toISOString(),
      };

      const payloadCanonical = canonicalizeTransaction(canonicalData);
      const hash = calculateBlockHash(payloadCanonical);

      await tx.hashRecord.create({
        data: {
          transactionId: transaction.id,
          blockIndex: nextBlockIndex,
          algorithm: "SHA-256",
          previousHash,
          hash,
          payloadCanonical,
        },
      });

      // k. Create Audit Event
      await tx.auditLog.create({
        data: {
          actorId: buyerId,
          action: gridDecision.status === "ADJUSTED" ? "TRADE_ADJUSTED" : "TRADE_CREATED",
          entityType: "Trade",
          entityId: trade.id,
          metadata: {
            listingId,
            demandId: demand?.id,
            quantityKwh: finalKwh,
            agreedPriceInrPerKwh,
            gridDecision: gridDecision.status,
            transactionId: transaction.id,
            hash,
          },
        },
      });

      return {
        trade,
        transaction,
        hash,
        sellerName: listing.seller.displayName,
        gridDecision: gridDecision.status,
        finalKwh,
        agreedPriceInrPerKwh,
        netAmountInr,
      };
    });

    // 2. Post-Commit Realtime Events
    await eventPublisher.publish({
      type: "trade.created",
      tradeId: result.trade.id,
      buyerId,
      listingId,
      quantityKwh: result.finalKwh,
      agreedPriceInrPerKwh: result.agreedPriceInrPerKwh,
      gridDecision: result.gridDecision,
      occurredAt: new Date().toISOString(),
    });

    await eventPublisher.publish({
      type: "price.updated",
      priceInrPerKwh: result.agreedPriceInrPerKwh.toString(),
      occurredAt: new Date().toISOString(),
    });

    return {
      id: result.trade.id,
      listingId,
      demandId: result.trade.demandId,
      buyerId,
      sellerName: result.sellerName,
      quantityKwh: result.finalKwh,
      agreedPriceInrPerKwh: result.agreedPriceInrPerKwh,
      gridDecision: result.gridDecision,
      netAmountInr: result.netAmountInr,
      transactionId: result.transaction.id,
      ledgerHash: result.hash,
      status: result.trade.status,
      createdAt: result.trade.createdAt.toISOString(),
    };
  }

  async getTradeById(tradeId: string) {
    const trade = await prisma.trade.findUnique({
      where: { id: tradeId },
      include: {
        listing: {
          include: { seller: true },
        },
        buyer: true,
        transactions: {
          include: { hashRecord: true },
        },
      },
    });

    if (!trade) {
      throw new AppError("NOT_FOUND", "Trade record not found", 404);
    }

    return {
      id: trade.id,
      listingId: trade.listingId,
      demandId: trade.demandId,
      buyerId: trade.buyerId,
      buyerName: trade.buyer.displayName,
      sellerName: trade.listing.seller.displayName,
      quantityKwh: trade.quantityKwh.toNumber(),
      agreedPriceInrPerKwh: trade.agreedPriceInrPerKwh.toNumber(),
      gridDecision: trade.gridDecision,
      wheelingFeeInr: trade.wheelingFeeInr.toNumber(),
      netAmountInr: trade.netAmountInr.toNumber(),
      status: trade.status,
      transaction: trade.transactions[0]
        ? {
            id: trade.transactions[0].id,
            amountInr: trade.transactions[0].amountInr.toNumber(),
            status: trade.transactions[0].status,
            hash: trade.transactions[0].hashRecord?.hash ?? null,
            settledAt: trade.transactions[0].settledAt?.toISOString(),
          }
        : null,
      createdAt: trade.createdAt.toISOString(),
    };
  }

  async listUserTrades(userId: string) {
    const trades = await prisma.trade.findMany({
      where: {
        OR: [{ buyerId: userId }, { listing: { sellerId: userId } }],
      },
      include: {
        listing: {
          include: { seller: true },
        },
        buyer: true,
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return trades.map((t) => ({
      id: t.id,
      listingId: t.listingId,
      demandId: t.demandId,
      buyerId: t.buyerId,
      buyerName: t.buyer.displayName,
      sellerName: t.listing.seller.displayName,
      quantityKwh: t.quantityKwh.toNumber(),
      agreedPriceInrPerKwh: t.agreedPriceInrPerKwh.toNumber(),
      gridDecision: t.gridDecision,
      netAmountInr: t.netAmountInr.toNumber(),
      status: t.status,
      createdAt: t.createdAt.toISOString(),
    }));
  }
}

export const tradeService = new TradeService();

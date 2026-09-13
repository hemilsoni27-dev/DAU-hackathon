import { marketplaceService } from "./marketplace.service";
import { demandService } from "./demand.service";
import { tradeIntelligenceService } from "./trade-intelligence.service";
import { auditRepository } from "../repositories/audit.repository";
import { eventPublisher } from "../realtime/events";
import {
  isEligibleCandidate,
  scoreMatchCandidate,
  type CandidateListing,
  type CandidateDemand,
} from "../domain/matching-engine";
import { AppError } from "../middleware/errors";

export class MatchingService {
  async recommendMatches(demandId: string, limit = 10) {
    // 1. Fetch consumer demand
    const demandRecord = await demandService.getDemandById(demandId);
    if (!demandRecord) {
      throw new AppError("NOT_FOUND", "Demand request not found", 404);
    }

    const candidateDemand: CandidateDemand = {
      id: demandRecord.id,
      buyerId: demandRecord.buyerId,
      buyerName: demandRecord.buyerName,
      location: "Bengaluru South",
      gridArea: "NCR-NORTH",
      quantityKwh: demandRecord.quantityKwh,
      allocatedKwh: demandRecord.allocatedKwh,
      remainingKwh: demandRecord.remainingKwh,
      maxPriceInrPerKwh: demandRecord.maxPriceInrPerKwh,
      availableFrom: new Date(demandRecord.availableFrom),
      availableUntil: new Date(demandRecord.availableUntil),
    };

    // 2. Fetch active listings
    const activeListings = await marketplaceService.getListings({ status: "ACTIVE" });

    // 3. Filter and Score Candidates
    const scoredCandidates = activeListings
      .map((l) => {
        const candidateListing: CandidateListing = {
          id: l.id,
          sellerId: l.sellerId,
          sellerName: l.sellerName,
          location: l.location,
          gridArea: l.gridArea,
          quantityKwh: l.quantityKwh,
          allocatedKwh: l.allocatedKwh,
          remainingKwh: l.remainingKwh,
          priceInrPerKwh: l.priceInrPerKwh,
          availableFrom: new Date(l.availableFrom),
          availableUntil: new Date(l.availableUntil),
          gridDecision: l.gridDecision,
        };
        return { listing: l, candidateListing };
      })
      .filter(({ candidateListing }) => isEligibleCandidate(candidateListing, candidateDemand))
      .map(({ listing, candidateListing }) => {
        const result = scoreMatchCandidate(candidateListing, candidateDemand);
        return {
          listingId: listing.id,
          sellerId: listing.sellerId,
          sellerName: listing.sellerName,
          location: listing.location,
          availableEnergyKwh: listing.remainingKwh.toFixed(2),
          pricePerKwh: listing.priceInrPerKwh.toFixed(2),
          matchScore: result.totalScore,
          matchPercentage: result.matchPercentage,
          scores: result.scores,
          gridStatus: listing.gridDecision,
          distanceKm: result.distanceKm,
          reasons: result.reasons,
        };
      })
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, limit);

    // 4. Audit & Event Emission
    await auditRepository.logAction({
      actorId: demandRecord.buyerId,
      action: "MATCH_RECOMMENDATION_CREATED",
      entityType: "Demand",
      entityId: demandId,
      metadata: { recommendationCount: scoredCandidates.length },
    });

    await eventPublisher.publish({
      type: "match.recommended",
      matchId: `rec-${demandId}`,
      occurredAt: new Date().toISOString(),
    });

    return {
      demandId,
      generatedAt: new Date().toISOString(),
      recommendations: scoredCandidates,
    };
  }

  async getRecommendations() {
    const listings = await marketplaceService.getListings({ status: "ACTIVE" });
    return listings.map((listing, index) => {
      const distanceKm = index === 0 ? 1.4 : index === 1 ? 3.8 : 6.2;
      const score = Math.round(94 - index * 6);
      return {
        id: `match-${listing.id}`,
        listingId: listing.id,
        sellerName: listing.sellerName,
        location: listing.location,
        quantityKwh: listing.remainingKwh,
        priceInrPerKwh: listing.priceInrPerKwh,
        score,
        rationale:
          index === 0
            ? "Closest approved supply with a strong quantity fit."
            : "Good price and reliability; grid suitability slightly lowers the rank.",
        factors: [
          `${distanceKm} km proximity`,
          `${95 - index * 5}% reliability`,
          listing.gridDecision === "APPROVED" ? "approved grid window" : "adjusted grid window",
        ],
      };
    });
  }

  async getTradePreview(listingId: string, demandId?: string, requestedKwh?: number) {
    return tradeIntelligenceService.getTradeIntelligence(listingId, demandId, requestedKwh);
  }
}

export const matchingService = new MatchingService();

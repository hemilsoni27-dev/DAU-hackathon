import { Decimal } from "@prisma/client/runtime/library";
import { marketplaceService } from "./marketplace.service";
import { demandService } from "./demand.service";
import { gridRepository } from "../repositories/grid.repository";
import { calculateDynamicPrice, type PricingResult } from "../domain/pricing-engine";
import { evaluateTradeGridCondition, type GridDecisionResult } from "../domain/grid-decision";
import { SETTLEMENT_POLICY_V1, type SettlementPolicy } from "../policies/settlement-policy";
import { AppError } from "../middleware/errors";

export type SettlementPreview = {
  energyCostInr: number;
  wheelingFeePercent: number;
  wheelingFeeInr: number;
  transmissionLossPercent: number;
  transmissionLossKwh: number;
  netPayableInr: number;
  estimatedCarbonSavingsKg: number;
};

export type TradeIntelligenceResult = {
  listingId: string;
  demandId: string | null;
  sellerName: string;
  buyerName?: string;
  location: string;
  gridArea: string;
  requestedKwh: number;
  maximumTradableEnergyKwh: number;
  unitPriceInr: number;
  basePriceInr: number;
  pricing: PricingResult;
  gridDecision: GridDecisionResult;
  settlement: SettlementPreview;
  evaluatedAt: string;
};

export class TradeIntelligenceService {
  async getTradeIntelligence(
    listingId: string,
    demandId?: string,
    requestedKwhInput?: number,
    policy: SettlementPolicy = SETTLEMENT_POLICY_V1
  ): Promise<TradeIntelligenceResult> {
    // 1. Fetch Target Listing
    const listing = await marketplaceService.getListingById(listingId);
    if (!listing) {
      throw new AppError("NOT_FOUND", "Marketplace listing not found", 404);
    }

    // 2. Fetch Target Demand (if provided)
    let demand = null;
    if (demandId) {
      demand = await demandService.getDemandById(demandId);
    }

    // 3. Calculate Requested Energy
    const listingAvailableKwh = listing.remainingKwh;
    let requestedKwh = requestedKwhInput;
    if (!requestedKwh || requestedKwh <= 0) {
      if (demand) {
        requestedKwh = Math.min(listingAvailableKwh, demand.remainingKwh);
      } else {
        requestedKwh = listingAvailableKwh;
      }
    }

    // 4. Load Grid Data & Evaluate Grid Decision
    const gridData = await gridRepository.findLatest("NCR-NORTH");
    const congestionPercent = gridData ? Number(gridData.congestionPercent) : 62.0;
    const renewableSharePercent = gridData ? Number(gridData.renewableSharePercent) : 71.0;
    const frequencyHz = gridData ? Number(gridData.frequencyHz) : 49.98;

    const gridDecision = evaluateTradeGridCondition({
      region: "NCR-NORTH",
      congestionPercent,
      renewableSharePercent,
      frequencyHz,
      requestedKwh,
      gridDataId: gridData?.id,
    });

    // 5. Compute Active Market Supply vs Demand for Dynamic Pricing Engine
    const activeListings = await marketplaceService.getListings({ status: "ACTIVE" });
    const openDemands = await demandService.getDemands({ status: "OPEN" });

    const marketSupplyKwh = activeListings.reduce((sum, l) => sum + l.remainingKwh, 0);
    const marketDemandKwh = openDemands.reduce((sum, d) => sum + d.remainingKwh, 0);

    const pricing = calculateDynamicPrice({
      basePricePerKwh: listing.priceInrPerKwh,
      supplyKwh: marketSupplyKwh || listing.remainingKwh,
      demandKwh: marketDemandKwh || requestedKwh,
      congestionLevel: gridDecision.congestionLevel,
    });

    // 6. Determine Maximum Allowed Energy based on Grid Decision
    let maximumTradableEnergyKwh = requestedKwh;
    if (gridDecision.status === "RESTRICTED") {
      maximumTradableEnergyKwh = 0;
    } else if (gridDecision.status === "ADJUSTED" && gridDecision.constraints.maxEnergyKwh) {
      maximumTradableEnergyKwh = Math.min(
        requestedKwh,
        gridDecision.constraints.maxEnergyKwh.toNumber()
      );
    }
    // Cap energy by actual remaining available energy in listing
    maximumTradableEnergyKwh = Math.min(maximumTradableEnergyKwh, listingAvailableKwh);

    // 7. Calculate Settlement Breakdown
    const unitPriceInr = pricing.recommendedPricePerKwh.toNumber();
    const energyCostInr = Number((maximumTradableEnergyKwh * unitPriceInr).toFixed(2));
    const wheelingFeePercent = policy.wheelingFeePercent.toNumber();
    const wheelingFeeInr = Number((energyCostInr * (wheelingFeePercent / 100)).toFixed(2));
    const netPayableInr = Number((energyCostInr + wheelingFeeInr).toFixed(2));

    const transmissionLossPercent = policy.transmissionLossPercent.toNumber();
    const transmissionLossKwh = Number((maximumTradableEnergyKwh * (transmissionLossPercent / 100)).toFixed(2));
    const estimatedCarbonSavingsKg = Number(
      (maximumTradableEnergyKwh * policy.carbonFactorKgPerKwh.toNumber()).toFixed(2)
    );

    return {
      listingId: listing.id,
      demandId: demand?.id ?? null,
      sellerName: listing.sellerName,
      buyerName: demand?.buyerName,
      location: listing.location,
      gridArea: listing.gridArea,
      requestedKwh,
      maximumTradableEnergyKwh,
      unitPriceInr,
      basePriceInr: listing.priceInrPerKwh,
      pricing,
      gridDecision,
      settlement: {
        energyCostInr,
        wheelingFeePercent,
        wheelingFeeInr,
        transmissionLossPercent,
        transmissionLossKwh,
        netPayableInr,
        estimatedCarbonSavingsKg,
      },
      evaluatedAt: new Date().toISOString(),
    };
  }
}

export const tradeIntelligenceService = new TradeIntelligenceService();

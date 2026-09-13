import type { Request, Response } from "express";
import { tradeIntelligenceService } from "../services/trade-intelligence.service";
import { marketplaceService } from "../services/marketplace.service";
import { demandService } from "../services/demand.service";
import { gridRepository } from "../repositories/grid.repository";
import { calculateDynamicPrice } from "../domain/pricing-engine";
import { PRICING_POLICY_V1 } from "../policies/pricing-policy";

export async function getCurrentPrice(req: Request, res: Response): Promise<void> {
  try {
    const region = (req.query.region as string) || "NCR-NORTH";
    const gridData = await gridRepository.findLatest(region);
    const congestionPercent = gridData ? Number(gridData.congestionPercent) : 62.0;

    const activeListings = await marketplaceService.getListings({ status: "ACTIVE" });
    const openDemands = await demandService.getDemands({ status: "OPEN" });

    const marketSupplyKwh = activeListings.reduce((sum, l) => sum + l.remainingKwh, 0) || 100;
    const marketDemandKwh = openDemands.reduce((sum, d) => sum + d.remainingKwh, 0) || 120;

    const pricing = calculateDynamicPrice({
      basePricePerKwh: PRICING_POLICY_V1.basePricePerKwh,
      supplyKwh: marketSupplyKwh,
      demandKwh: marketDemandKwh,
      congestionLevel: congestionPercent / 100,
    });

    res.json({
      region,
      recommendedPricePerKwh: pricing.recommendedPricePerKwh.toNumber(),
      basePricePerKwh: pricing.basePricePerKwh.toNumber(),
      supplyDemandFactor: pricing.supplyDemandFactor.toNumber(),
      congestionFactor: pricing.congestionFactor.toNumber(),
      priceFloor: pricing.priceFloor.toNumber(),
      priceCeiling: pricing.priceCeiling.toNumber(),
      explanation: pricing.explanation,
      version: pricing.engineVersion,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
}

export async function getPriceQuote(req: Request, res: Response): Promise<void> {
  try {
    const { supplyKwh, demandKwh, congestionLevel, basePricePerKwh } = req.body;

    const pricing = calculateDynamicPrice({
      basePricePerKwh: basePricePerKwh ?? PRICING_POLICY_V1.basePricePerKwh,
      supplyKwh: supplyKwh ?? 100,
      demandKwh: demandKwh ?? 100,
      congestionLevel: congestionLevel ?? 0.60,
    });

    res.json({
      recommendedPricePerKwh: pricing.recommendedPricePerKwh.toNumber(),
      basePricePerKwh: pricing.basePricePerKwh.toNumber(),
      supplyDemandFactor: pricing.supplyDemandFactor.toNumber(),
      congestionFactor: pricing.congestionFactor.toNumber(),
      priceFloor: pricing.priceFloor.toNumber(),
      priceCeiling: pricing.priceCeiling.toNumber(),
      explanation: pricing.explanation,
      version: pricing.engineVersion,
    });
  } catch (error) {
    res.status(400).json({ error: (error as Error).message });
  }
}

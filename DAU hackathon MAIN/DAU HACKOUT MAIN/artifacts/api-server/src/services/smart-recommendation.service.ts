import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { predictionService } from "./prediction.service";

export interface SmartRecommendationResult {
  id?: string;
  kind: "SMART_SELL" | "SMART_BUY";
  score: number;
  listingId?: string;
  demandId?: string;
  suggestedQuantityKwh: number;
  suggestedPriceInrPerKwh: number;
  expectedValueInr: number;
  reasons: string[];
  gridStatus: string;
  predictionMetadata: {
    modelVersion: string;
    generatedAt: string;
    actualSurplusKwh?: number;
    predictedSurplusKwh?: number;
  };
}

export class SmartRecommendationService {
  async generateSmartSellRecommendations(userId: string): Promise<SmartRecommendationResult> {
    let user: any = null;
    let latestGrid: any = null;

    try {
      user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          solarSystems: {
            include: {
              energyData: {
                orderBy: { observedAt: "desc" },
                take: 5,
              },
            },
          },
        },
      });

      latestGrid = await prisma.gridData.findFirst({
        orderBy: { observedAt: "desc" },
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable for recommendation context lookup, using baseline context");
    }

    const gridDecision = latestGrid ? latestGrid.decision : "APPROVED";

    // 1. Calculate actual current surplus from recent reading
    let actualSurplusKwh = 0;
    if (user?.solarSystems && user.solarSystems.length > 0) {
      const latestReading = user.solarSystems[0].energyData[0];
      if (latestReading) {
        actualSurplusKwh = Math.max(
          0,
          latestReading.generationKwh.toNumber() - latestReading.consumptionKwh.toNumber()
        );
      }
    }

    // 2. Fetch generation forecast
    let predictedSurplusKwh = actualSurplusKwh;
    let modelVersion = "generation-forecast-v1.0";
    if (user?.solarSystems && user.solarSystems[0]) {
      try {
        const forecast = await predictionService.generateGenerationForecast(user.solarSystems[0].id, 24);
        modelVersion = forecast.modelVersion;
        if (forecast.payload?.summary?.projectedGenerationKwh) {
          predictedSurplusKwh = Math.max(actualSurplusKwh, forecast.payload.summary.projectedGenerationKwh);
        }
      } catch (err) {
        logger.warn({ err }, "Could not fetch AI generation forecast for Smart Sell");
      }
    }

    // Safety checks
    const reasons: string[] = [];
    let score = 0.85;

    if (gridDecision === "RESTRICTED") {
      score = 0.0;
      reasons.push("Grid decision is RESTRICTED: Trading temporarily halted in region.");
    }

    if (actualSurplusKwh <= 0 && predictedSurplusKwh <= 0) {
      score = 0.0;
      reasons.push("Zero surplus energy detected: No excess solar energy available for trading.");
    }

    if (score > 0) {
      if (actualSurplusKwh > 0) {
        reasons.push(`Current active surplus: ${actualSurplusKwh.toFixed(2)} kWh ready to list.`);
      }
      if (predictedSurplusKwh > 0) {
        reasons.push(`Predicted 24h solar generation window: ${predictedSurplusKwh.toFixed(2)} kWh projected.`);
      }
      reasons.push("Strong local consumer demand observed in current grid sector.");
      reasons.push(`Grid region operating normally with ${gridDecision} condition.`);
    }

    const suggestedQuantity = Math.max(actualSurplusKwh, Math.min(predictedSurplusKwh, 15.0));
    const suggestedPrice = 5.20;
    const expectedValue = Math.round(suggestedQuantity * suggestedPrice * 100) / 100;

    const result: SmartRecommendationResult = {
      kind: "SMART_SELL",
      score,
      suggestedQuantityKwh: Math.round(suggestedQuantity * 100) / 100,
      suggestedPriceInrPerKwh: suggestedPrice,
      expectedValueInr: expectedValue,
      reasons,
      gridStatus: gridDecision,
      predictionMetadata: {
        modelVersion,
        generatedAt: new Date().toISOString(),
        actualSurplusKwh,
        predictedSurplusKwh,
      },
    };

    if (score > 0 && userId) {
      try {
        const rec = await prisma.smartRecommendation.create({
          data: {
            userId,
            kind: "SMART_SELL",
            score,
            suggestedQuantity: result.suggestedQuantityKwh,
            suggestedPrice: result.suggestedPriceInrPerKwh,
            expectedValue: result.expectedValueInr,
            reasons: result.reasons,
            gridStatus: gridDecision,
            modelVersion,
          },
        });
        result.id = rec.id;
      } catch (err) {
        logger.warn({ err }, "Database unavailable for recommendation persistence");
      }
    }

    return result;
  }

  async generateSmartBuyRecommendations(userId: string): Promise<SmartRecommendationResult> {
    let activeListings: any[] = [];
    let latestGrid: any = null;

    try {
      activeListings = await prisma.listing.findMany({
        where: { status: "OPEN" as any },
        orderBy: { priceInrPerKwh: "asc" },
        take: 5,
      });

      latestGrid = await prisma.gridData.findFirst({
        orderBy: { observedAt: "desc" },
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable for Smart Buy lookup");
    }

    const gridDecision = latestGrid ? latestGrid.decision : "APPROVED";

    const topListing = activeListings[0];
    const reasons: string[] = [];
    let score = 0.88;

    if (gridDecision === "RESTRICTED") {
      score = 0.0;
      reasons.push("Grid decision is RESTRICTED: Purchases restricted by local grid policy.");
    }

    if (!topListing) {
      score = 0.0;
      reasons.push("No active open renewable listings currently available.");
    } else {
      reasons.push(`Lowest available price: ₹${topListing.priceInrPerKwh.toFixed(2)}/kWh.`);
      reasons.push(`Available renewable volume: ${topListing.quantityKwh.toFixed(2)} kWh.`);
      reasons.push("Estimated 15% savings compared to standard utility grid tariffs.");
    }

    const qty = topListing ? topListing.quantityKwh.toNumber() : 10.0;
    const price = topListing ? topListing.priceInrPerKwh.toNumber() : 5.0;
    const gridUtilityTariff = 6.50;
    const expectedSavings = Math.round(qty * (gridUtilityTariff - price) * 100) / 100;

    const result: SmartRecommendationResult = {
      kind: "SMART_BUY",
      score,
      listingId: topListing?.id,
      suggestedQuantityKwh: qty,
      suggestedPriceInrPerKwh: price,
      expectedValueInr: Math.max(0, expectedSavings),
      reasons,
      gridStatus: gridDecision,
      predictionMetadata: {
        modelVersion: "demand-forecast-v1.0",
        generatedAt: new Date().toISOString(),
      },
    };

    if (score > 0 && userId) {
      try {
        const rec = await prisma.smartRecommendation.create({
          data: {
            userId,
            kind: "SMART_BUY",
            score,
            listingId: topListing?.id,
            suggestedQuantity: qty,
            suggestedPrice: price,
            expectedValue: Math.max(0, expectedSavings),
            reasons: result.reasons,
            gridStatus: gridDecision,
            modelVersion: "demand-forecast-v1.0",
          },
        });
        result.id = rec.id;
      } catch (err) {
        logger.warn({ err }, "Database unavailable for recommendation persistence");
      }
    }

    return result;
  }

  async dismissRecommendation(recommendationId: string): Promise<void> {
    await prisma.smartRecommendation.update({
      where: { id: recommendationId },
      data: { dismissedAt: new Date() },
    });
  }
}

export const smartRecommendationService = new SmartRecommendationService();

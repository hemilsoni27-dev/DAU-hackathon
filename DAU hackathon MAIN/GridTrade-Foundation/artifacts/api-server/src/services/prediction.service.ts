import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { aiClientService } from "./ai-client.service";
import { eventPublisher } from "../realtime/events";

export interface PredictionRecord {
  id: string;
  predictionType: string;
  horizon: string;
  payload: any;
  confidence: number | null;
  modelVersion: string;
  staleAt: string | null;
  isStale: boolean;
  createdAt: string;
}

export class PredictionService {
  /**
   * Generation Forecasting: solar system output prediction
   */
  async generateGenerationForecast(solarSystemId: string, horizonHours = 24): Promise<PredictionRecord> {
    let solarSystem: any = null;
    try {
      solarSystem = await prisma.solarSystem.findUnique({
        where: { id: solarSystemId },
        include: {
          energyData: {
            orderBy: { observedAt: "desc" },
            take: 48,
          },
        },
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable during generation forecast lookup");
    }

    const historicalReadings = (solarSystem?.energyData || []).map((r: any) => ({
      timestamp: r.observedAt ? r.observedAt.toISOString() : new Date().toISOString(),
      generationKwh: r.generationKwh.toNumber ? r.generationKwh.toNumber() : Number(r.generationKwh),
      consumptionKwh: r.consumptionKwh.toNumber ? r.consumptionKwh.toNumber() : Number(r.consumptionKwh),
    }));

    const capacityKw = solarSystem ? (solarSystem.capacityKw.toNumber ? solarSystem.capacityKw.toNumber() : Number(solarSystem.capacityKw)) : 10.0;

    const response = await aiClientService.predictGeneration({
      solarSystemId,
      capacityKw,
      forecastHorizonHours: horizonHours,
      historicalReadings,
    });

    let payload: any;
    let modelVersion = "generation-forecast-v1.0";
    let confidence = 0.85;

    if (response && response.status === "ok") {
      payload = {
        summary: response.payload,
        forecast: response.forecast,
      };
      modelVersion = response.modelVersion || modelVersion;
      confidence = response.payload?.confidence || confidence;
    } else {
      logger.info({ solarSystemId }, "Using deterministic fallback for solar generation prediction");
      const baseAvg = capacityKw * 0.42;
      const forecastPoints = [];
      let total = 0;
      const now = new Date();

      for (let h = 1; h <= horizonHours; h++) {
        const future = new Date(now.getTime() + h * 3600000);
        const hour = future.getHours();
        const solarFactor = 6 <= hour && hour <= 18 ? Math.max(0.05, 1 - Math.pow((hour - 12) / 6, 2)) : 0;
        const val = Math.round(baseAvg * solarFactor * 1.1 * 100) / 100;
        total += val;
        forecastPoints.push({
          timestamp: future.toISOString(),
          predictedGenerationKwh: val,
          confidence: 0.80,
        });
      }

      payload = {
        summary: {
          projectedGenerationKwh: Math.round(total * 100) / 100,
          peakWindow: "11:00-14:00",
          confidence: 0.80,
          isFallback: true,
        },
        forecast: forecastPoints,
      };
      confidence = 0.80;
    }

    const staleAt = new Date(Date.now() + horizonHours * 3600 * 1000);

    let record: any = null;
    try {
      record = await prisma.aiPrediction.create({
        data: {
          solarSystemId,
          predictionType: "generation",
          horizon: `${horizonHours}h`,
          payload,
          confidence,
          modelVersion,
          staleAt,
        },
      });

      await eventPublisher.publish({
        type: "prediction.generated",
        predictionId: record.id,
        predictionType: "generation",
        modelVersion,
        occurredAt: new Date().toISOString(),
      } as any);
    } catch (err) {
      logger.warn({ err }, "Database unavailable during prediction persistence");
      record = {
        id: `pred-${Date.now()}`,
        solarSystemId,
        predictionType: "generation",
        horizon: `${horizonHours}h`,
        payload,
        confidence,
        modelVersion,
        staleAt,
        createdAt: new Date(),
      };
    }

    return this.mapPredictionRecord(record);
  }

  /**
   * Demand Forecasting: consumer energy consumption prediction
   */
  async generateDemandForecast(userId: string, region = "NCR-NORTH", horizonHours = 24): Promise<PredictionRecord> {
    let readings: any[] = [];
    try {
      readings = await prisma.energyData.findMany({
        orderBy: { observedAt: "desc" },
        take: 48,
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable during demand forecast lookup");
    }

    const historicalReadings = readings.map((r: any) => ({
      timestamp: r.timestamp.toISOString(),
      generationKwh: r.generationKwh.toNumber ? r.generationKwh.toNumber() : Number(r.generationKwh),
      consumptionKwh: r.consumptionKwh.toNumber ? r.consumptionKwh.toNumber() : Number(r.consumptionKwh),
    }));

    const response = await aiClientService.predictDemand({
      region,
      consumerCount: 1,
      forecastHorizonHours: horizonHours,
      historicalReadings,
    });

    let payload: any;
    let modelVersion = "demand-forecast-v1.0";
    let confidence = 0.84;

    if (response && response.status === "ok") {
      payload = {
        summary: response.payload,
        forecast: response.forecast,
      };
      modelVersion = response.modelVersion || modelVersion;
      confidence = response.payload?.confidence || confidence;
    } else {
      logger.info({ userId }, "Using deterministic fallback for consumer demand prediction");
      const baseDemand = 4.5;
      const forecastPoints = [];
      let total = 0;
      const now = new Date();

      for (let h = 1; h <= horizonHours; h++) {
        const future = new Date(now.getTime() + h * 3600000);
        const hour = future.getHours();
        const factor = (7 <= hour && hour <= 9) ? 1.35 : ((18 <= hour && hour <= 22) ? 1.50 : 0.90);
        const val = Math.round(baseDemand * factor * 100) / 100;
        total += val;
        forecastPoints.push({
          timestamp: future.toISOString(),
          predictedDemandKwh: val,
          confidence: 0.78,
        });
      }

      payload = {
        summary: {
          projectedDemandKwh: Math.round(total * 100) / 100,
          region,
          confidence: 0.78,
          isFallback: true,
        },
        forecast: forecastPoints,
      };
      confidence = 0.78;
    }

    const staleAt = new Date(Date.now() + horizonHours * 3600 * 1000);

    let record: any = null;
    try {
      record = await prisma.aiPrediction.create({
        data: {
          userId,
          predictionType: "demand",
          horizon: `${horizonHours}h`,
          payload,
          confidence,
          modelVersion,
          staleAt,
        },
      });

      await eventPublisher.publish({
        type: "prediction.generated",
        predictionId: record.id,
        predictionType: "demand",
        modelVersion,
        occurredAt: new Date().toISOString(),
      } as any);
    } catch (err) {
      logger.warn({ err }, "Database unavailable during prediction persistence");
      record = {
        id: `pred-${Date.now()}`,
        userId,
        predictionType: "demand",
        horizon: `${horizonHours}h`,
        payload,
        confidence,
        modelVersion,
        staleAt,
        createdAt: new Date(),
      };
    }

    return this.mapPredictionRecord(record);
  }

  /**
   * Price Prediction Signal (Informational signal boundary)
   */
  async generatePriceSignal(region = "NCR-NORTH", surplusKwh = 50.0, demandKwh = 40.0): Promise<PredictionRecord> {
    const response = await aiClientService.predictPrice({
      region,
      horizon: "24h",
      surplusKwh,
      demandKwh,
    });

    let payload: any;
    let modelVersion = "price-signal-v1.0";
    let confidence = 0.89;

    if (response && response.status === "ok") {
      payload = response.payload;
      modelVersion = response.modelVersion || modelVersion;
      confidence = response.payload?.confidence || confidence;
    } else {
      logger.info({ region }, "Using deterministic fallback for price signal prediction");
      const basePrice = 4.80;
      const ratio = demandKwh / Math.max(surplusKwh, 1.0);
      const indicative = Math.max(3.50, Math.min(7.50, Math.round(basePrice * ratio * 100) / 100));

      payload = {
        indicativePriceInrPerKwh: indicative,
        region,
        confidence: 0.82,
        marketSignal: ratio > 1.2 ? "HIGH_DEMAND" : (ratio < 0.8 ? "SURPLUS" : "BALANCED"),
        isFallback: true,
      };
      confidence = 0.82;
    }

    let record: any = null;
    try {
      record = await prisma.aiPrediction.create({
        data: {
          predictionType: "price",
          horizon: "24h",
          payload,
          confidence,
          modelVersion,
          staleAt: new Date(Date.now() + 6 * 3600 * 1000),
        },
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable during price prediction persistence");
      record = {
        id: `pred-${Date.now()}`,
        predictionType: "price",
        horizon: "24h",
        payload,
        confidence,
        modelVersion,
        staleAt: new Date(Date.now() + 6 * 3600 * 1000),
        createdAt: new Date(),
      };
    }

    return this.mapPredictionRecord(record);
  }

  /**
   * List predictions with freshness status
   */
  async listPredictions(predictionType?: string, limit = 20): Promise<PredictionRecord[]> {
    const where: any = {};
    if (predictionType) {
      where.predictionType = predictionType;
    }

    let records: any[] = [];
    try {
      records = await prisma.aiPrediction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      });
    } catch (err) {
      logger.warn({ err }, "Database unavailable for predictions listing");
    }

    return records.map((r) => this.mapPredictionRecord(r));
  }

  private mapPredictionRecord(record: any): PredictionRecord {
    const now = new Date();
    const staleAt = record.staleAt ? new Date(record.staleAt) : null;
    const isStale = staleAt ? now > staleAt : false;

    return {
      id: record.id,
      predictionType: record.predictionType,
      horizon: record.horizon,
      payload: record.payload,
      confidence: record.confidence ? (record.confidence.toNumber ? record.confidence.toNumber() : Number(record.confidence)) : null,
      modelVersion: record.modelVersion,
      staleAt: record.staleAt ? record.staleAt.toISOString() : null,
      isStale,
      createdAt: record.createdAt ? (record.createdAt.toISOString ? record.createdAt.toISOString() : String(record.createdAt)) : new Date().toISOString(),
    };
  }
}

export const predictionService = new PredictionService();

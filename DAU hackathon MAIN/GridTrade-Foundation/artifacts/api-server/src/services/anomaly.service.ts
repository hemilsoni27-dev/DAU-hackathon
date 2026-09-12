import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";
import { aiClientService } from "./ai-client.service";
import { eventPublisher } from "../realtime/events";
import { AnomalyStatus } from "@prisma/client";

export interface EvaluateAnomalyInput {
  userId?: string;
  entityType: string;
  entityId?: string;
  gridRegion?: string;
  metrics: {
    trade_frequency?: number;
    cancellation_rate?: number;
    energy_kwh?: number;
    price_inr?: number;
    frequency_hz?: number;
    [key: string]: number | undefined;
  };
}

export interface AnomalyRecord {
  id: string;
  userId: string | null;
  entityType: string;
  entityId: string | null;
  score: number;
  severity: string;
  reasons: string[];
  modelVersion: string;
  status: AnomalyStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export class AnomalyService {
  async evaluateAnomaly(input: EvaluateAnomalyInput): Promise<AnomalyRecord> {
    const metrics: Record<string, number> = {};
    for (const [k, v] of Object.entries(input.metrics)) {
      if (typeof v === "number") {
        metrics[k] = v;
      }
    }

    const aiResponse = await aiClientService.detectAnomaly({
      userId: input.userId,
      gridRegion: input.gridRegion,
      metrics,
    });

    let score = 0.05;
    let severity = "LOW";
    let reasons: string[] = ["Metrics within expected baseline bounds"];
    let modelVersion = "anomaly-rule-v1.0";

    if (aiResponse && aiResponse.status === "ok" && aiResponse.payload) {
      score = typeof aiResponse.payload.score === "number" ? aiResponse.payload.score : score;
      severity = typeof aiResponse.payload.severity === "string" ? aiResponse.payload.severity : severity;
      reasons = Array.isArray(aiResponse.payload.reasons) ? aiResponse.payload.reasons : reasons;
      modelVersion = aiResponse.modelVersion || modelVersion;
    } else {
      // Deterministic Rule Fallback
      const tradeFreq = metrics.trade_frequency || 0;
      const cancelRate = metrics.cancellation_rate || 0;
      const energyKwh = metrics.energy_kwh || 0;

      let calcScore = 0.05;
      const ruleReasons: string[] = [];

      if (tradeFreq > 15) {
        calcScore += 0.40;
        ruleReasons.push(`Unusually high trade frequency: ${tradeFreq} trades/min`);
      }
      if (cancelRate > 0.50) {
        calcScore += 0.35;
        ruleReasons.push(`High order cancellation rate: ${Math.round(cancelRate * 100)}%`);
      }
      if (energyKwh > 500) {
        calcScore += 0.25;
        ruleReasons.push(`Abnormal single trade volume: ${energyKwh} kWh`);
      }

      score = Math.min(1.0, Math.round(calcScore * 100) / 100);
      severity = score >= 0.75 ? "HIGH" : (score >= 0.40 ? "MEDIUM" : "LOW");
      reasons = ruleReasons.length > 0 ? ruleReasons : ["Metrics within expected baseline bounds"];
    }

    try {
      const anomaly = await prisma.anomaly.create({
        data: {
          userId: input.userId || null,
          entityType: input.entityType,
          entityId: input.entityId || null,
          score,
          severity,
          reasons,
          modelVersion,
          status: "OPEN",
        },
      });

      if (score >= 0.40) {
        logger.warn({ anomalyId: anomaly.id, score, severity }, "Anomaly detected above threshold");
        await eventPublisher.publish({
          type: "anomaly.detected",
          anomalyId: anomaly.id,
          severity,
          score,
          occurredAt: new Date().toISOString(),
        } as any);
      }

      return this.mapAnomalyRecord(anomaly);
    } catch (err) {
      logger.warn({ err }, "Database unavailable during anomaly logging, returning evaluated record");
      return {
        id: `anom-${Date.now()}`,
        userId: input.userId || null,
        entityType: input.entityType,
        entityId: input.entityId || null,
        score,
        severity,
        reasons,
        modelVersion,
        status: "OPEN" as AnomalyStatus,
        reviewedBy: null,
        reviewedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  async listAnomalies(status?: AnomalyStatus, severity?: string, limit = 50): Promise<AnomalyRecord[]> {
    const where: any = {};
    if (status) where.status = status;
    if (severity) where.severity = severity;

    const items = await prisma.anomaly.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return items.map((item) => this.mapAnomalyRecord(item));
  }

  async reviewAnomaly(anomalyId: string, status: AnomalyStatus, reviewedBy?: string): Promise<AnomalyRecord> {
    const anomaly = await prisma.anomaly.update({
      where: { id: anomalyId },
      data: {
        status,
        reviewedBy: reviewedBy || null,
        reviewedAt: new Date(),
      },
    });

    return this.mapAnomalyRecord(anomaly);
  }

  private mapAnomalyRecord(item: any): AnomalyRecord {
    return {
      id: item.id,
      userId: item.userId,
      entityType: item.entityType,
      entityId: item.entityId,
      score: item.score ? item.score.toNumber() : 0,
      severity: item.severity,
      reasons: Array.isArray(item.reasons) ? item.reasons : [],
      modelVersion: item.modelVersion,
      status: item.status,
      reviewedBy: item.reviewedBy,
      reviewedAt: item.reviewedAt ? item.reviewedAt.toISOString() : null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }
}

export const anomalyService = new AnomalyService();

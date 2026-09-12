import type { Request, Response, NextFunction } from "express";
import { anomalyService } from "../services/anomaly.service";
import type { AnomalyStatus } from "@prisma/client";

export async function listAnomalies(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const status = req.query.status as AnomalyStatus | undefined;
    const severity = req.query.severity as string | undefined;
    const limit = parseInt((req.query.limit as string) || "50", 10);

    const items = await anomalyService.listAnomalies(status, severity, limit);
    res.json(items);
  } catch (error) {
    next(error);
  }
}

export async function reviewAnomaly(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const anomalyId = (Array.isArray(rawId) ? rawId[0] : rawId) || "";
    const { status } = req.body;
    const reviewedBy = req.authContext?.userId || "admin-user";

    const item = await anomalyService.reviewAnomaly(anomalyId, status as AnomalyStatus, reviewedBy);
    res.json(item);
  } catch (error) {
    next(error);
  }
}

export async function detectAnomaly(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, entityType, entityId, gridRegion, metrics } = req.body;
    const item = await anomalyService.evaluateAnomaly({
      userId: userId || req.authContext?.userId,
      entityType: entityType || "trade",
      entityId,
      gridRegion,
      metrics: metrics || {},
    });
    res.json(item);
  } catch (error) {
    next(error);
  }
}

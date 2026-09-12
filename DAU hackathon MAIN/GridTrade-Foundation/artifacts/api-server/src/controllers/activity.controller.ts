import type { Request, Response, NextFunction } from "express";
import {
  GetActivityFeedQueryParams,
  GetActivityFeedResponse,
  GetEnergyOverviewQueryParams,
  GetEnergyOverviewResponse,
} from "@workspace/api-zod";
import { auditRepository } from "../repositories/audit.repository";
import { energyRepository } from "../repositories/energy.repository";

export async function getActivityFeed(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const params = GetActivityFeedQueryParams.parse(req.query);
    const logs = await auditRepository.findRecent(params.limit ?? 20);

    const formatted = logs.map((log) => ({
      id: log.id,
      type: (log.entityType.toLowerCase() as "listing" | "match" | "grid" | "transaction" | "prediction" | "alert") || "listing",
      title: `${log.action} on ${log.entityType}`,
      detail: log.actor?.displayName ? `Performed by ${log.actor.displayName}` : "System event",
      occurredAt: log.createdAt,
      status: "positive" as const,
    }));

    res.json(GetActivityFeedResponse.parse(formatted));
  } catch (error) {
    next(error);
  }
}

export async function getEnergyData(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    GetEnergyOverviewQueryParams.parse(req.query);
    const records = await energyRepository.findOverview(12);

    const formatted = records.map((record) => ({
      timestamp: record.observedAt,
      generationKwh: Number(record.generationKwh),
      consumptionKwh: Number(record.consumptionKwh),
      marketableSurplusKwh: Number(record.marketableSurplusKwh),
    }));

    res.json(GetEnergyOverviewResponse.parse(formatted));
  } catch (error) {
    next(error);
  }
}

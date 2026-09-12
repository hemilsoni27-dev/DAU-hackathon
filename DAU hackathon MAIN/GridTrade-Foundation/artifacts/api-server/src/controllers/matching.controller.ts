import type { Request, Response, NextFunction } from "express";
import { GetMatchRecommendationsResponse } from "@workspace/api-zod";
import { matchingService } from "../services/matching.service";

export async function getMatchRecommendations(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const recommendations = await matchingService.getRecommendations();
    res.json(GetMatchRecommendationsResponse.parse(recommendations));
  } catch (error) {
    next(error);
  }
}

export async function recommendMatches(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const demandId = req.body.demandId as string;
    const limit = req.body.limit ? Number(req.body.limit) : 10;
    const recommendations = await matchingService.recommendMatches(demandId, limit);
    res.json({ data: recommendations });
  } catch (error) {
    next(error);
  }
}

export async function getTradePreview(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const rawParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const listingId = (req.body?.listingId as string) || (req.query?.listingId as string) || rawParam;
    const demandId = (req.body?.demandId as string) || (req.query?.demandId as string) || undefined;
    const requestedKwh = req.body?.requestedKwh ? Number(req.body.requestedKwh) : (req.query?.requestedKwh ? Number(req.query.requestedKwh) : undefined);

    const preview = await matchingService.getTradePreview(listingId, demandId, requestedKwh);
    res.json({ data: preview });
  } catch (error) {
    next(error);
  }
}

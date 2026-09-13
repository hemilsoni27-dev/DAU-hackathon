import type { Request, Response, NextFunction } from "express";
import { smartRecommendationService } from "../services/smart-recommendation.service";

export async function getSmartSellRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authContext?.userId || (req.query.userId as string) || "user-1";
    const result = await smartRecommendationService.generateSmartSellRecommendations(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function getSmartBuyRecommendations(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authContext?.userId || (req.query.userId as string) || "user-1";
    const result = await smartRecommendationService.generateSmartBuyRecommendations(userId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function dismissRecommendation(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = (Array.isArray(rawId) ? rawId[0] : rawId) || "";
    await smartRecommendationService.dismissRecommendation(id);
    res.json({ success: true, id });
  } catch (error) {
    next(error);
  }
}

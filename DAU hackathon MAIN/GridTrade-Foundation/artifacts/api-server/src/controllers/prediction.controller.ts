import type { Request, Response, NextFunction } from "express";
import { predictionService } from "../services/prediction.service";
import { aiClientService } from "../services/ai-client.service";

export async function getAiHealth(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const health = await aiClientService.checkHealth();
    res.json(health);
  } catch (error) {
    next(error);
  }
}

export async function listPredictions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const type = req.query.type as string | undefined;
    const limit = parseInt((req.query.limit as string) || "20", 10);
    const records = await predictionService.listPredictions(type, limit);
    res.json(records);
  } catch (error) {
    next(error);
  }
}

export async function generateGenerationForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { solarSystemId, forecastHorizonHours } = req.body;
    const record = await predictionService.generateGenerationForecast(
      solarSystemId || "default-system-id",
      forecastHorizonHours || 24
    );
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function generateDemandForecast(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { userId, region, forecastHorizonHours } = req.body;
    const record = await predictionService.generateDemandForecast(
      userId || req.authContext?.userId || "default-user-id",
      region || "NCR-NORTH",
      forecastHorizonHours || 24
    );
    res.json(record);
  } catch (error) {
    next(error);
  }
}

export async function generatePriceSignal(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { region, surplusKwh, demandKwh } = req.body;
    const record = await predictionService.generatePriceSignal(
      region || "NCR-NORTH",
      surplusKwh || 50,
      demandKwh || 40
    );
    res.json(record);
  } catch (error) {
    next(error);
  }
}

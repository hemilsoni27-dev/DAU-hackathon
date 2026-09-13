import type { Request, Response, NextFunction } from "express";
import { GetDashboardSummaryResponse } from "@workspace/api-zod";
import { dashboardService } from "../services/dashboard.service";

export async function getDashboardSummary(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const summary = await dashboardService.getSummary();
    res.json(GetDashboardSummaryResponse.parse(summary));
  } catch (error) {
    next(error);
  }
}

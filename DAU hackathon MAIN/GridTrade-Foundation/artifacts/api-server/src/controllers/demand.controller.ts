import type { Request, Response, NextFunction } from "express";
import { demandService } from "../services/demand.service";
import { AppError } from "../middleware/errors";

export async function listDemands(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const status = req.query.status as string | undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;
    const demands = await demandService.getDemands({ status, limit });
    res.json(demands);
  } catch (error) {
    next(error);
  }
}

export async function getDemandById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const demandId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const demand = await demandService.getDemandById(demandId);
    res.json(demand);
  } catch (error) {
    next(error);
  }
}

export async function createDemand(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const demand = await demandService.createDemand(req.authContext, req.body);
    res.status(201).json(demand);
  } catch (error) {
    next(error);
  }
}

export async function cancelDemand(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const demandId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const result = await demandService.cancelDemand(req.authContext, demandId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

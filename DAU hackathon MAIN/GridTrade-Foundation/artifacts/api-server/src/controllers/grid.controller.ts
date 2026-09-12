import type { Request, Response, NextFunction } from "express";
import { GetGridStatusResponse } from "@workspace/api-zod";
import { gridService } from "../services/grid.service";

export async function getGridStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const region = (req.query.region as string) || "NCR-NORTH";
    const status = await gridService.getStatus(region);
    res.json(GetGridStatusResponse.parse(status));
  } catch (error) {
    next(error);
  }
}

export async function listGridAreas(_req: Request, res: Response, next: NextFunction) {
  try {
    const areas = [
      { id: "NCR-NORTH", name: "NCR North Distribution Substation", status: "APPROVED", congestionPercent: 42.5 },
      { id: "NCR-SOUTH", name: "Bengaluru South Feeder", status: "APPROVED", congestionPercent: 38.0 },
      { id: "NCR-EAST", name: "Indiranagar Solar Microgrid", status: "ADJUSTED", congestionPercent: 72.4 },
      { id: "NCR-WEST", name: "Electronic City Industrial Substation", status: "RESTRICTED", congestionPercent: 88.5 },
    ];
    res.json(areas);
  } catch (error) {
    next(error);
  }
}

export async function getGridAreaStatus(req: Request, res: Response, NextFunction: NextFunction) {
  try {
    const rawArea = req.params.areaId;
    const areaId = Array.isArray(rawArea) ? rawArea[0] : (rawArea || "NCR-NORTH");
    const status = await gridService.getStatus(areaId);
    res.json(status);
  } catch (error) {
    NextFunction(error);
  }
}

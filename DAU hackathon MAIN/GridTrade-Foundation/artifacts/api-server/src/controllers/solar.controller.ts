import type { Request, Response, NextFunction } from "express";
import {
  CreateSolarSystemBody,
  ListSolarSystemsResponse,
} from "@workspace/api-zod";
import { solarRepository } from "../repositories/solar.repository";
import { AppError } from "../middleware/errors";

export async function listSolarSystems(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const ownerId = req.authContext?.userId;
    const systems = ownerId
      ? await solarRepository.findByOwnerId(ownerId)
      : await solarRepository.findAll();

    const formatted = systems.map((sys) => ({
      id: sys.id,
      ownerId: sys.ownerId,
      name: sys.name,
      capacityKw: Number(sys.capacityKw),
      location: sys.location,
      status: sys.status,
      todayGenerationKwh: 24.5,
      todayConsumptionKwh: 12.0,
    }));

    res.json(ListSolarSystemsResponse.parse(formatted));
  } catch (error) {
    next(error);
  }
}

export async function createSolarSystem(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!req.authContext) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const input = CreateSolarSystemBody.parse(req.body);
    const system = await solarRepository.create({
      ownerId: req.authContext.userId,
      name: input.name,
      capacityKw: input.capacityKw,
      location: input.location,
    });

    res.status(201).json({
      id: system.id,
      ownerId: system.ownerId,
      name: system.name,
      capacityKw: Number(system.capacityKw),
      location: system.location,
      status: system.status,
      todayGenerationKwh: 0,
      todayConsumptionKwh: 0,
    });
  } catch (error) {
    next(error);
  }
}

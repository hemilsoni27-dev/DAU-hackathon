import { prisma } from "../lib/prisma";
import type { SolarSystem, SolarSystemStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class SolarRepository {
  async findById(id: string): Promise<SolarSystem | null> {
    return prisma.solarSystem.findUnique({
      where: { id },
      include: { owner: true },
    });
  }

  async findByOwnerId(ownerId: string): Promise<SolarSystem[]> {
    return prisma.solarSystem.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    });
  }

  async findAll(): Promise<SolarSystem[]> {
    return prisma.solarSystem.findMany({
      orderBy: { createdAt: "desc" },
    });
  }

  async create(data: {
    ownerId: string;
    name: string;
    capacityKw: number | Decimal;
    location: string;
    status?: SolarSystemStatus;
  }): Promise<SolarSystem> {
    return prisma.solarSystem.create({
      data: {
        ownerId: data.ownerId,
        name: data.name,
        capacityKw: new Decimal(data.capacityKw.toString()),
        location: data.location,
        status: data.status ?? "online",
      },
    });
  }
}

export const solarRepository = new SolarRepository();

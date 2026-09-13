import { prisma } from "../lib/prisma";
import type { AuditLog, Prisma } from "@prisma/client";

export class AuditRepository {
  async findRecent(limit = 20) {
    return prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { actor: { select: { displayName: true } } },
    });
  }

  async logAction(data: {
    actorId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    requestId?: string;
    metadata?: Prisma.InputJsonValue;
  }): Promise<AuditLog> {
    return prisma.auditLog.create({
      data: {
        actorId: data.actorId,
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId,
        requestId: data.requestId,
        metadata: data.metadata ?? {},
      },
    });
  }
}

export const auditRepository = new AuditRepository();

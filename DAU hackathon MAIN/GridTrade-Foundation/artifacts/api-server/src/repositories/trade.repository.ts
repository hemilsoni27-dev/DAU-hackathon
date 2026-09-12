import { prisma } from "../lib/prisma";
import type { Prisma, Trade, TradeStatus, GridDecision } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class TradeRepository {
  async findById(id: string) {
    return prisma.trade.findUnique({
      where: { id },
      include: {
        listing: {
          include: {
            seller: true,
          },
        },
        buyer: true,
        transactions: {
          include: {
            hashRecord: true,
          },
        },
      },
    });
  }

  async findByUser(userId: string) {
    return prisma.trade.findMany({
      where: {
        OR: [
          { buyerId: userId },
          { listing: { sellerId: userId } },
        ],
      },
      include: {
        listing: {
          include: {
            seller: true,
          },
        },
        buyer: true,
        transactions: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listRecent(limit = 20) {
    return prisma.trade.findMany({
      take: limit,
      include: {
        listing: {
          include: {
            seller: true,
          },
        },
        buyer: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }
}

export const tradeRepository = new TradeRepository();

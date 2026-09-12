import type { Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma";
import { ledgerVerificationService } from "../services/ledger-verification.service";
import { AppError } from "../middleware/errors";

export async function listTransactions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const transactions = await prisma.transaction.findMany({
      where:
        auth.role === "ADMIN" || auth.role === "REGULATOR"
          ? {}
          : {
              OR: [
                { trade: { buyerId: auth.userId } },
                { trade: { listing: { sellerId: auth.userId } } },
              ],
            },
      include: {
        trade: {
          include: { listing: { include: { seller: true } }, buyer: true },
        },
        payment: true,
        hashRecord: true,
      },
      orderBy: { createdAt: "desc" },
    });

    res.json(
      transactions.map((tx) => ({
        id: tx.id,
        tradeId: tx.tradeId,
        buyerName: tx.trade.buyer.displayName,
        sellerName: tx.trade.listing.seller.displayName,
        amountInr: tx.amountInr.toNumber(),
        quantityKwh: tx.trade.quantityKwh.toNumber(),
        agreedPriceInrPerKwh: tx.trade.agreedPriceInrPerKwh.toNumber(),
        status: tx.status,
        paymentStatus: tx.payment?.status ?? "PAID",
        blockIndex: tx.hashRecord?.blockIndex ?? 0,
        hash: tx.hashRecord?.hash ?? null,
        previousHash: tx.hashRecord?.previousHash ?? null,
        settledAt: (tx.settledAt || tx.createdAt).toISOString(),
        createdAt: tx.createdAt.toISOString(),
      }))
    );
  } catch (error) {
    next(error);
  }
}

export async function getTransactionById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const tx = await prisma.transaction.findUnique({
      where: { id },
      include: {
        trade: {
          include: { listing: { include: { seller: true } }, buyer: true },
        },
        payment: true,
        hashRecord: true,
      },
    });

    if (!tx) {
      throw new AppError("NOT_FOUND", "Transaction record not found", 404);
    }

    res.json({
      id: tx.id,
      tradeId: tx.tradeId,
      buyerId: tx.trade.buyerId,
      buyerName: tx.trade.buyer.displayName,
      sellerName: tx.trade.listing.seller.displayName,
      quantityKwh: tx.trade.quantityKwh.toNumber(),
      agreedPriceInrPerKwh: tx.trade.agreedPriceInrPerKwh.toNumber(),
      amountInr: tx.amountInr.toNumber(),
      wheelingFeeInr: tx.trade.wheelingFeeInr.toNumber(),
      netAmountInr: tx.trade.netAmountInr.toNumber(),
      status: tx.status,
      payment: tx.payment
        ? {
            id: tx.payment.id,
            providerReference: tx.payment.providerReference,
            paymentMethod: tx.payment.paymentMethod,
            amountInr: tx.payment.amountInr.toNumber(),
            status: tx.payment.status,
            paidAt: tx.payment.paidAt?.toISOString(),
          }
        : null,
      hashRecord: tx.hashRecord
        ? {
            id: tx.hashRecord.id,
            blockIndex: tx.hashRecord.blockIndex,
            algorithm: tx.hashRecord.algorithm,
            previousHash: tx.hashRecord.previousHash,
            hash: tx.hashRecord.hash,
            createdAt: tx.hashRecord.createdAt.toISOString(),
          }
        : null,
      settledAt: (tx.settledAt || tx.createdAt).toISOString(),
      createdAt: tx.createdAt.toISOString(),
    });
  } catch (error) {
    next(error);
  }
}

export async function verifyTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawId = req.params.id;
    const transactionId = Array.isArray(rawId) ? rawId[0] : rawId;

    const result = await ledgerVerificationService.verifyTransaction(transactionId);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

export async function verifyLedger(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = await ledgerVerificationService.verifyLedger();
    res.json(result);
  } catch (error) {
    next(error);
  }
}

import { paymentRepository } from "../repositories/payment.repository";
import { tradeRepository } from "../repositories/trade.repository";
import { prisma } from "../lib/prisma";
import { defaultSettlementProvider, type SettlementProvider } from "../domain/settlement-provider";
import { auditRepository } from "../repositories/audit.repository";
import { eventPublisher } from "../realtime/events";
import { AppError } from "../middleware/errors";
import type { PaymentStatus } from "@prisma/client";
import { createHash } from "node:crypto";

export class PaymentService {
  constructor(private provider: SettlementProvider = defaultSettlementProvider) {}

  async processPaymentForTransaction(params: {
    transactionId: string;
    buyerId: string;
    idempotencyKey?: string;
    paymentMethod?: string;
  }) {
    const { transactionId, buyerId, idempotencyKey, paymentMethod } = params;

    // 1. Check Idempotency Key (if provided)
    if (idempotencyKey) {
      const existing = await paymentRepository.findByIdempotencyKey(idempotencyKey);
      if (existing) {
        return existing;
      }
    }

    // 2. Fetch & Validate Transaction
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        trade: {
          include: {
            listing: true,
          },
        },
        payment: true,
      },
    });

    if (!transaction) {
      throw new AppError("NOT_FOUND", "Transaction not found", 404);
    }

    if (transaction.trade.buyerId !== buyerId) {
      throw new AppError("FORBIDDEN", "You are not authorized to process payment for this transaction", 403);
    }

    if (transaction.trade.gridDecision === "RESTRICTED") {
      throw new AppError("UNPROCESSABLE_ENTITY", "Restricted trades cannot process payments", 422);
    }

    if (transaction.payment) {
      if (transaction.payment.status === "PAID") {
        return transaction.payment; // Already settled idempotently
      }
    }

    // 3. Delegate to SettlementProvider for Payment Intent / Authorization
    const providerResult = await this.provider.createPayment({
      transactionId,
      amountInr: transaction.amountInr,
      currency: "INR",
      idempotencyKey,
      metadata: {
        tradeId: transaction.tradeId,
        buyerId,
        sellerId: transaction.trade.listing.sellerId,
      },
    });

    // 4. Create or Update Payment Record in Database
    let payment;
    if (transaction.payment) {
      payment = await paymentRepository.updateStatus(
        transaction.payment.id,
        providerResult.status as PaymentStatus,
        providerResult.metadata
      );
    } else {
      payment = await paymentRepository.createPayment({
        transactionId,
        provider: "prototype_upi",
        providerReference: providerResult.providerPaymentId,
        paymentMethod: paymentMethod ?? "prototype_upi",
        idempotencyKey,
        amountInr: transaction.amountInr,
        status: providerResult.status as PaymentStatus,
        paidAt: providerResult.paidAt,
        metadata: providerResult.metadata,
      });
    }

    // 5. Audit Log & Event Publication
    await auditRepository.logAction({
      actorId: buyerId,
      action: "PAYMENT_CREATED",
      entityType: "Payment",
      entityId: payment.id,
      metadata: {
        transactionId,
        amountInr: transaction.amountInr.toNumber(),
        status: payment.status,
      },
    });

    await eventPublisher.publish({
      type: "transaction.updated",
      transactionId: transaction.id,
      status: payment.status,
      occurredAt: new Date().toISOString(),
    });

    return payment;
  }

  /**
   * Read-only: returns current payment state for a transaction without creating/mutating anything.
   * Used by GET /transactions/:id/payment.
   */
  async getPaymentStatus(transactionId: string, requestingUserId: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        trade: true,
        payment: true,
      },
    });

    if (!transaction) {
      throw new AppError("NOT_FOUND", "Transaction not found", 404);
    }

    // IDOR guard: only the buyer (or ADMIN) may read their transaction's payment status
    if (transaction.trade.buyerId !== requestingUserId) {
      throw new AppError("FORBIDDEN", "You are not authorized to view this payment", 403);
    }

    return transaction.payment ?? null;
  }

  async transition(paymentId: string, targetStatus: PaymentStatus, metadata?: any) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      throw new AppError("NOT_FOUND", "Payment record not found", 404);
    }

    const currentStatus = payment.status;
    const allowedMap: Record<PaymentStatus, PaymentStatus[]> = {
      PENDING: ["PROCESSING", "PAID", "FAILED", "CANCELLED"],
      PROCESSING: ["PAID", "FAILED", "CANCELLED"],
      PAID: ["REFUNDED"],
      FAILED: [],
      CANCELLED: [],
      REFUNDED: [],
    };

    if (!allowedMap[currentStatus]?.includes(targetStatus)) {
      throw new AppError(
        "BAD_REQUEST",
        `Invalid payment transition from '${currentStatus}' to '${targetStatus}'`,
        400
      );
    }

    const updated = await paymentRepository.updateStatus(paymentId, targetStatus, metadata);

    await auditRepository.logAction({
      action: "PAYMENT_STATUS_CHANGED",
      entityType: "Payment",
      entityId: paymentId,
      metadata: { from: currentStatus, to: targetStatus },
    });

    return updated;
  }

  async handleWebhook(provider: string, providerEventId: string, payload: any) {
    const payloadString = JSON.stringify(payload);
    const payloadHash = createHash("sha256").update(payloadString).digest("hex");

    // Idempotency check for duplicate webhook delivery
    const existingLog = await paymentRepository.findWebhookLog(provider, providerEventId);
    if (existingLog) {
      return { status: "ALREADY_PROCESSED", webhookLogId: existingLog.id };
    }

    const log = await paymentRepository.logWebhook({
      provider,
      providerEventId,
      payloadHash,
      status: "processed",
    });

    return { status: "SUCCESS", webhookLogId: log.id };
  }
}

export const paymentService = new PaymentService();

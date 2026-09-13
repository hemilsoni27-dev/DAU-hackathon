import { prisma } from "../lib/prisma";
import type { Payment, PaymentStatus, PaymentWebhookLog } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export class PaymentRepository {
  async findByTransactionId(transactionId: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { transactionId },
    });
  }

  async findByIdempotencyKey(idempotencyKey: string): Promise<Payment | null> {
    return prisma.payment.findUnique({
      where: { idempotencyKey },
    });
  }

  async findWebhookLog(provider: string, providerEventId: string): Promise<PaymentWebhookLog | null> {
    return prisma.paymentWebhookLog.findUnique({
      where: {
        provider_providerEventId: {
          provider,
          providerEventId,
        },
      },
    });
  }

  async createPayment(data: {
    transactionId: string;
    provider: string;
    providerReference?: string;
    paymentMethod?: string;
    idempotencyKey?: string;
    amountInr: Decimal;
    status: PaymentStatus;
    paidAt?: Date;
    metadata?: any;
  }): Promise<Payment> {
    return prisma.payment.create({
      data: {
        transactionId: data.transactionId,
        provider: data.provider,
        providerReference: data.providerReference,
        paymentMethod: data.paymentMethod ?? "prototype_upi",
        idempotencyKey: data.idempotencyKey,
        amountInr: data.amountInr,
        status: data.status,
        paidAt: data.paidAt,
        metadata: data.metadata,
      },
    });
  }

  async updateStatus(paymentId: string, status: PaymentStatus, metadata?: any): Promise<Payment> {
    return prisma.payment.update({
      where: { id: paymentId },
      data: {
        status,
        paidAt: status === "PAID" ? new Date() : undefined,
        metadata,
      },
    });
  }

  async logWebhook(data: {
    provider: string;
    providerEventId: string;
    payloadHash: string;
    status?: string;
    errorMessage?: string;
  }): Promise<PaymentWebhookLog> {
    return prisma.paymentWebhookLog.create({
      data: {
        provider: data.provider,
        providerEventId: data.providerEventId,
        payloadHash: data.payloadHash,
        status: data.status ?? "processed",
        errorMessage: data.errorMessage,
      },
    });
  }
}

export const paymentRepository = new PaymentRepository();

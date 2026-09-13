import { Decimal } from "@prisma/client/runtime/library";
import crypto from "node:crypto";

export interface PaymentProviderResult {
  providerPaymentId: string;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED";
  paidAt?: Date;
  metadata?: Record<string, any>;
}

export interface PaymentVerificationResult {
  verified: boolean;
  status: "PENDING" | "PROCESSING" | "PAID" | "FAILED" | "REFUNDED";
  providerPaymentId: string;
  amountInr: Decimal;
  verifiedAt: Date;
}

export interface CreatePaymentInput {
  transactionId: string;
  amountInr: Decimal;
  currency: string;
  idempotencyKey?: string;
  metadata?: Record<string, any>;
}

export interface SettlementProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult>;
  verifyPayment(input: { providerPaymentId: string }): Promise<PaymentVerificationResult>;
  refundPayment?(input: { providerPaymentId: string; amountInr?: Decimal }): Promise<{ status: "REFUNDED"; providerRefundId: string }>;
}

export class PrototypeUpiSettlementProvider implements SettlementProvider {
  async createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult> {
    // Generate deterministic or random reference ID for prototype UPI transfer
    const randomHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    const providerPaymentId = `UPI-GT-${randomHex}`;
    const now = new Date();

    // Deterministic simulation failure trigger for testing failure handling paths
    const isSimulatedFailure =
      input.metadata?.simulateFailure === true ||
      input.metadata?.paymentMethod === "simulate_failed_upi" ||
      input.amountInr.toNumber() === 9999.99;

    if (isSimulatedFailure) {
      return {
        providerPaymentId,
        status: "FAILED",
        paidAt: undefined,
        metadata: {
          paymentMethod: "UPI",
          failureReason: "SIMULATED_GATEWAY_DECLINE",
          simulated: true,
        },
      };
    }

    return {
      providerPaymentId,
      status: "PAID",
      paidAt: now,
      metadata: {
        paymentMethod: "UPI",
        vpa: "consumer@gridtrade.upi",
        bankRrn: `RRN-${Math.floor(100000000000 + Math.random() * 900000000000)}`,
        simulated: true,
      },
    };
  }

  async verifyPayment(input: { providerPaymentId: string }): Promise<PaymentVerificationResult> {
    return {
      verified: true,
      status: "PAID",
      providerPaymentId: input.providerPaymentId,
      amountInr: new Decimal("0.00"),
      verifiedAt: new Date(),
    };
  }

  async refundPayment(input: { providerPaymentId: string; amountInr?: Decimal }) {
    const refundHex = crypto.randomBytes(4).toString("hex").toUpperCase();
    return {
      status: "REFUNDED" as const,
      providerRefundId: `REF-${refundHex}`,
    };
  }
}

export const defaultSettlementProvider: SettlementProvider = new PrototypeUpiSettlementProvider();

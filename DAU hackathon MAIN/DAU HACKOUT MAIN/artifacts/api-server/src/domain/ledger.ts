import { createHash } from "node:crypto";

export const GENESIS_PREVIOUS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

export interface CanonicalTransactionData {
  blockIndex: number;
  transactionId: string;
  tradeId: string;
  buyerId: string;
  sellerId: string;
  quantityKwh: string;             // Serialized e.g. "10.0000"
  agreedPriceInrPerKwh: string;    // Serialized e.g. "7.5000"
  amountInr: string;               // Serialized e.g. "75.0000"
  wheelingFeeInr: string;          // Serialized e.g. "1.5000"
  netAmountInr: string;            // Serialized e.g. "76.5000"
  previousHash: string;            // 64-hex string of previous block
  settledAt: string;               // ISO-8601 UTC string
}

export function canonicalizeTransaction(data: CanonicalTransactionData): string {
  // Alphabetically sorted keys ensure stable deterministic serialization
  return JSON.stringify({
    agreedPriceInrPerKwh: data.agreedPriceInrPerKwh,
    amountInr: data.amountInr,
    blockIndex: data.blockIndex,
    buyerId: data.buyerId,
    netAmountInr: data.netAmountInr,
    previousHash: data.previousHash,
    quantityKwh: data.quantityKwh,
    sellerId: data.sellerId,
    settledAt: data.settledAt,
    tradeId: data.tradeId,
    transactionId: data.transactionId,
    wheelingFeeInr: data.wheelingFeeInr,
  });
}

export function calculateBlockHash(canonicalPayload: string): string {
  return createHash("sha256").update(canonicalPayload).digest("hex");
}

// Backwards compatibility legacy helper
export function hashTransaction(payload: {
  transactionId: string;
  tradeId: string;
  amountInr: string;
  quantityKwh: string;
  settledAt: string;
}) {
  const canonical = JSON.stringify({
    amountInr: payload.amountInr,
    quantityKwh: payload.quantityKwh,
    settledAt: payload.settledAt,
    tradeId: payload.tradeId,
    transactionId: payload.transactionId,
  });
  return createHash("sha256").update(canonical).digest("hex");
}
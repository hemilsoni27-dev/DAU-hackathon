import { prisma } from "../lib/prisma";
import {
  canonicalizeTransaction,
  calculateBlockHash,
  GENESIS_PREVIOUS_HASH,
  type CanonicalTransactionData,
} from "../domain/ledger";
import { auditRepository } from "../repositories/audit.repository";
import { AppError } from "../middleware/errors";

export type VerificationResultCode =
  | "VALID"
  | "INVALID_HASH"
  | "INVALID_CHAIN"
  | "MISSING_HASH_RECORD"
  | "MALFORMED_RECORD";

export type TransactionVerificationResult = {
  transactionId: string;
  verified: boolean;
  result: VerificationResultCode;
  blockIndex?: number;
  hash?: string;
  previousHash?: string;
  expectedHash?: string;
  explanation?: string;
  checkedAt: string;
};

export type WholeLedgerVerificationResult = {
  verified: boolean;
  totalBlocks: number;
  verifiedBlocks: number;
  firstInvalidBlock?: number;
  failureReason?: string;
  checkedAt: string;
};

export class LedgerVerificationService {
  async verifyTransaction(transactionId: string): Promise<TransactionVerificationResult> {
    const checkedAt = new Date().toISOString();

    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        trade: {
          include: {
            listing: true,
          },
        },
        hashRecord: true,
      },
    });

    if (!transaction) {
      throw new AppError("NOT_FOUND", "Transaction not found", 404);
    }

    const { hashRecord, trade } = transaction;

    if (!hashRecord) {
      return {
        transactionId,
        verified: false,
        result: "MISSING_HASH_RECORD",
        explanation: "No cryptographic SHA-256 hash record found for this transaction",
        checkedAt,
      };
    }

    // 1. Re-construct Canonical Transaction Data from Live Database State
    const canonicalData: CanonicalTransactionData = {
      blockIndex: hashRecord.blockIndex,
      transactionId: transaction.id,
      tradeId: trade.id,
      buyerId: trade.buyerId,
      sellerId: trade.listing.sellerId,
      quantityKwh: trade.quantityKwh.toFixed(4),
      agreedPriceInrPerKwh: trade.agreedPriceInrPerKwh.toFixed(4),
      amountInr: transaction.amountInr.toFixed(4),
      wheelingFeeInr: trade.wheelingFeeInr.toFixed(4),
      netAmountInr: trade.netAmountInr.toFixed(4),
      previousHash: hashRecord.previousHash,
      settledAt: (transaction.settledAt || transaction.createdAt).toISOString(),
    };

    const canonicalPayload = canonicalizeTransaction(canonicalData);
    const expectedHash = calculateBlockHash(canonicalPayload);

    // 2. Detect Data Tampering (Computed Hash vs Persisted Hash)
    if (expectedHash !== hashRecord.hash) {
      await auditRepository.logAction({
        action: "LEDGER_TAMPER_DETECTED",
        entityType: "HashRecord",
        entityId: hashRecord.id,
        metadata: {
          transactionId,
          blockIndex: hashRecord.blockIndex,
          storedHash: hashRecord.hash,
          computedHash: expectedHash,
        },
      });

      return {
        transactionId,
        verified: false,
        result: "INVALID_HASH",
        blockIndex: hashRecord.blockIndex,
        hash: hashRecord.hash,
        previousHash: hashRecord.previousHash,
        expectedHash,
        explanation: "SHA-256 hash mismatch! Database fields modified or hash record tampered.",
        checkedAt,
      };
    }

    // 3. Verify Previous Hash Chain Linkage
    if (hashRecord.blockIndex > 0) {
      const priorRecord = await prisma.hashRecord.findUnique({
        where: { blockIndex: hashRecord.blockIndex - 1 },
      });

      if (!priorRecord || priorRecord.hash !== hashRecord.previousHash) {
        return {
          transactionId,
          verified: false,
          result: "INVALID_CHAIN",
          blockIndex: hashRecord.blockIndex,
          hash: hashRecord.hash,
          previousHash: hashRecord.previousHash,
          explanation: "Hash chain broken! Previous hash does not match prior block hash.",
          checkedAt,
        };
      }
    } else {
      if (hashRecord.previousHash !== GENESIS_PREVIOUS_HASH) {
        return {
          transactionId,
          verified: false,
          result: "INVALID_CHAIN",
          blockIndex: hashRecord.blockIndex,
          explanation: "Genesis block previous hash is invalid",
          checkedAt,
        };
      }
    }

    // 4. Log Audit Event & Return Verification Success
    await auditRepository.logAction({
      action: "LEDGER_VERIFICATION_PERFORMED",
      entityType: "HashRecord",
      entityId: hashRecord.id,
      metadata: { transactionId, blockIndex: hashRecord.blockIndex, status: "VALID" },
    });

    return {
      transactionId,
      verified: true,
      result: "VALID",
      blockIndex: hashRecord.blockIndex,
      hash: hashRecord.hash,
      previousHash: hashRecord.previousHash,
      explanation: "SHA-256 canonical hash & chain integrity verified successfully",
      checkedAt,
    };
  }

  async verifyLedger(): Promise<WholeLedgerVerificationResult> {
    const checkedAt = new Date().toISOString();
    const blocks = await prisma.hashRecord.findMany({
      orderBy: { blockIndex: "asc" },
      include: {
        transaction: {
          include: {
            trade: {
              include: { listing: true },
            },
          },
        },
      },
    });

    let verifiedBlocks = 0;

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      const { transaction } = block;

      if (!transaction) {
        return {
          verified: false,
          totalBlocks: blocks.length,
          verifiedBlocks,
          firstInvalidBlock: block.blockIndex,
          failureReason: `Block ${block.blockIndex} references missing transaction`,
          checkedAt,
        };
      }

      // Re-verify hash canonicalization
      const canonicalData: CanonicalTransactionData = {
        blockIndex: block.blockIndex,
        transactionId: transaction.id,
        tradeId: transaction.trade.id,
        buyerId: transaction.trade.buyerId,
        sellerId: transaction.trade.listing.sellerId,
        quantityKwh: transaction.trade.quantityKwh.toFixed(4),
        agreedPriceInrPerKwh: transaction.trade.agreedPriceInrPerKwh.toFixed(4),
        amountInr: transaction.amountInr.toFixed(4),
        wheelingFeeInr: transaction.trade.wheelingFeeInr.toFixed(4),
        netAmountInr: transaction.trade.netAmountInr.toFixed(4),
        previousHash: block.previousHash,
        settledAt: (transaction.settledAt || transaction.createdAt).toISOString(),
      };

      const computedHash = calculateBlockHash(canonicalizeTransaction(canonicalData));
      if (computedHash !== block.hash) {
        return {
          verified: false,
          totalBlocks: blocks.length,
          verifiedBlocks,
          firstInvalidBlock: block.blockIndex,
          failureReason: `Block ${block.blockIndex} SHA-256 hash mismatch! Computed: ${computedHash.slice(0, 10)}... vs Stored: ${block.hash.slice(0, 10)}...`,
          checkedAt,
        };
      }

      // Re-verify chain continuity
      if (i === 0) {
        if (block.previousHash !== GENESIS_PREVIOUS_HASH) {
          return {
            verified: false,
            totalBlocks: blocks.length,
            verifiedBlocks,
            firstInvalidBlock: block.blockIndex,
            failureReason: `Genesis block ${block.blockIndex} previous hash invalid`,
            checkedAt,
          };
        }
      } else {
        const prevBlock = blocks[i - 1];
        if (block.previousHash !== prevBlock.hash) {
          return {
            verified: false,
            totalBlocks: blocks.length,
            verifiedBlocks,
            firstInvalidBlock: block.blockIndex,
            failureReason: `Chain broken at block ${block.blockIndex}! Previous hash does not match block ${prevBlock.blockIndex} hash.`,
            checkedAt,
          };
        }
      }

      verifiedBlocks++;
    }

    return {
      verified: true,
      totalBlocks: blocks.length,
      verifiedBlocks,
      checkedAt,
    };
  }
}

export const ledgerVerificationService = new LedgerVerificationService();

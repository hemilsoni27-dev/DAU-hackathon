# SHA-256 Tamper-Evident Ledger Architecture

## Overview
GridTrade implements a deterministic, tamper-evident digital ledger using SHA-256 hash-chaining stored natively in PostgreSQL. Every completed trade creates a canonical `Transaction` and an immutable `HashRecord` linked to the previous block in sequence.

## Canonicalization Algorithm
To guarantee 100% deterministic cryptographic hashing regardless of JSON key ordering or platform serialization differences, transaction fields are canonicalized into an alphabetically-sorted JSON payload string:

```json
{
  "agreedPriceInrPerKwh": "7.5000",
  "amountInr": "75.0000",
  "blockIndex": 42,
  "buyerId": "uuid...",
  "netAmountInr": "76.5000",
  "previousHash": "64-character-hex-string...",
  "quantityKwh": "10.0000",
  "sellerId": "uuid...",
  "settledAt": "2026-09-12T10:00:00.000Z",
  "tradeId": "uuid...",
  "transactionId": "uuid...",
  "wheelingFeeInr": "1.5000"
}
```

## Hash-Chain Model
For block index $N \ge 0$:
$$\text{Block}_N.\text{previousHash} = \begin{cases} \text{GENESIS\_PREVIOUS\_HASH} & N = 0 \\ \text{Block}_{N-1}.\text{hash} & N > 0 \end{cases}$$
$$\text{Block}_N.\text{hash} = \text{SHA256}(\text{canonicalPayload}_N)$$

## Live Tamper Detection & Audit Verification
1. **Transaction Level Verification (`GET /api/v1/transactions/:id/verify`)**:
   - Re-reads live database state for the transaction.
   - Re-computes the canonical payload string and SHA-256 hash.
   - Compares computed hash vs stored `HashRecord.hash` and `previousHash`.
   - Returns `VALID` or flags tampering (`INVALID_HASH`, `INVALID_CHAIN`, `MISSING_HASH_RECORD`).
2. **Whole-Ledger Verification (`GET /api/v1/transactions/ledger/verify`)**:
   - Iterates all blocks in `blockIndex ASC` order.
   - Re-verifies every hash and chain link. Returns total blocks, verified blocks, and any first broken block index.

## Distinction from Public Blockchain
GridTrade's SHA-256 ledger is a high-performance, tamper-evident cryptographic hash-chain designed for local P2P energy coordination. It does not require consensus overhead or energy-intensive proof-of-work, while maintaining full cryptographic auditability for utility regulators and market participants.

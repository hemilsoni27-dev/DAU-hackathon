# Payment Security & Settlement Abstraction

## Overview
GridTrade decouples payment processing from core trade matching using a clean `SettlementProvider` abstraction layer.

## Settlement Provider Interface
```ts
export interface SettlementProvider {
  createPayment(input: CreatePaymentInput): Promise<PaymentProviderResult>;
  verifyPayment(input: { providerPaymentId: string }): Promise<PaymentVerificationResult>;
  refundPayment?(input: { providerPaymentId: string; amountInr?: Decimal }): Promise<{ status: "REFUNDED"; providerRefundId: string }>;
}
```

## Idempotency & Replay Protection
- **Unique Idempotency Keys**: Payment creation requests enforce an optional or generated `idempotencyKey` backed by a PostgreSQL unique index (`Payment.idempotencyKey`).
- **Webhook Ingestion**: Webhooks sent to `POST /api/v1/payments/webhook/:provider` are logged in `PaymentWebhookLog` with a unique `(provider, providerEventId)` constraint to prevent duplicate processing on retries.

## Server-Side Rate & Financial Derivation
- Payment amounts are strictly derived from server-side trade pricing calculations (`trade.netAmountInr`).
- Client-supplied total price or payment status overrides are strictly ignored.

## Settlement Simulation & Failure Paths
- `PrototypeUpiSettlementProvider` implements an in-memory/simulated gateway suitable for hackathon demonstration.
- **Success Path**: Returns status `PAID` with a generated virtual UPI reference (e.g., `UPI-GT-XXXXXX`) and simulated bank RRN.
- **Failure Path**: Triggered by passing `simulateFailure: true` in metadata, using `paymentMethod: "simulate_failed_upi"`, or sending an amount of `9999.99`. Returns status `FAILED` with `SIMULATED_GATEWAY_DECLINE`. Tested in `domain.test.ts`.


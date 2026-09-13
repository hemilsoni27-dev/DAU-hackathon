import { realtimeService } from "../infra/redis";
import { logger } from "../lib/logger";

export type GridTradeEvent =
  | { type: "price.updated"; priceInrPerKwh: string; occurredAt: string }
  | { type: "grid.updated"; decision: "APPROVED" | "ADJUSTED" | "RESTRICTED"; occurredAt: string }
  | { type: "listing.created"; listingId: string; occurredAt: string }
  | { type: "listing.closed"; listingId: string; occurredAt: string }
  | { type: "match.recommended"; matchId: string; occurredAt: string }
  | { type: "trade.created"; tradeId: string; buyerId: string; listingId: string; quantityKwh: number; agreedPriceInrPerKwh: number; gridDecision: string; occurredAt: string }
  | { type: "trade.updated"; tradeId: string; status: string; occurredAt: string }
  | { type: "transaction.created"; transactionId: string; occurredAt: string }
  | { type: "transaction.updated"; transactionId: string; status: string; occurredAt: string }
  | { type: "alert.created"; alertId: string; severity: "info" | "warning" | "critical"; occurredAt: string }
  | { type: "prediction.generated"; predictionId: string; predictionType: string; modelVersion: string; occurredAt: string }
  | { type: "recommendation.created"; recommendationId: string; kind: string; occurredAt: string }
  | { type: "recommendation.updated"; recommendationId: string; status: string; occurredAt: string }
  | { type: "anomaly.detected"; anomalyId: string; severity: string; score: number; occurredAt: string };

export interface EventPublisher {
  publish(event: GridTradeEvent): Promise<void>;
}

export class RealtimeEventPublisher implements EventPublisher {
  /**
   * Rule: PERSISTENCE FIRST, THEN EVENT.
   * Call publish ONLY AFTER durable database transaction has successfully committed.
   */
  async publish(event: GridTradeEvent): Promise<void> {
    try {
      await realtimeService.publish(`gridtrade:events:${event.type}`, event);
      logger.info({ eventType: event.type }, "Realtime event emitted");
    } catch (error) {
      logger.warn({ err: error, eventType: event.type }, "Failed to publish realtime event");
    }
  }
}

export const eventPublisher = new RealtimeEventPublisher();
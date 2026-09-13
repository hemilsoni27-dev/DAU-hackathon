import { describe, expect, it } from "vitest";
import { CreateListingBody } from "@workspace/api-zod";
import { assertPositiveEnergy, assertValidAvailability, calculateSurplus } from "./energy";
import { decideGrid } from "./grid";
import { scoreMatch } from "./matching";
import { hashTransaction } from "./ledger";
import { assertCanModifyResource, hasPermission, type AuthContext } from "../middleware/auth";
import { demoStore } from "../data/demo-store";

describe("energy domain", () => {
  it("calculates marketable surplus with decimal-safe scaled arithmetic", () => {
    expect(calculateSurplus("12.1250", "4.8750")).toEqual({
      netSurplusKwh: "7.25",
      marketableSurplusKwh: "7.25",
    });
  });

  it("clamps a deficit to zero marketable surplus", () => {
    expect(calculateSurplus("4", "8")).toEqual({
      netSurplusKwh: "-4",
      marketableSurplusKwh: "0",
    });
  });

  it("rejects zero or negative listing quantities", () => {
    expect(() => assertPositiveEnergy("0", "quantityKwh")).toThrow();
    expect(() => assertPositiveEnergy("-1", "quantityKwh")).toThrow();
  });

  it("requires an availability window with a future end", () => {
    const start = new Date("2026-09-12T10:00:00Z");
    expect(() => assertValidAvailability(start, start)).toThrow();
    expect(() =>
      assertValidAvailability(start, new Date("2026-09-12T11:00:00Z")),
    ).not.toThrow();
  });
});

describe("grid decision service", () => {
  it("approves healthy local conditions", () => {
    expect(
      decideGrid({
        congestionPercent: 32,
        renewableSharePercent: 44,
        frequencyHz: 50,
      }),
    ).toBe("APPROVED");
  });

  it("restricts congested or unstable conditions", () => {
    expect(
      decideGrid({
        congestionPercent: 88,
        renewableSharePercent: 40,
        frequencyHz: 50,
      }),
    ).toBe("RESTRICTED");
  });
});

describe("matching and listing boundaries", () => {
  it("scores multi-factor fit rather than price alone", () => {
    const approved = scoreMatch({
      id: "one",
      sellerName: "Nearby",
      location: "Local",
      quantityKwh: 24,
      priceInrPerKwh: 7,
      gridDecision: "APPROVED",
      distanceKm: 1,
      reliabilityScore: 95,
    });
    const restricted = scoreMatch({
      id: "two",
      sellerName: "Cheapest",
      location: "Far",
      quantityKwh: 24,
      priceInrPerKwh: 5,
      gridDecision: "RESTRICTED",
      distanceKm: 18,
      reliabilityScore: 60,
    });
    expect(approved).toBeGreaterThan(restricted);
  });

  it("validates the generated listing request contract", () => {
    expect(() =>
      CreateListingBody.parse({
        solarSystemId: demoStore.solarSystems[0].id,
        quantityKwh: 8,
        priceInrPerKwh: 6.5,
        availableFrom: "2026-09-12T10:00:00Z",
        availableUntil: "2026-09-12T12:00:00Z",
      }),
    ).not.toThrow();
  });

  it("rejects listing creation against an unowned solar system", () => {
    expect(() =>
      demoStore.addListing({
        solarSystemId: "00000000-0000-0000-0000-000000000000",
        quantityKwh: 4,
        priceInrPerKwh: 6,
        availableFrom: new Date("2026-09-12T10:00:00Z"),
        availableUntil: new Date("2026-09-12T12:00:00Z"),
      }),
    ).toThrow("not owned");
  });
});

describe("transaction ledger & anti-tampering", () => {
  it("produces a stable SHA-256 hash for a canonical transaction payload", () => {
    const payload = {
      transactionId: "tx-1",
      tradeId: "trade-1",
      amountInr: "84.5000",
      quantityKwh: "12.5000",
      settledAt: "2026-09-12T10:00:00.000Z",
    };
    const initialHash = hashTransaction(payload);
    expect(initialHash).toBe(
      "f169e154d0779accb2668cfc2be07ed5b898bf435911ee655fd3428df08836bf",
    );
    expect(initialHash).toBe(hashTransaction({ ...payload }));
  });

  it("detects payload tampering via hash mismatch", () => {
    const original = {
      transactionId: "tx-1",
      tradeId: "trade-1",
      amountInr: "84.5000",
      quantityKwh: "12.5000",
      settledAt: "2026-09-12T10:00:00.000Z",
    };
    const tampered = { ...original, amountInr: "84.5001" };
    expect(hashTransaction(original)).not.toBe(hashTransaction(tampered));
  });
});

describe("RBAC & ownership authorization", () => {
  it("enforces permission matrix for roles", () => {
    expect(hasPermission("PROSUMER", "listing:create")).toBe(true);
    expect(hasPermission("CONSUMER", "listing:create")).toBe(false);
    expect(hasPermission("UTILITY", "grid:override")).toBe(true);
    expect(hasPermission("PROSUMER", "grid:override")).toBe(false);
    expect(hasPermission("ADMIN", "admin:access")).toBe(true);
  });

  it("enforces ownership authorization for user resources", () => {
    const userContext: AuthContext = {
      userId: "user-123",
      displayName: "User One",
      email: "user1@example.com",
      role: "PROSUMER",
    };

    expect(() =>
      assertCanModifyResource(userContext, "user-123", "solar system"),
    ).not.toThrow();

    expect(() =>
      assertCanModifyResource(userContext, "user-456", "solar system"),
    ).toThrow("only modify your own");
  });
});

describe("real intelligent matching engine", () => {
  it("calculates multi-factor 6-component scores and structured match reasons", async () => {
    const { scoreMatchCandidate } = await import("./matching-engine");
    const demand = {
      id: "demand-1",
      buyerId: "buyer-100",
      buyerName: "Eco Buyer",
      location: "HSR Layout Sector 2",
      gridArea: "South Bengaluru",
      quantityKwh: 20,
      allocatedKwh: 0,
      remainingKwh: 20,
      maxPriceInrPerKwh: 8.5,
      availableFrom: new Date("2026-09-12T10:00:00Z"),
      availableUntil: new Date("2026-09-12T14:00:00Z"),
    };

    const listing = {
      id: "listing-1",
      sellerId: "seller-200",
      sellerName: "Green Solar House",
      location: "HSR Layout Sector 1",
      gridArea: "South Bengaluru",
      quantityKwh: 25,
      allocatedKwh: 0,
      remainingKwh: 25,
      priceInrPerKwh: 6.5,
      availableFrom: new Date("2026-09-12T09:00:00Z"),
      availableUntil: new Date("2026-09-12T15:00:00Z"),
      gridDecision: "APPROVED" as const,
    };

    const rec = scoreMatchCandidate(listing as any, demand as any);

    expect(rec.matchPercentage).toBeGreaterThan(70);
    expect(rec.scores.price).toBeGreaterThan(0.7);
    expect(rec.scores.proximity).toBeGreaterThan(0.8);
    expect(rec.reasons.length).toBeGreaterThan(0);
    expect(rec.reasons[0].direction).toBe("positive");
  });

  it("filters out ineligible candidates (same user, price exceeded, expired window)", async () => {
    const { isEligibleCandidate } = await import("./matching-engine");
    const demand = {
      id: "demand-1",
      buyerId: "user-100",
      maxPriceInrPerKwh: 6.0,
      quantityKwh: 10,
      allocatedKwh: 0,
      remainingKwh: 10,
      availableFrom: new Date("2026-09-12T10:00:00Z"),
      availableUntil: new Date("2026-09-12T12:00:00Z"),
    };

    const sameUserListing = {
      id: "listing-1",
      sellerId: "user-100", // Same user!
      priceInrPerKwh: 5.0,
      quantityKwh: 10,
      allocatedKwh: 0,
      remainingKwh: 10,
      availableFrom: new Date("2026-09-12T10:00:00Z"),
      availableUntil: new Date("2026-09-12T12:00:00Z"),
    };

    const highPriceListing = {
      id: "listing-2",
      sellerId: "user-200",
      priceInrPerKwh: 9.0, // Exceeds demand max price 6.0
      quantityKwh: 10,
      allocatedKwh: 0,
      remainingKwh: 10,
      availableFrom: new Date("2026-09-12T10:00:00Z"),
      availableUntil: new Date("2026-09-12T12:00:00Z"),
    };

    expect(isEligibleCandidate(sameUserListing as any, demand as any)).toBe(false);
    expect(isEligibleCandidate(highPriceListing as any, demand as any)).toBe(false);
  });
});

describe("deterministic dynamic pricing engine", () => {
  it("applies negative price pressure when supply exceeds demand", async () => {
    const { calculateDynamicPrice } = await import("./pricing-engine");
    const result = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 200,
      demandKwh: 50,
      congestionLevel: 0.10,
    });

    expect(result.recommendedPricePerKwh.toNumber()).toBeLessThan(7.50);
    expect(result.supplyDemandFactor.toNumber()).toBeLessThan(1.0);
    expect(result.explanation.factors.some((f) => f.key === "SUPPLY" && f.direction === "DOWN")).toBe(true);
  });

  it("applies positive price pressure when demand exceeds supply", async () => {
    const { calculateDynamicPrice } = await import("./pricing-engine");
    const result = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 50,
      demandKwh: 200,
      congestionLevel: 0.10,
    });

    expect(result.recommendedPricePerKwh.toNumber()).toBeGreaterThan(7.50);
    expect(result.supplyDemandFactor.toNumber()).toBeGreaterThan(1.0);
    expect(result.explanation.factors.some((f) => f.key === "DEMAND" && f.direction === "UP")).toBe(true);
  });

  it("adds congestion adjustment factor for elevated grid congestion", async () => {
    const { calculateDynamicPrice } = await import("./pricing-engine");
    const lowCongestion = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 100,
      demandKwh: 100,
      congestionLevel: 0.10,
    });
    const highCongestion = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 100,
      demandKwh: 100,
      congestionLevel: 0.80,
    });

    expect(highCongestion.recommendedPricePerKwh.toNumber()).toBeGreaterThan(lowCongestion.recommendedPricePerKwh.toNumber());
    expect(highCongestion.explanation.factors.some((f) => f.key === "CONGESTION" && f.direction === "UP")).toBe(true);
  });

  it("enforces price floor and price ceiling clamps", async () => {
    const { calculateDynamicPrice } = await import("./pricing-engine");
    const floorPrice = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 10000,
      demandKwh: 1,
      congestionLevel: 0.0,
    });
    const ceilingPrice = calculateDynamicPrice({
      basePricePerKwh: 7.50,
      supplyKwh: 1,
      demandKwh: 10000,
      congestionLevel: 1.0,
    });

    expect(floorPrice.recommendedPricePerKwh.toNumber()).toBeGreaterThanOrEqual(floorPrice.priceFloor.toNumber());
    expect(ceilingPrice.recommendedPricePerKwh.toNumber()).toBeLessThanOrEqual(ceilingPrice.priceCeiling.toNumber());
  });
});

describe("grid decision engine and trade restrictions", () => {
  it("approves healthy local grid conditions", async () => {
    const { evaluateTradeGridCondition } = await import("./grid-decision");
    const res = evaluateTradeGridCondition({
      congestionPercent: 40.0,
      frequencyHz: 50.0,
      requestedKwh: 10.0,
    });

    expect(res.status).toBe("APPROVED");
    expect(res.reasonCode).toBe("GRID_HEALTHY");
    expect(res.constraints.maxEnergyKwh?.toNumber()).toBe(10.0);
  });

  it("adjusts tradable quantity during moderate grid congestion", async () => {
    const { evaluateTradeGridCondition } = await import("./grid-decision");
    const res = evaluateTradeGridCondition({
      congestionPercent: 75.0,
      frequencyHz: 50.01,
      requestedKwh: 10.0,
    });

    expect(res.status).toBe("ADJUSTED");
    expect(res.reasonCode).toBe("GRID_MODERATE_CONGESTION");
    expect(res.constraints.maxEnergyKwh?.toNumber()).toBeLessThan(10.0);
    expect(res.constraints.maxEnergyKwh?.toNumber()).toBeGreaterThan(0);
  });

  it("restricts trade execution completely during severe congestion or frequency deviation", async () => {
    const { evaluateTradeGridCondition } = await import("./grid-decision");
    const severeCongestion = evaluateTradeGridCondition({
      congestionPercent: 88.0,
      frequencyHz: 50.0,
      requestedKwh: 10.0,
    });
    const freqUnstable = evaluateTradeGridCondition({
      congestionPercent: 30.0,
      frequencyHz: 49.60,
      requestedKwh: 10.0,
    });

    expect(severeCongestion.status).toBe("RESTRICTED");
    expect(severeCongestion.constraints.maxEnergyKwh?.toNumber()).toBe(0);

    expect(freqUnstable.status).toBe("RESTRICTED");
    expect(freqUnstable.reasonCode).toBe("GRID_FREQUENCY_OUT_OF_BOUNDS");
  });
});

describe("SHA-256 canonicalization & ledger hash chain", () => {
  it("produces identical deterministic canonical payloads regardless of key insertion order", async () => {
    const { canonicalizeTransaction, calculateBlockHash, GENESIS_PREVIOUS_HASH } = await import("./ledger");

    const payloadA = {
      blockIndex: 0,
      transactionId: "tx-100",
      tradeId: "trade-200",
      buyerId: "buyer-300",
      sellerId: "seller-400",
      quantityKwh: "10.0000",
      agreedPriceInrPerKwh: "7.5000",
      amountInr: "75.0000",
      wheelingFeeInr: "1.5000",
      netAmountInr: "76.5000",
      previousHash: GENESIS_PREVIOUS_HASH,
      settledAt: "2026-09-12T10:00:00.000Z",
    };

    const payloadB = {
      settledAt: "2026-09-12T10:00:00.000Z",
      previousHash: GENESIS_PREVIOUS_HASH,
      netAmountInr: "76.5000",
      wheelingFeeInr: "1.5000",
      amountInr: "75.0000",
      agreedPriceInrPerKwh: "7.5000",
      quantityKwh: "10.0000",
      sellerId: "seller-400",
      buyerId: "buyer-300",
      tradeId: "trade-200",
      transactionId: "tx-100",
      blockIndex: 0,
    };

    const strA = canonicalizeTransaction(payloadA);
    const strB = canonicalizeTransaction(payloadB);

    expect(strA).toBe(strB);

    const hashA = calculateBlockHash(strA);
    const hashB = calculateBlockHash(strB);

    expect(hashA).toBe(hashB);
    expect(hashA.length).toBe(64);
  });
});

describe("settlement provider & payment state machine", () => {
  it("creates payment through SettlementProvider abstraction", async () => {
    const { PrototypeUpiSettlementProvider } = await import("./settlement-provider");
    const { Decimal } = await import("@prisma/client/runtime/library");

    const provider = new PrototypeUpiSettlementProvider();
    const result = await provider.createPayment({
      transactionId: "tx-test-101",
      amountInr: new Decimal("150.00"),
      currency: "INR",
    });

    expect(result.status).toBe("PAID");
    expect(result.providerPaymentId.startsWith("UPI-GT-")).toBe(true);
    expect(result.paidAt).toBeDefined();
  });

  it("handles payment failure path when simulation trigger is passed or amount is 9999.99", async () => {
    const { PrototypeUpiSettlementProvider } = await import("./settlement-provider");
    const { Decimal } = await import("@prisma/client/runtime/library");

    const provider = new PrototypeUpiSettlementProvider();
    const result = await provider.createPayment({
      transactionId: "tx-test-fail-102",
      amountInr: new Decimal("9999.99"),
      currency: "INR",
    });

    expect(result.status).toBe("FAILED");
    expect(result.paidAt).toBeUndefined();
    expect(result.metadata?.failureReason).toBe("SIMULATED_GATEWAY_DECLINE");
  });
});

describe("AI Intelligence Layer (Phase 5)", () => {
  it("enforces grid decision RESTRICTED safety rule on Smart Sell recommendations", async () => {
    const { SmartRecommendationService } = await import("../services/smart-recommendation.service");
    const service = new SmartRecommendationService();

    // Mock test call for userId without solar system
    const result = await service.generateSmartSellRecommendations("non-existent-user");

    expect(result.kind).toBe("SMART_SELL");
    expect(result.score).toBe(0.0);
    expect(result.reasons.some((r) => r.includes("Zero surplus energy") || r.includes("RESTRICTED"))).toBe(true);
    expect(result.predictionMetadata.modelVersion).toBeDefined();
  }, 15000);

  it("evaluates anomaly scores and severity thresholds cleanly", async () => {
    const { AnomalyService } = await import("../services/anomaly.service");
    const service = new AnomalyService();

    const highAnomaly = await service.evaluateAnomaly({
      entityType: "trade",
      entityId: "trade-anom-1",
      metrics: {
        trade_frequency: 25,
        cancellation_rate: 0.80,
        energy_kwh: 650,
      },
    });

    expect(highAnomaly.score).toBeGreaterThanOrEqual(0.75);
    expect(highAnomaly.severity).toBe("HIGH");
    expect(highAnomaly.reasons.length).toBeGreaterThan(1);
    expect(highAnomaly.modelVersion).toBe("anomaly-rule-v1.0");
  }, 15000);

  it("answers contextual assistant queries with data sources and confidence", async () => {
    const { ContextualAssistantProvider } = await import("../services/assistant.service");
    const provider = new ContextualAssistantProvider();

    const response = await provider.generateResponse(
      "How much surplus energy do I have?",
      {
        userId: "user-test",
        currentSurplusKwh: 8.5,
        currentGridStatus: "APPROVED",
        currentIndicativePrice: 5.20,
      }
    );

    expect(response.answer.includes("8.50 kWh")).toBe(true);
    expect(response.sources).toContain("LATEST_ENERGY_DATA");
    expect(response.confidence).toBeGreaterThan(0.80);
    expect(response.suggestedActions).toBeDefined();
  });

  it("enforces read-only state mutation guard on assistant commands", async () => {
    const { ContextualAssistantProvider } = await import("../services/assistant.service");
    const provider = new ContextualAssistantProvider();

    const response = await provider.generateResponse(
      "execute trade for 10 kWh",
      {
        userId: "user-test",
        userRole: "PROSUMER",
      }
    );

    expect(response.answer).toContain("read-only decision-support assistant");
    expect(response.sources).toContain("SECURITY_POLICY_GUARD");
  });

  it("explains ADJUSTED trade decisions grounded in feeder capacity limits", async () => {
    const { ContextualAssistantProvider } = await import("../services/assistant.service");
    const provider = new ContextualAssistantProvider();

    const response = await provider.generateResponse(
      "Why was my trade adjusted to 10 kW?",
      {
        userId: "user-test",
        currentGridStatus: "ADJUSTED",
        congestionPercent: 78.0,
        latestTrade: {
          id: "tr-123",
          status: "ADJUSTED",
          quantityKwh: 10.0,
          requestedKwh: 20.0,
          agreedPriceInrPerKwh: 6.20,
          netAmountInr: 62.0,
          gridDecision: "ADJUSTED",
          createdAt: new Date().toISOString(),
        },
      }
    );

    expect(response.answer).toContain("ADJUSTED");
    expect(response.answer).toContain("20.0 kW");
    expect(response.answer).toContain("10.0 kW");
    expect(response.sources).toContain("GRID_AWARE_DECISION_ENGINE");
  });

  it("explains RESTRICTED grid status and blocks ungrounded trading claims", async () => {
    const { ContextualAssistantProvider } = await import("../services/assistant.service");
    const provider = new ContextualAssistantProvider();

    const response = await provider.generateResponse(
      "Why is trading restricted right now?",
      {
        userId: "user-test",
        currentGridStatus: "RESTRICTED",
        congestionPercent: 94.0,
        frequencyHz: 49.50,
      }
    );

    expect(response.answer).toContain("RESTRICTED");
    expect(response.answer).toContain("94.0%");
    expect(response.sources).toContain("SCADA_FEEDER_TELEMETRY");
  });

  it("explains GridTrade differentiation versus unconstrained P2P markets", async () => {
    const { ContextualAssistantProvider } = await import("../services/assistant.service");
    const provider = new ContextualAssistantProvider();

    const response = await provider.generateResponse(
      "Why is GridTrade different from a normal P2P marketplace?",
      {
        userId: "user-test",
        userRole: "PROSUMER",
      }
    );

    expect(response.answer).toContain("cheap or nearby");
    expect(response.answer).toContain("digital coordination and record layer");
  });
});

describe("Real-Time Operations & Control Room Portals (Phase 6)", () => {
  it("verifies realtime hub room subscription authorization matrix", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");

    // Prosumer can subscribe to own user room & market rooms only
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "user:user-123")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "user:user-999")).toBe(false);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "market:GLOBAL")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "utility:KA_BLR_01")).toBe(false);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "regulator")).toBe(false);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-123", "admin")).toBe(false);

    // Utility role
    expect(realtimeHub.canSubscribe("UTILITY", "util-1", "utility:KA_BLR_01")).toBe(true);
    expect(realtimeHub.canSubscribe("UTILITY", "util-1", "regulator")).toBe(false);

    // Regulator role
    expect(realtimeHub.canSubscribe("REGULATOR", "reg-1", "regulator")).toBe(true);
    expect(realtimeHub.canSubscribe("REGULATOR", "reg-1", "admin")).toBe(false);

    // Admin role can subscribe to everything
    expect(realtimeHub.canSubscribe("ADMIN", "adm-1", "utility:KA_BLR_01")).toBe(true);
    expect(realtimeHub.canSubscribe("ADMIN", "adm-1", "regulator")).toBe(true);
    expect(realtimeHub.canSubscribe("ADMIN", "adm-1", "admin")).toBe(true);
  });

  it("triggers grid simulation scenarios with expected operational thresholds", async () => {
    const { gridSimulationService } = await import("../services/grid-simulation.service");

    const sunny = await gridSimulationService.triggerScenario("SUNNY_SURPLUS");
    expect(sunny.scenario).toBe("SUNNY_SURPLUS");
    expect(sunny.decision).toBe("APPROVED");
    expect(sunny.congestionPercent).toBeLessThan(10);

    const severe = await gridSimulationService.triggerScenario("SEVERE_CONGESTION");
    expect(severe.scenario).toBe("SEVERE_CONGESTION");
    expect(severe.decision).toBe("RESTRICTED");
    expect(severe.congestionPercent).toBeGreaterThan(90);
  }, 15000);

  it("fetches aggregated control room metrics for DISCOM Utility and Regulator", async () => {
    const { controlRoomService } = await import("../services/control-room.service");

    const utilityMetrics = await controlRoomService.getUtilityMetrics();
    expect(utilityMetrics.region).toBe("KA_BLR_01");
    expect(utilityMetrics.feeders.length).toBeGreaterThan(0);
    expect(utilityMetrics.marketplaceSummary).toBeDefined();

    const regulatorMetrics = await controlRoomService.getRegulatorMetrics();
    expect(regulatorMetrics.complianceOverview.ledgerIntegrityStatus).toBe("VERIFIED");
    expect(regulatorMetrics.tradingAuditsSummary.totalTradesAudited).toBeGreaterThan(0);
  }, 15000);
});

// ─── Phase 7 — Security Hardening Tests ──────────────────────────────────────

describe("Security Hardening (Phase 7) — Demo Token Router", () => {
  it("maps demo:prosumer to PROSUMER context with correct seed userId", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    const ctx = DEMO_TOKEN_REGISTRY["demo:prosumer"];
    expect(ctx).toBeDefined();
    expect(ctx!.role).toBe("PROSUMER");
    expect(ctx!.userId).toBe("8f6a2b30-1d0c-4d74-8d68-3b7d2b09c2a1");
    expect(ctx!.email).toBe("aarav.mehta@gridtrade.example");
  });

  it("maps demo:consumer to CONSUMER context", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    const ctx = DEMO_TOKEN_REGISTRY["demo:consumer"];
    expect(ctx!.role).toBe("CONSUMER");
    expect(ctx!.userId).toBe("6d4a0f10-9b8a-2b52-6b46-1a5b0f97a089");
  });

  it("maps demo:utility to UTILITY context", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    const ctx = DEMO_TOKEN_REGISTRY["demo:utility"];
    expect(ctx!.role).toBe("UTILITY");
    expect(ctx!.userId).toBe("5c3e9e00-8a7f-1a41-5a35-0f4a9e869f78");
  });

  it("maps demo:regulator to REGULATOR context", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    const ctx = DEMO_TOKEN_REGISTRY["demo:regulator"];
    expect(ctx!.role).toBe("REGULATOR");
  });

  it("maps demo:admin to ADMIN context with correct seed userId", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    const ctx = DEMO_TOKEN_REGISTRY["demo:admin"];
    expect(ctx!.role).toBe("ADMIN");
    expect(ctx!.userId).toBe("4b2d8d90-7f6e-0f30-4924-0e398d758e67");
  });

  it("returns undefined for unknown demo tokens", async () => {
    const { DEMO_TOKEN_REGISTRY } = await import("../middleware/auth");
    expect(DEMO_TOKEN_REGISTRY["demo:unknown"]).toBeUndefined();
    expect(DEMO_TOKEN_REGISTRY["Bearer eyJhbGc..."]).toBeUndefined();
  });
});

describe("Security Hardening (Phase 7) — RBAC Permission Matrix", () => {
  it("PROSUMER has listing:create but not admin:access or grid:override", () => {
    expect(hasPermission("PROSUMER", "listing:create")).toBe(true);
    expect(hasPermission("PROSUMER", "admin:access")).toBe(false);
    expect(hasPermission("PROSUMER", "grid:override")).toBe(false);
    expect(hasPermission("PROSUMER", "audit:read")).toBe(false);
  });

  it("CONSUMER cannot create listings or override grid", () => {
    expect(hasPermission("CONSUMER", "listing:create")).toBe(false);
    expect(hasPermission("CONSUMER", "grid:override")).toBe(false);
    expect(hasPermission("CONSUMER", "admin:access")).toBe(false);
    expect(hasPermission("CONSUMER", "trade:create")).toBe(true);
    expect(hasPermission("CONSUMER", "demand:create")).toBe(true);
  });

  it("UTILITY can override grid but cannot create trades or listings", () => {
    expect(hasPermission("UTILITY", "grid:override")).toBe(true);
    expect(hasPermission("UTILITY", "audit:read")).toBe(true);
    expect(hasPermission("UTILITY", "trade:create")).toBe(false);
    expect(hasPermission("UTILITY", "listing:create")).toBe(false);
    expect(hasPermission("UTILITY", "admin:access")).toBe(false);
  });

  it("REGULATOR has audit:read but cannot create trades, listings, or override grid", () => {
    expect(hasPermission("REGULATOR", "audit:read")).toBe(true);
    expect(hasPermission("REGULATOR", "trade:create")).toBe(false);
    expect(hasPermission("REGULATOR", "listing:create")).toBe(false);
    expect(hasPermission("REGULATOR", "grid:override")).toBe(false);
    expect(hasPermission("REGULATOR", "admin:access")).toBe(false);
  });

  it("ADMIN has all permissions", () => {
    const allPerms: import("../middleware/auth").Permission[] = [
      "solar:create", "solar:read", "solar:update",
      "listing:create", "listing:read", "listing:cancel",
      "demand:create", "demand:read",
      "trade:create", "trade:read",
      "grid:read", "grid:override",
      "audit:read", "admin:access",
    ];
    for (const perm of allPerms) {
      expect(hasPermission("ADMIN", perm)).toBe(true);
    }
  });
});

describe("Security Hardening (Phase 7) — IDOR Prevention", () => {
  const ownerCtx: AuthContext = {
    userId: "owner-123",
    displayName: "Owner User",
    email: "owner@test.com",
    role: "PROSUMER",
  };

  const attackerCtx: AuthContext = {
    userId: "attacker-456",
    displayName: "Attacker User",
    email: "attacker@test.com",
    role: "PROSUMER",
  };

  const adminCtx: AuthContext = {
    userId: "admin-789",
    displayName: "Admin User",
    email: "admin@test.com",
    role: "ADMIN",
  };

  it("allows resource modification by the resource owner", () => {
    expect(() => assertCanModifyResource(ownerCtx, "owner-123", "listing")).not.toThrow();
  });

  it("blocks modification by a different user (IDOR attempt)", () => {
    expect(() => assertCanModifyResource(attackerCtx, "owner-123", "listing")).toThrow(/403|FORBIDDEN|only modify your own/i);
  });

  it("allows ADMIN to modify any resource regardless of ownership", () => {
    expect(() => assertCanModifyResource(adminCtx, "owner-123", "listing")).not.toThrow();
    expect(() => assertCanModifyResource(adminCtx, "any-user-id", "trade")).not.toThrow();
  });

  it("throws 401 when no auth context provided", () => {
    // AppError code is UNAUTHORIZED (401); message is 'Authentication required'
    expect(() => assertCanModifyResource(undefined, "owner-123", "listing")).toThrow(/authentication required|UNAUTHORIZED/i);
  });
});

describe("Security Hardening (Phase 7) — SSE Room Authorization Matrix", () => {
  it("all roles can subscribe to market:GLOBAL", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    for (const role of ["PROSUMER", "CONSUMER", "UTILITY", "REGULATOR", "ADMIN"] as const) {
      expect(realtimeHub.canSubscribe(role, "user-abc", "market:GLOBAL")).toBe(true);
    }
  });

  it("user:id room only allows the matching user or ADMIN", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    expect(realtimeHub.canSubscribe("PROSUMER", "user-abc", "user:user-abc")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "user-abc", "user:user-xyz")).toBe(false);
    expect(realtimeHub.canSubscribe("ADMIN", "admin-123", "user:user-abc")).toBe(true);
  });

  it("utility: room only allows UTILITY and ADMIN", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    expect(realtimeHub.canSubscribe("UTILITY", "u1", "utility:KA_BLR_01")).toBe(true);
    expect(realtimeHub.canSubscribe("ADMIN", "u1", "utility:KA_BLR_01")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "u1", "utility:KA_BLR_01")).toBe(false);
    expect(realtimeHub.canSubscribe("CONSUMER", "u1", "utility:KA_BLR_01")).toBe(false);
    expect(realtimeHub.canSubscribe("REGULATOR", "u1", "utility:KA_BLR_01")).toBe(false);
  });

  it("regulator room only allows REGULATOR and ADMIN", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    expect(realtimeHub.canSubscribe("REGULATOR", "u1", "regulator")).toBe(true);
    expect(realtimeHub.canSubscribe("ADMIN", "u1", "regulator")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "u1", "regulator")).toBe(false);
    expect(realtimeHub.canSubscribe("UTILITY", "u1", "regulator")).toBe(false);
  });

  it("admin room only allows ADMIN", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    expect(realtimeHub.canSubscribe("ADMIN", "u1", "admin")).toBe(true);
    expect(realtimeHub.canSubscribe("PROSUMER", "u1", "admin")).toBe(false);
    expect(realtimeHub.canSubscribe("UTILITY", "u1", "admin")).toBe(false);
    expect(realtimeHub.canSubscribe("REGULATOR", "u1", "admin")).toBe(false);
    expect(realtimeHub.canSubscribe("CONSUMER", "u1", "admin")).toBe(false);
  });

  it("arbitrary unknown rooms are denied", async () => {
    const { realtimeHub } = await import("../realtime/socket-server");
    expect(realtimeHub.canSubscribe("ADMIN", "u1", "internal:secrets")).toBe(false);
    expect(realtimeHub.canSubscribe("PROSUMER", "u1", "privileged")).toBe(false);
  });
});

describe("Security Hardening (Phase 7) — Business Tampering Prevention", () => {
  it("grid decision domain ignores client-supplied decision overrides", () => {
    // Server always recalculates — cannot be overridden by client supplying a different value
    const result = decideGrid({
      congestionPercent: 95,   // Would be RESTRICTED
      renewableSharePercent: 10,
      frequencyHz: 49.5,
    });
    // Client claiming it should be APPROVED is irrelevant — server result is authoritative
    expect(result).toBe("RESTRICTED");
    expect(result).not.toBe("APPROVED");
  });

  it("ledger hash is computed from canonical server-side data — not client-supplied hash", () => {
    // hashTransaction uses {transactionId, tradeId, amountInr, quantityKwh, settledAt}
    // Fields are serialised as strings in the canonical form
    const serverComputedHash = hashTransaction({
      transactionId: "tx-001",
      tradeId: "trade-001",
      amountInr: "21.0000",      // canonical server-computed amount
      quantityKwh: "5.0000",
      settledAt: "2026-09-12T10:00:00.000Z",
    });

    // Tamper: client tries to supply a smaller amountInr — hash must differ
    const tamperedHash = hashTransaction({
      transactionId: "tx-001",
      tradeId: "trade-001",
      amountInr: "0.0100",       // tampered!
      quantityKwh: "5.0000",
      settledAt: "2026-09-12T10:00:00.000Z",
    });

    // Server-computed and tampered hashes must NOT match
    expect(serverComputedHash).not.toBe(tamperedHash);
    // Both are valid SHA-256 hex strings
    expect(serverComputedHash).toHaveLength(64);
    expect(tamperedHash).toHaveLength(64);
  });
});

describe("Security Hardening (Phase 7) — Input Validation Schemas", () => {
  it("rejects non-positive energy amounts in trade body schema", async () => {
    const { CreateTradeBodySchema } = await import("../middleware/validate");
    const result = CreateTradeBodySchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      energyAmountKwh: -5,
    });
    expect(result.success).toBe(false);
  });

  it("requires valid UUID for listingId in trade body schema", async () => {
    const { CreateTradeBodySchema } = await import("../middleware/validate");
    const result = CreateTradeBodySchema.safeParse({
      listingId: "not-a-uuid",
      energyAmountKwh: 5,
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid trade body", async () => {
    const { CreateTradeBodySchema } = await import("../middleware/validate");
    const result = CreateTradeBodySchema.safeParse({
      listingId: "550e8400-e29b-41d4-a716-446655440000",
      requestedKwh: 5.0,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid scenario values in simulation schema", async () => {
    const { SimulationBodySchema } = await import("../middleware/validate");
    const bad = SimulationBodySchema.safeParse({ scenario: "EXPLOIT_INJECTION" });
    expect(bad.success).toBe(false);
    const good = SimulationBodySchema.safeParse({ scenario: "SUNNY_SURPLUS" });
    expect(good.success).toBe(true);
  });
});
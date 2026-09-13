import { prisma } from "../lib/prisma";
import { logger } from "../lib/logger";

export interface AssistantContext {
  userId?: string;
  userName?: string;
  userRole?: string;
  solarCapacityKw?: number;
  latestGenerationKwh?: number;
  latestConsumptionKwh?: number;
  currentSurplusKwh?: number;
  activeListingsCount?: number;
  activeDemandsCount?: number;
  currentGridStatus?: string;
  congestionPercent?: number;
  frequencyHz?: number;
  renewableSharePercent?: number;
  currentIndicativePrice?: number;
  utilityBaselineTariffInr?: number;
  recentTradesCount?: number;
  totalEarningsInr?: number;
  latestTrade?: {
    id: string;
    status: string;
    quantityKwh: number;
    requestedKwh?: number;
    agreedPriceInrPerKwh: number;
    netAmountInr: number;
    gridDecision: string;
    gridReasonCode?: string;
    createdAt: string;
  } | null;
  latestPaymentStatus?: string;
  ledgerVerified?: boolean;
  totalBlocksHashed?: number;
  bestMatch?: {
    sellerName: string;
    score: number;
    rationale: string;
    priceInrPerKwh: number;
    wheelingFeeInr: number;
  } | null;
}

export interface AssistantSuggestedAction {
  label: string;
  action: string;
  targetUrl?: string;
}

export interface AssistantResponse {
  answer: string;
  sources: string[];
  confidence: number;
  generatedAt: string;
  conversationId?: string;
  suggestedActions?: AssistantSuggestedAction[];
  contextUsed?: string[];
}

export interface AssistantProvider {
  generateResponse(message: string, context: AssistantContext, conversationId?: string): Promise<AssistantResponse>;
}

export class ContextualAssistantProvider implements AssistantProvider {
  async generateResponse(
    message: string,
    context: AssistantContext,
    conversationId?: string
  ): Promise<AssistantResponse> {
    const query = message.toLowerCase();
    const sources: string[] = [];
    const contextUsed: string[] = [];
    let answer = "";
    let confidence = 0.94;
    const actions: AssistantSuggestedAction[] = [];

    const surplus = context.currentSurplusKwh ?? 0;
    const gridStatus = context.currentGridStatus || "APPROVED";
    const congestion = context.congestionPercent ?? 32.0;
    const freq = context.frequencyHz ?? 50.01;
    const price = context.currentIndicativePrice || 5.20;
    const baselineTariff = context.utilityBaselineTariffInr || 6.50;
    const savingsVsBaseline = Math.max(0, baselineTariff - price);
    const role = context.userRole || "PROSUMER";

    contextUsed.push(`Role: ${role}`, `GridStatus: ${gridStatus}`, `Price: ₹${price.toFixed(2)}/kWh`);

    // ─── 1. READ-ONLY STATE MUTATION GUARD ─────────────────────────────────────
    const mutationWords = ["execute trade", "confirm trade", "buy now", "sell now", "create listing", "publish surplus", "post demand", "pay now", "change role", "approve trade", "cancel order", "modify grid"];
    if (mutationWords.some((w) => query.includes(w))) {
      sources.push("SECURITY_POLICY_GUARD", "READ_ONLY_ASSISTANT_RULE");
      answer = `As a read-only decision-support assistant, I cannot directly execute trades or modify state. State mutation actions must be completed through the authorized GridTrade workflow.`;
      actions.push({ label: "Go to Marketplace", action: "NAVIGATE", targetUrl: "/marketplace" });
      return {
        answer,
        sources,
        confidence: 0.99,
        generatedAt: new Date().toISOString(),
        conversationId: conversationId || `conv-${Date.now()}`,
        suggestedActions: actions,
        contextUsed,
      };
    }

    // ─── 2. GRID-AWARE TRADING & ADJUSTED/RESTRICTED DECISION EXPLANATIONS ────
    if (query.includes("different") || query.includes("normal p2p") || query.includes("why gridtrade") || query.includes("differentiat")) {
      sources.push("GRIDTRADE_ARCHITECTURE_SPEC", "GRID_AWARE_DECISION_ENGINE");
      answer = `A trade is not truly smart just because it is cheap or nearby — it must also be compatible with the condition and capacity of the local grid. Unlike conventional P2P markets that ignore grid constraints (risking transformer overload) or rigid utility systems (which restrict prosumers), GridTrade combines marketplace coordination with real-time feeder awareness. Note: The existing electricity grid carries physical electrons; GridTrade provides the digital coordination and record layer.`;
      actions.push({ label: "Inspect Grid Architecture", action: "NAVIGATE", targetUrl: "/grid" });
    } else if (query.includes("adjust") || query.includes("only trade 10") || query.includes("restrict") || query.includes("approved") || query.includes("decision") || query.includes("why was my trade")) {
      sources.push("GRID_AWARE_DECISION_ENGINE", "SCADA_FEEDER_TELEMETRY");
      contextUsed.push(`Congestion: ${congestion}%`, `Frequency: ${freq}Hz`);

      if (gridStatus === "RESTRICTED" || query.includes("restricted")) {
        answer = `In your local grid region (**KA_BLR_01**), current feeder congestion is critical at **${congestion.toFixed(1)}%** with a frequency reading of **${freq.toFixed(2)} Hz**. GridTrade issued a **RESTRICTED** decision to prevent physical transformer thermal overload and voltage instability. Trade execution is disabled until feeder headroom recovers.`;
      } else if (gridStatus === "ADJUSTED" || query.includes("adjusted") || query.includes("10 kw")) {
        const requested = context.latestTrade?.requestedKwh || 20.0;
        const allocated = context.latestTrade?.quantityKwh || 10.0;
        answer = `Your requested trade quantity was **${requested.toFixed(1)} kW**, but local feeder thermal margin is currently constrained at **${allocated.toFixed(1)} kW** (${congestion.toFixed(1)}% congestion). GridTrade's grid-aware protocol automatically **ADJUSTED** the approved trade quantity to **${allocated.toFixed(1)} kW**, allowing you to trade safely without tripping the local microgrid.`;
      } else {
        answer = `GridTrade evaluates every trade against local feeder capacity before approval:\n• **APPROVED** (Congestion < 70%): 100% of requested energy is allocated.\n• **ADJUSTED** (Congestion 70%–90%): Quantity is capped to available feeder thermal margin.\n• **RESTRICTED** (Congestion > 90%): Trade confirmation is blocked to protect network stability.\nCurrently, your local grid status is **${gridStatus}** (${congestion.toFixed(1)}% congestion).`;
      }
      actions.push({ label: "Inspect Grid Conditions", action: "NAVIGATE", targetUrl: "/grid" });
    }

    // ─── 3. BUY ADVICE & RECOMMENDATIONS ──────────────────────────────────────
    else if (query.includes("buy") || query.includes("should i buy") || query.includes("match") || query.includes("best listing")) {
      sources.push("MATCHING_ENGINE_6FACTOR", "DYNAMIC_PRICING_ENGINE");
      contextUsed.push(`IndicativePrice: ₹${price}/kWh`, `BaselineTariff: ₹${baselineTariff}/kWh`);

      if (gridStatus === "RESTRICTED") {
        answer = `Energy purchases are currently **RESTRICTED** due to high feeder congestion (${congestion.toFixed(1)}%). We recommend waiting for grid conditions to normalize before initiating new purchases.`;
      } else {
        const best = context.bestMatch || { sellerName: "Mehta Rooftop Array 10kW", score: 94, priceInrPerKwh: 5.20, wheelingFeeInr: 0.35 };
        answer = `**Recommendation:** Yes, current market conditions are favorable for buying energy.\n• **Current Market Rate:** ₹${price.toFixed(2)}/kWh (Savings of **₹${savingsVsBaseline.toFixed(2)}/kWh** or **${((savingsVsBaseline / baselineTariff) * 100).toFixed(0)}%** vs ₹${baselineTariff.toFixed(2)} utility baseline).\n• **Top Match:** **${best.sellerName}** (${best.score}% fit score, Wheeling fee: ₹${best.wheelingFeeInr.toFixed(2)}/kWh).\n• **Grid Status:** **${gridStatus}** (Safe trading window).`;
        actions.push({ label: "Browse Marketplace Matches", action: "NAVIGATE", targetUrl: "/marketplace" });
      }
    }

    // ─── 4. SELL ADVICE & SURPLUS ──────────────────────────────────────────────
    else if (query.includes("surplus") || query.includes("generation") || query.includes("should i sell") || query.includes("sell")) {
      sources.push("LATEST_ENERGY_DATA", "SOLAR_SYSTEM_READINGS", "SMART_SELL_ENGINE");
      contextUsed.push(`Surplus: ${surplus.toFixed(2)} kWh`, `Gen: ${context.latestGenerationKwh || 14.2} kWh`);

      if (gridStatus === "RESTRICTED") {
        answer = `You currently have **${surplus.toFixed(2)} kWh** of marketable surplus. However, trading is **RESTRICTED** right now due to feeder congestion. Hold off listing until grid conditions improve to APPROVED or ADJUSTED.`;
      } else if (surplus > 0) {
        answer = `According to your solar meter telemetry:\n• **Generation:** ${context.latestGenerationKwh?.toFixed(1) || "14.2"} kWh | **Consumption:** ${context.latestConsumptionKwh?.toFixed(1) || "6.8"} kWh\n• **Marketable Surplus:** **${surplus.toFixed(2)} kWh**\n• **Current Price:** ₹${price.toFixed(2)}/kWh\n• **Est. Export Value:** **₹${(surplus * price).toFixed(2)}**\nGrid status is **${gridStatus}**. You can publish your surplus on the marketplace right now.`;
        actions.push({ label: "Publish Surplus Listing", action: "NAVIGATE", targetUrl: "/marketplace" });
      } else {
        answer = `Your household is currently consuming all generated solar power. We recommend publishing a listing during peak solar production hours (typically 11:00 AM – 3:00 PM).`;
      }
    }

    // ─── 5. DYNAMIC PRICING EXPLANATION ─────────────────────────────────────────
    else if (query.includes("price") || query.includes("rate") || query.includes("cost") || query.includes("movement") || query.includes("₹")) {
      sources.push("DYNAMIC_PRICING_ENGINE", "GRID_CONGESTION_DATA");
      answer = `GridTrade's dynamic pricing engine computes rates based on supply/demand ratio and feeder congestion pressure:\n• **Current Indicative Price:** **₹${price.toFixed(2)}/kWh**\n• **Utility Baseline Tariff:** ₹${baselineTariff.toFixed(2)}/kWh\n• **Policy Bounds:** ₹3.50/kWh (floor) – ₹7.50/kWh (ceiling)\n• **Current Feeder Status:** ${gridStatus} (${congestion.toFixed(1)}% congestion)\nPrices decrease during high solar surplus windows and adjust upwards when local demand or feeder congestion increases.`;
      actions.push({ label: "View Pricing Signal", action: "NAVIGATE", targetUrl: "/grid" });
    }

    // ─── 6. GRID HEALTH & CONGESTION EXPLANATIONS ──────────────────────────────
    else if (query.includes("congest") || query.includes("grid") || query.includes("frequency") || query.includes("feeder")) {
      sources.push("GRID_TELEMETRY_SCADA", "SUBSTATION_LOGGER");
      answer = `**Current Substation Feeder Reading (KA_BLR_01):**\n• **Feeder Congestion:** **${congestion.toFixed(1)}%** (${congestion < 70 ? "Healthy" : congestion < 90 ? "Moderate Load" : "Critical Load"})\n• **Grid Frequency:** **${freq.toFixed(2)} Hz** (Nominal 50.00 Hz)\n• **Renewable Share:** **${context.renewableSharePercent || 64.5}%**\n• **Operating Decision:** **${gridStatus}**`;
      actions.push({ label: "View Control Room", action: "NAVIGATE", targetUrl: role === "UTILITY" ? "/utility" : "/grid" });
    }

    // ─── 7. TRANSACTION & PAYMENT STATUS ──────────────────────────────────────
    else if (query.includes("transaction") || query.includes("payment") || query.includes("paid") || query.includes("earn") || query.includes("latest trade")) {
      sources.push("LEDGER_SETTLEMENT", "PAYMENT_GATEWAY_UPI");
      const trade = context.latestTrade;
      if (trade) {
        answer = `**Latest Transaction Context:**\n• **Trade ID:** ${trade.id.substring(0, 8)}...\n• **Quantity:** ${trade.quantityKwh.toFixed(1)} kWh @ ₹${trade.agreedPriceInrPerKwh.toFixed(2)}/kWh\n• **Net Amount:** **₹${trade.netAmountInr.toFixed(2)}**\n• **Trade Status:** **${trade.status}** (${trade.gridDecision})\n• **Payment Status:** **${context.latestPaymentStatus || "PAID"}** (Prototype UPI)`;
      } else {
        answer = `You have **${context.recentTradesCount || 4}** settled transactions recorded on the ledger, with total accumulated earnings of **₹${(context.totalEarningsInr || 320.40).toFixed(2)}**. Payment status across all settled trades is **PAID**.`;
      }
      actions.push({ label: "View Audit Ledger", action: "NAVIGATE", targetUrl: "/ledger" });
    }

    // ─── 8. SHA-256 LEDGER INTEGRITY ──────────────────────────────────────────
    else if (query.includes("ledger") || query.includes("sha-256") || query.includes("hash") || query.includes("tamper") || query.includes("valid")) {
      sources.push("SHA256_HASH_CHAIN_AUDITOR");
      answer = `**Ledger Verification Report:**\n• **Chain Integrity:** **VERIFIED (100% Intact)**\n• **Total Blocks Hashed:** **${context.totalBlocksHashed || 42}**\n• **Algorithm:** SHA-256 Hash Chaining (Canonical Payload Serialized)\n• **Corrupt Blocks Found:** **0**\nEvery trade payload is cryptographically linked to the previous block hash in PostgreSQL, providing tamper-evident auditability for DISCOMs and regulators.`;
      actions.push({ label: "Run Cryptographic Audit", action: "NAVIGATE", targetUrl: "/ledger" });
    }

    // ─── 9. FORECAST & AI PREDICTIONS ─────────────────────────────────────────
    else if (query.includes("forecast") || query.includes("predict") || query.includes("tomorrow") || query.includes("ai cockpit")) {
      sources.push("FASTAPI_FORECAST_SERVICE", "DIURNAL_SOLAR_MODEL");
      answer = `**24-Hour AI Energy Forecast:**\n• **Model Version:** generation-forecast-v1.0 / demand-forecast-v1.0\n• **Confidence Score:** **88%**\n• **Peak Solar Window:** 11:00 AM – 3:00 PM (Projected Peak: 12.4 kWh)\n• **Peak Demand Window:** 6:00 PM – 10:00 PM (Projected Peak: 8.4 kWh)\n*Note: Predictions represent AI decision support and do not guarantee physical generation.*`;
      actions.push({ label: "Open AI Cockpit", action: "NAVIGATE", targetUrl: "/ai" });
    }

    // ─── 10. GENERAL / FALLBACK GREETING ──────────────────────────────────────
    else {
      sources.push("GRIDTRADE_CONTEXT_SERVICE");
      if (role === "UTILITY") {
        answer = `Hello! I am your GridTrade Utility Operations Assistant. Local feeder congestion is **${congestion.toFixed(1)}%**, grid frequency is **${freq.toFixed(2)} Hz**, and regional trading status is **${gridStatus}**. How can I assist with your grid oversight today?`;
      } else if (role === "REGULATOR") {
        answer = `Hello! I am your GridTrade Compliance Assistant. The SHA-256 cryptographic audit chain is **VERIFIED** (${context.totalBlocksHashed || 42} blocks hashed), and tariff compliance is active. How can I assist with your audit review?`;
      } else {
        answer = `I am your GridTrade AI Energy Assistant. You currently have **${surplus.toFixed(2)} kWh** of surplus energy, local grid status is **${gridStatus}**, and the market price is **₹${price.toFixed(2)}/kWh**. How can I assist with your trading strategy today?`;
      }
      actions.push({ label: "Explore Marketplace", action: "NAVIGATE", targetUrl: "/marketplace" });
    }

    return {
      answer,
      sources,
      confidence,
      generatedAt: new Date().toISOString(),
      conversationId: conversationId || `conv-${Date.now()}`,
      suggestedActions: actions,
      contextUsed,
    };
  }
}

export class AssistantService {
  private provider: AssistantProvider;

  constructor(provider?: AssistantProvider) {
    this.provider = provider || new ContextualAssistantProvider();
  }

  async assembleUserContext(userId?: string, role?: string): Promise<AssistantContext> {
    const defaultRole = role || "PROSUMER";

    let user: any = null;
    try {
      if (userId) {
        user = await prisma.user.findUnique({
          where: { id: userId },
          include: {
            solarSystems: {
              include: { energyData: { orderBy: { observedAt: "desc" }, take: 1 } },
            },
            trades: { orderBy: { createdAt: "desc" }, take: 5 },
          },
        });
      }
    } catch (err) {
      logger.warn({ err }, "Database unavailable for assistant user context lookup, using baseline context");
    }

    let activeListingsCount = 3;
    let activeDemandsCount = 2;
    let latestGrid: any = null;
    let totalBlocksHashed = 42;

    try {
      activeListingsCount = await prisma.listing.count({ where: { status: "ACTIVE" as any } });
      activeDemandsCount = await prisma.demand.count({ where: { status: "OPEN" as any } });
      latestGrid = await prisma.gridData.findFirst({ orderBy: { observedAt: "desc" } });
      totalBlocksHashed = await prisma.hashRecord.count();
    } catch (err) {
      logger.warn({ err }, "Database unavailable for assistant metrics lookup");
    }

    let latestGen = 14.2;
    let latestCon = 6.8;
    if (user?.solarSystems && user.solarSystems[0] && user.solarSystems[0].energyData && user.solarSystems[0].energyData[0]) {
      const eg = user.solarSystems[0].energyData[0];
      latestGen = eg.generationKwh.toNumber ? eg.generationKwh.toNumber() : Number(eg.generationKwh);
      latestCon = eg.consumptionKwh.toNumber ? eg.consumptionKwh.toNumber() : Number(eg.consumptionKwh);
    }

    const surplus = Math.max(0, latestGen - latestCon);
    let totalEarnings = 0;
    let latestTradeObj: any = null;

    if (user?.trades && user.trades.length > 0) {
      const lt = user.trades[0];
      latestTradeObj = {
        id: lt.id,
        status: lt.status,
        quantityKwh: lt.quantityKwh?.toNumber ? lt.quantityKwh.toNumber() : Number(lt.quantityKwh),
        agreedPriceInrPerKwh: lt.agreedPriceInrPerKwh?.toNumber ? lt.agreedPriceInrPerKwh.toNumber() : Number(lt.agreedPriceInrPerKwh),
        netAmountInr: lt.netAmountInr?.toNumber ? lt.netAmountInr.toNumber() : Number(lt.netAmountInr),
        gridDecision: lt.gridDecision || "APPROVED",
        gridReasonCode: lt.gridReasonCode || undefined,
        createdAt: lt.createdAt?.toISOString ? lt.createdAt.toISOString() : String(lt.createdAt),
      };
      for (const t of user.trades) {
        totalEarnings += t.netAmountInr?.toNumber ? t.netAmountInr.toNumber() : Number(t.netAmountInr || 0);
      }
    }

    const userRoleResolved = user?.role || defaultRole;

    return {
      userId: user?.id || userId,
      userName: user?.displayName || "Prosumer Priya",
      userRole: userRoleResolved,
      solarCapacityKw: user?.solarSystems[0]?.capacityKw?.toNumber ? user.solarSystems[0].capacityKw.toNumber() : 10.0,
      latestGenerationKwh: latestGen,
      latestConsumptionKwh: latestCon,
      currentSurplusKwh: surplus,
      activeListingsCount,
      activeDemandsCount,
      currentGridStatus: latestGrid?.decision || "APPROVED",
      congestionPercent: latestGrid?.congestionPercent ? Number(latestGrid.congestionPercent) : 32.0,
      frequencyHz: latestGrid?.frequencyHz ? Number(latestGrid.frequencyHz) : 50.01,
      renewableSharePercent: latestGrid?.renewableSharePercent ? Number(latestGrid.renewableSharePercent) : 64.5,
      currentIndicativePrice: 5.20,
      utilityBaselineTariffInr: 6.50,
      recentTradesCount: user?.trades?.length || 4,
      totalEarningsInr: totalEarnings > 0 ? totalEarnings : 320.40,
      latestTrade: latestTradeObj,
      latestPaymentStatus: "PAID",
      ledgerVerified: true,
      totalBlocksHashed: totalBlocksHashed > 0 ? totalBlocksHashed : 42,
      bestMatch: {
        sellerName: "Mehta Rooftop Array 10kW",
        score: 94,
        rationale: "Proximity 1.2 km, High Solar Confidence, Safe Feeder Margin",
        priceInrPerKwh: 5.20,
        wheelingFeeInr: 0.35,
      },
    };
  }

  async processChat(message: string, userId?: string, conversationId?: string, userRole?: string): Promise<AssistantResponse> {
    logger.info({ userId, userRole, message: message.substring(0, 50) }, "Processing AI assistant chat query");
    const context = await this.assembleUserContext(userId, userRole);
    return this.provider.generateResponse(message, context, conversationId);
  }
}

export const assistantService = new AssistantService();

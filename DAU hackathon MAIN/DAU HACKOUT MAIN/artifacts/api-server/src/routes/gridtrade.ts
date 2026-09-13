import { Router, type IRouter } from "express";
import { getDashboardSummary } from "../controllers/dashboard.controller";
import { getActivityFeed, getEnergyData } from "../controllers/activity.controller";
import { listSolarSystems, createSolarSystem } from "../controllers/solar.controller";
import {
  listListings,
  getListingById,
  createListing,
  closeListing,
  cancelListing,
} from "../controllers/marketplace.controller";
import {
  listDemands,
  getDemandById,
  createDemand,
  cancelDemand,
} from "../controllers/demand.controller";
import { getGridStatus, listGridAreas, getGridAreaStatus } from "../controllers/grid.controller";
import { getCurrentPrice, getPriceQuote } from "../controllers/pricing.controller";
import {
  getMatchRecommendations,
  recommendMatches,
  getTradePreview,
} from "../controllers/matching.controller";
import { createTrade, listTrades, getTradeById } from "../controllers/trade.controller";
import {
  listTransactions,
  getTransactionById,
  verifyTransaction,
  verifyLedger,
} from "../controllers/transaction.controller";
import {
  createPaymentForTransaction,
  getPaymentForTransaction,
  handlePaymentWebhook,
} from "../controllers/payment.controller";
import {
  getAiHealth,
  listPredictions,
  generateGenerationForecast,
  generateDemandForecast,
  generatePriceSignal,
} from "../controllers/prediction.controller";
import {
  getSmartSellRecommendations,
  getSmartBuyRecommendations,
  dismissRecommendation,
} from "../controllers/recommendation.controller";
import {
  listAnomalies,
  reviewAnomaly,
  detectAnomaly,
} from "../controllers/anomaly.controller";
import {
  chatAssistant,
  getAssistantContext,
} from "../controllers/assistant.controller";
import {
  handleRealtimeStream,
  handleTriggerSimulation,
  handleGetUtilityDashboard,
  handleGetAdminDashboard,
  handleGetRegulatorDashboard,
  handleGetAlerts,
  handleAcknowledgeAlert,
} from "../controllers/operations.controller";
import { getAuthSession } from "../controllers/auth.controller";
import { requirePermission } from "../middleware/auth";
import { simulationRateLimit, paymentRateLimit, assistantRateLimit, predictionRateLimit } from "../middleware/security";

const router: IRouter = Router();

// Dashboard & Activity
router.get("/v1/dashboard/summary", getDashboardSummary);
router.get("/v1/activity", getActivityFeed);

// Solar Systems
router.get("/v1/solar-systems", listSolarSystems);
router.post("/v1/solar-systems", requirePermission("solar:create"), createSolarSystem);
router.get("/v1/energy-data", getEnergyData);

// Marketplace Listings
router.get("/v1/listings", listListings);
router.post("/v1/listings", requirePermission("listing:create"), createListing);
router.get("/v1/listings/:id", getListingById);
router.post("/v1/listings/:id/close", requirePermission("listing:cancel"), closeListing);
router.post("/v1/listings/:id/cancel", requirePermission("listing:cancel"), cancelListing);

// Consumer Demands
router.get("/v1/demands", listDemands);
router.post("/v1/demands", requirePermission("demand:create"), createDemand);
router.get("/v1/demands/:id", getDemandById);
router.post("/v1/demands/:id/cancel", cancelDemand);

// Dynamic Pricing Engine
router.get("/v1/pricing/current", getCurrentPrice);
router.post("/v1/pricing/quote", getPriceQuote);

// Grid Status & Grid Areas
router.get("/v1/grid/status", getGridStatus);
router.get("/v1/grid/areas", listGridAreas);
router.get("/v1/grid/areas/:areaId/status", getGridAreaStatus);

// Matching Engine & Pre-Execution Trade Preview
router.get("/v1/matching/recommendations", getMatchRecommendations);
router.post("/v1/matching/recommend", recommendMatches);
router.get("/v1/matching/trade-preview", getTradePreview);
router.post("/v1/matching/trade-preview", getTradePreview);

// Trade Execution & History
router.post("/v1/trades", requirePermission("trade:create"), createTrade);
router.get("/v1/trades", listTrades);
router.get("/v1/trades/:id", getTradeById);

// Transactions & SHA-256 Ledger Verification
router.get("/v1/transactions", listTransactions);
router.get("/v1/transactions/ledger/verify", verifyLedger);
router.get("/v1/transactions/:id", getTransactionById);
router.get("/v1/transactions/:id/verify", verifyTransaction);

// Payments & Webhooks
router.post("/v1/transactions/:id/payment", paymentRateLimit, createPaymentForTransaction);
router.get("/v1/transactions/:id/payment", getPaymentForTransaction);
router.post("/v1/payments/webhook/:provider", handlePaymentWebhook);

// AI Intelligence Layer (Forecasting, Recommendations, Anomalies, Assistant)
router.get("/v1/ai/health", getAiHealth);
router.get("/v1/ai/predictions", listPredictions);
router.post("/v1/ai/predictions/generation", predictionRateLimit, generateGenerationForecast);
router.post("/v1/ai/predictions/demand", predictionRateLimit, generateDemandForecast);
router.post("/v1/ai/predictions/price", predictionRateLimit, generatePriceSignal);

router.get("/v1/recommendations/smart-sell", getSmartSellRecommendations);
router.get("/v1/recommendations/smart-buy", getSmartBuyRecommendations);
router.post("/v1/recommendations/:id/dismiss", dismissRecommendation);

router.get("/v1/ai/anomalies", listAnomalies);
router.post("/v1/ai/anomalies/detect", detectAnomaly);
router.post("/v1/ai/anomalies/:id/review", reviewAnomaly);

router.post("/v1/assistant/chat", assistantRateLimit, chatAssistant);
router.get("/v1/assistant/context", getAssistantContext);

// Auth Session
router.get("/v1/auth/session", getAuthSession);

// Real-Time Operations & Control Room Portals
router.get("/v1/operations/realtime/stream", handleRealtimeStream);
router.post("/v1/operations/simulation/trigger", simulationRateLimit, handleTriggerSimulation);
router.get("/v1/operations/utility/dashboard", handleGetUtilityDashboard);
router.get("/v1/operations/admin/dashboard", handleGetAdminDashboard);
router.get("/v1/operations/regulator/dashboard", handleGetRegulatorDashboard);
router.get("/v1/operations/alerts", handleGetAlerts);
router.post("/v1/operations/alerts/:id/acknowledge", handleAcknowledgeAlert);

export default router;
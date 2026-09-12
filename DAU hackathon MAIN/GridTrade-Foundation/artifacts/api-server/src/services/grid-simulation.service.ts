import { prisma } from "@workspace/db";
import { realtimeHub } from "../realtime/socket-server";
import { logger } from "../lib/logger";

export type SimulationScenario =
  | "SUNNY_SURPLUS"
  | "HIGH_DEMAND"
  | "MODERATE_CONGESTION"
  | "SEVERE_CONGESTION"
  | "BALANCED";

export interface SimulationState {
  scenario: SimulationScenario;
  region: string;
  observedAt: Date;
  congestionPercent: number;
  renewableSharePercent: number;
  frequencyHz: number;
  decision: "APPROVED" | "ADJUSTED" | "RESTRICTED";
  recommendedPriceInr: number;
  activeAlertsCount: number;
}

class GridSimulationService {
  private currentScenario: SimulationScenario = "BALANCED";

  public getScenarioState(scenario: SimulationScenario, region = "KA_BLR_01"): SimulationState {
    const now = new Date();
    switch (scenario) {
      case "SUNNY_SURPLUS":
        return {
          scenario,
          region,
          observedAt: now,
          congestionPercent: 8.5,
          renewableSharePercent: 88.2,
          frequencyHz: 50.02,
          decision: "APPROVED",
          recommendedPriceInr: 3.20,
          activeAlertsCount: 0
        };
      case "HIGH_DEMAND":
        return {
          scenario,
          region,
          observedAt: now,
          congestionPercent: 78.4,
          renewableSharePercent: 32.1,
          frequencyHz: 49.88,
          decision: "ADJUSTED",
          recommendedPriceInr: 7.50,
          activeAlertsCount: 2
        };
      case "MODERATE_CONGESTION":
        return {
          scenario,
          region,
          observedAt: now,
          congestionPercent: 46.2,
          renewableSharePercent: 54.0,
          frequencyHz: 49.95,
          decision: "ADJUSTED",
          recommendedPriceInr: 4.80,
          activeAlertsCount: 1
        };
      case "SEVERE_CONGESTION":
        return {
          scenario,
          region,
          observedAt: now,
          congestionPercent: 94.8,
          renewableSharePercent: 21.5,
          frequencyHz: 49.72,
          decision: "RESTRICTED",
          recommendedPriceInr: 9.80,
          activeAlertsCount: 4
        };
      case "BALANCED":
      default:
        return {
          scenario: "BALANCED",
          region,
          observedAt: now,
          congestionPercent: 18.2,
          renewableSharePercent: 62.4,
          frequencyHz: 50.00,
          decision: "APPROVED",
          recommendedPriceInr: 4.20,
          activeAlertsCount: 0
        };
    }
  }

  public async triggerScenario(scenario: SimulationScenario, region = "KA_BLR_01"): Promise<SimulationState> {
    this.currentScenario = scenario;
    const state = this.getScenarioState(scenario, region);

    // Save grid snapshot to Postgres if database is connected
    try {
      if (prisma && prisma.gridData && process.env.NODE_ENV !== "test") {
        await prisma.gridData.create({
          data: {
            region: state.region,
            observedAt: state.observedAt,
            congestionPercent: state.congestionPercent,
            renewableSharePercent: state.renewableSharePercent,
            frequencyHz: state.frequencyHz,
            decision: state.decision as any
          }
        });
      }
    } catch (err) {
      logger.warn({ err }, "Database record save skipped during grid simulation trigger");
    }

    // Broadcast simulation change over realtime hub
    realtimeHub.broadcastToRoom(`utility:${region}`, "simulation:changed", state);
    realtimeHub.broadcastToRoom("market:GLOBAL", "grid:status_updated", state);
    realtimeHub.broadcastToRoom("regulator", "grid:status_updated", state);

    // Create system alert if severe or high demand
    if (scenario === "SEVERE_CONGESTION" || scenario === "HIGH_DEMAND") {
      const alertPayload = {
        type: scenario === "SEVERE_CONGESTION" ? "THERMAL_OVERLOAD" : "HIGH_DEMAND_WARNING",
        severity: scenario === "SEVERE_CONGESTION" ? "CRITICAL" : "WARNING",
        message: `Grid simulation triggered ${scenario} in region ${region}. Congestion at ${state.congestionPercent}%.`,
        createdAt: new Date().toISOString()
      };

      try {
        if (prisma && prisma.alert && process.env.NODE_ENV !== "test") {
          await prisma.alert.create({
            data: {
              type: alertPayload.type,
              severity: alertPayload.severity as any,
              message: alertPayload.message
            }
          });
        }
      } catch (err) {
        logger.warn({ err }, "Alert save skipped in database");
      }

      realtimeHub.broadcastToRoom(`utility:${region}`, "alert:new", alertPayload);
      realtimeHub.broadcastToRoom("regulator", "alert:new", alertPayload);
    }

    logger.info({ scenario, region }, "Triggered grid simulation scenario");
    return state;
  }

  public getCurrentState(region = "KA_BLR_01"): SimulationState {
    return this.getScenarioState(this.currentScenario, region);
  }
}

export const gridSimulationService = new GridSimulationService();

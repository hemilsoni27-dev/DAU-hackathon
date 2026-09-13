/**
 * Demo Mode Routes — development/demo only.
 *
 * SECURITY: All routes in this file check NODE_ENV and DEMO_MODE environment
 * variables and return 404 in production to prevent any demo operations from
 * being executed against production data.
 */
import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function guardDemoMode(res: any): boolean {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.DEMO_MODE !== "true"
  ) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Route not found.",
      },
    });
    return false;
  }
  return true;
}

/**
 * POST /api/demo/reset
 * Resets demo data by re-running the seed script.
 * BLOCKED in production (returns 404).
 */
router.post("/reset", async (_req, res) => {
  if (!guardDemoMode(res)) return;

  try {
    logger.info("Demo reset triggered via API");
    // Dynamic import to avoid loading in production bundles
    const { execSync } = await import("node:child_process");
    execSync("pnpm db:seed", {
      cwd: process.cwd().includes("artifacts") 
        ? process.cwd().replace(/artifacts.*/, "").replace(/\/$/, "")
        : process.cwd(),
      stdio: "pipe",
      timeout: 30_000,
    });
    res.json({
      success: true,
      message: "Demo data reset complete. Seed scenarios restored.",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    logger.error({ err }, "Demo reset failed");
    res.status(500).json({
      error: {
        code: "DEMO_RESET_FAILED",
        message: `Demo reset failed: ${err.message}`,
      },
    });
  }
});

/**
 * GET /api/demo/users
 * Returns the demo user credentials (tokens + roles) for use by the Demo Panel.
 * BLOCKED in production.
 */
router.get("/users", (req, res) => {
  if (!guardDemoMode(res)) return;

  res.json({
    users: [
      {
        key: "demo:prosumer",
        role: "PROSUMER",
        displayName: "Aarav Mehta",
        email: "aarav.mehta@gridtrade.example",
        token: "demo:prosumer",
      },
      {
        key: "demo:consumer",
        role: "CONSUMER",
        displayName: "Rohit Verma",
        email: "rohit.verma@gridtrade.example",
        token: "demo:consumer",
      },
      {
        key: "demo:utility",
        role: "UTILITY",
        displayName: "State Grid Control",
        email: "gridops@stateutility.example",
        token: "demo:utility",
      },
      {
        key: "demo:regulator",
        role: "REGULATOR",
        displayName: "Central Electricity Regulator",
        email: "cer@regulators.example",
        token: "demo:regulator",
      },
      {
        key: "demo:admin",
        role: "ADMIN",
        displayName: "Platform Admin",
        email: "admin@gridtrade.example",
        token: "demo:admin",
      },
    ],
  });
});

/**
 * GET /api/demo/scenarios
 * Returns available demo scenario descriptors.
 * BLOCKED in production.
 */
router.get("/scenarios", (req, res) => {
  if (!guardDemoMode(res)) return;

  res.json({
    scenarios: [
      {
        key: "SUNNY_SURPLUS",
        label: "☀️ Sunny Surplus",
        description: "Optimal conditions: low congestion, low price, APPROVED trades",
        congestion: "8.5%",
        decision: "APPROVED",
      },
      {
        key: "HIGH_DEMAND",
        label: "⚡ High Demand",
        description: "Peak load: elevated prices, ADJUSTED quantities",
        congestion: "78.4%",
        decision: "ADJUSTED",
      },
      {
        key: "MODERATE_CONGESTION",
        label: "🔶 Moderate Congestion",
        description: "Grid under stress: adjusted quantities, moderate price premium",
        congestion: "46.2%",
        decision: "ADJUSTED",
      },
      {
        key: "SEVERE_CONGESTION",
        label: "🚨 Severe Congestion",
        description: "Grid critical: trades restricted, alerts generated",
        congestion: "94.8%",
        decision: "RESTRICTED",
      },
      {
        key: "BALANCED",
        label: "✅ Balanced",
        description: "Nominal operations: stable price, APPROVED trades",
        congestion: "18.2%",
        decision: "APPROVED",
      },
    ],
  });
});

export default router;

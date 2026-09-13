import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { prisma } from "../lib/prisma";
import { redisCoordinator } from "../infra/redis";

const router: IRouter = Router();

/** /healthz — liveness: confirms the process is alive */
router.get("/healthz", async (_req, res) => {
  let databaseHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseHealthy = true;
  } catch {
    databaseHealthy = false;
  }

  let redisHealthy = false;
  if (redisCoordinator.configured) {
    try {
      redisHealthy = await redisCoordinator.ping();
    } catch {
      redisHealthy = false;
    }
  }

  const status = databaseHealthy ? "ok" : "degraded";
  const data = HealthCheckResponse.parse({
    status,
    service: "gridtrade-api",
    timestamp: new Date(),
  });

  res.status(status === "ok" ? 200 : 503).json({
    ...data,
    dependencies: {
      postgres: databaseHealthy ? "ok" : "unavailable",
      redis: redisCoordinator.configured
        ? redisHealthy
          ? "ok"
          : "unavailable"
        : "not_configured",
    },
  });
});

/**
 * /ready — readiness: confirms required dependencies are sufficiently available
 * to serve traffic.
 * - PostgreSQL unavailable → 503 (not_ready)
 * - Redis unavailable → 200 degraded (still serves core trading with limitations)
 * Does not expose internal infrastructure details beyond health status.
 */
router.get("/ready", async (_req, res) => {
  let databaseHealthy = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    databaseHealthy = true;
  } catch {
    databaseHealthy = false;
  }

  let redisHealthy = false;
  if (redisCoordinator.configured) {
    try {
      redisHealthy = await redisCoordinator.ping();
    } catch {
      redisHealthy = false;
    }
  }

  const httpStatus = databaseHealthy ? 200 : 503;
  const status = databaseHealthy
    ? redisHealthy || !redisCoordinator.configured
      ? "ready"
      : "degraded"
    : "not_ready";

  res.status(httpStatus).json({
    status,
    service: "gridtrade-api",
    timestamp: new Date().toISOString(),
    dependencies: {
      postgres: databaseHealthy ? "ok" : "unavailable",
      redis: redisCoordinator.configured
        ? redisHealthy
          ? "ok"
          : "degraded"
        : "not_configured",
    },
  });
});

export default router;

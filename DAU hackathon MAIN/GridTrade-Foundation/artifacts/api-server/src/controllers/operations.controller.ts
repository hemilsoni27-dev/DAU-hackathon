import type { Request, Response } from "express";
import { realtimeHub } from "../realtime/socket-server";
import { gridSimulationService, type SimulationScenario } from "../services/grid-simulation.service";
import { alertService } from "../services/alert.service";
import { controlRoomService } from "../services/control-room.service";
import { logger } from "../lib/logger";

/**
 * SECURITY: userId and role are sourced exclusively from req.authContext —
 * the server-verified identity context set by attachAuthContext middleware.
 * Client-supplied query params (userId, role) are never trusted for identity.
 */
export async function handleRealtimeStream(req: Request, res: Response): Promise<void> {
  const auth = req.authContext;
  if (!auth) {
    res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required for realtime stream." });
    return;
  }

  const userId = auth.userId;
  const role = auth.role;

  // Only allow explicitly listed safe room suffixes from client.
  // Role-based eligibility is enforced by RealtimeHub.canSubscribe().
  const roomsParam = (req.query.rooms as string) || "";
  const initialRooms = roomsParam
    ? roomsParam.split(",").map((r) => r.trim()).filter(Boolean)
    : [];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const clientId = `client-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  const client = realtimeHub.registerClient(clientId, userId, role, res, initialRooms);

  // Heartbeat to keep SSE connection alive through proxies
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25_000);

  // Send initial welcome handshake envelope
  res.write(
    `data: ${JSON.stringify({
      eventId: `evt-${clientId}`,
      eventType: "connection:established",
      version: "1",
      occurredAt: new Date().toISOString(),
      data: {
        clientId,
        userId,
        role,
        subscribedRooms: Array.from(client.subscribedRooms)
      }
    })}\n\n`
  );

  req.on("close", () => {
    clearInterval(heartbeat);
    realtimeHub.removeClient(clientId);
    logger.info({ clientId, userId, role }, "Realtime client disconnected");
  });
}

export async function handleTriggerSimulation(req: Request, res: Response): Promise<void> {
  try {
    // SECURITY: role is sourced from req.authContext only — not from query params or headers.
    const auth = req.authContext;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    if (auth.role !== "UTILITY" && auth.role !== "ADMIN") {
      res.status(403).json({ error: "FORBIDDEN", message: "Only UTILITY or ADMIN roles may trigger grid simulation scenarios." });
      return;
    }

    const { scenario, region = "KA_BLR_01" } = req.body || {};
    const validScenarios: SimulationScenario[] = ["SUNNY_SURPLUS", "HIGH_DEMAND", "MODERATE_CONGESTION", "SEVERE_CONGESTION", "BALANCED"];

    if (!scenario || !validScenarios.includes(scenario)) {
      res.status(400).json({ error: "BAD_REQUEST", message: `Invalid scenario. Must be one of: ${validScenarios.join(", ")}` });
      return;
    }

    const resultState = await gridSimulationService.triggerScenario(scenario, region);
    res.json({ success: true, data: resultState });
  } catch (err: any) {
    logger.error({ err }, "Error triggering grid simulation");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

export async function handleGetUtilityDashboard(req: Request, res: Response): Promise<void> {
  try {
    const region = (req.query.region as string) || "KA_BLR_01";
    const metrics = await controlRoomService.getUtilityMetrics(region);
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    logger.error({ err }, "Error getting utility dashboard metrics");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

export async function handleGetAdminDashboard(req: Request, res: Response): Promise<void> {
  try {
    // SECURITY: role is sourced from req.authContext only.
    const auth = req.authContext;
    if (!auth || auth.role !== "ADMIN") {
      res.status(403).json({ error: "FORBIDDEN", message: "Only ADMIN role may access admin dashboard metrics." });
      return;
    }

    const metrics = await controlRoomService.getAdminMetrics();
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    logger.error({ err }, "Error getting admin dashboard metrics");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

export async function handleGetRegulatorDashboard(req: Request, res: Response): Promise<void> {
  try {
    // SECURITY: role is sourced from req.authContext only.
    const auth = req.authContext;
    if (!auth || (auth.role !== "REGULATOR" && auth.role !== "ADMIN")) {
      res.status(403).json({ error: "FORBIDDEN", message: "Only REGULATOR or ADMIN roles may access regulator dashboard metrics." });
      return;
    }

    const metrics = await controlRoomService.getRegulatorMetrics();
    res.json({ success: true, data: metrics });
  } catch (err: any) {
    logger.error({ err }, "Error getting regulator dashboard metrics");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

export async function handleGetAlerts(req: Request, res: Response): Promise<void> {
  try {
    const severity = req.query.severity as any;
    const unacknowledgedOnly = req.query.unacknowledged === "true";
    const alerts = await alertService.getAlerts({ severity, unacknowledgedOnly });
    res.json({ success: true, data: alerts });
  } catch (err: any) {
    logger.error({ err }, "Error getting alerts");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

export async function handleAcknowledgeAlert(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    // SECURITY: userId and role from authContext only — never from request body or headers.
    const auth = req.authContext;
    if (!auth) {
      res.status(401).json({ error: "UNAUTHORIZED", message: "Authentication required." });
      return;
    }
    if (auth.role !== "UTILITY" && auth.role !== "ADMIN") {
      res.status(403).json({ error: "FORBIDDEN", message: "Only UTILITY or ADMIN roles may acknowledge alerts." });
      return;
    }
    if (!id) {
      res.status(400).json({ error: "BAD_REQUEST", message: "Alert ID is required." });
      return;
    }

    const ackResult = await alertService.acknowledgeAlert(String(id), auth.userId);
    res.json({ success: true, data: ackResult });
  } catch (err: any) {
    logger.error({ err }, "Error acknowledging alert");
    res.status(500).json({ error: "INTERNAL_SERVER_ERROR", message: err.message });
  }
}

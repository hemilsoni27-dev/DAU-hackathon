import { EventEmitter } from "node:events";
import type { Response, Request } from "express";
import { logger } from "../lib/logger";

export interface RealtimeMessage {
  event: string;
  payload: any;
  timestamp: string;
  room?: string;
}

export interface ClientConnection {
  id: string;
  userId: string;
  role: string;
  res: Response;
  subscribedRooms: Set<string>;
}

class RealtimeHub extends EventEmitter {
  private clients: Map<string, ClientConnection> = new Map();

  /**
   * Check room authorization for a user role
   */
  public canSubscribe(role: string, userId: string, room: string): boolean {
    const normalizedRole = (role || "").toUpperCase();

    if (room.startsWith("user:")) {
      const targetUserId = room.substring(5);
      return userId === targetUserId || normalizedRole === "ADMIN";
    }

    if (room.startsWith("market:")) {
      return true; // Open to all authenticated users
    }

    if (room.startsWith("utility:")) {
      return normalizedRole === "UTILITY" || normalizedRole === "ADMIN";
    }

    if (room === "regulator") {
      return normalizedRole === "REGULATOR" || normalizedRole === "ADMIN";
    }

    if (room === "admin") {
      return normalizedRole === "ADMIN";
    }

    return false;
  }

  public registerClient(clientId: string, userId: string, role: string, res: Response, initialRooms: string[] = []): ClientConnection {
    const client: ClientConnection = {
      id: clientId,
      userId,
      role,
      res,
      subscribedRooms: new Set<string>()
    };

    // Auto subscribe to basic rooms
    this.subscribeClient(client, `user:${userId}`);
    this.subscribeClient(client, "market:GLOBAL");

    for (const r of initialRooms) {
      this.subscribeClient(client, r);
    }

    this.clients.set(clientId, client);
    logger.info({ clientId, userId, role }, "Realtime client connected");
    return client;
  }

  public subscribeClient(client: ClientConnection, room: string): boolean {
    if (this.canSubscribe(client.role, client.userId, room)) {
      client.subscribedRooms.add(room);
      return true;
    }
    logger.warn({ clientId: client.id, role: client.role, room }, "Unauthorized room subscription attempt");
    return false;
  }

  public unsubscribeClient(client: ClientConnection, room: string): void {
    client.subscribedRooms.delete(room);
  }

  public removeClient(clientId: string): void {
    this.clients.delete(clientId);
    logger.info({ clientId }, "Realtime client disconnected");
  }

  public broadcastToRoom(room: string, event: string, payload: any): void {
    const msg: RealtimeMessage = {
      event,
      payload,
      timestamp: new Date().toISOString(),
      room
    };

    const formattedData = `data: ${JSON.stringify(msg)}\n\n`;

    let deliveredCount = 0;
    for (const client of this.clients.values()) {
      if (client.subscribedRooms.has(room)) {
        try {
          client.res.write(formattedData);
          deliveredCount++;
        } catch (err) {
          logger.error({ err, clientId: client.id }, "Failed to write to realtime stream");
        }
      }
    }

    this.emit("broadcast", { room, event, payload, deliveredCount });
  }

  public broadcastGlobal(event: string, payload: any): void {
    const msg: RealtimeMessage = {
      event,
      payload,
      timestamp: new Date().toISOString()
    };

    const formattedData = `data: ${JSON.stringify(msg)}\n\n`;

    for (const client of this.clients.values()) {
      try {
        client.res.write(formattedData);
      } catch (err) {
        logger.error({ err, clientId: client.id }, "Failed to write global realtime stream");
      }
    }
  }

  public getConnectedCount(): number {
    return this.clients.size;
  }
}

export const realtimeHub = new RealtimeHub();

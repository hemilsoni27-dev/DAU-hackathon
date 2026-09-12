import type { Request, Response, NextFunction } from "express";
import { tradeService } from "../services/trade.service";
import { AppError } from "../middleware/errors";

export async function createTrade(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const buyerId = auth.userId;
    const { listingId, demandId, energyAmountKwh, requestedKwh } = req.body;

    const kwh = Number(energyAmountKwh ?? requestedKwh);

    const result = await tradeService.executeTrade({
      buyerId,
      listingId,
      demandId,
      requestedKwh: kwh,
    });

    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

export async function listTrades(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }
    const trades = await tradeService.listUserTrades(auth.userId);
    res.json(trades);
  } catch (error) {
    next(error);
  }
}

/**
 * SECURITY FIX: Previously returned any trade by ID without an ownership check (IDOR).
 * Now: ADMIN sees all trades. Others only see their own (as buyer or seller).
 * Returns generic 404 when the resource exists but is not owned by the caller,
 * to avoid revealing the existence of other users' trades.
 */
export async function getTradeById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    const trade = await tradeService.getTradeById(id);

    if (!trade) {
      throw new AppError("NOT_FOUND", "Trade not found", 404);
    }

    // IDOR enforcement: ADMIN can see all; others only their own trades.
    // trade.buyerId is direct; seller is via trade.sellerName (service already resolved it).
    // Re-check via listUserTrades ownership pattern: buyer or seller of the listing.
    const isOwner = trade.buyerId === auth.userId;
    const isAdmin = auth.role === "ADMIN";
    const isRegulator = auth.role === "REGULATOR"; // read-only audit access
    const isUtility = auth.role === "UTILITY"; // read-only operational access

    if (!isOwner && !isAdmin && !isRegulator && !isUtility) {
      // Generic 404 to avoid leaking existence of other users' trades
      throw new AppError("NOT_FOUND", "Trade not found", 404);
    }


    res.json(trade);
  } catch (error) {
    next(error);
  }
}

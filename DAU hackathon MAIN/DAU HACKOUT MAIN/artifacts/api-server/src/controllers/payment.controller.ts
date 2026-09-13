import type { Request, Response, NextFunction } from "express";
import { paymentService } from "../services/payment.service";
import { AppError } from "../middleware/errors";

export async function createPaymentForTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const rawId = req.params.id;
    const transactionId = Array.isArray(rawId) ? rawId[0] : rawId;
    const { idempotencyKey, paymentMethod } = req.body || {};

    const payment = await paymentService.processPaymentForTransaction({
      transactionId,
      buyerId: auth.userId,
      idempotencyKey,
      paymentMethod,
    });

    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
}

/**
 * SECURITY FIX: This was previously calling processPaymentForTransaction (a write operation)
 * on a GET route — causing unintended side-effects and idempotency violations.
 * Now correctly calls the read-only getPaymentStatus method.
 */
export async function getPaymentForTransaction(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const auth = req.authContext;
    if (!auth) {
      throw new AppError("UNAUTHORIZED", "Authentication required", 401);
    }

    const rawId = req.params.id;
    const transactionId = Array.isArray(rawId) ? rawId[0] : rawId;

    const payment = await paymentService.getPaymentStatus(transactionId, auth.userId);

    if (!payment) {
      res.status(404).json({
        error: { code: "NOT_FOUND", message: "No payment found for this transaction." },
      });
      return;
    }

    res.json(payment);
  } catch (error) {
    next(error);
  }
}

export async function handlePaymentWebhook(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawProvider = req.params.provider;
    const provider = (Array.isArray(rawProvider) ? rawProvider[0] : rawProvider) || "prototype_upi";
    const rawHeaderId = req.headers["x-webhook-event-id"];
    const providerEventId = (Array.isArray(rawHeaderId) ? rawHeaderId[0] : rawHeaderId) || (req.body?.eventId as string) || `evt-${Date.now()}`;

    const result = await paymentService.handleWebhook(provider, providerEventId, req.body);
    res.json(result);
  } catch (error) {
    next(error);
  }
}

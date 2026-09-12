import type { Request, Response, NextFunction } from "express";
import { assistantService } from "../services/assistant.service";

export async function chatAssistant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { message, conversationId } = req.body;
    const userId = req.authContext?.userId || "user-1";

    if (!message || typeof message !== "string") {
      res.status(400).json({ error: "Message is required" });
      return;
    }

    const response = await assistantService.processChat(message, userId, conversationId);
    res.json(response);
  } catch (error) {
    next(error);
  }
}

export async function getAssistantContext(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.authContext?.userId || (req.query.userId as string) || "user-1";
    const context = await assistantService.assembleUserContext(userId);
    res.json(context);
  } catch (error) {
    next(error);
  }
}

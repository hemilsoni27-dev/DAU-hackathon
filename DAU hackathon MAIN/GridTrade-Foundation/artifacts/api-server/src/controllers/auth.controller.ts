import type { Request, Response } from "express";
import { GetAuthSessionResponse } from "@workspace/api-zod";

export function getAuthSession(req: Request, res: Response) {
  res.json(
    GetAuthSessionResponse.parse({
      authenticated: Boolean(req.authContext),
      role: req.authContext?.role ?? "PROSUMER",
      displayName: req.authContext?.displayName ?? "Guest",
    }),
  );
}

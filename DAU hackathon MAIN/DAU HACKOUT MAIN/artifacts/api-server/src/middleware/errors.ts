import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
    public readonly details: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError("NOT_FOUND", `Route not found: ${req.method} ${req.path}`, 404));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const requestId = (res.locals.requestId || req.id || "req-unknown") as string;

  if (error instanceof ZodError) {
    req.log.warn({ err: error, requestId }, "Validation failed");
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: { issues: error.issues },
        requestId,
      },
    });
    return;
  }

  const isKnown = error instanceof AppError;
  const status = isKnown ? error.status : 500;
  const code = isKnown ? error.code : "INTERNAL_ERROR";
  const message = isKnown ? error.message : "An unexpected error occurred";

  req.log.error({ err: error, requestId, status }, "Request failed");
  res.status(status).json({
    error: {
      code,
      message,
      details: isKnown ? error.details : {},
      requestId,
    },
  });
};
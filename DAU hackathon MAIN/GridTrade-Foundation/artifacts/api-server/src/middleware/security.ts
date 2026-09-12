import type { RequestHandler } from "express";

const buckets = new Map<string, { count: number; resetAt: number }>();

export const securityHeaders: RequestHandler = (_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  // HSTS: enforced only in production (requires HTTPS)
  if (process.env.NODE_ENV === "production") {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  }
  next();
};

/**
 * Per-endpoint rate limit factory.
 * Keyed by userId (when auth context is available) or IP as fallback.
 * Safe when Redis is unavailable — uses in-process memory bucket.
 *
 * @param maxRequests - max requests per window
 * @param windowMs    - window duration in milliseconds
 */
export function makeRateLimit(maxRequests: number, windowMs: number): RequestHandler {
  const localBuckets = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    // Prefer userId-based key for per-user fairness; fall back to IP
    const key = req.authContext?.userId ?? req.ip ?? "unknown";
    const now = Date.now();
    const current = localBuckets.get(key);

    if (!current || current.resetAt <= now) {
      localBuckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    current.count += 1;
    if (current.count > maxRequests) {
      res.status(429).json({
        error: {
          code: "RATE_LIMITED",
          message: "Too many requests. Try again shortly.",
          details: {},
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    next();
  };
}

/** Global write rate limit: 60 write requests per minute per key */
export const writeRateLimit: RequestHandler = (req, res, next) => {
  if (req.method === "GET" || req.path === "/healthz" || req.path === "/ready") return next();
  const key = req.authContext?.userId ?? req.ip ?? "unknown";
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  current.count += 1;
  if (current.count > 60) {
    res.status(429).json({
      error: {
        code: "RATE_LIMITED",
        message: "Too many write requests. Try again shortly.",
        details: {},
        requestId: res.locals.requestId,
      },
    });
    return;
  }
  next();
};

/** Strict rate limits for sensitive endpoints */
export const loginRateLimit = makeRateLimit(10, 60_000);       // 10/min
export const assistantRateLimit = makeRateLimit(20, 60_000);   // 20/min
export const simulationRateLimit = makeRateLimit(5, 60_000);   // 5/min
export const paymentRateLimit = makeRateLimit(10, 60_000);     // 10/min
export const predictionRateLimit = makeRateLimit(15, 60_000);  // 15/min
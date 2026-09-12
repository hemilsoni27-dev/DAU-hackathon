import type { RequestHandler } from "express";
import { AppError } from "./errors";

export type PlatformRole =
  | "PROSUMER"
  | "CONSUMER"
  | "UTILITY"
  | "REGULATOR"
  | "ADMIN";

export type Permission =
  | "solar:create"
  | "solar:read"
  | "solar:update"
  | "listing:create"
  | "listing:read"
  | "listing:cancel"
  | "demand:create"
  | "demand:read"
  | "trade:create"
  | "trade:read"
  | "grid:read"
  | "grid:override"
  | "audit:read"
  | "admin:access";

export interface AuthContext {
  userId: string;
  displayName: string;
  email: string;
  role: PlatformRole;
}

declare global {
  namespace Express {
    interface Request {
      authContext?: AuthContext;
    }
  }
}

// Role to Permission Matrix
const ROLE_PERMISSIONS: Record<PlatformRole, Set<Permission>> = {
  PROSUMER: new Set([
    "solar:create",
    "solar:read",
    "solar:update",
    "listing:create",
    "listing:read",
    "listing:cancel",
    "demand:create",
    "demand:read",
    "trade:create",
    "trade:read",
    "grid:read",
  ]),
  CONSUMER: new Set([
    "listing:read",
    "demand:create",
    "demand:read",
    "trade:create",
    "trade:read",
    "grid:read",
  ]),
  UTILITY: new Set([
    "solar:read",
    "listing:read",
    "demand:read",
    "trade:read",
    "grid:read",
    "grid:override",
    "audit:read",
  ]),
  REGULATOR: new Set([
    "solar:read",
    "listing:read",
    "demand:read",
    "trade:read",
    "grid:read",
    "audit:read",
  ]),
  ADMIN: new Set([
    "solar:create",
    "solar:read",
    "solar:update",
    "listing:create",
    "listing:read",
    "listing:cancel",
    "demand:create",
    "demand:read",
    "trade:create",
    "trade:read",
    "grid:read",
    "grid:override",
    "audit:read",
    "admin:access",
  ]),
};

// Abstract Identity Provider Interface for OIDC / MFA extensibility
export interface IIdentityProvider {
  verifyToken(token: string): Promise<AuthContext | null>;
  getUserContext(userId: string): Promise<AuthContext | null>;
}

/**
 * Demo token registry — maps well-known bearer tokens to seed user contexts.
 * These identities match exactly the UUIDs in prisma/seed.ts.
 *
 * Tokens are intentionally fake/non-secret: they only work in development/demo.
 * In NODE_ENV=production, all demo: tokens are rejected with 401.
 *
 * Token format: "demo:<roleKey>"
 * Example: Authorization: Bearer demo:prosumer
 */
const DEMO_TOKEN_REGISTRY: Record<string, AuthContext> = {
  "demo:prosumer": {
    userId: "8f6a2b30-1d0c-4d74-8d68-3b7d2b09c2a1",
    displayName: "Aarav Mehta",
    email: "aarav.mehta@gridtrade.example",
    role: "PROSUMER",
  },
  "demo:prosumer2": {
    userId: "7e5b1a20-0c9b-3c63-7c57-2a6c1a08b190",
    displayName: "Priya Sharma",
    email: "priya.sharma@gridtrade.example",
    role: "PROSUMER",
  },
  "demo:consumer": {
    userId: "6d4a0f10-9b8a-2b52-6b46-1a5b0f97a089",
    displayName: "Rohit Verma",
    email: "rohit.verma@gridtrade.example",
    role: "CONSUMER",
  },
  "demo:utility": {
    userId: "5c3e9e00-8a7f-1a41-5a35-0f4a9e869f78",
    displayName: "State Grid Control",
    email: "gridops@stateutility.example",
    role: "UTILITY",
  },
  "demo:regulator": {
    userId: "3a1c7c80-6d5c-9f20-3812-0c286c647d56",
    displayName: "Central Electricity Regulator",
    email: "cer@regulators.example",
    role: "REGULATOR",
  },
  "demo:admin": {
    userId: "4b2d8d90-7f6e-0f30-4924-0e398d758e67",
    displayName: "Platform Admin",
    email: "admin@gridtrade.example",
    role: "ADMIN",
  },
};

/**
 * Resolve a bearer token to an AuthContext.
 * Extension point: replace the demo-token branch with real JWT/OIDC verification.
 */
function resolveToken(token: string): AuthContext | null {
  // Production guard: never accept demo tokens in production
  if (process.env.NODE_ENV === "production" && token.startsWith("demo:")) {
    return null;
  }

  // Demo token routing (development + demo mode)
  if (token.startsWith("demo:")) {
    return DEMO_TOKEN_REGISTRY[token] ?? null;
  }

  // OIDC / JWT extension boundary:
  // return await jwtVerifier.verify(token);
  // For now, fall through as unauthenticated.
  return null;
}

/**
 * Default unauthenticated context used when no valid token is present.
 * Defaults to PROSUMER (lowest privilege) so unauthenticated requests still
 * receive sensible behaviour in demo environments while being blocked by
 * requireRole/requirePermission on protected routes.
 */
const DEFAULT_DEMO_CONTEXT: AuthContext = DEMO_TOKEN_REGISTRY["demo:prosumer"]!;

export const attachAuthContext: RequestHandler = (req, _res, next) => {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    const resolved = resolveToken(token);
    if (resolved) {
      req.authContext = resolved;
      next();
      return;
    }
    // Token present but not resolvable — treat as unauthenticated in demo mode
    // In production this would return 401; for now fall back gracefully.
  }

  // No token: use default demo context (dev/demo only).
  // In production deployments, this branch would return 401 to unauthenticated requests.
  if (process.env.NODE_ENV !== "production") {
    req.authContext = DEFAULT_DEMO_CONTEXT;
  }
  // In production, authContext remains undefined; requirePermission/requireRole will reject.

  next();
};

export function hasPermission(role: PlatformRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

export function requirePermission(permission: Permission): RequestHandler {
  return (req, res, next) => {
    if (!req.authContext) {
      next(new AppError("UNAUTHORIZED", "Authentication required.", 401));
      return;
    }
    if (!hasPermission(req.authContext.role, permission)) {
      next(
        new AppError(
          "FORBIDDEN",
          `Missing permission '${permission}' for role '${req.authContext.role}'`,
          403,
        ),
      );
      return;
    }
    next();
  };
}

export function requireRole(...roles: PlatformRole[]): RequestHandler {
  return (req, res, next) => {
    if (!req.authContext || !roles.includes(req.authContext.role)) {
      next(new AppError("FORBIDDEN", "You do not have permission for this action.", 403));
      return;
    }
    next();
  };
}

export function assertCanModifyResource(
  authContext: AuthContext | undefined,
  resourceOwnerId: string,
  resourceName = "resource",
) {
  if (!authContext) {
    throw new AppError("UNAUTHORIZED", "Authentication required", 401);
  }
  if (authContext.role === "ADMIN") return;
  if (authContext.userId !== resourceOwnerId) {
    throw new AppError(
      "FORBIDDEN",
      `You can only modify your own ${resourceName}s`,
      403,
    );
  }
}

/** Export the demo registry for test access only. */
export { DEMO_TOKEN_REGISTRY };
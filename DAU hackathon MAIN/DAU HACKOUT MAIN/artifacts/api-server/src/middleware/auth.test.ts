import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { attachAuthContext, requirePermission, requireRole, hasPermission } from "./auth";

describe("auth middleware & RBAC unit tests", () => {
  const originalEnv = process.env.STRICT_AUTH;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    delete process.env.STRICT_AUTH;
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.STRICT_AUTH = originalEnv;
    } else {
      delete process.env.STRICT_AUTH;
    }
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("attaches default demo context when no token is present and STRICT_AUTH is false", () => {
    const req: any = { headers: {} };
    const res: any = {};
    let nextCalled = false;

    attachAuthContext(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.authContext).toBeDefined();
    expect(req.authContext?.role).toBe("PROSUMER");
    expect(req.authContext?.displayName).toBe("Aarav Mehta");
  });

  it("does NOT attach default demo context when STRICT_AUTH=true", () => {
    process.env.STRICT_AUTH = "true";
    const req: any = { headers: {} };
    const res: any = {};
    let nextCalled = false;

    attachAuthContext(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.authContext).toBeUndefined();
  });

  it("attaches explicit identity when Bearer token is provided in STRICT_AUTH mode", () => {
    process.env.STRICT_AUTH = "true";
    const req: any = { headers: { authorization: "Bearer demo:utility" } };
    const res: any = {};
    let nextCalled = false;

    attachAuthContext(req, res, () => {
      nextCalled = true;
    });

    expect(nextCalled).toBe(true);
    expect(req.authContext).toBeDefined();
    expect(req.authContext?.role).toBe("UTILITY");
    expect(req.authContext?.displayName).toBe("State Grid Control");
  });

  it("enforces permission checks correctly", () => {
    expect(hasPermission("PROSUMER", "solar:create")).toBe(true);
    expect(hasPermission("PROSUMER", "admin:access")).toBe(false);
    expect(hasPermission("ADMIN", "admin:access")).toBe(true);
  });

  it("requireRole passes for matching role and blocks missing role", () => {
    const middleware = requireRole("ADMIN");

    let errorSent: any = null;
    const reqAuthorized: any = { authContext: { role: "ADMIN" } };
    middleware(reqAuthorized, {} as any, (err?: any) => {
      errorSent = err;
    });
    expect(errorSent).toBeUndefined();

    const reqUnauthorized: any = { authContext: { role: "PROSUMER" } };
    middleware(reqUnauthorized, {} as any, (err?: any) => {
      errorSent = err;
    });
    expect(errorSent).toBeDefined();
    expect(errorSent.status).toBe(403);
  });
});

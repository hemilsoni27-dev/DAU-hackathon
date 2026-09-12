import type { RequestHandler } from "express";
import { z, type ZodSchema } from "zod";
import { AppError } from "./errors";

interface ValidateSchemas {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Zod-based request validation middleware factory.
 * Returns 400 with structured error details when validation fails.
 *
 * Usage:
 *   router.post("/listing", validate({ body: CreateListingSchema }), createListing);
 */
export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req, _res, next) => {
    const errors: Record<string, string[]> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = issue.path.join(".") || "body";
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
      } else {
        req.body = result.data; // Use parsed/coerced value
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = `query.${issue.path.join(".") || "query"}`;
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
      } else {
        req.query = result.data as any;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (!result.success) {
        for (const issue of result.error.issues) {
          const path = `params.${issue.path.join(".") || "params"}`;
          if (!errors[path]) errors[path] = [];
          errors[path].push(issue.message);
        }
      }
    }

    if (Object.keys(errors).length > 0) {
      next(
        new AppError("VALIDATION_ERROR", "Request validation failed", 400, errors),
      );
      return;
    }

    next();
  };
}

// ─── Common reusable schemas ────────────────────────────────────────────────

export const UUIDParamSchema = z.object({
  id: z.string().uuid("ID must be a valid UUID"),
});

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}).partial();

export const CreateTradeBodySchema = z.object({
  listingId: z.string().uuid("listingId must be a valid UUID"),
  demandId: z.string().uuid().optional(),
  energyAmountKwh: z.coerce.number().positive("Energy amount must be positive").optional(),
  requestedKwh: z.coerce.number().positive("Requested kWh must be positive").optional(),
}).refine(
  (d) => d.energyAmountKwh !== undefined || d.requestedKwh !== undefined,
  { message: "Either energyAmountKwh or requestedKwh must be provided" }
);

export const CreateListingBodySchema = z.object({
  solarSystemId: z.string().uuid(),
  quantityKwh: z.number().positive("Quantity must be positive"),
  pricePerKwhInr: z.number().positive("Price must be positive"),
  validUntil: z.string().datetime({ message: "validUntil must be an ISO 8601 datetime" }).optional(),
  gridRegion: z.string().min(1).max(50).optional(),
});

export const CreateDemandBodySchema = z.object({
  quantityKwh: z.number().positive("Quantity must be positive"),
  maxPricePerKwhInr: z.number().positive("Max price must be positive"),
  gridRegion: z.string().min(1).max(50).optional(),
  flexibilityWindowHours: z.number().int().min(1).max(168).optional(),
});

export const CreatePaymentBodySchema = z.object({
  idempotencyKey: z.string().min(1).max(128).optional(),
  paymentMethod: z.string().min(1).max(50).optional(),
});

export const SimulationBodySchema = z.object({
  scenario: z.enum(["SUNNY_SURPLUS", "HIGH_DEMAND", "MODERATE_CONGESTION", "SEVERE_CONGESTION", "BALANCED"]),
  region: z.string().min(1).max(50).default("KA_BLR_01"),
});

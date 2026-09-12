import { Decimal } from "@prisma/client/runtime/library";

export type PricingPolicy = {
  version: string;
  basePricePerKwh: Decimal;
  minMultiplier: Decimal;
  maxMultiplier: Decimal;
  congestionMultiplierMax: Decimal;
  epsilon: Decimal;
};

export const PRICING_POLICY_V1: PricingPolicy = {
  version: "1.0.0",
  basePricePerKwh: new Decimal("7.50"), // Base rate in INR/kWh
  minMultiplier: new Decimal("0.70"),   // Price floor: ₹5.25/kWh
  maxMultiplier: new Decimal("1.80"),   // Price ceiling: ₹13.50/kWh
  congestionMultiplierMax: new Decimal("0.25"), // +25% max dynamic congestion pressure
  epsilon: new Decimal("0.001"),
};

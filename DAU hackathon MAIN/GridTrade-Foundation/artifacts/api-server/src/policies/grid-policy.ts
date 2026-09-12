import { Decimal } from "@prisma/client/runtime/library";

export type GridPolicy = {
  version: string;
  approvedCongestionMaxPercent: Decimal; // <= 64% -> APPROVED
  adjustedCongestionMaxPercent: Decimal; // 65% - 84% -> ADJUSTED
  // >= 85% -> RESTRICTED
  frequencyLowerBoundHz: Decimal;        // 49.75 Hz
  frequencyUpperBoundHz: Decimal;        // 50.25 Hz
};

export const GRID_POLICY_V1: GridPolicy = {
  version: "1.0.0",
  approvedCongestionMaxPercent: new Decimal("64.0"),
  adjustedCongestionMaxPercent: new Decimal("84.0"),
  frequencyLowerBoundHz: new Decimal("49.75"),
  frequencyUpperBoundHz: new Decimal("50.25"),
};

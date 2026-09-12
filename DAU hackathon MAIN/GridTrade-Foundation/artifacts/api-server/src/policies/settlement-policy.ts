import { Decimal } from "@prisma/client/runtime/library";

export type SettlementPolicy = {
  version: string;
  wheelingFeePercent: Decimal;          // 2.0% DISCOM prototype wheeling & distribution charge
  transmissionLossPercent: Decimal;     // 3.5% estimated local grid transmission loss
  carbonFactorKgPerKwh: Decimal;        // 0.82 kg CO2e saved per kWh of solar P2P trade vs grid thermal
};

export const SETTLEMENT_POLICY_V1: SettlementPolicy = {
  version: "1.0.0",
  wheelingFeePercent: new Decimal("2.00"),
  transmissionLossPercent: new Decimal("3.50"),
  carbonFactorKgPerKwh: new Decimal("0.82"),
};

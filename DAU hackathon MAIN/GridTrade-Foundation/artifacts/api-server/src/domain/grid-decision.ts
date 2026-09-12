import { Decimal } from "@prisma/client/runtime/library";
import { GRID_POLICY_V1, type GridPolicy } from "../policies/grid-policy";

export type GridDecisionInput = {
  region?: string;
  congestionPercent: Decimal | number | string;
  renewableSharePercent?: Decimal | number | string;
  frequencyHz: Decimal | number | string;
  requestedKwh?: Decimal | number | string;
  gridDataId?: string;
};

export type GridReasonCode =
  | "GRID_HEALTHY"
  | "GRID_MODERATE_CONGESTION"
  | "GRID_HIGH_CONGESTION"
  | "GRID_FREQUENCY_OUT_OF_BOUNDS";

export type GridDecisionResult = {
  status: "APPROVED" | "ADJUSTED" | "RESTRICTED";
  congestionLevel: Decimal;
  reasonCode: GridReasonCode;
  explanation: string;
  constraints: {
    maxEnergyKwh?: Decimal;
    priceAdjustmentPercent?: number;
  };
  evaluatedAt: Date;
  gridDataId?: string;
};

export function evaluateTradeGridCondition(
  input: GridDecisionInput,
  policy: GridPolicy = GRID_POLICY_V1
): GridDecisionResult {
  const congestionNum = Number(input.congestionPercent);
  const frequencyNum = Number(input.frequencyHz);
  const requestedKwhNum = input.requestedKwh ? Number(input.requestedKwh) : 0;
  const congestionLevel = new Decimal((congestionNum / 100).toFixed(4));

  const freqDiff = Math.abs(frequencyNum - 50.0);
  const isFreqUnstable =
    frequencyNum < Number(policy.frequencyLowerBoundHz) ||
    frequencyNum > Number(policy.frequencyUpperBoundHz);

  // 1. RESTRICTED Rule (Severe congestion >= 85% or frequency instability)
  if (congestionNum >= 85.0 || isFreqUnstable) {
    const reasonCode: GridReasonCode = isFreqUnstable
      ? "GRID_FREQUENCY_OUT_OF_BOUNDS"
      : "GRID_HIGH_CONGESTION";

    const explanation = isFreqUnstable
      ? `Grid frequency abnormal (${frequencyNum.toFixed(2)} Hz vs 50.0 Hz target). Trade execution restricted to prevent power quality degradation.`
      : `Critical feeder congestion (${congestionNum.toFixed(1)}% ≥ 85%). New trade executions restricted for network safety.`;

    return {
      status: "RESTRICTED",
      congestionLevel,
      reasonCode,
      explanation,
      constraints: {
        maxEnergyKwh: new Decimal("0.00"),
        priceAdjustmentPercent: 0,
      },
      evaluatedAt: new Date(),
      gridDataId: input.gridDataId,
    };
  }

  // 2. ADJUSTED Rule (Moderate congestion 65% - 84%)
  if (congestionNum >= Number(policy.approvedCongestionMaxPercent)) {
    // Capping formula: reduce allowed energy proportional to congestion above 60%
    // At 65% -> 95% of requested quantity allowed
    // At 80% -> 80% of requested quantity allowed
    const reductionPercent = Math.min(0.40, (congestionNum - 60) * 0.01);
    const allowedRatio = Math.max(0.50, 1.0 - reductionPercent);
    const maxEnergyNumber = requestedKwhNum > 0 ? requestedKwhNum * allowedRatio : 0;
    const maxEnergyKwh = new Decimal(maxEnergyNumber.toFixed(2));
    const priceAdjustmentPercent = Math.round(congestionLevel.toNumber() * 25);

    return {
      status: "ADJUSTED",
      congestionLevel,
      reasonCode: "GRID_MODERATE_CONGESTION",
      explanation: `Local distribution feeder experiencing moderate congestion (${congestionNum.toFixed(1)}%). Trade quantity adjusted from ${requestedKwhNum} kWh to ${maxEnergyKwh.toFixed(2)} kWh.`,
      constraints: {
        maxEnergyKwh,
        priceAdjustmentPercent,
      },
      evaluatedAt: new Date(),
      gridDataId: input.gridDataId,
    };
  }

  // 3. APPROVED Rule (Healthy grid <= 64%)
  const maxEnergyKwh = requestedKwhNum > 0 ? new Decimal(requestedKwhNum.toFixed(2)) : undefined;

  return {
    status: "APPROVED",
    congestionLevel,
    reasonCode: "GRID_HEALTHY",
    explanation: `Local grid operating within normal thermal & voltage limits (${congestionNum.toFixed(1)}% congestion, ${frequencyNum.toFixed(2)} Hz). Trade approved.`,
    constraints: {
      maxEnergyKwh,
      priceAdjustmentPercent: 0,
    },
    evaluatedAt: new Date(),
    gridDataId: input.gridDataId,
  };
}

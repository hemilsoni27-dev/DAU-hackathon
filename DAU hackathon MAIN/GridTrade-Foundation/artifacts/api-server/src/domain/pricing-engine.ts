import { Decimal } from "@prisma/client/runtime/library";
import { PRICING_POLICY_V1, type PricingPolicy } from "../policies/pricing-policy";

export type PricingInput = {
  basePricePerKwh?: Decimal | number | string;
  supplyKwh: Decimal | number | string;
  demandKwh: Decimal | number | string;
  congestionLevel: Decimal | number | string; // 0.0 to 1.0 (or 0 to 100 percent)
  gridCapacityMw?: Decimal | number | string;
  currentLoadMw?: Decimal | number | string;
};

export type PriceFactorExplanation = {
  key: "BASE_PRICE" | "SUPPLY" | "DEMAND" | "CONGESTION" | "MARKET_CONDITION";
  direction: "UP" | "DOWN" | "NEUTRAL";
  impactPercent: number;
  explanation: string;
};

export type PriceExplanation = {
  factors: PriceFactorExplanation[];
  summary: string;
};

export type PricingResult = {
  recommendedPricePerKwh: Decimal;
  basePricePerKwh: Decimal;
  supplyDemandFactor: Decimal;
  congestionFactor: Decimal;
  priceFloor: Decimal;
  priceCeiling: Decimal;
  explanation: PriceExplanation;
  engineVersion: string;
};

export function calculateDynamicPrice(
  input: PricingInput,
  policy: PricingPolicy = PRICING_POLICY_V1
): PricingResult {
  const basePrice = new Decimal(
    (input.basePricePerKwh ?? policy.basePricePerKwh).toString()
  );
  const supply = new Decimal(input.supplyKwh.toString());
  const demand = new Decimal(input.demandKwh.toString());
  
  let rawCongestion = new Decimal(input.congestionLevel.toString());
  // Normalize congestion level to [0.0, 1.0] if passed as percentage > 1
  if (rawCongestion.greaterThan(1)) {
    rawCongestion = rawCongestion.dividedBy(100);
  }
  const congestionLevel = Decimal.max(0, Decimal.min(1, rawCongestion));

  const effectiveSupply = Decimal.max(supply, policy.epsilon);
  const demandSupplyRatio = demand.dividedBy(effectiveSupply);

  // 1. Calculate Supply/Demand Multiplier (bounded between 0.75 and 1.45)
  // Ratio = 1.0 -> multiplier 1.0
  // Ratio > 1.0 (Demand > Supply) -> positive pressure up to +45%
  // Ratio < 1.0 (Supply > Demand) -> negative pressure down to -25%
  let sdMultiplierNumber = 1.0;
  const ratioNum = demandSupplyRatio.toNumber();
  if (ratioNum > 1.0) {
    sdMultiplierNumber = Math.min(1.45, 1.0 + 0.35 * Math.log10(ratioNum));
  } else if (ratioNum < 1.0) {
    sdMultiplierNumber = Math.max(0.75, 1.0 - 0.25 * (1.0 - ratioNum));
  }
  const supplyDemandFactor = new Decimal(sdMultiplierNumber.toFixed(4));

  // 2. Calculate Congestion Multiplier (bounded between 1.0 and 1.25)
  // congestion 0.0 -> 1.0 (neutral)
  // congestion 1.0 -> 1.25 (+25% congestion charge)
  const congestionMultiplierNum =
    1.0 + congestionLevel.toNumber() * policy.congestionMultiplierMax.toNumber();
  const congestionFactor = new Decimal(congestionMultiplierNum.toFixed(4));

  // 3. Raw Price Calculation
  const rawCalculatedPrice = basePrice
    .mul(supplyDemandFactor)
    .mul(congestionFactor);

  // 4. Floor & Ceiling Boundaries
  const priceFloor = basePrice.mul(policy.minMultiplier);
  const priceCeiling = basePrice.mul(policy.maxMultiplier);

  const recommendedPrice = Decimal.max(
    priceFloor,
    Decimal.min(priceCeiling, rawCalculatedPrice)
  );

  // 5. Generate Transparent Explanations
  const factors: PriceFactorExplanation[] = [
    {
      key: "BASE_PRICE",
      direction: "NEUTRAL",
      impactPercent: 0,
      explanation: `Baseline regional tariff benchmark set at ₹${basePrice.toFixed(2)}/kWh.`,
    },
  ];

  const sdImpactPercent = Math.round((sdMultiplierNumber - 1.0) * 100);
  if (sdImpactPercent > 0) {
    factors.push({
      key: "DEMAND",
      direction: "UP",
      impactPercent: sdImpactPercent,
      explanation: `Consumer demand currently exceeds available local solar surplus (+${sdImpactPercent}% pressure).`,
    });
  } else if (sdImpactPercent < 0) {
    factors.push({
      key: "SUPPLY",
      direction: "DOWN",
      impactPercent: Math.abs(sdImpactPercent),
      explanation: `Abundant solar generation surplus in your feeder area (-${Math.abs(sdImpactPercent)}% discount).`,
    });
  } else {
    factors.push({
      key: "MARKET_CONDITION",
      direction: "NEUTRAL",
      impactPercent: 0,
      explanation: `Market supply and demand are balanced near equilibrium.`,
    });
  }

  const congestionImpactPercent = Math.round((congestionMultiplierNum - 1.0) * 100);
  if (congestionImpactPercent > 0) {
    factors.push({
      key: "CONGESTION",
      direction: "UP",
      impactPercent: congestionImpactPercent,
      explanation: `Elevated local distribution congestion (${Math.round(congestionLevel.toNumber() * 100)}%) adds +${congestionImpactPercent}% grid adjustment.`,
    });
  } else {
    factors.push({
      key: "CONGESTION",
      direction: "NEUTRAL",
      impactPercent: 0,
      explanation: `Local feeder congestion is minimal with smooth grid transmission.`,
    });
  }

  // Summary Text
  let summary = `Indicative dynamic price is ₹${recommendedPrice.toFixed(2)}/kWh (Base ₹${basePrice.toFixed(2)}/kWh). `;
  if (recommendedPrice.equals(priceFloor)) {
    summary += "Price floor limit applied.";
  } else if (recommendedPrice.equals(priceCeiling)) {
    summary += "Price ceiling limit applied.";
  } else if (sdImpactPercent > 0 && congestionImpactPercent > 0) {
    summary += `High consumer demand (+${sdImpactPercent}%) and grid congestion (+${congestionImpactPercent}%) are increasing trading rate.`;
  } else if (sdImpactPercent < 0) {
    summary += `High local solar surplus (-${Math.abs(sdImpactPercent)}%) provides competitive savings.`;
  } else {
    summary += "Fair market pricing based on current local grid conditions.";
  }

  return {
    recommendedPricePerKwh: new Decimal(recommendedPrice.toFixed(4)),
    basePricePerKwh: basePrice,
    supplyDemandFactor,
    congestionFactor,
    priceFloor,
    priceCeiling,
    explanation: {
      factors,
      summary,
    },
    engineVersion: policy.version,
  };
}

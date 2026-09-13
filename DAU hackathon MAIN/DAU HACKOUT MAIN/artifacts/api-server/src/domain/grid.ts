export type GridDecision = "APPROVED" | "ADJUSTED" | "RESTRICTED";

export interface GridInputs {
  congestionPercent: number;
  renewableSharePercent: number;
  frequencyHz: number;
}

export function decideGrid(inputs: GridInputs): GridDecision {
  if (inputs.congestionPercent >= 85 || Math.abs(inputs.frequencyHz - 50) > 0.25) {
    return "RESTRICTED";
  }
  if (inputs.congestionPercent >= 65 || inputs.renewableSharePercent >= 78) {
    return "ADJUSTED";
  }
  return "APPROVED";
}

export function gridDecisionLabel(decision: GridDecision) {
  return {
    APPROVED: "Trading window open",
    ADJUSTED: "Trading with grid-aware limits",
    RESTRICTED: "New trades temporarily restricted",
  }[decision];
}
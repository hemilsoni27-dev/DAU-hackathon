export interface MatchCandidate {
  id: string;
  sellerName: string;
  location: string;
  quantityKwh: number;
  priceInrPerKwh: number;
  gridDecision: "APPROVED" | "ADJUSTED" | "RESTRICTED";
  distanceKm: number;
  reliabilityScore: number;
}

export function scoreMatch(candidate: MatchCandidate) {
  const priceScore = Math.max(0, 100 - candidate.priceInrPerKwh * 16);
  const proximityScore = Math.max(0, 100 - candidate.distanceKm * 3);
  const gridScore =
    candidate.gridDecision === "APPROVED"
      ? 100
      : candidate.gridDecision === "ADJUSTED"
        ? 68
        : 18;
  return Math.round(
    priceScore * 0.3 +
      proximityScore * 0.2 +
      Math.min(candidate.quantityKwh, 100) * 0.1 +
      candidate.reliabilityScore * 0.2 +
      gridScore * 0.2,
  );
}
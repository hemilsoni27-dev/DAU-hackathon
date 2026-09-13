export interface CandidateListing {
  id: string;
  sellerId: string;
  sellerName: string;
  location: string;
  gridArea: string;
  lat?: number;
  lng?: number;
  quantityKwh: number;
  allocatedKwh: number;
  remainingKwh: number;
  priceInrPerKwh: number;
  availableFrom: Date;
  availableUntil: Date;
  gridDecision: "APPROVED" | "ADJUSTED" | "RESTRICTED";
  sellerCompletedTrades?: number;
  sellerTotalTrades?: number;
}

export interface CandidateDemand {
  id: string;
  buyerId: string;
  buyerName: string;
  location: string;
  gridArea: string;
  lat?: number;
  lng?: number;
  quantityKwh: number;
  allocatedKwh: number;
  remainingKwh: number;
  maxPriceInrPerKwh: number;
  availableFrom: Date;
  availableUntil: Date;
}

export interface MatchingWeights {
  price: number;
  availability: number;
  quantityFit: number;
  proximity: number;
  reliability: number;
  grid: number;
}

export const DEFAULT_MATCHING_WEIGHTS: MatchingWeights = {
  price: 0.25,
  availability: 0.15,
  quantityFit: 0.15,
  proximity: 0.15,
  reliability: 0.15,
  grid: 0.15,
};

export interface MatchReason {
  key: "PRICE" | "AVAILABILITY" | "QUANTITY_FIT" | "PROXIMITY" | "RELIABILITY" | "GRID";
  direction: "positive" | "neutral" | "negative";
  score: number;
  explanation: string;
}

export interface MatchScoreResult {
  totalScore: number; // 0..1
  matchPercentage: number; // 0..100
  scores: {
    price: number;
    availability: number;
    quantityFit: number;
    proximity: number;
    reliability: number;
    grid: number;
  };
  reasons: MatchReason[];
  distanceKm: number;
}

/**
  * Calculate geographic distance in kilometers using the Haversine formula.
  */
export function calculateHaversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Number((R * c).toFixed(2));
}

/**
  * Filter candidates for valid matching eligibility:
  * 1. seller != buyer
  * 2. remaining listing energy > 0
  * 3. remaining demand energy > 0
  * 4. availability windows overlap
  * 5. price <= maxPriceInrPerKwh
  */
export function isEligibleCandidate(
  listing: CandidateListing,
  demand: CandidateDemand,
): boolean {
  if (listing.sellerId === demand.buyerId) return false;
  if (listing.remainingKwh <= 0 || demand.remainingKwh <= 0) return false;

  const overlapStart = Math.max(
    listing.availableFrom.getTime(),
    demand.availableFrom.getTime(),
  );
  const overlapEnd = Math.min(
    listing.availableUntil.getTime(),
    demand.availableUntil.getTime(),
  );

  if (overlapEnd <= overlapStart) return false;

  if (
    demand.maxPriceInrPerKwh > 0 &&
    listing.priceInrPerKwh > demand.maxPriceInrPerKwh
  ) {
    return false;
  }

  return true;
}

/**
  * Score a candidate listing against a consumer demand using multi-factor analysis.
  */
export function scoreMatchCandidate(
  listing: CandidateListing,
  demand: CandidateDemand,
  weights: MatchingWeights = DEFAULT_MATCHING_WEIGHTS,
): MatchScoreResult {
  // 1. Price Score
  let priceScore = 0.5;
  let priceExplanation = "";
  if (demand.maxPriceInrPerKwh > 0) {
    const diff = demand.maxPriceInrPerKwh - listing.priceInrPerKwh;
    if (diff >= 0) {
      const percentageBelow = (diff / demand.maxPriceInrPerKwh) * 100;
      priceScore = Math.min(1.0, 0.7 + (diff / demand.maxPriceInrPerKwh) * 0.5);
      priceExplanation = `Listing price ₹${listing.priceInrPerKwh.toFixed(2)}/kWh is ${percentageBelow.toFixed(0)}% below your maximum ₹${demand.maxPriceInrPerKwh.toFixed(2)}/kWh limit.`;
    } else {
      priceScore = Math.max(0.0, 0.5 - Math.abs(diff) * 0.1);
      priceExplanation = `Listing price ₹${listing.priceInrPerKwh.toFixed(2)}/kWh exceeds max target.`;
    }
  } else {
    priceScore = Math.max(0.1, Math.min(1.0, (10 - listing.priceInrPerKwh) / 6));
    priceExplanation = `Competitive listing price at ₹${listing.priceInrPerKwh.toFixed(2)}/kWh.`;
  }
  priceScore = Number(priceScore.toFixed(4));

  // 2. Availability Score
  const overlapStart = Math.max(
    listing.availableFrom.getTime(),
    demand.availableFrom.getTime(),
  );
  const overlapEnd = Math.min(
    listing.availableUntil.getTime(),
    demand.availableUntil.getTime(),
  );
  const overlapDurationMs = Math.max(0, overlapEnd - overlapStart);
  const demandDurationMs = Math.max(
    1,
    demand.availableUntil.getTime() - demand.availableFrom.getTime(),
  );

  let availabilityScore = Math.min(1.0, overlapDurationMs / demandDurationMs);
  availabilityScore = Number(availabilityScore.toFixed(4));
  const overlapHours = (overlapDurationMs / (3600 * 1000)).toFixed(1);
  const availabilityExplanation = `Window overlaps for ${overlapHours} hours with requested demand schedule.`;

  // 3. Quantity Fit Score
  const availKwh = listing.remainingKwh;
  const reqKwh = demand.remainingKwh;
  let quantityFitScore = Math.min(availKwh, reqKwh) / Math.max(availKwh, reqKwh);
  quantityFitScore = Number(quantityFitScore.toFixed(4));
  const fitPercentage = Math.round(quantityFitScore * 100);
  const quantityExplanation = `Offers ${availKwh.toFixed(1)} kWh against requested ${reqKwh.toFixed(1)} kWh (${fitPercentage}% volume fit).`;

  // 4. Proximity Score (Haversine or Area Match)
  let distanceKm = 2.5; // Default local area approximation
  if (
    listing.lat !== undefined &&
    listing.lng !== undefined &&
    demand.lat !== undefined &&
    demand.lng !== undefined
  ) {
    distanceKm = calculateHaversineDistanceKm(
      listing.lat,
      listing.lng,
      demand.lat,
      demand.lng,
    );
  } else if (listing.gridArea === demand.gridArea) {
    distanceKm = 1.2;
  } else {
    distanceKm = 4.5;
  }

  let proximityScore = Math.max(0, 1.0 - distanceKm / 20.0);
  proximityScore = Number(proximityScore.toFixed(4));
  const proximityExplanation = `Located within ${distanceKm} km in local ${listing.gridArea || "zone"}.`;

  // 5. Reliability Score
  const completed = listing.sellerCompletedTrades ?? 19;
  const total = listing.sellerTotalTrades ?? 20;
  let reliabilityScore = completed / Math.max(total, 1);
  reliabilityScore = Number(Math.min(1.0, Math.max(0.1, reliabilityScore)).toFixed(4));
  const reliabilityPercentage = Math.round(reliabilityScore * 100);
  const reliabilityExplanation = `Seller has a ${reliabilityPercentage}% historical trade fulfillment rating.`;

  // 6. Grid Suitability Score
  let gridSuitabilityScore = 1.0;
  let gridExplanation = "Local grid condition is optimal (APPROVED).";
  if (listing.gridDecision === "ADJUSTED") {
    gridSuitabilityScore = 0.7;
    gridExplanation = "Local grid shows moderate congestion; trading allowed with limits (ADJUSTED).";
  } else if (listing.gridDecision === "RESTRICTED") {
    gridSuitabilityScore = 0.2;
    gridExplanation = "Local grid is constrained (RESTRICTED).";
  }

  // Calculate Weighted Total Score
  const normalizedSumWeights =
    weights.price +
    weights.availability +
    weights.quantityFit +
    weights.proximity +
    weights.reliability +
    weights.grid;

  const rawTotal =
    (priceScore * weights.price +
      availabilityScore * weights.availability +
      quantityFitScore * weights.quantityFit +
      proximityScore * weights.proximity +
      reliabilityScore * weights.reliability +
      gridSuitabilityScore * weights.grid) /
    normalizedSumWeights;

  const totalScore = Number(Math.max(0, Math.min(1.0, rawTotal)).toFixed(4));
  const matchPercentage = Math.round(totalScore * 100);

  const reasons: MatchReason[] = [
    {
      key: "PRICE",
      direction: priceScore >= 0.7 ? "positive" : priceScore >= 0.4 ? "neutral" : "negative",
      score: priceScore,
      explanation: priceExplanation,
    },
    {
      key: "AVAILABILITY",
      direction: availabilityScore >= 0.7 ? "positive" : "neutral",
      score: availabilityScore,
      explanation: availabilityExplanation,
    },
    {
      key: "QUANTITY_FIT",
      direction: quantityFitScore >= 0.7 ? "positive" : "neutral",
      score: quantityFitScore,
      explanation: quantityExplanation,
    },
    {
      key: "PROXIMITY",
      direction: proximityScore >= 0.7 ? "positive" : "neutral",
      score: proximityScore,
      explanation: proximityExplanation,
    },
    {
      key: "RELIABILITY",
      direction: reliabilityScore >= 0.85 ? "positive" : "neutral",
      score: reliabilityScore,
      explanation: reliabilityExplanation,
    },
    {
      key: "GRID",
      direction: gridSuitabilityScore >= 0.9 ? "positive" : gridSuitabilityScore >= 0.6 ? "neutral" : "negative",
      score: gridSuitabilityScore,
      explanation: gridExplanation,
    },
  ];

  return {
    totalScore,
    matchPercentage,
    scores: {
      price: priceScore,
      availability: availabilityScore,
      quantityFit: quantityFitScore,
      proximity: proximityScore,
      reliability: reliabilityScore,
      grid: gridSuitabilityScore,
    },
    reasons,
    distanceKm,
  };
}

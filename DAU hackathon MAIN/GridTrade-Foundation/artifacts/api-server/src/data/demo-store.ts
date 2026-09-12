import { randomUUID } from "node:crypto";
import { calculateSurplus } from "../domain/energy";
import { decideGrid, gridDecisionLabel } from "../domain/grid";

export interface SolarSystemRecord {
  id: string;
  ownerId: string;
  name: string;
  capacityKw: number;
  location: string;
  status: "online" | "standby" | "offline";
  todayGenerationKwh: number;
  todayConsumptionKwh: number;
}

export interface ListingRecord {
  id: string;
  sellerId: string;
  sellerName: string;
  location: string;
  quantityKwh: number;
  priceInrPerKwh: number;
  status: "active" | "matched" | "closed" | "restricted";
  availableFrom: Date;
  availableUntil: Date;
  matchScore: number;
  gridDecision: "APPROVED" | "ADJUSTED" | "RESTRICTED";
}

export interface ActivityRecord {
  id: string;
  type: "listing" | "match" | "grid" | "transaction" | "prediction" | "alert";
  title: string;
  detail: string;
  occurredAt: Date;
  status: "positive" | "neutral" | "warning";
}

export interface EnergyRecord {
  timestamp: Date;
  generationKwh: number;
  consumptionKwh: number;
  marketableSurplusKwh: number;
}

const demoUserId = "8f6a2b30-1d0c-4d74-8d68-3b7d2b09c2a1";
const now = Date.now();
const hoursAgo = (hours: number) => new Date(now - hours * 60 * 60 * 1000);

const solarSystems: SolarSystemRecord[] = [
  {
    id: "a20d1b71-3be9-4f30-8c7d-2bcfbf8c2b31",
    ownerId: demoUserId,
    name: "Mehta Residence",
    capacityKw: 8.4,
    location: "Indiranagar, Bengaluru",
    status: "online",
    todayGenerationKwh: 31.8,
    todayConsumptionKwh: 18.6,
  },
  {
    id: "d3b160d5-9cc9-48c7-a49f-1d810402a8d2",
    ownerId: demoUserId,
    name: "Studio Rooftop",
    capacityKw: 4.8,
    location: "Koramangala, Bengaluru",
    status: "online",
    todayGenerationKwh: 18.4,
    todayConsumptionKwh: 12.1,
  },
  {
    id: "5c0d7d9e-96c8-41ee-bb62-44a14b30d97b",
    ownerId: demoUserId,
    name: "East Block Microgrid",
    capacityKw: 12,
    location: "Whitefield, Bengaluru",
    status: "standby",
    todayGenerationKwh: 44.2,
    todayConsumptionKwh: 35.7,
  },
];

const listingTimes = {
  from: new Date(now + 30 * 60 * 1000),
  until: new Date(now + 4 * 60 * 60 * 1000),
};

const listings: ListingRecord[] = [
  {
    id: "1e13bca6-0d08-4ca4-8d42-56f35bc2a7dd",
    sellerId: demoUserId,
    sellerName: "Mehta Residence",
    location: "Indiranagar",
    quantityKwh: 12.4,
    priceInrPerKwh: 6.85,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 94,
    gridDecision: "APPROVED",
  },
  {
    id: "b4d7d7fa-589b-4e18-9abf-4c927c5b3c79",
    sellerId: "d4a4d9b8-d4aa-4d2d-8a66-30a0c3c70e98",
    sellerName: "Rao Solar Co-op",
    location: "HSR Layout",
    quantityKwh: 28.6,
    priceInrPerKwh: 7.1,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 87,
    gridDecision: "APPROVED",
  },
  {
    id: "d2b565cb-0bfc-4f0d-9b9f-0d07d4b3a972",
    sellerId: "5144be7c-56ae-4c3f-8dc1-8f560a7f0f50",
    sellerName: "Whitefield Commons",
    location: "Whitefield",
    quantityKwh: 9.2,
    priceInrPerKwh: 6.5,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 78,
    gridDecision: "ADJUSTED",
  },
];

const energy: EnergyRecord[] = Array.from({ length: 12 }, (_, index) => {
  const generation = 26 + Math.sin(index / 2) * 13 + (index > 7 ? 5 : 0);
  const consumption = 15 + Math.cos(index / 2) * 4;
  const surplus = calculateSurplus(generation.toFixed(4), consumption.toFixed(4));
  return {
    timestamp: hoursAgo(11 - index),
    generationKwh: Number(generation.toFixed(2)),
    consumptionKwh: Number(consumption.toFixed(2)),
    marketableSurplusKwh: Number(surplus.marketableSurplusKwh),
  };
});

const activity: ActivityRecord[] = [
  {
    id: "activity-1",
    type: "match",
    title: "Smart Buy found a nearby fit",
    detail: "12.4 kWh from Mehta Residence matches your evening demand profile.",
    occurredAt: hoursAgo(0.25),
    status: "positive",
  },
  {
    id: "activity-2",
    type: "grid",
    title: "Grid window adjusted",
    detail: "Whitefield congestion moved to 62%; trading remains open with limits.",
    occurredAt: hoursAgo(1.1),
    status: "warning",
  },
  {
    id: "activity-3",
    type: "listing",
    title: "New local supply listed",
    detail: "Rao Solar Co-op listed 28.6 kWh for the next four hours.",
    occurredAt: hoursAgo(1.8),
    status: "positive",
  },
  {
    id: "activity-4",
    type: "prediction",
    title: "Demand prediction refreshed",
    detail: "Tomorrow morning demand is expected to peak at 08:30.",
    occurredAt: hoursAgo(3.4),
    status: "neutral",
  },
  {
    id: "activity-5",
    type: "transaction",
    title: "Settlement ledger verified",
    detail: "SHA-256 record confirmed for yesterday’s 18.2 kWh trade.",
    occurredAt: hoursAgo(5.2),
    status: "positive",
  },
];

const gridInputs = {
  congestionPercent: 62,
  renewableSharePercent: 71,
  frequencyHz: 49.98,
};

export const demoStore = {
  demoUserId,
  solarSystems,
  listings,
  activity,
  energy,
  gridInputs,
  get gridDecision() {
    return decideGrid(gridInputs);
  },
  get gridLabel() {
    return gridDecisionLabel(this.gridDecision);
  },
  addSolarSystem(input: {
    name: string;
    capacityKw: number;
    location: string;
  }) {
    const record: SolarSystemRecord = {
      id: randomUUID(),
      ownerId: demoUserId,
      ...input,
      status: "online",
      todayGenerationKwh: 0,
      todayConsumptionKwh: 0,
    };
    this.solarSystems.unshift(record);
    return record;
  },
  addListing(input: {
    solarSystemId: string;
    quantityKwh: number;
    priceInrPerKwh: number;
    availableFrom: Date;
    availableUntil: Date;
  }) {
    const system = this.solarSystems.find(
      (candidate) => candidate.id === input.solarSystemId,
    );
    if (!system || system.ownerId !== demoUserId) {
      throw new Error("Solar system is not owned by the current user");
    }
    const listing: ListingRecord = {
      id: randomUUID(),
      sellerId: demoUserId,
      sellerName: system.name,
      location: system.location,
      quantityKwh: input.quantityKwh,
      priceInrPerKwh: input.priceInrPerKwh,
      status: "active",
      availableFrom: input.availableFrom,
      availableUntil: input.availableUntil,
      matchScore: 92,
      gridDecision: this.gridDecision,
    };
    this.listings.unshift(listing);
    this.activity.unshift({
      id: randomUUID(),
      type: "listing",
      title: "New surplus listing published",
      detail: `${listing.quantityKwh} kWh is now visible to nearby buyers.`,
      occurredAt: new Date(),
      status: "positive",
    });
    return listing;
  },
};

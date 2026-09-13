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
    sellerName: "Mehta Residence Solar",
    location: "Indiranagar, KA_BLR_01",
    quantityKwh: 14.5,
    priceInrPerKwh: 6.85,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 96,
    gridDecision: "APPROVED",
  },
  {
    id: "b4d7d7fa-589b-4e18-9abf-4c927c5b3c79",
    sellerId: "d4a4d9b8-d4aa-4d2d-8a66-30a0c3c70e98",
    sellerName: "Rao Solar Co-op",
    location: "HSR Layout, KA_BLR_01",
    quantityKwh: 32.0,
    priceInrPerKwh: 7.10,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 89,
    gridDecision: "APPROVED",
  },
  {
    id: "d2b565cb-0bfc-4f0d-9b9f-0d07d4b3a972",
    sellerId: "5144be7c-56ae-4c3f-8dc1-8f560a7f0f50",
    sellerName: "Whitefield Commons Array",
    location: "Whitefield Substation Zone",
    quantityKwh: 18.5,
    priceInrPerKwh: 6.50,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 82,
    gridDecision: "ADJUSTED",
  },
  {
    id: "e5f6a7b8-1234-4567-8901-234567890abc",
    sellerId: "7e5b1a20-0c9b-3c63-7c57-2a6c1a08b190",
    sellerName: "Priya Sharma Solar Farm",
    location: "Koramangala 4th Block",
    quantityKwh: 45.0,
    priceInrPerKwh: 6.95,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 94,
    gridDecision: "APPROVED",
  },
  {
    id: "f6a7b8c9-2345-5678-9012-34567890abcd",
    sellerId: "89012345-abcd-ef01-2345-67890abcdef0",
    sellerName: "Bellandur Green Tech Park",
    location: "Bellandur Outer Ring Road",
    quantityKwh: 75.0,
    priceInrPerKwh: 7.40,
    status: "active",
    availableFrom: listingTimes.from,
    availableUntil: listingTimes.until,
    matchScore: 91,
    gridDecision: "APPROVED",
  },
];

const energy: EnergyRecord[] = Array.from({ length: 12 }, (_, index) => {
  const generation = 28 + Math.sin(index / 2) * 15 + (index > 7 ? 6 : 0);
  const consumption = 14 + Math.cos(index / 2) * 3;
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
    title: "AI P2P Match Executed",
    detail: "14.5 kWh from Mehta Residence matched with Rohit Verma at ₹6.85/kWh.",
    occurredAt: hoursAgo(0.1),
    status: "positive",
  },
  {
    id: "activity-2",
    type: "grid",
    title: "Grid Congestion Shield Active",
    detail: "Substation KA_BLR_01 congestion stable at 38%. Transmission losses 2.1%.",
    occurredAt: hoursAgo(0.4),
    status: "positive",
  },
  {
    id: "activity-3",
    type: "listing",
    title: "Commercial Surplus Listed",
    detail: "Bellandur Green Tech Park published 75.0 kWh surplus available for 4h.",
    occurredAt: hoursAgo(0.8),
    status: "positive",
  },
  {
    id: "activity-4",
    type: "transaction",
    title: "UPI Settlement Committed",
    detail: "Txn #tx-9941 committed to ledger with SHA-256 hash e3b0c44298fc1c14...",
    occurredAt: hoursAgo(1.5),
    status: "positive",
  },
  {
    id: "activity-5",
    type: "prediction",
    title: "Solar Forecast Updated",
    detail: "Peak afternoon generation projected at +18.4% above seasonal baseline.",
    occurredAt: hoursAgo(2.1),
    status: "neutral",
  },
  {
    id: "activity-6",
    type: "grid",
    title: "DISCOM Voltage Stabilized",
    detail: "Frequency held at 49.98 Hz. Grid constraint status: APPROVED.",
    occurredAt: hoursAgo(3.0),
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

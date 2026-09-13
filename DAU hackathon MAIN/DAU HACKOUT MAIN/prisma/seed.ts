import { PrismaClient, UserRole, SolarSystemStatus, ListingStatus, DemandStatus, TradeStatus, TransactionStatus, GridDecision } from "@prisma/client";
import crypto from "node:crypto";

const prisma = new PrismaClient();

function generateSha256Hash(payload: string): string {
  return crypto.createHash("sha256").update(payload).digest("hex");
}

async function main() {
  console.log("Seeding GridTrade PostgreSQL database...");

  // 1. Clean existing records in reverse dependency order
  await prisma.auditLog.deleteMany();
  await prisma.aiPrediction.deleteMany();
  await prisma.gridData.deleteMany();
  await prisma.hashRecord.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.demand.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.energyData.deleteMany();
  await prisma.solarSystem.deleteMany();
  await prisma.user.deleteMany();

  // 2. Create Users
  const prosumer1 = await prisma.user.create({
    data: {
      id: "8f6a2b30-1d0c-4d74-8d68-3b7d2b09c2a1",
      email: "aarav.mehta@gridtrade.example",
      displayName: "Aarav Mehta",
      role: UserRole.PROSUMER,
    },
  });

  const prosumer2 = await prisma.user.create({
    data: {
      id: "7e5b1a20-0c9b-3c63-7c57-2a6c1a08b190",
      email: "priya.sharma@gridtrade.example",
      displayName: "Priya Sharma",
      role: UserRole.PROSUMER,
    },
  });

  const consumer1 = await prisma.user.create({
    data: {
      id: "6d4a0f10-9b8a-2b52-6b46-1a5b0f97a089",
      email: "rohit.verma@gridtrade.example",
      displayName: "Rohit Verma",
      role: UserRole.CONSUMER,
    },
  });

  const utility1 = await prisma.user.create({
    data: {
      id: "5c3e9e00-8a7f-1a41-5a35-0f4a9e869f78",
      email: "gridops@stateutility.example",
      displayName: "State Grid Control",
      role: UserRole.UTILITY,
    },
  });

  const admin1 = await prisma.user.create({
    data: {
      id: "4b2d8d90-7f6e-0f30-4924-0e398d758e67",
      email: "admin@gridtrade.example",
      displayName: "Platform Admin",
      role: UserRole.ADMIN,
    },
  });

  // 3. Create Solar Systems
  const solar1 = await prisma.solarSystem.create({
    data: {
      id: "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      ownerId: prosumer1.id,
      name: "Mehta Rooftop Array 10kW",
      capacityKw: 10.0,
      location: "Sector 62, Noida, UP",
      status: SolarSystemStatus.online,
    },
  });

  const solar2 = await prisma.solarSystem.create({
    data: {
      id: "b2c3d4e5-f6a7-5b6c-9d0e-1f2a3b4c5d6e",
      ownerId: prosumer2.id,
      name: "Sharma Micro-Grid 25kW",
      capacityKw: 25.0,
      location: "Indirapuram, Ghaziabad, UP",
      status: SolarSystemStatus.online,
    },
  });

  // 4. Energy Readings (Scenario A: Sunny Surplus)
  const now = new Date();
  await prisma.energyData.createMany({
    data: [
      {
        solarSystemId: solar1.id,
        observedAt: new Date(now.getTime() - 3600 * 1000 * 3),
        generationKwh: 8.5,
        consumptionKwh: 2.1,
        marketableSurplusKwh: 6.4,
        source: "meter_telemetry",
      },
      {
        solarSystemId: solar1.id,
        observedAt: new Date(now.getTime() - 3600 * 1000 * 2),
        generationKwh: 9.2,
        consumptionKwh: 1.8,
        marketableSurplusKwh: 7.4,
        source: "meter_telemetry",
      },
      {
        solarSystemId: solar2.id,
        observedAt: new Date(now.getTime() - 3600 * 1000 * 2),
        generationKwh: 22.0,
        consumptionKwh: 5.5,
        marketableSurplusKwh: 16.5,
        source: "meter_telemetry",
      },
    ],
  });

  // 5. Grid Snapshots (Scenarios C & D)
  const healthyGrid = await prisma.gridData.create({
    data: {
      region: "NCR-NORTH",
      observedAt: new Date(now.getTime() - 1800 * 1000),
      congestionPercent: 24.5,
      renewableSharePercent: 68.2,
      frequencyHz: 50.02,
      decision: GridDecision.APPROVED,
    },
  });

  const congestedGrid = await prisma.gridData.create({
    data: {
      region: "NCR-WEST-TRANSIT",
      observedAt: new Date(now.getTime() - 600 * 1000),
      congestionPercent: 82.4,
      renewableSharePercent: 41.0,
      frequencyHz: 49.85,
      decision: GridDecision.RESTRICTED,
    },
  });

  // 6. Listings (Scenario A: Sunny surplus listings)
  const listing1 = await prisma.listing.create({
    data: {
      sellerId: prosumer1.id,
      solarSystemId: solar1.id,
      quantityKwh: 14.5,
      allocatedKwh: 0.0,
      priceInrPerKwh: 4.8,
      availableFrom: now,
      availableUntil: new Date(now.getTime() + 3600 * 1000 * 4),
      status: ListingStatus.ACTIVE,
      gridDecision: GridDecision.APPROVED,
    },
  });

  const listing2 = await prisma.listing.create({
    data: {
      sellerId: prosumer2.id,
      solarSystemId: solar2.id,
      quantityKwh: 30.0,
      allocatedKwh: 0.0,
      priceInrPerKwh: 4.5,
      availableFrom: now,
      availableUntil: new Date(now.getTime() + 3600 * 1000 * 6),
      status: ListingStatus.ACTIVE,
      gridDecision: GridDecision.APPROVED,
    },
  });

  // Scenario C: Congested / Restricted Listing
  const listingRestricted = await prisma.listing.create({
    data: {
      sellerId: prosumer2.id,
      solarSystemId: solar2.id,
      quantityKwh: 20.0,
      allocatedKwh: 0.0,
      priceInrPerKwh: 4.2,
      availableFrom: now,
      availableUntil: new Date(now.getTime() + 3600 * 1000 * 2),
      status: ListingStatus.CLOSED,
      gridDecision: GridDecision.RESTRICTED,
    },
  });

  // 7. Demands (Scenario B: High Consumer Demand)
  const demand1 = await prisma.demand.create({
    data: {
      buyerId: consumer1.id,
      quantityKwh: 12.0,
      allocatedKwh: 0.0,
      maxPriceInrPerKwh: 5.2,
      availableFrom: now,
      availableUntil: new Date(now.getTime() + 3600 * 1000 * 5),
      status: DemandStatus.OPEN,
    },
  });

  // 8. Sample Trades & Transactions (Deterministic SHA-256 Hash Chain)
  const genesisPrevHash = "0000000000000000000000000000000000000000000000000000000000000000";

  const trade1 = await prisma.trade.create({
    data: {
      listingId: listing1.id,
      buyerId: consumer1.id,
      quantityKwh: 10.0,
      agreedPriceInrPerKwh: 7.2,
      gridDecision: GridDecision.APPROVED,
      gridReasonCode: "GRID_HEALTHY",
      wheelingFeeInr: 1.44,
      netAmountInr: 73.44,
      status: TradeStatus.CONFIRMED,
    },
  });

  const amountInr = 73.44;
  const tx1 = await prisma.transaction.create({
    data: {
      tradeId: trade1.id,
      amountInr,
      status: TransactionStatus.confirmed,
      settledAt: now,
    },
  });

  await prisma.payment.create({
    data: {
      transactionId: tx1.id,
      provider: "prototype_upi",
      providerReference: "UPI-GT-987654321",
      paymentMethod: "prototype_upi",
      idempotencyKey: "idem-seed-tx1",
      amountInr,
      status: PaymentStatus.PAID,
      paidAt: now,
      metadata: { simulated: true },
    },
  });

  const canonicalPayload0 = JSON.stringify({
    agreedPriceInrPerKwh: "7.2000",
    amountInr: "72.0000",
    blockIndex: 0,
    buyerId: consumer1.id,
    netAmountInr: "73.4400",
    previousHash: genesisPrevHash,
    quantityKwh: "10.0000",
    sellerId: prosumer1.id,
    settledAt: now.toISOString(),
    tradeId: trade1.id,
    transactionId: tx1.id,
    wheelingFeeInr: "1.4400",
  });
  const hash0 = generateSha256Hash(canonicalPayload0);

  await prisma.hashRecord.create({
    data: {
      transactionId: tx1.id,
      blockIndex: 0,
      algorithm: "SHA-256",
      previousHash: genesisPrevHash,
      hash: hash0,
      payloadCanonical: canonicalPayload0,
    },
  });

  // 9. AI Predictions
  await prisma.aiPrediction.createMany({
    data: [
      {
        gridDataId: healthyGrid.id,
        predictionType: "generation",
        horizon: "24h",
        payload: { projectedPeakKwh: 34.2, solarIrradianceIndex: 0.92 },
        confidence: 0.9450,
      },
      {
        gridDataId: congestedGrid.id,
        predictionType: "anomaly",
        horizon: "1h",
        payload: { anomalyDetected: true, riskScore: 0.88, bottleneckSubstation: "Sub-4" },
        confidence: 0.8920,
      },
    ],
  });

  // 10. Audit Logs
  await prisma.auditLog.createMany({
    data: [
      {
        actorId: prosumer1.id,
        action: "CREATE_LISTING",
        entityType: "Listing",
        entityId: listing1.id,
        metadata: { quantityKwh: 14.5, priceInrPerKwh: 4.8 },
      },
      {
        actorId: utility1.id,
        action: "RESTRICT_GRID_ZONE",
        entityType: "GridData",
        entityId: congestedGrid.id,
        metadata: { region: "NCR-WEST-TRANSIT", congestionPercent: 82.4 },
      },
    ],
  });

  console.log("Database successfully seeded with Scenarios A, B, C, D!");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

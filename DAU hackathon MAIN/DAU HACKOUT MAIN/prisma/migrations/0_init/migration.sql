-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('PROSUMER', 'CONSUMER', 'UTILITY', 'REGULATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "SolarSystemStatus" AS ENUM ('online', 'standby', 'offline');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('active', 'matched', 'closed', 'restricted');

-- CreateEnum
CREATE TYPE "DemandStatus" AS ENUM ('active', 'matched', 'closed', 'restricted');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('proposed', 'confirmed', 'settled', 'cancelled');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'confirmed', 'failed');

-- CreateEnum
CREATE TYPE "GridDecision" AS ENUM ('APPROVED', 'ADJUSTED', 'RESTRICTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "clerkId" TEXT,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'PROSUMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "solar_systems" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacityKw" DECIMAL(12,3) NOT NULL,
    "location" TEXT NOT NULL,
    "status" "SolarSystemStatus" NOT NULL DEFAULT 'online',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "solar_systems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "energy_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "solarSystemId" UUID NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "generationKwh" DECIMAL(14,4) NOT NULL,
    "consumptionKwh" DECIMAL(14,4) NOT NULL,
    "marketableSurplusKwh" DECIMAL(14,4) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'prototype',

    CONSTRAINT "energy_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "listings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "sellerId" UUID NOT NULL,
    "solarSystemId" UUID NOT NULL,
    "quantityKwh" DECIMAL(14,4) NOT NULL,
    "priceInrPerKwh" DECIMAL(12,4) NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3) NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'active',
    "gridDecision" "GridDecision" NOT NULL DEFAULT 'APPROVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "listings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demands" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "buyerId" UUID NOT NULL,
    "quantityKwh" DECIMAL(14,4) NOT NULL,
    "maxPriceInrPerKwh" DECIMAL(12,4) NOT NULL,
    "availableFrom" TIMESTAMP(3) NOT NULL,
    "availableUntil" TIMESTAMP(3) NOT NULL,
    "status" "DemandStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "demands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "listingId" UUID NOT NULL,
    "buyerId" UUID NOT NULL,
    "quantityKwh" DECIMAL(14,4) NOT NULL,
    "agreedPriceInrPerKwh" DECIMAL(12,4) NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'proposed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tradeId" UUID NOT NULL,
    "amountInr" DECIMAL(14,4) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'pending',
    "settledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionId" UUID NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'prototype',
    "providerReference" TEXT,
    "amountInr" DECIMAL(14,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hash_records" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transactionId" UUID NOT NULL,
    "algorithm" TEXT NOT NULL DEFAULT 'SHA-256',
    "hash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hash_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "grid_data" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "region" TEXT NOT NULL,
    "observedAt" TIMESTAMP(3) NOT NULL,
    "congestionPercent" DECIMAL(6,3) NOT NULL,
    "renewableSharePercent" DECIMAL(6,3) NOT NULL,
    "frequencyHz" DECIMAL(8,4) NOT NULL,
    "decision" "GridDecision" NOT NULL,

    CONSTRAINT "grid_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_predictions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "gridDataId" UUID,
    "predictionType" TEXT NOT NULL,
    "horizon" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "confidence" DECIMAL(6,4),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_predictions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" UUID,
    "requestId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerkId_key" ON "users"("clerkId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_email_idx" ON "users"("email");
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "solar_systems_ownerId_idx" ON "solar_systems"("ownerId");

-- CreateIndex
CREATE INDEX "energy_data_solarSystemId_observedAt_idx" ON "energy_data"("solarSystemId", "observedAt");

-- CreateIndex
CREATE INDEX "listings_status_idx" ON "listings"("status");
CREATE INDEX "listings_sellerId_idx" ON "listings"("sellerId");
CREATE INDEX "listings_solarSystemId_idx" ON "listings"("solarSystemId");
CREATE INDEX "listings_availableFrom_availableUntil_idx" ON "listings"("availableFrom", "availableUntil");

-- CreateIndex
CREATE INDEX "demands_status_idx" ON "demands"("status");
CREATE INDEX "demands_buyerId_idx" ON "demands"("buyerId");
CREATE INDEX "demands_availableFrom_availableUntil_idx" ON "demands"("availableFrom", "availableUntil");

-- CreateIndex
CREATE INDEX "trades_listingId_idx" ON "trades"("listingId");
CREATE INDEX "trades_buyerId_idx" ON "trades"("buyerId");
CREATE INDEX "trades_createdAt_idx" ON "trades"("createdAt");

-- CreateIndex
CREATE INDEX "transactions_tradeId_idx" ON "transactions"("tradeId");
CREATE INDEX "transactions_createdAt_idx" ON "transactions"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payments_transactionId_key" ON "payments"("transactionId");

-- CreateIndex
CREATE UNIQUE INDEX "hash_records_transactionId_key" ON "hash_records"("transactionId");
CREATE UNIQUE INDEX "hash_records_hash_key" ON "hash_records"("hash");

-- CreateIndex
CREATE INDEX "grid_data_region_observedAt_idx" ON "grid_data"("region", "observedAt");

-- CreateIndex
CREATE INDEX "ai_predictions_predictionType_createdAt_idx" ON "ai_predictions"("predictionType", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");
CREATE INDEX "audit_logs_entityType_idx" ON "audit_logs"("entityType");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "solar_systems" ADD CONSTRAINT "solar_systems_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "energy_data" ADD CONSTRAINT "energy_data_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "solar_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "listings" ADD CONSTRAINT "listings_solarSystemId_fkey" FOREIGN KEY ("solarSystemId") REFERENCES "solar_systems"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demands" ADD CONSTRAINT "demands_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "listings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_buyerId_fkey" FOREIGN KEY ("buyerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hash_records" ADD CONSTRAINT "hash_records_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_predictions" ADD CONSTRAINT "ai_predictions_gridDataId_fkey" FOREIGN KEY ("gridDataId") REFERENCES "grid_data"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

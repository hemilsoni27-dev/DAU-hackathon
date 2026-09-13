-- The development database is provisioned through the workspace DB package.
-- This migration mirrors the portable Prisma contract for deployments that
-- adopt Prisma migrations in a later service boundary.
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TYPE "UserRole" AS ENUM ('PROSUMER', 'CONSUMER', 'UTILITY', 'REGULATOR', 'ADMIN');
CREATE TYPE "SolarSystemStatus" AS ENUM ('online', 'standby', 'offline');
CREATE TYPE "ListingStatus" AS ENUM ('active', 'matched', 'closed', 'restricted');
CREATE TYPE "TradeStatus" AS ENUM ('proposed', 'confirmed', 'settled', 'cancelled');
CREATE TYPE "TransactionStatus" AS ENUM ('pending', 'confirmed', 'failed');
CREATE TYPE "GridDecision" AS ENUM ('APPROVED', 'ADJUSTED', 'RESTRICTED');

-- Schema ownership and table creation are intentionally kept in Drizzle for
-- the current workspace runtime. This file is a portable handoff boundary.
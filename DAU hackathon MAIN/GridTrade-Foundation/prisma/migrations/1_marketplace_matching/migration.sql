-- AlterEnum
ALTER TYPE "ListingStatus" RENAME TO "ListingStatus_old";
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'PARTIALLY_MATCHED', 'FULLY_MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "listings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "listings" ALTER COLUMN "status" TYPE "ListingStatus" USING (
  CASE "status"::text
    WHEN 'active' THEN 'ACTIVE'::"ListingStatus"
    WHEN 'matched' THEN 'FULLY_MATCHED'::"ListingStatus"
    WHEN 'closed' THEN 'CLOSED'::"ListingStatus"
    WHEN 'restricted' THEN 'CLOSED'::"ListingStatus"
    ELSE 'ACTIVE'::"ListingStatus"
  END
);
ALTER TABLE "listings" ALTER COLUMN "status" SET DEFAULT 'ACTIVE';
DROP TYPE "ListingStatus_old";

-- AlterEnum
ALTER TYPE "DemandStatus" RENAME TO "DemandStatus_old";
CREATE TYPE "DemandStatus" AS ENUM ('OPEN', 'PARTIALLY_MATCHED', 'FULLY_MATCHED', 'CLOSED', 'CANCELLED', 'EXPIRED');
ALTER TABLE "demands" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "demands" ALTER COLUMN "status" TYPE "DemandStatus" USING (
  CASE "status"::text
    WHEN 'active' THEN 'OPEN'::"DemandStatus"
    WHEN 'matched' THEN 'FULLY_MATCHED'::"DemandStatus"
    WHEN 'closed' THEN 'CLOSED'::"DemandStatus"
    WHEN 'restricted' THEN 'CLOSED'::"DemandStatus"
    ELSE 'OPEN'::"DemandStatus"
  END
);
ALTER TABLE "demands" ALTER COLUMN "status" SET DEFAULT 'OPEN';
DROP TYPE "DemandStatus_old";

-- AlterTable
ALTER TABLE "listings" ADD COLUMN "allocatedKwh" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "demands" ADD COLUMN "allocatedKwh" DECIMAL(14,4) NOT NULL DEFAULT 0;

-- Fix column names to match Prisma camelCase convention (same as company_brand_configs, etc.)

-- ad_automation_defaults
ALTER TABLE "ad_automation_defaults" RENAME COLUMN "company_id" TO "companyId";
ALTER TABLE "ad_automation_defaults" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ad_automation_defaults" RENAME COLUMN "updated_at" TO "updatedAt";

DROP INDEX IF EXISTS "ad_automation_defaults_company_id_key";
CREATE UNIQUE INDEX IF NOT EXISTS "ad_automation_defaults_companyId_key"
  ON "ad_automation_defaults"("companyId");

ALTER TABLE "ad_automation_defaults" DROP CONSTRAINT IF EXISTS "ad_automation_defaults_company_id_fkey";
ALTER TABLE "ad_automation_defaults"
  ADD CONSTRAINT "ad_automation_defaults_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ad_automations
ALTER TABLE "ad_automations" RENAME COLUMN "company_id" TO "companyId";
ALTER TABLE "ad_automations" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ad_automations" RENAME COLUMN "updated_at" TO "updatedAt";

DROP INDEX IF EXISTS "ad_automations_company_id_idx";
DROP INDEX IF EXISTS "ad_automations_company_id_status_idx";
DROP INDEX IF EXISTS "ad_automations_created_at_idx";

CREATE INDEX IF NOT EXISTS "ad_automations_companyId_idx"
  ON "ad_automations"("companyId");
CREATE INDEX IF NOT EXISTS "ad_automations_companyId_status_idx"
  ON "ad_automations"("companyId", "status");
CREATE INDEX IF NOT EXISTS "ad_automations_createdAt_idx"
  ON "ad_automations"("createdAt" DESC);

ALTER TABLE "ad_automations" DROP CONSTRAINT IF EXISTS "ad_automations_company_id_fkey";
ALTER TABLE "ad_automations"
  ADD CONSTRAINT "ad_automations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ad_variants
ALTER TABLE "ad_variants" RENAME COLUMN "created_at" TO "createdAt";

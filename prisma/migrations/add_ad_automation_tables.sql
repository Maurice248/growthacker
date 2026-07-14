-- Ad automation defaults (per-company)
CREATE TABLE IF NOT EXISTS "ad_automation_defaults" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "num_variants" INTEGER NOT NULL DEFAULT 3,
  "eval_length_days" INTEGER NOT NULL DEFAULT 7,
  "daily_budget_cents" INTEGER NOT NULL DEFAULT 100,
  "winner_metric" TEXT NOT NULL DEFAULT 'objective_aware',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_automation_defaults_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ad_automation_defaults_companyId_key"
  ON "ad_automation_defaults"("companyId");

ALTER TABLE "ad_automation_defaults"
  DROP CONSTRAINT IF EXISTS "ad_automation_defaults_companyId_fkey";
ALTER TABLE "ad_automation_defaults"
  ADD CONSTRAINT "ad_automation_defaults_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ad automation loops (one per launched ad set)
CREATE TABLE IF NOT EXISTS "ad_automations" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "meta_campaign_id" TEXT,
  "meta_ad_set_id" TEXT,
  "base_ad_media_url" TEXT NOT NULL,
  "base_concept" JSONB NOT NULL DEFAULT '{}',
  "num_variants" INTEGER NOT NULL DEFAULT 3,
  "eval_length_days" INTEGER NOT NULL DEFAULT 7,
  "daily_budget_cents" INTEGER NOT NULL DEFAULT 100,
  "automation_enabled" BOOLEAN NOT NULL DEFAULT false,
  "status" TEXT NOT NULL DEFAULT 'generating',
  "generation" INTEGER NOT NULL DEFAULT 1,
  "next_evaluation_at" TIMESTAMP(3),
  "launch_schema" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_automations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ad_automations_companyId_idx"
  ON "ad_automations"("companyId");
CREATE INDEX IF NOT EXISTS "ad_automations_companyId_status_idx"
  ON "ad_automations"("companyId", "status");
CREATE INDEX IF NOT EXISTS "ad_automations_status_next_evaluation_at_idx"
  ON "ad_automations"("status", "next_evaluation_at");
CREATE INDEX IF NOT EXISTS "ad_automations_createdAt_idx"
  ON "ad_automations"("createdAt" DESC);

ALTER TABLE "ad_automations"
  DROP CONSTRAINT IF EXISTS "ad_automations_companyId_fkey";
ALTER TABLE "ad_automations"
  ADD CONSTRAINT "ad_automations_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Ad variants within an automation loop
CREATE TABLE IF NOT EXISTS "ad_variants" (
  "id" TEXT NOT NULL,
  "automation_id" TEXT NOT NULL,
  "generation" INTEGER NOT NULL DEFAULT 1,
  "meta_ad_id" TEXT,
  "media_url" TEXT NOT NULL,
  "format" TEXT NOT NULL,
  "concept" JSONB NOT NULL DEFAULT '{}',
  "metrics" JSONB,
  "role" TEXT NOT NULL DEFAULT 'challenger',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ad_variants_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ad_variants_automation_id_idx"
  ON "ad_variants"("automation_id");
CREATE INDEX IF NOT EXISTS "ad_variants_automation_id_generation_idx"
  ON "ad_variants"("automation_id", "generation");
CREATE INDEX IF NOT EXISTS "ad_variants_automation_id_role_idx"
  ON "ad_variants"("automation_id", "role");

ALTER TABLE "ad_variants"
  DROP CONSTRAINT IF EXISTS "ad_variants_automation_id_fkey";
ALTER TABLE "ad_variants"
  ADD CONSTRAINT "ad_variants_automation_id_fkey"
  FOREIGN KEY ("automation_id") REFERENCES "ad_automations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

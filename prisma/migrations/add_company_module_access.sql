CREATE TABLE IF NOT EXISTS "company_module_access" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "meta_enabled" BOOLEAN NOT NULL DEFAULT true,
  "social_enabled" BOOLEAN NOT NULL DEFAULT true,
  "newsletter_enabled" BOOLEAN NOT NULL DEFAULT true,
  "outreach_enabled" BOOLEAN NOT NULL DEFAULT true,
  "blog_enabled" BOOLEAN NOT NULL DEFAULT true,
  "maintenance_message" TEXT NOT NULL DEFAULT 'This module is under maintenance. Please check back later.',
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "company_module_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "company_module_access_company_id_key"
  ON "company_module_access"("company_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_module_access_company_id_fkey'
  ) THEN
    ALTER TABLE "company_module_access"
      ADD CONSTRAINT "company_module_access_company_id_fkey"
      FOREIGN KEY ("company_id") REFERENCES "companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "company_module_access" (
  "id",
  "company_id",
  "meta_enabled",
  "social_enabled",
  "newsletter_enabled",
  "outreach_enabled",
  "blog_enabled",
  "maintenance_message",
  "updated_at"
)
SELECT
  'cma_' || c."id",
  c."id",
  true,
  true,
  true,
  true,
  true,
  'This module is under maintenance. Please check back later.',
  CURRENT_TIMESTAMP
FROM "companies" c
WHERE NOT EXISTS (
  SELECT 1 FROM "company_module_access" ma WHERE ma."company_id" = c."id"
);

DROP TABLE IF EXISTS "platform_module_settings";

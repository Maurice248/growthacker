ALTER TABLE "company_module_access"
  ADD COLUMN IF NOT EXISTS "cold_dm_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cold_call_enabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "cold_sms_enabled" BOOLEAN NOT NULL DEFAULT true;

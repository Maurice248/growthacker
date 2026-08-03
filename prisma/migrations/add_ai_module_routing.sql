-- Per-company AI routing: selected provider + vendor/model per module, plus gateway base URLs.
-- Gateway API keys stay in the encrypted "apiTokenSecretsEnc" blob.

ALTER TABLE company_integrations
  ADD COLUMN IF NOT EXISTS "aiRoutingConfig" JSONB;

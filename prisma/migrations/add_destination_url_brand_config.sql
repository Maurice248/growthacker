-- Add per-company Meta Ads destination URL to brand config
ALTER TABLE company_brand_configs
  ADD COLUMN IF NOT EXISTS destination_url TEXT NOT NULL DEFAULT '';

ALTER TABLE "company_brand_configs"
  ADD COLUMN IF NOT EXISTS "icp_social" TEXT NOT NULL DEFAULT '';

ALTER TABLE "company_brand_snapshots"
  ADD COLUMN IF NOT EXISTS "icp_social" TEXT NOT NULL DEFAULT '';

UPDATE "company_brand_configs"
SET
  "icp_social" = 'Canadian landlords and property managers active on Facebook, Instagram, LinkedIn, and TikTok — owners of 1-10 rental units who follow property management content, landlord communities, and real estate investing; seeking short-form educational posts about tenant screening, background checks, credit reports, and rental risk reduction'
WHERE "icp_social" = '';

UPDATE "company_brand_snapshots"
SET
  "icp_social" = 'Canadian landlords and property managers active on Facebook, Instagram, LinkedIn, and TikTok — owners of 1-10 rental units who follow property management content, landlord communities, and real estate investing; seeking short-form educational posts about tenant screening, background checks, credit reports, and rental risk reduction'
WHERE "icp_social" = '';

ALTER TABLE "company_brand_configs"
  ADD COLUMN IF NOT EXISTS "icp_cold_dm" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_cold_call" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_cold_sms" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_blog" TEXT NOT NULL DEFAULT '';

ALTER TABLE "company_brand_snapshots"
  ADD COLUMN IF NOT EXISTS "icp_cold_dm" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_cold_call" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_cold_sms" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "icp_blog" TEXT NOT NULL DEFAULT '';

UPDATE "company_brand_configs"
SET
  "icp_cold_dm" = 'Canadian landlords and property managers active on LinkedIn and Facebook — owners of 1-10 rental units who engage with property management content, landlord communities, and real estate investing groups; receptive to short personalized outreach about tenant screening and rent protection',
  "icp_cold_call" = 'Canadian landlords and property managers who are primary decision-makers for tenant screening — reachable by phone during business hours, managing 1-10 residential units, open to quick conversations about reducing rental risk and comparing screening solutions',
  "icp_cold_sms" = 'Canadian landlords and property managers with mobile-first communication preferences — small portfolio owners who respond to concise SMS about tenant applications, screening reminders, and affordable background check services',
  "icp_blog" = 'Canadian landlords and property managers researching tenant screening online — searching for background checks, credit reports, bad tenant prevention, and landlord rights; readers comparing screening platforms and seeking educational content on rental risk reduction'
WHERE "icp_cold_dm" = '' AND "icp_cold_call" = '' AND "icp_cold_sms" = '' AND "icp_blog" = '';

UPDATE "company_brand_snapshots"
SET
  "icp_cold_dm" = 'Canadian landlords and property managers active on LinkedIn and Facebook — owners of 1-10 rental units who engage with property management content, landlord communities, and real estate investing groups; receptive to short personalized outreach about tenant screening and rent protection',
  "icp_cold_call" = 'Canadian landlords and property managers who are primary decision-makers for tenant screening — reachable by phone during business hours, managing 1-10 residential units, open to quick conversations about reducing rental risk and comparing screening solutions',
  "icp_cold_sms" = 'Canadian landlords and property managers with mobile-first communication preferences — small portfolio owners who respond to concise SMS about tenant applications, screening reminders, and affordable background check services',
  "icp_blog" = 'Canadian landlords and property managers researching tenant screening online — searching for background checks, credit reports, bad tenant prevention, and landlord rights; readers comparing screening platforms and seeking educational content on rental risk reduction'
WHERE "icp_cold_dm" = '' AND "icp_cold_call" = '' AND "icp_cold_sms" = '' AND "icp_blog" = '';

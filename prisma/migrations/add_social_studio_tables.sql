-- Social Studio native pipeline tables (Creator Studio migration off n8n)

CREATE TABLE IF NOT EXISTS social_studio_configs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  brand_about TEXT NOT NULL DEFAULT '',
  brand_mission TEXT NOT NULL DEFAULT '',
  brand_services TEXT NOT NULL DEFAULT '',
  brand_audience TEXT NOT NULL DEFAULT '',
  brand_website TEXT NOT NULL DEFAULT '',
  tone TEXT NOT NULL DEFAULT '',
  default_image_ratio TEXT NOT NULL DEFAULT '1:1',
  upload_post_user TEXT NOT NULL DEFAULT '',
  facebook_page_id TEXT NOT NULL DEFAULT '',
  linkedin_org_urn TEXT NOT NULL DEFAULT '',
  tiktok_handle TEXT NOT NULL DEFAULT '',
  enabled_platforms JSONB NOT NULL DEFAULT '["facebook","instagram","linkedin","tiktok"]'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS social_studio_jobs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  story TEXT,
  scenes JSONB,
  asset_url TEXT,
  descriptions JSONB,
  error TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS social_studio_jobs_company_id_idx ON social_studio_jobs("companyId");
CREATE INDEX IF NOT EXISTS social_studio_jobs_company_kind_idx ON social_studio_jobs("companyId", kind);
CREATE INDEX IF NOT EXISTS social_studio_jobs_created_at_idx ON social_studio_jobs("createdAt" DESC);

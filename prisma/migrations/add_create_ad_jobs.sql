-- Create Ad background jobs (server-side pipelines; survives tab/module navigation)

CREATE TABLE IF NOT EXISTS create_ad_jobs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  result JSONB,
  error TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS create_ad_jobs_company_id_idx ON create_ad_jobs("companyId");
CREATE INDEX IF NOT EXISTS create_ad_jobs_company_status_idx ON create_ad_jobs("companyId", status);
CREATE INDEX IF NOT EXISTS create_ad_jobs_created_at_idx ON create_ad_jobs("createdAt" DESC);

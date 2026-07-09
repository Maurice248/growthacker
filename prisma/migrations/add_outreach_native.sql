-- Cold Email native: outreach config, lead lists, leads + campaign columns

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS lead_list_id TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS instantly_campaign_id TEXT;

CREATE TABLE IF NOT EXISTS outreach_configs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  instantly_campaign_id TEXT NOT NULL DEFAULT '',
  sender_name TEXT NOT NULL DEFAULT '',
  default_cta_link TEXT NOT NULL DEFAULT '',
  cleanup_interval_days INTEGER NOT NULL DEFAULT 10,
  cleanup_batch_size INTEGER NOT NULL DEFAULT 100,
  daily_send_limit INTEGER NOT NULL DEFAULT 60,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS outreach_lead_lists (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", name)
);

CREATE INDEX IF NOT EXISTS outreach_lead_lists_companyId_idx ON outreach_lead_lists ("companyId");

CREATE TABLE IF NOT EXISTS outreach_leads (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  list_id TEXT NOT NULL REFERENCES outreach_lead_lists(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  mobile_number TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  email_status TEXT NOT NULL DEFAULT 'pending',
  is_catch_all BOOLEAN NOT NULL DEFAULT false,
  sent_status TEXT NOT NULL DEFAULT 'not_sent',
  source TEXT NOT NULL DEFAULT 'apify',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP(3),
  UNIQUE ("companyId", email)
);

CREATE INDEX IF NOT EXISTS outreach_leads_companyId_idx ON outreach_leads ("companyId");
CREATE INDEX IF NOT EXISTS outreach_leads_list_id_idx ON outreach_leads (list_id);
CREATE INDEX IF NOT EXISTS outreach_leads_companyId_sent_status_idx ON outreach_leads ("companyId", sent_status);
CREATE INDEX IF NOT EXISTS outreach_leads_companyId_email_sent_idx ON outreach_leads ("companyId", email_status, sent_status);

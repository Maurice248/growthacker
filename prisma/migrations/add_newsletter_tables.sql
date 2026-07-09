-- Newsletter native pipeline tables (migration off n8n)

CREATE TABLE IF NOT EXISTS newsletter_configs (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL UNIQUE REFERENCES companies(id) ON DELETE CASCADE,
  from_email TEXT NOT NULL DEFAULT '',
  from_name TEXT NOT NULL DEFAULT '',
  reply_to TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  logo_url TEXT NOT NULL DEFAULT '',
  address_line TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  unsubscribe_base_url TEXT NOT NULL DEFAULT '',
  send_hour INTEGER NOT NULL DEFAULT 10,
  send_minute INTEGER NOT NULL DEFAULT 30,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  active BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS newsletter_templates (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'newsletter',
  service TEXT NOT NULL DEFAULT '',
  topic TEXT NOT NULL DEFAULT '',
  subject_line TEXT NOT NULL DEFAULT '',
  preheader TEXT NOT NULL DEFAULT '',
  html TEXT NOT NULL DEFAULT '',
  structured_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS newsletter_templates_company_id_idx ON newsletter_templates("companyId");
CREATE INDEX IF NOT EXISTS newsletter_templates_created_at_idx ON newsletter_templates("createdAt" DESC);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  service_type TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'subscribed',
  email_status TEXT NOT NULL DEFAULT 'verified',
  unsubscribe_token TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("companyId", email)
);

CREATE INDEX IF NOT EXISTS newsletter_subscribers_company_id_idx ON newsletter_subscribers("companyId");
CREATE INDEX IF NOT EXISTS newsletter_subscribers_company_status_idx ON newsletter_subscribers("companyId", status, email_status);

CREATE TABLE IF NOT EXISTS newsletter_native_campaigns (
  id TEXT PRIMARY KEY,
  "companyId" TEXT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_id TEXT NOT NULL REFERENCES newsletter_templates(id) ON DELETE CASCADE,
  daily_limit INTEGER NOT NULL DEFAULT 50,
  audience_limit TEXT NOT NULL DEFAULT 'All Subscribers',
  status TEXT NOT NULL DEFAULT 'active',
  sent_count INTEGER NOT NULL DEFAULT 0,
  send_hour INTEGER NOT NULL DEFAULT 10,
  send_minute INTEGER NOT NULL DEFAULT 30,
  last_run_at TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS newsletter_native_campaigns_company_id_idx ON newsletter_native_campaigns("companyId");
CREATE INDEX IF NOT EXISTS newsletter_native_campaigns_company_status_idx ON newsletter_native_campaigns("companyId", status);
CREATE INDEX IF NOT EXISTS newsletter_native_campaigns_status_idx ON newsletter_native_campaigns(status);

CREATE TABLE IF NOT EXISTS newsletter_sends (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES newsletter_native_campaigns(id) ON DELETE CASCADE,
  subscriber_id TEXT NOT NULL REFERENCES newsletter_subscribers(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'sent',
  resend_id TEXT,
  sent_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (campaign_id, subscriber_id)
);

CREATE INDEX IF NOT EXISTS newsletter_sends_campaign_id_idx ON newsletter_sends(campaign_id);
CREATE INDEX IF NOT EXISTS newsletter_sends_subscriber_id_idx ON newsletter_sends(subscriber_id);

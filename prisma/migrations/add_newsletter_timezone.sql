-- Add timezone support for newsletter scheduling

ALTER TABLE newsletter_configs
  ADD COLUMN IF NOT EXISTS send_timezone TEXT NOT NULL DEFAULT 'UTC';

ALTER TABLE newsletter_native_campaigns
  ADD COLUMN IF NOT EXISTS send_timezone TEXT NOT NULL DEFAULT 'UTC';
